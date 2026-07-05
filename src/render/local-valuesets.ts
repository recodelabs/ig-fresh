// Build-time resolution of Questionnaire `answerValueSet` canonicals against
// the IG's own ValueSets, so the interactive preview can populate choice
// options without asking an external terminology server (which does not know
// IG-local ValueSets — the live failure mode is a 422 from tx.fhir.org).
//
// Sources, in priority order:
//   1. the publisher's expansions.json (already loaded by the build),
//   2. an `expansion.contains` embedded in the ValueSet-<id>.json itself,
//   3. an enumerable `compose.include` (explicit concept lists, no filters).
// Canonicals that are not IG-local — or local but not enumerable — are left
// out of the result so the renderer's existing terminology-server behavior
// still applies to them.
import type { Artifact } from "../model/types.js";

export interface VsConcept {
  system?: string;
  code: string;
  display?: string;
}

/** Options for locally-resolvable ValueSets, keyed by the canonical exactly as written in the Questionnaire. */
export type LocalVsOptions = Record<string, VsConcept[]>;

/** Split a canonical reference into its URL and optional `|version` suffix. */
export function splitCanonical(canonical: string): { url: string; version?: string } {
  const i = canonical.indexOf("|");
  if (i === -1) return { url: canonical };
  return { url: canonical.slice(0, i), version: canonical.slice(i + 1) || undefined };
}

/** Collect the unique `answerValueSet` canonicals used anywhere in a Questionnaire's items. */
export function collectAnswerValueSets(items: unknown): string[] {
  const found = new Set<string>();
  const walk = (list: unknown) => {
    if (!Array.isArray(list)) return;
    for (const item of list) {
      if (item && typeof item === "object") {
        const avs = (item as { answerValueSet?: unknown }).answerValueSet;
        if (typeof avs === "string" && avs) found.add(avs);
        walk((item as { item?: unknown }).item);
      }
    }
  };
  walk(items);
  return [...found];
}

function conceptsFromExpansion(vs: any): VsConcept[] {
  const contains = vs?.expansion?.contains;
  if (!Array.isArray(contains)) return [];
  return contains
    .filter((c: any) => c && typeof c.code === "string" && c.abstract !== true)
    .map((c: any) => ({ system: c.system, code: c.code, display: c.display }));
}

/** compose.include is enumerable only if every include lists explicit concepts (no filters, no nested ValueSets). */
function conceptsFromCompose(vs: any): VsConcept[] {
  const includes = vs?.compose?.include;
  if (!Array.isArray(includes) || includes.length === 0) return [];
  if (Array.isArray(vs?.compose?.exclude) && vs.compose.exclude.length > 0) return [];
  const out: VsConcept[] = [];
  for (const inc of includes) {
    if (!inc || inc.filter || inc.valueSet || !Array.isArray(inc.concept) || inc.concept.length === 0) {
      return []; // not fully enumerable — bail out entirely
    }
    for (const c of inc.concept) {
      if (!c || typeof c.code !== "string") return [];
      out.push({ system: inc.system, code: c.code, display: c.display });
    }
  }
  return out;
}

/**
 * Resolve each canonical against the IG's ValueSet artifacts. Returns a map
 * holding only the canonicals that are IG-local *and* enumerable; everything
 * else is omitted (the preview leaves those items untouched).
 */
export function resolveLocalOptions(
  canonicals: string[],
  artifacts: Artifact[],
  expansions: Map<string, VsConcept[]>,
): LocalVsOptions {
  const byUrl = new Map<string, Artifact>();
  for (const a of artifacts) {
    if (a.resourceType === "ValueSet" && a.url) byUrl.set(a.url, a);
  }

  const out: LocalVsOptions = {};
  for (const canonical of canonicals) {
    const { url, version } = splitCanonical(canonical);
    const artifact = byUrl.get(url);
    if (!artifact) continue; // not IG-local → leave to the terminology server
    if (version && artifact.version && artifact.version !== version) continue; // version mismatch → not ours

    const concepts =
      (expansions.get(url) ?? []).length > 0
        ? expansions.get(url)!
        : conceptsFromExpansion(artifact.json).length > 0
          ? conceptsFromExpansion(artifact.json)
          : conceptsFromCompose(artifact.json);
    if (concepts.length > 0) out[canonical] = concepts;
  }
  return out;
}
