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
  tags: [],
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

  it("emits no local-valueset blob when the questionnaire has no answerValueSet", () => {
    expect(html).not.toContain("igf-vs-options");
  });
});

describe("renderQuestionnaire with IG-local answerValueSet", () => {
  const vs: Artifact = {
    kind: "valueset",
    resourceType: "ValueSet",
    id: "disease-vs",
    name: "DiseaseVS",
    title: "Disease VS",
    url: "https://x/ValueSet/disease-vs",
    version: "0.1.0",
    status: "active",
    filename: "ValueSet-disease-vs.html",
    tags: [],
    json: { resourceType: "ValueSet", id: "disease-vs", url: "https://x/ValueSet/disease-vs" },
  };
  const qvs: Artifact = {
    ...q,
    json: {
      ...q.json,
      item: [
        { linkId: "p_disease", text: "Disease", type: "choice", answerValueSet: "https://x/ValueSet/disease-vs" },
        { linkId: "p_other", text: "Other", type: "choice", answerValueSet: "http://hl7.org/fhir/ValueSet/administrative-gender" },
      ],
    },
  };
  const vsModel: IgModel = { ...model, artifacts: [qvs, vs] };
  const vsCtx: RenderCtx = {
    model: vsModel,
    links: new LinkResolver([qvs, vs]),
    expansions: new Map([
      [
        "https://x/ValueSet/disease-vs",
        [{ system: "https://x/cs", code: "lf", display: "Lymphatic filariasis" }],
      ],
    ]),
    examplesOf: [],
  };
  const html = renderPage(vsModel, {
    filename: qvs.filename,
    title: qvs.title,
    breadcrumbs: [],
    body: renderQuestionnaire(qvs, vsCtx),
    activeKind: "questionnaire",
  });

  it("emits a JSON blob with the locally resolved options", () => {
    expect(html).toContain('id="igf-vs-options"');
    expect(html).toContain("Lymphatic filariasis");
    expect(html).toContain('"code":"lf"');
  });

  it("keeps non-local canonicals out of the blob", () => {
    const blob = html.match(/<script type="application\/json" id="igf-vs-options">(.*?)<\/script>/s)?.[1];
    expect(blob).toBeTruthy();
    expect(blob).not.toContain("administrative-gender");
  });

  it("escapes </script> in concept displays so the blob cannot break out of its script tag", () => {
    const hostileCtx: RenderCtx = {
      ...vsCtx,
      expansions: new Map([
        [
          "https://x/ValueSet/disease-vs",
          [{ system: "https://x/cs", code: "evil", display: "</script><img onerror=x>" }],
        ],
      ]),
    };
    const hostileHtml = renderPage(vsModel, {
      filename: qvs.filename,
      title: qvs.title,
      breadcrumbs: [],
      body: renderQuestionnaire(qvs, hostileCtx),
      activeKind: "questionnaire",
    });
    const blob = hostileHtml.match(/<script type="application\/json" id="igf-vs-options">(.*?)<\/script>/s)?.[1];
    expect(blob).toBeTruthy();
    // no literal close-tag or element open inside the JSON payload…
    expect(blob).not.toContain("</script");
    expect(blob).not.toContain("<img");
    // …but the original display round-trips through JSON.parse
    const parsed = JSON.parse(blob!);
    expect(parsed["https://x/ValueSet/disease-vs"][0].display).toBe("</script><img onerror=x>");
  });
});
