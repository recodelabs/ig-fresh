import { describe, it, expect } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadArtifacts } from "../src/load/artifacts.js";
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
