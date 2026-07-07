import { describe, it, expect } from "vitest";
import { buildRedirects } from "../src/build/redirects.js";
import type { Artifact } from "../src/model/types.js";

function artifact(partial: Partial<Artifact>): Artifact {
  return {
    kind: "terminology",
    resourceType: "CodeSystem",
    id: "my-codes",
    name: "MyCodes",
    title: "My Codes",
    filename: "CodeSystem-my-codes.html",
    tags: [],
    json: {},
    ...partial,
  } as Artifact;
}

describe("buildRedirects", () => {
  it("maps each canonical path /{ResourceType}/{id} to its page as a 301", () => {
    const out = buildRedirects([artifact({})]);
    expect(out).toBe("/CodeSystem/my-codes  /CodeSystem-my-codes.html  301\n");
  });

  it("covers every resource type, including examples with no canonical url", () => {
    const out = buildRedirects([
      artifact({ resourceType: "StructureDefinition", id: "icr-campaign", filename: "StructureDefinition-icr-campaign.html" }),
      // an example instance: no `url`, still addressable as Type/id in references
      artifact({ kind: "example", resourceType: "Location", id: "uganda-national", filename: "Location-uganda-national.html", url: undefined }),
    ]);
    expect(out).toContain("/StructureDefinition/icr-campaign  /StructureDefinition-icr-campaign.html  301");
    expect(out).toContain("/Location/uganda-national  /Location-uganda-national.html  301");
  });

  it("is deterministic: rules are sorted by source path", () => {
    const a = buildRedirects([
      artifact({ resourceType: "ValueSet", id: "z-vs", filename: "ValueSet-z-vs.html" }),
      artifact({ resourceType: "CodeSystem", id: "a-cs", filename: "CodeSystem-a-cs.html" }),
    ]);
    const b = buildRedirects([
      artifact({ resourceType: "CodeSystem", id: "a-cs", filename: "CodeSystem-a-cs.html" }),
      artifact({ resourceType: "ValueSet", id: "z-vs", filename: "ValueSet-z-vs.html" }),
    ]);
    expect(a).toBe(b);
    expect(a.indexOf("/CodeSystem/a-cs")).toBeLessThan(a.indexOf("/ValueSet/z-vs"));
  });

  it("deduplicates a repeated source path, first artifact wins", () => {
    const out = buildRedirects([
      artifact({ resourceType: "CodeSystem", id: "dup", filename: "CodeSystem-dup.html" }),
      artifact({ resourceType: "CodeSystem", id: "dup", filename: "CodeSystem-dup-other.html" }),
    ]);
    expect(out).toBe("/CodeSystem/dup  /CodeSystem-dup.html  301\n");
  });

  it("emits nothing for an empty artifact list", () => {
    expect(buildRedirects([])).toBe("");
  });

  it("uses exact-match sources (no wildcards) so no rule can target a missing file", () => {
    const out = buildRedirects([artifact({})]);
    expect(out).not.toContain("*");
    expect(out).not.toContain(":splat");
  });
});
