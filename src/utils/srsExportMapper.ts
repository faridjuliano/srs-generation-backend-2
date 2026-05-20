import {
  StoredSrsProject,
  SrsFrNfrExportData,
  Feature,
  FunctionalRequirement,
  NonFunctionalRequirement,
} from "../types/srs.types";

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function cleanStringArray(values: unknown): string[] {
  return Array.isArray(values)
    ? values.filter(hasText).map((value) => value.trim())
    : [];
}

function isNonEmptyFeature(
  feature: Partial<Feature> | null | undefined
): feature is Feature {
  return Boolean(
    feature &&
      (hasText(feature.id) ||
        hasText(feature.name) ||
        hasText(feature.description) ||
        hasText(feature.priority) ||
        hasText(feature.source))
  );
}

function isNonEmptyFunctionalRequirement(
  requirement: Partial<FunctionalRequirement> | null | undefined
): requirement is FunctionalRequirement {
  return Boolean(
    requirement &&
      (hasText(requirement.id) ||
        hasText(requirement.statement) ||
        hasText(requirement.title) ||
        hasText(requirement.priority) ||
        hasText(requirement.category) ||
        hasText(requirement.rationale) ||
        hasText(requirement.fitCriterion) ||
        hasText(requirement.verificationMethod) ||
        cleanStringArray(requirement.preconditions).length > 0 ||
        cleanStringArray(requirement.postconditions).length > 0 ||
        cleanStringArray(requirement.traceToFeatures).length > 0 ||
        cleanStringArray(requirement.traceToAssumptions).length > 0 ||
        cleanStringArray(requirement.traceToConstraints).length > 0 ||
        cleanStringArray(requirement.dependsOn).length > 0 ||
        cleanStringArray(requirement.conflictsWith).length > 0 ||
        cleanStringArray(requirement.source).length > 0 ||
        hasText(requirement.notes))
  );
}

function isNonEmptyNonFunctionalRequirement(
  requirement: Partial<NonFunctionalRequirement> | null | undefined
): requirement is NonFunctionalRequirement {
  return Boolean(
    requirement &&
      (hasText(requirement.id) ||
        hasText(requirement.statement) ||
        hasText(requirement.title) ||
        hasText(requirement.priority) ||
        hasText(requirement.rationale) ||
        hasText(requirement.fitCriterion) ||
        hasText(requirement.verificationMethod) ||
        cleanStringArray(requirement.traceToFeatures).length > 0 ||
        cleanStringArray(requirement.traceToAssumptions).length > 0 ||
        cleanStringArray(requirement.traceToConstraints).length > 0 ||
        cleanStringArray(requirement.source).length > 0 ||
        hasText(requirement.notes))
  );
}

function normalizeFunctionalRequirement(
  requirement: FunctionalRequirement
): FunctionalRequirement {
  return {
    ...requirement,
    preconditions: cleanStringArray(requirement.preconditions),
    postconditions: cleanStringArray(requirement.postconditions),
    traceToFeatures: cleanStringArray(requirement.traceToFeatures),
    traceToAssumptions: cleanStringArray(requirement.traceToAssumptions),
    traceToConstraints: cleanStringArray(requirement.traceToConstraints),
    dependsOn: cleanStringArray(requirement.dependsOn),
    conflictsWith: cleanStringArray(requirement.conflictsWith),
    source: cleanStringArray(requirement.source),
  };
}

function normalizeNonFunctionalRequirement(
  requirement: NonFunctionalRequirement
): NonFunctionalRequirement {
  return {
    ...requirement,
    traceToFeatures: cleanStringArray(requirement.traceToFeatures),
    traceToAssumptions: cleanStringArray(requirement.traceToAssumptions),
    traceToConstraints: cleanStringArray(requirement.traceToConstraints),
    source: cleanStringArray(requirement.source),
  };
}

function normalizeRequirements<T extends FunctionalRequirement | NonFunctionalRequirement>(
  items: unknown[],
  predicate: (item: Partial<T> | null | undefined) => item is T,
  normalize: (item: T) => T
): T[] {
  return (items as Array<Partial<T> | null | undefined>)
    .filter(predicate)
    .map(normalize);
}

