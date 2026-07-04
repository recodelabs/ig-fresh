import { describe, it, expect } from "vitest";
import type { Artifact, IgModel } from "../src/model/types.js";
import { renderPage } from "../src/render/shell.js";
import { LinkResolver } from "../src/render/links.js";
import { renderQuestionnaire } from "../src/render/questionnaire.js";
import type { RenderCtx } from "../src/render/structure-definition.js";

const q: Artifact = {
  kind: "questionnaire",
  resourceType: "Questionnaire",
  id: "icr-mda-supervision-checklist",
  name: "ICRMDASupervisionChecklist",
  title: "ICR MDA Supervision Checklist",
  description: "Supervision checklist.",
  url: "https://x/Questionnaire/icr-mda-supervision-checklist",
  version: "0.1.0",
  status: "active",
  filename: "Questionnaire-icr-mda-supervision-checklist.html",
  json: {
    resourceType: "Questionnaire",
    id: "icr-mda-supervision-checklist",
    title: "ICR MDA Supervision Checklist",
    subjectType: ["Group", "Location"],
    item: [
      {
        linkId: "supplies",
        text: "MDA supplies available",
        type: "group",
        item: [
          { linkId: "supplies.register", text: "Register present", type: "boolean", required: true },
          { linkId: "supplies.checklist", text: "Records/checklist present", type: "boolean" },
        ],
      },
    ],
  },
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
    dependencies: [],
  },
  pages: [{ source: "index.html", title: "Home", children: [] }],
  artifacts: [q],
  menu: [],
};

const ctx: RenderCtx = {
  model,
  links: new LinkResolver([q]),
  expansions: new Map(),
  examplesOf: [],
};

describe("renderQuestionnaire", () => {
  const html = renderPage(model, {
    filename: q.filename,
    title: q.title,
    breadcrumbs: [],
    body: renderQuestionnaire(q, ctx),
    activeKind: "questionnaire",
  });

  it("renders the three form tabs", () => {
    expect(html).toContain('data-q-tab="preview"');
    expect(html).toContain('data-q-tab="structure"');
    expect(html).toContain('data-q-tab="json"');
  });

  it("wires an auto-mounting preview island pointed at the questionnaire JSON", () => {
    expect(html).toContain("data-questionnaire-preview");
    expect(html).toContain('data-questionnaire-src="Questionnaire-icr-mda-supervision-checklist.json"');
    expect(html).toContain("q-preview-loading");
  });

  it("renders a static item-structure table with groups, types, required flags, link ids", () => {
    expect(html).toContain("MDA supplies available");
    expect(html).toContain("Register present");
    expect(html).toContain("supplies.register");
    expect(html).toContain("yes / no"); // boolean type label
    expect(html).toContain(">req<"); // required flag
  });

  it("counts leaf questions (not groups) in metadata", () => {
    expect(html).toContain("Questions");
    // 2 boolean leaves under one group
    expect(html).toMatch(/Questions<\/dt>\s*<dd[^>]*>2</);
  });
});
