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
import { renderArtifactsIndex } from "../render/artifacts-index.js";
import { renderNarrative, renderSearchPage } from "../render/page.js";

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
  copyAssets(outDir);

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

function copyAssets(outDir: string) {
  const igf = path.join(outDir, "igf");
  const fonts = path.join(igf, "fonts");
  fs.mkdirSync(fonts, { recursive: true });

  const cssSrc = path.join(PKG_ROOT, "dist", "ui", "site.built.css");
  fs.copyFileSync(cssSrc, path.join(igf, "site.css"));
  for (const f of ["site.js", "palette.js"]) {
    fs.copyFileSync(path.join(PKG_ROOT, "dist", "ui", f), path.join(igf, f));
  }
  fs.copyFileSync(
    path.join(PKG_ROOT, "node_modules", "fuse.js", "dist", "fuse.min.mjs"),
    path.join(igf, "fuse.min.mjs"),
  );

  const fontFiles: [string, string][] = [
    ["@fontsource-variable/fraunces", "fraunces-latin-wght-normal.woff2"],
    ["@fontsource-variable/fraunces", "fraunces-latin-wght-italic.woff2"],
    ["@fontsource/ibm-plex-sans", "ibm-plex-sans-latin-400-normal.woff2"],
    ["@fontsource/ibm-plex-sans", "ibm-plex-sans-latin-500-normal.woff2"],
    ["@fontsource/ibm-plex-sans", "ibm-plex-sans-latin-600-normal.woff2"],
    ["@fontsource/ibm-plex-sans", "ibm-plex-sans-latin-700-normal.woff2"],
    ["@fontsource/ibm-plex-mono", "ibm-plex-mono-latin-400-normal.woff2"],
    ["@fontsource/ibm-plex-mono", "ibm-plex-mono-latin-600-normal.woff2"],
  ];
  for (const [pkg, file] of fontFiles) {
    fs.copyFileSync(path.join(PKG_ROOT, "node_modules", pkg, "files", file), path.join(fonts, file));
  }
}
