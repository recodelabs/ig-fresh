import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHighlighter, type Highlighter } from "shiki";
import type { Artifact, IgModel, PageNode } from "../model/types.js";
import { KIND_INFO } from "../model/types.js";
import { loadIgResource } from "../load/ig.js";
import { loadArtifacts } from "../load/artifacts.js";
import { loadExpansions } from "../load/expansions.js";
import { extractNarrative } from "../load/narrative.js";
import { renderPage, type Crumb } from "../render/shell.js";
import { LinkResolver } from "../render/links.js";
import { renderStructureDefinition, type RenderCtx } from "../render/structure-definition.js";
import { renderCodeSystem, renderValueSet } from "../render/terminology.js";
import { renderInstance } from "../render/instance.js";
import { renderQuestionnaire } from "../render/questionnaire.js";
import { renderArtifactsIndex } from "../render/artifacts-index.js";
import { renderNarrative, renderSearchPage } from "../render/page.js";
import { contentHash, fingerprintName } from "./fingerprint.js";
import type { AssetManifest } from "../model/types.js";

const PKG_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const MAX_HIGHLIGHT_BYTES = 220_000;

export interface BuildStats {
  pages: number;
  artifacts: number;
  copied: number;
  warnings: string[];
}

export async function buildSite(
  inputDir: string,
  outDir: string,
  opts: { verbose?: boolean; log?: (msg: string) => void } = {},
): Promise<BuildStats> {
  const log = opts.log ?? console.log;
  const warnings: string[] = [];
  const warn = (msg: string) => {
    warnings.push(msg);
    log(`  ⚠ ${msg}`);
  };

  // ---- load ---------------------------------------------------------------
  const { meta, pages, resources } = loadIgResource(inputDir);
  const artifacts = loadArtifacts(inputDir, resources, warn);
  const expansions = loadExpansions(inputDir, warn);
  const model: IgModel = { meta, pages, artifacts, menu: [] };
  const links = new LinkResolver(artifacts);
  log(`• ${meta.title} v${meta.version} — ${artifacts.length} artifacts, ${expansions.size} expansions`);

  fs.mkdirSync(outDir, { recursive: true });

  // ---- what we replace ------------------------------------------------------
  const replaced = new Set<string>(["artifacts.html", "ig-search.html"]);
  const collectPages = (ps: PageNode[]) => {
    for (const p of ps) {
      replaced.add(p.source);
      collectPages(p.children);
    }
  };
  collectPages(pages);
  for (const a of artifacts) replaced.add(a.filename);

  // ---- copy-through ---------------------------------------------------------
  let copied = 0;
  const copyDir = (from: string, to: string, top: boolean) => {
    for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
      const src = path.join(from, entry.name);
      const dst = path.join(to, entry.name);
      if (entry.isDirectory()) {
        fs.mkdirSync(dst, { recursive: true });
        copyDir(src, dst, false);
      } else {
        if (top && replaced.has(entry.name)) continue;
        fs.copyFileSync(src, dst);
        copied++;
      }
    }
  };
  copyDir(inputDir, outDir, true);
  log(`• copied ${copied} publisher files through`);

  // ---- assets ----------------------------------------------------------------
  model.assets = copyAssets(outDir);

  // ---- shiki -----------------------------------------------------------------
  const highlighter = await createHighlighter({
    themes: ["one-light", "one-dark-pro"],
    langs: ["json"],
  });

  // ---- artifact pages ----------------------------------------------------------
  const examplesByProfile = new Map<string, Artifact[]>();
  for (const a of artifacts) {
    for (const p of a.ref?.profiles ?? []) {
      if (!examplesByProfile.has(p)) examplesByProfile.set(p, []);
      examplesByProfile.get(p)!.push(a);
    }
  }

  let pageCount = 0;
  const write = (filename: string, html: string) => {
    fs.writeFileSync(path.join(outDir, filename), html);
    pageCount++;
  };

  for (const a of artifacts) {
    try {
      const ctx: RenderCtx = {
        model,
        links,
        expansions,
        jsonHtml: highlightJson(highlighter, a, warn),
        examplesOf: a.url ? (examplesByProfile.get(a.url) ?? []) : [],
      };
      const body =
        a.resourceType === "StructureDefinition"
          ? renderStructureDefinition(a, ctx)
          : a.resourceType === "CodeSystem"
            ? renderCodeSystem(a, ctx)
            : a.resourceType === "ValueSet"
              ? renderValueSet(a, ctx)
              : a.resourceType === "Questionnaire"
                ? renderQuestionnaire(a, ctx)
                : renderInstance(a, ctx);
      const crumbs: Crumb[] = [
        { label: "Home", href: "index.html" },
        { label: KIND_INFO[a.kind].plural, href: "artifacts.html" },
        { label: a.name },
      ];
      write(
        a.filename,
        renderPage(model, {
          filename: a.filename,
          title: a.title,
          breadcrumbs: crumbs,
          body,
          activeKind: a.kind,
        }),
      );
      if (opts.verbose) log(`  ✓ ${a.filename}`);
    } catch (e) {
      warn(`Failed to render ${a.filename}, emitting fallback: ${e}`);
      try {
        const fallback = renderInstance(a, { model, links, expansions, examplesOf: [] });
        write(
          a.filename,
          renderPage(model, {
            filename: a.filename,
            title: a.title,
            breadcrumbs: [{ label: "Home", href: "index.html" }, { label: a.name }],
            body: fallback,
            activeKind: a.kind,
          }),
        );
      } catch (e2) {
        warn(`Fallback also failed for ${a.filename}: ${e2}`);
      }
    }
  }

  // ---- narrative pages ------------------------------------------------------------
  const renderNarrativePage = (p: PageNode, crumbs: Crumb[]) => {
    const src = path.join(inputDir, p.source);
    if (!fs.existsSync(src)) {
      warn(`Narrative page missing in publisher output: ${p.source}`);
      return;
    }
    const { bodyHtml } = extractNarrative(fs.readFileSync(src, "utf8"));
    write(
      p.source,
      renderPage(model, {
        filename: p.source,
        title: p.title,
        breadcrumbs: p.source === "index.html" ? [] : [...crumbs, { label: p.title }],
        body: renderNarrative(bodyHtml),
      }),
    );
    for (const c of p.children) renderNarrativePage(c, [...crumbs, { label: p.title, href: p.source }]);
  };
  for (const p of pages) renderNarrativePage(p, [{ label: "Home", href: "index.html" }]);

  // ---- artifacts index + search page -------------------------------------------------
  write(
    "artifacts.html",
    renderPage(model, {
      filename: "artifacts.html",
      title: "Artifacts",
      breadcrumbs: [{ label: "Home", href: "index.html" }, { label: "Artifacts" }],
      body: renderArtifactsIndex(model),
    }),
  );
  write(
    "ig-search.html",
    renderPage(model, {
      filename: "ig-search.html",
      title: "Search",
      breadcrumbs: [{ label: "Home", href: "index.html" }, { label: "Search" }],
      body: renderSearchPage(),
    }),
  );

  // ---- palette search index ------------------------------------------------------------
  const items = [
    ...artifacts.map((a) => ({
      title: a.title,
      id: a.id,
      kind: a.kind,
      href: a.filename,
      desc: (a.description ?? "").slice(0, 140),
    })),
    ...flattenPages(pages).map((p) => ({
      title: p.title,
      id: p.source,
      kind: "page",
      href: p.source,
      desc: "",
    })),
    { title: "Artifacts", id: "artifacts.html", kind: "page", href: "artifacts.html", desc: "All artifacts defined in this guide" },
  ];
  fs.writeFileSync(path.join(outDir, "igf", "palette-index.json"), JSON.stringify({ items }));

  // ---- pagefind ---------------------------------------------------------------------------
  try {
    const pagefind = await import("pagefind");
    const { index, errors } = await pagefind.createIndex({});
    if (!index) throw new Error(errors?.join("; ") ?? "createIndex failed");
    await index.addDirectory({ path: outDir });
    await index.writeFiles({ outputPath: path.join(outDir, "pagefind") });
    await pagefind.close();
    log("• pagefind full-text index built");
  } catch (e) {
    warn(`Pagefind indexing skipped: ${e}`);
  }

  log(`✓ wrote ${pageCount} pages to ${outDir}`);
  return { pages: pageCount, artifacts: artifacts.length, copied, warnings };
}

