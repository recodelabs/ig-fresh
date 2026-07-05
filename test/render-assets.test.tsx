import { describe, it, expect } from "vitest";
import type { IgModel } from "../src/model/types.js";
import { renderPage } from "../src/render/shell.js";

const baseModel: IgModel = {
  meta: {
    id: "test.ig",
    name: "TestIG",
    title: "Test IG",
    canonical: "https://x",
    version: "0.1.0",
    status: "active",
    fhirVersion: "4.0.1",
    publisher: "Test Org",
    dependencies: [],
  },
  pages: [{ source: "index.html", title: "Home", children: [] }],
  artifacts: [],
  menu: [],
};

const opts = {
  filename: "index.html",
  title: "Home",
  breadcrumbs: [],
  body: <p>hello</p>,
};

describe("renderPage asset references", () => {
  const assets = {
    "site.css": "igf/site.aaaaaaaa.css",
    "site.js": "igf/site.bbbbbbbb.js",
    "palette.js": "igf/palette.cccccccc.js",
    "formbox.js": "igf/formbox.dddddddd.js",
    "formbox.css": "igf/formbox.eeeeeeee.css",
  };
  const html = renderPage({ ...baseModel, assets }, opts);

  it("references the fingerprinted CSS and JS bundles from the manifest", () => {
    expect(html).toContain('href="igf/site.aaaaaaaa.css"');
    expect(html).toContain('src="igf/site.bbbbbbbb.js"');
    expect(html).toContain('src="igf/palette.cccccccc.js"');
  });

  it("emits NO reference to the stale un-hashed bundle paths", () => {
    expect(html).not.toContain('href="igf/site.css"');
    expect(html).not.toContain('src="igf/site.js"');
    expect(html).not.toContain('src="igf/palette.js"');
  });

  it("passes the hashed formbox URLs to the site.js loader via data-attributes", () => {
    expect(html).toContain('data-formbox-js="igf/formbox.dddddddd.js"');
    expect(html).toContain('data-formbox-css="igf/formbox.eeeeeeee.css"');
  });
});

describe("renderPage asset fallback (no manifest)", () => {
  const html = renderPage(baseModel, opts);

  it("falls back to stable un-hashed paths when no manifest is present", () => {
    expect(html).toContain('href="igf/site.css"');
    expect(html).toContain('src="igf/site.js"');
    expect(html).toContain('src="igf/palette.js"');
    expect(html).toContain('data-formbox-js="igf/formbox.js"');
    expect(html).toContain('data-formbox-css="igf/formbox.css"');
  });
});
