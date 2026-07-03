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
  json: any;
  ref?: ResourceRef;
}

export interface IgModel {
  meta: IgMeta;
  pages: PageNode[];
  artifacts: Artifact[];
  menu: { label: string; href: string }[];
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