function flattenPages(pages: PageNode[]): PageNode[] {
  return pages.flatMap((p) => [p, ...flattenPages(p.children)]);
}

function highlightJson(highlighter: Highlighter, a: Artifact, warn: (m: string) => void): string | undefined {
  try {
    const raw = JSON.stringify(a.json, null, 2);
    if (raw.length > MAX_HIGHLIGHT_BYTES) {
      return `<pre><code>${raw.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</code></pre>`;
    }
    return highlighter.codeToHtml(raw, {
      lang: "json",
      themes: { light: "one-light", dark: "one-dark-pro" },
      defaultColor: "light",
    });
  } catch (e) {
    warn(`JSON highlight failed for ${a.id}: ${e}`);
    return undefined;
  }
}

/**
 * Emit the runtime assets into `igf/` and return an {@link AssetManifest}.
 *
 * The JS/CSS bundles are written at **content-fingerprinted** paths
 * (`igf/<name>.<hash>.<ext>`) rather than stable ones. The hosting serves these
 * with a long `max-age`, so before this change a fresh deploy could be masked by
 * a browser/edge cache still holding the previous bundle for hours. A content
 * hash makes every changed asset a brand-new URL, so a deploy is visible
 * instantly and an unchanged asset stays cacheable. Nothing is emitted at the
 * old un-hashed paths — stale HTML references old hashed names (also absent),
 * which is fine because HTML is served `max-age=0`.
 *
 * Deliberately NOT fingerprinted:
 * - **fonts** — referenced by relative `url()` from the fingerprinted CSS (they
 *   resolve from the same `igf/` dir regardless of the CSS filename) and change
 *   very rarely, so the caching win is negligible and not worth rewriting CSS.
 * - **fuse.min.mjs** — a vendored, version-pinned lib, imported by `palette.js`
 *   relative to its own module URL.
 * - **palette-index.json** — regenerated every build and fetched by name.
 */
