import { describe, it, expect } from "vitest";
import type { Artifact } from "../src/model/types.js";
import {
  collectAnswerValueSets,
  resolveLocalOptions,
  splitCanonical,
} from "../src/render/local-valuesets.js";
// Runtime half (bundled into the formbox island) — tested here alongside the
// build half so the contract between them stays in one place.
// @ts-expect-error plain-JS browser module without type declarations
import { applyLocalValueSets } from "../src/ui/apply-local-valuesets.js";

function vsArtifact(id: string, json: any, version = "0.1.0"): Artifact {
  return {
    kind: "valueset",
    resourceType: "ValueSet",
    id,
    name: id,
    title: id,
    url: `https://x/ValueSet/${id}`,
    version,
    status: "active",
    filename: `ValueSet-${id}.html`,
    tags: [],
    json: { resourceType: "ValueSet", id, url: `https://x/ValueSet/${id}`, version, ...json },
  };
}

describe("splitCanonical", () => {
  it("passes plain URLs through", () => {
    expect(splitCanonical("https://x/ValueSet/a")).toEqual({ url: "https://x/ValueSet/a" });
  });
  it("splits a |version suffix", () => {
    expect(splitCanonical("https://x/ValueSet/a|0.1.0")).toEqual({
      url: "https://x/ValueSet/a",
      version: "0.1.0",
    });
  });
  it("treats a trailing bare pipe as no version", () => {
    expect(splitCanonical("https://x/ValueSet/a|")).toEqual({
      url: "https://x/ValueSet/a",
      version: undefined,
    });
  });
});

describe("collectAnswerValueSets", () => {
  it("finds canonicals in nested items and dedupes", () => {
    const items = [
      { linkId: "a", type: "choice", answerValueSet: "https://x/ValueSet/one" },
      {
        linkId: "g",
        type: "group",
        item: [
          { linkId: "b", type: "choice", answerValueSet: "https://x/ValueSet/two|1.0" },
          { linkId: "c", type: "choice", answerValueSet: "https://x/ValueSet/one" },
          { linkId: "d", type: "string" },
        ],
      },
    ];
    expect(collectAnswerValueSets(items).sort()).toEqual([
      "https://x/ValueSet/one",
      "https://x/ValueSet/two|1.0",
    ]);
  });
  it("returns [] for missing/empty items", () => {
    expect(collectAnswerValueSets(undefined)).toEqual([]);
    expect(collectAnswerValueSets([])).toEqual([]);
  });
});

describe("resolveLocalOptions", () => {
  const disease = vsArtifact("disease-vs", {
    compose: { include: [{ system: "https://x/CodeSystem/disease-cs" }] }, // whole-CS include: not enumerable
  });
  const expansions = new Map([
    [
      "https://x/ValueSet/disease-vs",
      [
        { system: "https://x/CodeSystem/disease-cs", code: "lf", display: "Lymphatic filariasis" },
        { system: "https://x/CodeSystem/disease-cs", code: "oncho", display: "Onchocerciasis" },
      ],
    ],
  ]);

  it("resolves an IG-local canonical from the publisher expansions", () => {
    const out = resolveLocalOptions(["https://x/ValueSet/disease-vs"], [disease], expansions);
    expect(out["https://x/ValueSet/disease-vs"]).toHaveLength(2);
    expect(out["https://x/ValueSet/disease-vs"][0]).toEqual({
      system: "https://x/CodeSystem/disease-cs",
      code: "lf",
      display: "Lymphatic filariasis",
    });
  });

  it("resolves a versioned canonical (url|version) when the version matches, keyed as written", () => {
    const canonical = "https://x/ValueSet/disease-vs|0.1.0";
    const out = resolveLocalOptions([canonical], [disease], expansions);
    expect(Object.keys(out)).toEqual([canonical]);
    expect(out[canonical]).toHaveLength(2);
  });

  it("skips a versioned canonical whose version does not match the artifact", () => {
    const out = resolveLocalOptions(["https://x/ValueSet/disease-vs|9.9.9"], [disease], expansions);
    expect(out).toEqual({});
  });

  it("skips non-local canonicals (left to the terminology server)", () => {
    const out = resolveLocalOptions(
      ["http://hl7.org/fhir/ValueSet/administrative-gender"],
      [disease],
      expansions,
    );
    expect(out).toEqual({});
  });

  it("falls back to an expansion embedded in the ValueSet JSON when expansions.json has none", () => {
    const embedded = vsArtifact("embedded-vs", {
      expansion: {
        contains: [
          { system: "https://x/cs", code: "a", display: "A" },
          { system: "https://x/cs", code: "grp", abstract: true }, // filtered out
          { system: "https://x/cs", code: "b" },
        ],
      },
    });
    const out = resolveLocalOptions(["https://x/ValueSet/embedded-vs"], [embedded], new Map());
    expect(out["https://x/ValueSet/embedded-vs"].map((c) => c.code)).toEqual(["a", "b"]);
  });

  it("falls back to enumerable compose.include when there is no expansion at all", () => {
    const composed = vsArtifact("composed-vs", {
      compose: {
        include: [
          {
            system: "https://x/cs",
            concept: [
              { code: "yes", display: "Yes" },
              { code: "no", display: "No" },
            ],
          },
        ],
      },
    });
    const out = resolveLocalOptions(["https://x/ValueSet/composed-vs"], [composed], new Map());
    expect(out["https://x/ValueSet/composed-vs"]).toEqual([
      { system: "https://x/cs", code: "yes", display: "Yes" },
      { system: "https://x/cs", code: "no", display: "No" },
    ]);
  });

  it("omits local ValueSets that are not enumerable (no expansion, filter-based compose)", () => {
    const filtered = vsArtifact("filtered-vs", {
      compose: { include: [{ system: "https://x/cs", filter: [{ property: "concept", op: "is-a", value: "x" }] }] },
    });
    const out = resolveLocalOptions(["https://x/ValueSet/filtered-vs"], [filtered], new Map());
    expect(out).toEqual({});
  });
});