export function mapStoredProjectToFrNfrExportData(
  project: StoredSrsProject
): SrsFrNfrExportData {
  const content = project.generatedSrs.content;

  const functionalRequirements = normalizeRequirements<FunctionalRequirement>(
    content.functionalRequirements || [],
    isNonEmptyFunctionalRequirement,
    normalizeFunctionalRequirement
  );

  const nonFunctionalRequirements = content.nonFunctionalRequirements || {};
  const features = (content.features || []).filter(isNonEmptyFeature);

  return {
    features: features.map((feature, index) => ({
      number: `4.${index + 1}`,
      id: feature.id,
      name: feature.name,
      description: feature.description,
      priority: feature.priority,
      relatedFunctionalRequirements: functionalRequirements.filter((fr) =>
        fr.traceToFeatures?.includes(feature.id)
      ),
    })),

    performanceRequirements: normalizeRequirements<NonFunctionalRequirement>(
      nonFunctionalRequirements.performanceRequirements || [],
      isNonEmptyNonFunctionalRequirement,
      normalizeNonFunctionalRequirement
    ),

    safetyRequirements: normalizeRequirements<NonFunctionalRequirement>(
      nonFunctionalRequirements.safetyRequirements || [],
      isNonEmptyNonFunctionalRequirement,
      normalizeNonFunctionalRequirement
    ),

    securityRequirements: normalizeRequirements<NonFunctionalRequirement>(
      nonFunctionalRequirements.securityRequirements || [],
      isNonEmptyNonFunctionalRequirement,
      normalizeNonFunctionalRequirement
    ),

    usabilityRequirements: normalizeRequirements<NonFunctionalRequirement>(
      nonFunctionalRequirements.usabilityRequirements || [],
      isNonEmptyNonFunctionalRequirement,
      normalizeNonFunctionalRequirement
    ),

    reliabilityRequirements: normalizeRequirements<NonFunctionalRequirement>(
      nonFunctionalRequirements.reliabilityRequirements || [],
      isNonEmptyNonFunctionalRequirement,
      normalizeNonFunctionalRequirement
    ),

    availabilityRequirements: normalizeRequirements<NonFunctionalRequirement>(
      nonFunctionalRequirements.availabilityRequirements || [],
      isNonEmptyNonFunctionalRequirement,
      normalizeNonFunctionalRequirement
    ),

    maintainabilityRequirements: normalizeRequirements<NonFunctionalRequirement>(
      nonFunctionalRequirements.maintainabilityRequirements || [],
      isNonEmptyNonFunctionalRequirement,
      normalizeNonFunctionalRequirement
    ),

    portabilityRequirements: normalizeRequirements<NonFunctionalRequirement>(
      nonFunctionalRequirements.portabilityRequirements || [],
      isNonEmptyNonFunctionalRequirement,
      normalizeNonFunctionalRequirement
    ),

    accessibilityRequirements: normalizeRequirements<NonFunctionalRequirement>(
      nonFunctionalRequirements.accessibilityRequirements || [],
      isNonEmptyNonFunctionalRequirement,
      normalizeNonFunctionalRequirement
    ),

    auditabilityRequirements: normalizeRequirements<NonFunctionalRequirement>(
      nonFunctionalRequirements.auditabilityRequirements || [],
      isNonEmptyNonFunctionalRequirement,
      normalizeNonFunctionalRequirement
    ),

    scalabilityRequirements: normalizeRequirements<NonFunctionalRequirement>(
      nonFunctionalRequirements.scalabilityRequirements || [],
      isNonEmptyNonFunctionalRequirement,
      normalizeNonFunctionalRequirement
    ),

    complianceRequirements: normalizeRequirements<NonFunctionalRequirement>(
      nonFunctionalRequirements.complianceRequirements || [],
      isNonEmptyNonFunctionalRequirement,
      normalizeNonFunctionalRequirement
    ),

    backupRecoveryRequirements: normalizeRequirements<NonFunctionalRequirement>(
      nonFunctionalRequirements.backupRecoveryRequirements || [],
      isNonEmptyNonFunctionalRequirement,
      normalizeNonFunctionalRequirement
    ),
  };
}