function copyAssets(outDir: string): AssetManifest {
  const igf = path.join(outDir, "igf");
  const fonts = path.join(igf, "fonts");
  fs.mkdirSync(fonts, { recursive: true });

  const manifest: AssetManifest = {};
  // [emitted logical name, source file]. Formbox is optional (only present when
  // the questionnaire-preview bundle has been built).
  const runtime: [string, string][] = [
    ["site.css", path.join(PKG_ROOT, "dist", "ui", "site.built.css")],
    ["site.js", path.join(PKG_ROOT, "dist", "ui", "site.js")],
    ["palette.js", path.join(PKG_ROOT, "dist", "ui", "palette.js")],
    ["formbox.js", path.join(PKG_ROOT, "dist", "ui", "formbox.js")],
    ["formbox.css", path.join(PKG_ROOT, "dist", "ui", "formbox.css")],
    ["mermaid.js", path.join(PKG_ROOT, "dist", "ui", "mermaid.js")],
  ];
  for (const [name, src] of runtime) {
    if (!fs.existsSync(src)) continue;
    const buf = fs.readFileSync(src);
    const hashed = fingerprintName(name, contentHash(buf));
    fs.writeFileSync(path.join(igf, hashed), buf);
    manifest[name] = `igf/${hashed}`;
  }

  fs.copyFileSync(
    path.join(PKG_ROOT, "node_modules", "fuse.js", "dist", "fuse.min.mjs"),
    path.join(igf, "fuse.min.mjs"),
  );

  const fontFiles: [string, string][] = [
    ["@fontsource-variable/plus-jakarta-sans", "plus-jakarta-sans-latin-wght-normal.woff2"],
    ["@fontsource-variable/jetbrains-mono", "jetbrains-mono-latin-wght-normal.woff2"],
  ];
  for (const [pkg, file] of fontFiles) {
    fs.copyFileSync(path.join(PKG_ROOT, "node_modules", pkg, "files", file), path.join(fonts, file));
  }

  return manifest;
}
