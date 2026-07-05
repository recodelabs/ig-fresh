import { describe, it, expect } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractTags, loadArtifacts } from "../src/load/artifacts.js";
import type { ResourceRef } from "../src/model/types.js";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "artifacts");

const refs: ResourceRef[] = [
  { reference: "StructureDefinition/ICRCampaignTask", isExample: false, profiles: [] },
  { reference: "StructureDefinition/exclusion-reason", isExample: false, profiles: [] },
  { reference: "CodeSystem/icr-campaign-type-cs", isExample: false, profiles: [] },
  { reference: "ValueSet/icr-campaign-type", isExample: false, profiles: [] },
  {
    reference: "CarePlan/example-mr-sia-2026",
    name: "MR SIA 2026 example",
    isExample: true,
    profiles: ["https://fhir.icr.unicef.org/StructureDefinition/ICRCampaign"],
  },
];

describe("loadArtifacts", () => {
  const artifacts = loadArtifacts(dir, refs);
  const byId = Object.fromEntries(artifacts.map((a) => [`${a.resourceType}/${a.id}`, a]));

  it("classifies profiles, extensions, terminology, examples", () => {
    expect(byId["StructureDefinition/ICRCampaignTask"].kind).toBe("profile");
    expect(byId["StructureDefinition/exclusion-reason"].kind).toBe("extension");
    expect(byId["CodeSystem/icr-campaign-type-cs"].kind).toBe("codesystem");
    expect(byId["ValueSet/icr-campaign-type"].kind).toBe("valueset");
    expect(byId["CarePlan/example-mr-sia-2026"].kind).toBe("example");
  });

  it("computes publisher-style page filenames", () => {
    expect(byId["StructureDefinition/ICRCampaignTask"].filename).toBe(
      "StructureDefinition-ICRCampaignTask.html",
    );
    expect(byId["CarePlan/example-mr-sia-2026"].filename).toBe(
      "CarePlan-example-mr-sia-2026.html",
    );
  });

  it("prefers the IG-declared name/description for examples", () => {
    expect(byId["CarePlan/example-mr-sia-2026"].title).toBe("MR SIA 2026 example");
  });

  it("reads project tags from meta.tag (display over code) and none elsewhere", () => {
    expect(byId["CarePlan/example-mr-sia-2026"].tags).toEqual([
      { code: "espen", label: "ESPEN" },
    ]);
    expect(byId["StructureDefinition/ICRCampaignTask"].tags).toEqual([]);
    expect(byId["CodeSystem/icr-campaign-type-cs"].tags).toEqual([]);
  });

  it("skips .canonical.json, non-resources, and junk files", () => {
    const ids = artifacts.map((a) => a.id);
    expect(ids.filter((i) => i === "ICRCampaignTask")).toHaveLength(1);
    expect(artifacts.some((a) => !a.resourceType)).toBe(false);
    expect(artifacts).toHaveLength(5);
  });

  it("does not throw on malformed json", () => {
    // covered by the fixture dir containing not-a-resource.json / usage-stats.json
    expect(() => loadArtifacts(dir, refs)).not.toThrow();
  });
});

describe("extractTags", () => {
  const wrap = (tag: any) => ({ meta: { tag } });

  it("uses display as the label with code as the key", () => {
    expect(extractTags(wrap([{ system: "s", code: "espen", display: "ESPEN" }]))).toEqual([
      { code: "espen", label: "ESPEN" },
    ]);
  });

  it("falls back to code when display is missing", () => {
    expect(extractTags(wrap([{ system: "s", code: "espen" }]))).toEqual([
      { code: "espen", label: "espen" },
    ]);
  });

  it("falls back to display as the key when code is missing or empty", () => {
    expect(extractTags(wrap([{ display: "ESPEN" }]))).toEqual([
      { code: "ESPEN", label: "ESPEN" },
    ]);
    // empty-string code must not become the key (it would collide with the "All" chip)
    expect(extractTags(wrap([{ code: "", display: "ESPEN" }]))).toEqual([
      { code: "ESPEN", label: "ESPEN" },
    ]);
  });

  it("collects multiple tags on one resource in order", () => {
    expect(
      extractTags(
        wrap([
          { code: "espen", display: "ESPEN" },
          { code: "gpei", display: "GPEI" },
        ]),
      ),
    ).toEqual([
      { code: "espen", label: "ESPEN" },
      { code: "gpei", label: "GPEI" },
    ]);
  });

  it("dedupes repeated tag codes, keeping the first", () => {
    expect(
      extractTags(
        wrap([
          { code: "espen", display: "ESPEN" },
          { code: "espen", display: "Espen (duplicate)" },
        ]),
      ),
    ).toEqual([{ code: "espen", label: "ESPEN" }]);
  });

  it("ignores empty, missing, and malformed meta.tag cleanly", () => {
    expect(extractTags({})).toEqual([]);
    expect(extractTags({ meta: {} })).toEqual([]);
    expect(extractTags(wrap([]))).toEqual([]);
    expect(extractTags({ meta: { tag: "nope" } })).toEqual([]);
    expect(extractTags(wrap([null, 42, {}, { system: "s" }, { code: "", display: "" }]))).toEqual([]);
  });

  it("keeps codes containing delimiter-like characters intact", () => {
    expect(extractTags(wrap([{ code: "a|b", display: "A | B" }]))).toEqual([
      { code: "a|b", label: "A | B" },
    ]);
  });
});
