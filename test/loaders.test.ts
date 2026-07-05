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
});
