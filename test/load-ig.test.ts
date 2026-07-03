import { describe, it, expect } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadIgResource } from "../src/load/ig.js";

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

describe("loadIgResource", () => {
  const { meta, pages, resources } = loadIgResource(fixtures);

  it("parses IG metadata", () => {
    expect(meta.id).toBe("unicef.fhir.icr");
    expect(meta.canonical).toBe("https://fhir.icr.unicef.org");
    expect(meta.title).toMatch(/Integrated Campaign Registry/);
    expect(meta.status).toBe("draft");
    expect(meta.fhirVersion).toBe("4.0.1");
    expect(meta.dependencies).toEqual([
      { id: "hl7.terminology.r4", version: "5.5.0", uri: "http://terminology.hl7.org/ImplementationGuide/hl7.terminology" },
    ]);
  });

  it("builds the page tree from definition.page, flattening the toc root", () => {
    // root is toc.html with children index + background — we surface its children
    expect(pages.map((p) => p.source)).toEqual(["index.html", "background.html"]);
    expect(pages[0].title).toBe("Home");
  });

  it("classifies examples via exampleBoolean/exampleCanonical", () => {
    const byRef = Object.fromEntries(resources.map((r) => [r.reference, r]));
    expect(byRef["CodeSystem/icr-campaign-type-cs"].isExample).toBe(false);
    expect(byRef["CarePlan/example-mr-sia-2026"].isExample).toBe(true);
    expect(byRef["ActivityDefinition/example-albendazole-activity"].profiles).toEqual([
      "https://fhir.icr.unicef.org/StructureDefinition/ICRCampaignActivity",
    ]);
  });

  it("throws when no ImplementationGuide resource is present", () => {
    expect(() => loadIgResource("/nonexistent-dir")).toThrow(/ImplementationGuide/);
  });
});
