import fs from "node:fs";
import path from "node:path";
import type { Artifact, ArtifactKind, ResourceRef } from "../model/types.js";

const RT_KIND: Record<string, ArtifactKind> = {
  CodeSystem: "codesystem",
  ValueSet: "valueset",
  ConceptMap: "conceptmap",
  CapabilityStatement: "capability",
  OperationDefinition: "operation",
  Questionnaire: "questionnaire",
  Measure: "measure",
};

function classify(json: any, ref: ResourceRef | undefined): ArtifactKind {
  if (ref?.isExample) return "example";
  const rt = json.resourceType;
  if (rt === "StructureDefinition") {
    if (json.type === "Extension") return "extension";
    if (json.kind === "logical") return "logical";
    return "profile";
  }
  return RT_KIND[rt] ?? (ref ? "other" : "example");
}

/** Files the publisher emits alongside resources that are not page-worthy artifacts. */
function isResourceFile(name: string): boolean {
  if (!/^[A-Z][A-Za-z]+-[A-Za-z0-9.-]+\.json$/.test(name)) return false;
  if (/\.(canonical|escaped|change|openapi)\.json$/.test(name)) return false;
  if (/^ImplementationGuide-/.test(name)) return false;
  return true;
}

export function loadArtifacts(
  outputDir: string,
  resources: ResourceRef[],
  warn: (msg: string) => void = () => {},
): Artifact[] {
  const byRef = new Map(resources.map((r) => [r.reference, r]));
  const artifacts: Artifact[] = [];

  for (const file of fs.readdirSync(outputDir).sort()) {
    if (!isResourceFile(file)) continue;
    let json: any;
    try {
      json = JSON.parse(fs.readFileSync(path.join(outputDir, file), "utf8"));
    } catch (e) {
      warn(`Skipping unparseable ${file}: ${e}`);
      continue;
    }
    if (!json?.resourceType || !json?.id) continue;
    // filename must match "<ResourceType>-<id>.json" to be a rendered artifact page
    if (file !== `${json.resourceType}-${json.id}.json`) continue;

    const ref = byRef.get(`${json.resourceType}/${json.id}`);
    const kind = classify(json, ref);
    artifacts.push({
      kind,
      resourceType: json.resourceType,
      id: json.id,
      name: json.name ?? ref?.name ?? json.id,
      title: ref?.name ?? json.title ?? json.name ?? `${json.resourceType}/${json.id}`,
      description: json.description ?? ref?.description,
      url: json.url,
      version: json.version,
      status: json.status,
      filename: `${json.resourceType}-${json.id}.html`,
      json,
      ref,
    });
  }
  return artifacts;
}
