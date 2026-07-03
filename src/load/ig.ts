import fs from "node:fs";
import path from "node:path";
import type { IgMeta, PageNode, ResourceRef } from "../model/types.js";

function pageSource(p: any): string {
  const src: string = p.nameUrl ?? p.name ?? "";
  // authored .md pages are generated as .html
  return src.replace(/\.md$/, ".html").replace(/\.xml$/, ".html");
}

function toPageNode(p: any): PageNode {
  return {
    source: pageSource(p),
    title: p.title ?? pageSource(p),
    children: (p.page ?? []).map(toPageNode),
  };
}

export function loadIgResource(outputDir: string): {
  meta: IgMeta;
  pages: PageNode[];
  resources: ResourceRef[];
} {
  let file: string | undefined;
  try {
    file = fs
      .readdirSync(outputDir)
      .find((f) => /^ImplementationGuide-.*\.json$/.test(f) && !f.includes(".canonical"));
  } catch {
    // fall through to the error below
  }
  if (!file) {
    throw new Error(`No ImplementationGuide-*.json found in ${outputDir}`);
  }
  const ig = JSON.parse(fs.readFileSync(path.join(outputDir, file), "utf8"));

  const meta: IgMeta = {
    id: ig.id,
    name: ig.name ?? ig.id,
    title: ig.title ?? ig.name ?? ig.id,
    canonical: (ig.url ?? "").replace(/\/ImplementationGuide\/.*$/, ""),
    version: ig.version ?? "",
    status: ig.status ?? "",
    fhirVersion: Array.isArray(ig.fhirVersion) ? ig.fhirVersion[0] : ig.fhirVersion ?? "",
    publisher: ig.publisher,
    description: ig.description,
    license: ig.license,
    dependencies: (ig.dependsOn ?? []).map((d: any) => ({
      id: d.packageId ?? d.id ?? "",
      version: d.version ?? "",
      uri: d.uri ?? "",
    })),
  };

  const rootPage = ig.definition?.page;
  // The publisher wraps everything under a toc.html root; surface its children.
  const pages: PageNode[] = rootPage
    ? pageSource(rootPage) === "toc.html"
      ? (rootPage.page ?? []).map(toPageNode)
      : [toPageNode(rootPage)]
    : [];

  const resources: ResourceRef[] = (ig.definition?.resource ?? []).map((r: any) => ({
    reference: r.reference?.reference ?? "",
    name: r.name,
    description: r.description,
    isExample: r.exampleBoolean === true || typeof r.exampleCanonical === "string",
    profiles: r.exampleCanonical ? [r.exampleCanonical] : [],
  }));

  return { meta, pages, resources };
}
