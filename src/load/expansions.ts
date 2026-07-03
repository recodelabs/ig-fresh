import fs from "node:fs";
import path from "node:path";

export interface ExpansionConcept {
  system: string;
  code: string;
  display?: string;
}

/**
 * Load the publisher's expansions.json (a Bundle of ValueSets with
 * `expansion.contains`). Returns a map keyed by ValueSet canonical URL.
 * Missing or unparseable file → empty map.
 */
export function loadExpansions(
  outputDir: string,
  warn: (msg: string) => void = () => {},
): Map<string, ExpansionConcept[]> {
  const map = new Map<string, ExpansionConcept[]>();
  const file = path.join(outputDir, "expansions.json");
  if (!fs.existsSync(file)) return map;
  let bundle: any;
  try {
    bundle = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    warn(`Could not parse expansions.json: ${e}`);
    return map;
  }
  for (const entry of bundle.entry ?? []) {
    const vs = entry.resource;
    if (vs?.resourceType !== "ValueSet" || !vs.url) continue;
    const contains = vs.expansion?.contains ?? [];
    map.set(
      vs.url,
      contains.map((c: any) => ({ system: c.system ?? "", code: c.code ?? "", display: c.display })),
    );
  }
  return map;
}
