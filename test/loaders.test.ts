import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { load as cheerioLoad } from "cheerio";
import { loadExpansions } from "../src/load/expansions.js";
import { extractNarrative } from "../src/load/narrative.js";

describe("loadExpansions", () => {
  it("returns empty map when file missing", () => {
    expect(loadExpansions(os.tmpdir() + "/nope").size).toBe(0);
  });

  it("indexes expansions by ValueSet url", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "igf-"));
    fs.writeFileSync(
      path.join(dir, "expansions.json"),
      JSON.stringify({
        resourceType: "Bundle",
        entry: [
          {
            resource: {
              resourceType: "ValueSet",
              url: "http://x/ValueSet/a",
              expansion: {
                contains: [
                  { system: "http://s", code: "c1", display: "C one" },
                  { system: "http://s", code: "grp", display: "Grouper", abstract: true },
                  { system: "http://s", display: "No code" },
                ],
              },
            },
          },
        ],
      }),
    );
    const m = loadExpansions(dir);
    // abstract and code-less entries are not selectable options — filtered out
    expect(m.get("http://x/ValueSet/a")).toEqual([
      { system: "http://s", code: "c1", display: "C one" },
    ]);
  });

  it("loads per-ValueSet <id>.expansion.json files, which win over the bundle", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "igf-"));
    fs.writeFileSync(
      path.join(dir, "expansions.json"),
      JSON.stringify({
        resourceType: "Bundle",
        entry: [
          {
            resource: {
              resourceType: "ValueSet",
              url: "http://x/ValueSet/a",
              expansion: { contains: [{ system: "http://s", code: "stale" }] },
            },
          },
        ],
      }),
    );
    fs.writeFileSync(
      path.join(dir, "ValueSet-a.expansion.json"),
      JSON.stringify({
        resourceType: "ValueSet",
        url: "http://x/ValueSet/a",
        expansion: { contains: [{ system: "http://s", code: "fresh", display: "Fresh" }] },
      }),
    );
    fs.writeFileSync(
      path.join(dir, "ValueSet-b.expansion.json"),
      JSON.stringify({
        resourceType: "ValueSet",
        url: "http://x/ValueSet/b",
        expansion: { contains: [{ system: "http://s", code: "only-per-vs" }] },
      }),
    );
    const m = loadExpansions(dir);
    expect(m.get("http://x/ValueSet/a")).toEqual([{ system: "http://s", code: "fresh", display: "Fresh" }]);
    expect(m.get("http://x/ValueSet/b")).toEqual([{ system: "http://s", code: "only-per-vs", display: undefined }]);
  });

  it("works with per-ValueSet expansion files when expansions.json is absent", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "igf-"));
    fs.writeFileSync(
      path.join(dir, "ValueSet-solo.expansion.json"),
      JSON.stringify({
        resourceType: "ValueSet",
        url: "http://x/ValueSet/solo",
        expansion: { contains: [{ system: "http://s", code: "s1" }] },
      }),
    );
    expect(loadExpansions(dir).get("http://x/ValueSet/solo")).toEqual([
      { system: "http://s", code: "s1", display: undefined },
    ]);
  });
});

describe("extractNarrative", () => {
  const html = `<!DOCTYPE html><html><head><title>Home - Test IG</title></head><body>
    <div id="segment-header">chrome</div>
    <div id="segment-navbar">nav</div>
    <div id="segment-content"><div class="row"><div class="col-12">
      <div class="publish-box">draft box</div>
      <h2>Welcome</h2><p>Real content with a <a href="artifacts.html">link</a>.</p>
      <script>evil()</script>
    </div></div></div>
    <div id="segment-footer">footer</div>
  </body></html>`;

  it("keeps the content region and drops chrome, publish-box, scripts", () => {
    const { title, bodyHtml } = extractNarrative(html);
    expect(title).toBe("Home - Test IG");
    expect(bodyHtml).toContain("<h2>Welcome</h2>");
    expect(bodyHtml).toContain('href="artifacts.html"');
    expect(bodyHtml).not.toContain("segment-header");
    expect(bodyHtml).not.toContain("draft box");
    expect(bodyHtml).not.toContain("<script>");
  });

  it("falls back to body when no publisher layout", () => {
    const { bodyHtml } = extractNarrative("<html><body><p>plain</p></body></html>");
    expect(bodyHtml).toContain("<p>plain</p>");
  });

  it("reports hasMermaid false on a page with no mermaid", () => {
    const { hasMermaid } = extractNarrative(html);
    expect(hasMermaid).toBe(false);
  });
});

