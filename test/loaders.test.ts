import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
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
              expansion: { contains: [{ system: "http://s", code: "c1", display: "C one" }] },
            },
          },
        ],
      }),
    );
    const m = loadExpansions(dir);
    expect(m.get("http://x/ValueSet/a")).toEqual([
      { system: "http://s", code: "c1", display: "C one" },
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
});
