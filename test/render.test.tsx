import { describe, it, expect } from "vitest";
import type { Artifact, IgModel } from "../src/model/types.js";
import { renderPage } from "../src/render/shell.js";
import { LinkResolver } from "../src/render/links.js";
import { renderStructureDefinition, type RenderCtx } from "../src/render/structure-definition.js";
import { renderCodeSystem } from "../src/render/terminology.js";

const sd = {
  resourceType: "StructureDefinition",
  id: "icr-campaign",
  url: "https://x/StructureDefinition/ICRCampaign",
  type: "CarePlan",
  baseDefinition: "http://hl7.org/fhir/StructureDefinition/CarePlan",
  derivation: "constraint",
  title: "ICR Campaign",
  snapshot: {
    element: [
      { id: "CarePlan", path: "CarePlan", min: 0, max: "*" },
      {
        id: "CarePlan.status",
        path: "CarePlan.status",
        min: 1,
        max: "1",
        short: "campaign status",
        type: [{ code: "code" }],
        mustSupport: true,
      },
    ],
  },
  differential: { element: [{ id: "CarePlan.status", path: "CarePlan.status" }] },
};

const artifact: Artifact = {
  kind: "profile",
  resourceType: "StructureDefinition",
  id: "icr-campaign",
  name: "ICRCampaign",
  title: "ICR Campaign",
  description: "A campaign profile.",
  url: "https://x/StructureDefinition/ICRCampaign",
  version: "0.1.0",
  status: "draft",
  filename: "StructureDefinition-icr-campaign.html",
  json: sd,
};

const model: IgModel = {
  meta: {
    id: "test.ig",
    name: "TestIG",
    title: "Test IG",
    canonical: "https://x",
    version: "0.1.0",
    status: "draft",
    fhirVersion: "4.0.1",
    publisher: "Test Org",
    dependencies: [],
  },
  pages: [{ source: "index.html", title: "Home", children: [] }],
  artifacts: [artifact],
  menu: [],
};

const ctx: RenderCtx = {
  model,
  links: new LinkResolver([artifact]),
  expansions: new Map(),
  examplesOf: [],
};

describe("renderPage shell", () => {
  const html = renderPage(model, {
    filename: "StructureDefinition-icr-campaign.html",
    title: "ICR Campaign",
    breadcrumbs: [{ label: "Home", href: "index.html" }, { label: "Profiles", href: "artifacts.html" }, { label: "ICRCampaign" }],
    body: renderStructureDefinition(artifact, ctx),
    activeKind: "profile",
  });

  it("is a full document with shell furniture", () => {
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain("<title>ICR Campaign — Test IG</title>");
    expect(html).toContain("igf/site.css");
    expect(html).toContain("Draft"); // status banner
    expect(html).toContain('href="artifacts.html"'); // sidebar + crumbs
    expect(html).toContain("igf-theme"); // theme bootstrap
  });

  it("renders the element tree with flags, cardinality, diff marking", () => {
    expect(html).toContain("tree-row");
    expect(html).toContain("1..1");
    expect(html).toContain("Must Support");
    expect(html).toContain("data-diff");
    expect(html).toContain("campaign status");
  });

  it("links the base definition to the core spec", () => {
    expect(html).toContain("http://hl7.org/fhir/R4/careplan.html");
  });

  it("shows canonical with copy button", () => {
    expect(html).toContain("https://x/StructureDefinition/ICRCampaign");
    expect(html).toContain("data-copy");
  });
});

describe("renderCodeSystem", () => {
  const cs: Artifact = {
    kind: "codesystem",
    resourceType: "CodeSystem",
    id: "cs1",
    name: "CS1",
    title: "Codes",
    url: "https://x/CodeSystem/cs1",
    filename: "CodeSystem-cs1.html",
    json: {
      resourceType: "CodeSystem",
      id: "cs1",
      url: "https://x/CodeSystem/cs1",
      concept: [
        { code: "a", display: "Alpha", definition: "first" },
        { code: "b", display: "Beta", concept: [{ code: "b1", display: "Beta one" }] },
      ],
    },
  };
  const html = renderPage(model, {
    filename: cs.filename,
    title: cs.title,
    breadcrumbs: [],
    body: renderCodeSystem(cs, ctx),
  });

  it("flattens nested concepts into a filterable table", () => {
    expect(html).toContain("data-filter");
    expect(html).toContain("Alpha");
    expect(html).toContain("Beta one");
    expect(html).toContain("Concepts (3)");
    expect(html).toContain('data-filter-text="b1 beta one "');
  });
});
