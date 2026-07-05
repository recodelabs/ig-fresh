import fs from "node:fs";
import path from "node:path";

export interface ExpansionConcept {
  system: string;
  code: string;
  display?: string;
}

/**
 * Load the publisher's computed ValueSet expansions. Two sources, merged:
 * the expansions.json Bundle (ValueSets with `expansion.contains`), then any
 * per-ValueSet `ValueSet-<id>.expansion.json` files (newer publishers emit
 * these alongside the definition JSON) — the per-VS files win on conflict.
 * Returns a map keyed by ValueSet canonical URL. Missing or unparseable
 * files → skipped (empty map when nothing is loadable).
 */
export function loadExpansions(
  outputDir: string,
  warn: (msg: string) => void = () => {},
): Map<string, ExpansionConcept[]> {
  const map = new Map<string, ExpansionConcept[]>();

  const addValueSet = (vs: any) => {
    if (vs?.resourceType !== "ValueSet" || !vs.url) return;
    const contains = vs.expansion?.contains;
    if (!Array.isArray(contains)) return;
    map.set(
      vs.url,
      contains
        .filter((c: any) => c && typeof c.code === "string" && c.abstract !== true)
        .map((c: any) => ({ system: c.system ?? "", code: c.code, display: c.display })),
    );
  };

  const file = path.join(outputDir, "expansions.json");
  if (fs.existsSync(file)) {
    try {
      const bundle = JSON.parse(fs.readFileSync(file, "utf8"));
      for (const entry of bundle.entry ?? []) addValueSet(entry.resource);
    } catch (e) {
      warn(`Could not parse expansions.json: ${e}`);
    }
  }

  let names: string[] = [];
  try {
    names = fs.readdirSync(outputDir);
  } catch {
    return map;
  }
  for (const name of names) {
    if (!/^ValueSet-.+\.expansion\.json$/.test(name)) continue;
    try {
      addValueSet(JSON.parse(fs.readFileSync(path.join(outputDir, name), "utf8")));
    } catch (e) {
      warn(`Could not parse ${name}: ${e}`);
    }
  }
  return map;
}