describe("extractNarrative — mermaid rewrite", () => {
  const wrap = (inner: string) =>
    `<html><body><div id="segment-content"><div class="row"><div class="col-12">${inner}</div></div></div></body></html>`;

  const IGP_BLOCK = (src: string) =>
    `<pre class="language-mermaid"><code class="language-mermaid">${src}</code></pre>`;

  it("rewrites pre.language-mermaid into pre.mermaid[data-mermaid-src]", () => {
    const { bodyHtml, hasMermaid } = extractNarrative(wrap(IGP_BLOCK("graph TD; A-->B;")));
    expect(hasMermaid).toBe(true);
    expect(bodyHtml).not.toContain("language-mermaid");
    // Round-trip via a parse: decoded attr and text both equal the source.
    // (cheerio leaves `>` unescaped in attribute values but escapes it in text.)
    const $ = cheerioLoad(bodyHtml);
    expect($("pre.mermaid").attr("data-mermaid-src")).toBe("graph TD; A-->B;");
    expect($("pre.mermaid").text()).toBe("graph TD; A-->B;");
  });

  it("stores clean text, stripping prism span markup inside the code", () => {
    const prismy = `<pre class="language-mermaid"><code class="language-mermaid"><span class="token">graph</span> TD; A--&gt;B;</code></pre>`;
    const { bodyHtml } = extractNarrative(wrap(prismy));
    const $ = cheerioLoad(bodyHtml);
    expect($("pre.mermaid").attr("data-mermaid-src")).toBe("graph TD; A-->B;");
    expect(bodyHtml).not.toContain("<span");
    expect(bodyHtml).not.toContain("token");
  });

  it("preserves whitespace / indentation exactly (trimming only fence newlines)", () => {
    const src = "\ngraph TD;\n    A[Start] --> B[End];\n    B --> C;\n";
    const { bodyHtml } = extractNarrative(wrap(IGP_BLOCK(src)));
    // leading/trailing fence newline trimmed, inner indentation preserved
    const expected = "graph TD;\n    A[Start] --> B[End];\n    B --> C;";
    expect(bodyHtml).toContain(expected);
    expect(bodyHtml).toContain(`data-mermaid-src="${expected}"`);
  });

  it("rewrites multiple blocks on one page", () => {
    const { bodyHtml, hasMermaid } = extractNarrative(
      wrap(IGP_BLOCK("graph TD; A-->B;") + "<p>between</p>" + IGP_BLOCK("sequenceDiagram; A->>B: hi;")),
    );
    expect(hasMermaid).toBe(true);
    const matches = bodyHtml.match(/<pre class="mermaid"/g) ?? [];
    expect(matches.length).toBe(2);
    expect(bodyHtml).toContain("<p>between</p>");
  });

  it("round-trips HTML-ish source (A --> B & C) without breaking escaping", () => {
    const src = "graph TD; A[A --> B & C] --> D;";
    const { bodyHtml } = extractNarrative(wrap(IGP_BLOCK("graph TD; A[A --&gt; B &amp; C] --&gt; D;")));
    // cheerio re-encodes on output; the decoded source is what mermaid receives
    const $ = cheerioLoad(bodyHtml);
    expect($("pre.mermaid").attr("data-mermaid-src")).toBe(src);
    expect($("pre.mermaid").text()).toBe(src);
  });

  it("handles a bare pre > code.language-mermaid", () => {
    const bare = `<pre><code class="language-mermaid">graph TD; A-->B;</code></pre>`;
    const { bodyHtml, hasMermaid } = extractNarrative(wrap(bare));
    expect(hasMermaid).toBe(true);
    expect(bodyHtml).toContain('<pre class="mermaid" data-mermaid-src="graph TD; A-->B;">');
  });

  it("leaves a non-mermaid page unchanged", () => {
    const plain = "<h2>Title</h2><pre><code class=\"language-json\">{}</code></pre>";
    const { bodyHtml, hasMermaid } = extractNarrative(wrap(plain));
    expect(hasMermaid).toBe(false);
    expect(bodyHtml).toContain('<code class="language-json">');
    expect(bodyHtml).not.toContain("mermaid");
  });
});
