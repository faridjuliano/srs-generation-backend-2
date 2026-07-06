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

function normalizeRequirements<
  T extends FunctionalRequirement | NonFunctionalRequirement
>(
  items: unknown,
  predicate: (item: Partial<T> | null | undefined) => item is T,
  normalize: (item: T) => T
): T[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return (items as Array<Partial<T> | null | undefined>)
    .filter(predicate)
    .map(normalize);
}

function normalizeNfrSection(
  title: string,
  requirements: unknown
): {
  title: string;
  requirements: NonFunctionalRequirement[];
} {
  return {
    title,
    requirements: normalizeRequirements<NonFunctionalRequirement>(
      requirements,
      isNonEmptyNonFunctionalRequirement,
      normalizeNonFunctionalRequirement
    ),
  };
}

/**
 * Maps FRs into feature sections without duplicating them.
 *
 * If an FR traces to multiple features, it is displayed only under the first
 * valid feature in traceToFeatures. However, the full traceToFeatures array
 * is still preserved inside the requirement, so the DOCX can still show all
 * trace links.
 */
function mapFeaturesWithUniqueFunctionalRequirements(
  features: Feature[],
  functionalRequirements: FunctionalRequirement[]
): Array<
  Feature & {
  relatedFunctionalRequirements: FunctionalRequirement[];
}
> {
  const featureIds = new Set(features.map((feature) => feature.id));
  const exportedFrIds = new Set<string>();

  return features.map((feature) => {
    const relatedFunctionalRequirements = functionalRequirements.filter((fr) => {
      if (!hasText(fr.id)) return false;

      const traceToFeatures = cleanStringArray(fr.traceToFeatures);

      if (traceToFeatures.length === 0) return false;

      // Select the first valid feature as the display/primary feature.
      const primaryFeatureId = traceToFeatures.find((id) => featureIds.has(id));

      if (primaryFeatureId !== feature.id) return false;

      // Extra protection: prevent the same FR from being exported twice.
      if (exportedFrIds.has(fr.id)) return false;

      exportedFrIds.add(fr.id);
      return true;
    });

    return {
      ...feature,
      relatedFunctionalRequirements,
    };
  });
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

  const features: Feature[] = Array.isArray(content.features)
    ? content.features.filter(isNonEmptyFeature)
    : [];

  const nonFunctionalRequirementSections = [
    normalizeNfrSection(
      "Performance Requirements",
      nonFunctionalRequirements.performanceRequirements
    ),
    normalizeNfrSection(
      "Safety Requirements",
      nonFunctionalRequirements.safetyRequirements
    ),
    normalizeNfrSection(
      "Security Requirements",
      nonFunctionalRequirements.securityRequirements
    ),
    normalizeNfrSection(
      "Usability Requirements",
      nonFunctionalRequirements.usabilityRequirements
    ),
    normalizeNfrSection(
      "Reliability Requirements",
      nonFunctionalRequirements.reliabilityRequirements
    ),
    normalizeNfrSection(
      "Availability Requirements",
      nonFunctionalRequirements.availabilityRequirements
    ),
    normalizeNfrSection(
      "Maintainability Requirements",
      nonFunctionalRequirements.maintainabilityRequirements
    ),
    normalizeNfrSection(
      "Portability Requirements",
      nonFunctionalRequirements.portabilityRequirements
    ),
    normalizeNfrSection(
      "Accessibility Requirements",
      nonFunctionalRequirements.accessibilityRequirements
    ),
    normalizeNfrSection(
      "Auditability Requirements",
      nonFunctionalRequirements.auditabilityRequirements
    ),
    normalizeNfrSection(
      "Scalability Requirements",
      nonFunctionalRequirements.scalabilityRequirements
    ),
    normalizeNfrSection(
      "Compliance Requirements",
      nonFunctionalRequirements.complianceRequirements
    ),
    normalizeNfrSection(
      "Backup and Recovery Requirements",
      nonFunctionalRequirements.backupRecoveryRequirements
    ),
  ].filter((section) => section.requirements.length > 0);

  return {
    projectName: content.projectName || project.projectName,

    features: mapFeaturesWithUniqueFunctionalRequirements(
      features,
      functionalRequirements
    ),

    nonFunctionalRequirementSections,
  };
}