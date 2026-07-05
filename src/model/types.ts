export type ArtifactKind =
  | "profile"
  | "extension"
  | "logical"
  | "codesystem"
  | "valueset"
  | "conceptmap"
  | "capability"
  | "operation"
  | "questionnaire"
  | "measure"
  | "example"
  | "other";

export interface IgMeta {
  id: string;
  name: string;
  title: string;
  canonical: string;
  version: string;
  status: string;
  fhirVersion: string;
  publisher?: string;
  description?: string;
  license?: string;
  dependencies: { id: string; version: string; uri: string }[];
}

export interface PageNode {
  source: string; // e.g. "index.html"
  title: string;
  children: PageNode[];
}

export interface ResourceRef {
  reference: string; // "StructureDefinition/icr-campaign"
  name?: string;
  description?: string;
  isExample: boolean;
  profiles: string[]; // canonical URLs this instance exemplifies
}

/** A project/source tag derived from an artifact's FHIR `meta.tag` coding. */
export interface ArtifactTag {
  code: string; // the coding.code (stable identifier used for filtering)
  label: string; // coding.display, falling back to code
}

export interface Artifact {
  kind: ArtifactKind;
  resourceType: string;
  id: string;
  name: string;
  title: string;
  description?: string;
  url?: string;
  version?: string;
  status?: string;
  filename: string; // "StructureDefinition-icr-campaign.html"
  /** Project tags read from `meta.tag` (empty when none). */
  tags: ArtifactTag[];
  json: any;
  ref?: ResourceRef;
}

/**
 * Maps a logical runtime-asset name (e.g. `"site.js"`) to its emitted,
 * content-fingerprinted href relative to a page (e.g. `"igf/site.a1b2c3d4.js"`).
 * Produced by the site build; absent in unit tests, where the shell falls back
 * to the stable un-hashed `igf/<name>` paths.
 */
export type AssetManifest = Record<string, string>;

export interface IgModel {
  meta: IgMeta;
  pages: PageNode[];
  artifacts: Artifact[];
  menu: { label: string; href: string }[];
  /** Content-fingerprinted runtime asset hrefs, set by the site build. */
  assets?: AssetManifest;
}

/** Display metadata for each artifact kind, in canonical display order. */
export const KIND_INFO: Record<ArtifactKind, { label: string; plural: string }> = {
  profile: { label: "Profile", plural: "Profiles" },
  extension: { label: "Extension", plural: "Extensions" },
  logical: { label: "Logical Model", plural: "Logical Models" },
  codesystem: { label: "Code System", plural: "Code Systems" },
  valueset: { label: "Value Set", plural: "Value Sets" },
  conceptmap: { label: "Concept Map", plural: "Concept Maps" },
  capability: { label: "Capability Statement", plural: "Capability Statements" },
  operation: { label: "Operation", plural: "Operations" },
  questionnaire: { label: "Questionnaire", plural: "Questionnaires" },
  measure: { label: "Measure", plural: "Measures" },
  example: { label: "Example", plural: "Examples" },
  other: { label: "Artifact", plural: "Other Artifacts" },
};

export const KIND_ORDER: ArtifactKind[] = [
  "profile",
  "extension",
  "logical",
  "valueset",
  "codesystem",
  "conceptmap",
  "questionnaire",
  "measure",
  "capability",
  "operation",
  "example",
  "other",
];
