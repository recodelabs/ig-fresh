// Runtime half of local answerValueSet resolution: before the formbox island
// mounts a Questionnaire, rewrite items whose `answerValueSet` canonical was
// resolved at build time (see src/render/local-valuesets.ts) into inline
// `answerOption` codings — the renderer handles those natively and never asks
// a terminology server. Items whose canonical is not in the map are left
// untouched, so external ValueSets still fall through to tx.fhir.org.

/**
 * @param {object} questionnaire FHIR Questionnaire resource
 * @param {Record<string, Array<{system?: string, code: string, display?: string}>>} optionsByCanonical
 * @returns {object} a rewritten copy (the input is never mutated), or the
 *   original questionnaire when there is nothing to rewrite
 */
export function applyLocalValueSets(questionnaire, optionsByCanonical) {
  if (
    !questionnaire ||
    !optionsByCanonical ||
    typeof optionsByCanonical !== "object" ||
    Object.keys(optionsByCanonical).length === 0
  ) {
    return questionnaire;
  }

  let changed = false;
  const clone = JSON.parse(JSON.stringify(questionnaire));
  const walk = (items) => {
    if (!Array.isArray(items)) return;
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const canonical = item.answerValueSet;
      if (typeof canonical === "string" && !item.answerOption) {
        const concepts = optionsByCanonical[canonical];
        if (Array.isArray(concepts) && concepts.length > 0) {
          item.answerOption = concepts.map((c) => {
            const coding = { code: c.code };
            if (c.system) coding.system = c.system;
            if (c.display) coding.display = c.display;
            return { valueCoding: coding };
          });
          delete item.answerValueSet;
          changed = true;
        }
      }
      walk(item.item);
    }
  };
  walk(clone.item);
  return changed ? clone : questionnaire;
}