describe("applyLocalValueSets (runtime preprocessing)", () => {
  const q = {
    resourceType: "Questionnaire",
    item: [
      { linkId: "p_disease", type: "choice", answerValueSet: "https://x/ValueSet/disease-vs" },
      {
        linkId: "grp",
        type: "group",
        item: [{ linkId: "p_other", type: "choice", answerValueSet: "https://ext/ValueSet/foreign" }],
      },
      { linkId: "p_name", type: "string" },
    ],
  };
  const options = {
    "https://x/ValueSet/disease-vs": [
      { system: "https://x/cs", code: "lf", display: "LF" },
      { code: "oncho" }, // no system/display — still valid
    ],
  };

  it("rewrites matched answerValueSet items into inline answerOption", () => {
    const out = applyLocalValueSets(q, options);
    const item = out.item[0];
    expect(item.answerValueSet).toBeUndefined();
    expect(item.answerOption).toEqual([
      { valueCoding: { code: "lf", system: "https://x/cs", display: "LF" } },
      { valueCoding: { code: "oncho" } },
    ]);
  });

  it("leaves unmatched (external) canonicals and non-choice items untouched", () => {
    const out = applyLocalValueSets(q, options);
    expect(out.item[1].item[0].answerValueSet).toBe("https://ext/ValueSet/foreign");
    expect(out.item[1].item[0].answerOption).toBeUndefined();
    expect(out.item[2]).toEqual({ linkId: "p_name", type: "string" });
  });

  it("does not mutate the input questionnaire", () => {
    const before = JSON.stringify(q);
    applyLocalValueSets(q, options);
    expect(JSON.stringify(q)).toBe(before);
  });

  it("returns the questionnaire unchanged (same reference) when nothing matches", () => {
    const plain = { resourceType: "Questionnaire", item: [{ linkId: "a", type: "string" }] };
    expect(applyLocalValueSets(plain, options)).toBe(plain);
    expect(applyLocalValueSets(q, {})).toBe(q);
  });

  it("does not clobber an existing answerOption", () => {
    const withOptions = {
      resourceType: "Questionnaire",
      item: [
        {
          linkId: "a",
          type: "choice",
          answerValueSet: "https://x/ValueSet/disease-vs",
          answerOption: [{ valueString: "keep me" }],
        },
      ],
    };
    const out = applyLocalValueSets(withOptions, options);
    expect(out.item[0].answerOption).toEqual([{ valueString: "keep me" }]);
    expect(out.item[0].answerValueSet).toBe("https://x/ValueSet/disease-vs");
  });
});
