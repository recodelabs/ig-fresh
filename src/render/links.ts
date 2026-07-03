import type { Artifact } from "../model/types.js";

const R4_CORE = "http://hl7.org/fhir/R4";

/** All FHIR R4 resource type names, for core-spec link targets. */
const R4_RESOURCES = new Set(
  ("Account ActivityDefinition AdverseEvent AllergyIntolerance Appointment AppointmentResponse AuditEvent Basic Binary " +
    "BiologicallyDerivedProduct BodyStructure Bundle CapabilityStatement CarePlan CareTeam CatalogEntry ChargeItem " +
    "ChargeItemDefinition Claim ClaimResponse ClinicalImpression CodeSystem Communication CommunicationRequest " +
    "CompartmentDefinition Composition ConceptMap Condition Consent Contract Coverage CoverageEligibilityRequest " +
    "CoverageEligibilityResponse DetectedIssue Device DeviceDefinition DeviceMetric DeviceRequest DeviceUseStatement " +
    "DiagnosticReport DocumentManifest DocumentReference EffectEvidenceSynthesis Encounter Endpoint EnrollmentRequest " +
    "EnrollmentResponse EpisodeOfCare EventDefinition Evidence EvidenceVariable ExampleScenario ExplanationOfBenefit " +
    "FamilyMemberHistory Flag Goal GraphDefinition Group GuidanceResponse HealthcareService ImagingStudy Immunization " +
    "ImmunizationEvaluation ImmunizationRecommendation ImplementationGuide InsurancePlan Invoice Library Linkage List " +
    "Location Measure MeasureReport Media Medication MedicationAdministration MedicationDispense MedicationKnowledge " +
    "MedicationRequest MedicationStatement MedicinalProduct MedicinalProductAuthorization MedicinalProductContraindication " +
    "MedicinalProductIndication MedicinalProductIngredient MedicinalProductInteraction MedicinalProductManufactured " +
    "MedicinalProductPackaged MedicinalProductPharmaceutical MedicinalProductUndesirableEffect MessageDefinition " +
    "MessageHeader MolecularSequence NamingSystem NutritionOrder Observation ObservationDefinition OperationDefinition " +
    "OperationOutcome Organization OrganizationAffiliation Parameters Patient PaymentNotice PaymentReconciliation Person " +
    "PlanDefinition Practitioner PractitionerRole Procedure Provenance Questionnaire QuestionnaireResponse RelatedPerson " +
    "RequestGroup ResearchDefinition ResearchElementDefinition ResearchStudy ResearchSubject RiskAssessment " +
    "RiskEvidenceSynthesis Schedule SearchParameter ServiceRequest Slot Specimen SpecimenDefinition StructureDefinition " +
    "StructureMap Subscription Substance SubstanceNucleicAcid SubstancePolymer SubstanceProtein " +
    "SubstanceReferenceInformation SubstanceSourceMaterial SubstanceSpecification SupplyDelivery SupplyRequest Task " +
    "TerminologyCapabilities TestReport TestScript ValueSet VerificationResult VisionPrescription Resource DomainResource").split(" "),
);

export class LinkResolver {
  private byUrl = new Map<string, Artifact>();
  private byRef = new Map<string, Artifact>();

  constructor(artifacts: Artifact[]) {
    for (const a of artifacts) {
      if (a.url) this.byUrl.set(a.url, a);
      this.byRef.set(`${a.resourceType}/${a.id}`, a);
    }
  }

  artifactFor(urlOrRef: string): Artifact | undefined {
    const clean = urlOrRef.split("|")[0];
    return this.byUrl.get(clean) ?? this.byRef.get(clean);
  }

  /** Resolve a canonical URL or local reference to an href, if we know one. */
  hrefFor(urlOrRef: string): string | undefined {
    const clean = urlOrRef.split("|")[0];
    const local = this.artifactFor(clean);
    if (local) return local.filename;
    // core spec structure definitions: http://hl7.org/fhir/StructureDefinition/X
    const m = clean.match(/^http:\/\/hl7\.org\/fhir\/StructureDefinition\/(.+)$/);
    if (m) {
      const name = m[1];
      if (R4_RESOURCES.has(name)) return `${R4_CORE}/${name.toLowerCase()}.html`;
      if (/^[a-z]/.test(name)) return `${R4_CORE}/datatypes.html#${name}`;
      return `${R4_CORE}/extension-${name.toLowerCase()}.html`;
    }
    const vs = clean.match(/^http:\/\/hl7\.org\/fhir\/ValueSet\/(.+)$/);
    if (vs) return `${R4_CORE}/valueset-${vs[1]}.html`;
    const cs = clean.match(/^http:\/\/hl7\.org\/fhir\/CodeSystem\/(.+)$/);
    if (cs) return `${R4_CORE}/codesystem-${cs[1]}.html`;
    if (/^https?:\/\//.test(clean)) return clean; // other canonicals: link raw
    return undefined;
  }

  /** Link target for a FHIR type code shown in the element tree. */
  hrefForType(code: string): string | undefined {
    if (!code) return undefined;
    if (code === "Extension") return `${R4_CORE}/extensibility.html`;
    if (code === "Reference") return `${R4_CORE}/references.html`;
    if (code === "BackboneElement") return `${R4_CORE}/backboneelement.html`;
    if (R4_RESOURCES.has(code)) return `${R4_CORE}/${code.toLowerCase()}.html`;
    if (/^[a-z]/.test(code)) return `${R4_CORE}/datatypes.html#${code}`;
    if (/^[A-Z]/.test(code)) return `${R4_CORE}/datatypes.html#${code}`;
    return undefined;
  }
}
