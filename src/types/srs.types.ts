export interface StoredSrsProject {
  success?: boolean;
  projectId: string;
  projectName: string;
  projectDescription?: string;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
  generatedSrs: {
    validation?: unknown;
    content: GeneratedSrsContent;
    autoFixSuggestions?: unknown[];
  };
}

export interface GeneratedSrsContent {
  projectName: string;
  features?: Feature[];
  functionalRequirements?: FunctionalRequirement[];
  nonFunctionalRequirements?: NonFunctionalRequirements;
  constraints?: unknown[];
  assumptions?: unknown[];
}

export interface Feature {
  id: string;
  name: string;
  description: string;
  priority: string;
  source?: string;
}

export interface FunctionalRequirement {
  id: string;
  title?: string;
  statement: string;
  priority?: string;
  category?: string;
  rationale?: string;
  fitCriterion?: string;
  verificationMethod?: string;
  preconditions?: string[];
  postconditions?: string[];
  traceToFeatures?: string[];
  traceToAssumptions?: string[];
  traceToConstraints?: string[];
  dependsOn?: string[];
  conflictsWith?: string[];
  source?: string[];
  notes?: string;
}

export interface NonFunctionalRequirement {
  id: string;
  title?: string;
  statement: string;
  priority?: string;
  rationale?: string;
  fitCriterion?: string;
  verificationMethod?: string;
  traceToFeatures?: string[];
  traceToAssumptions?: string[];
  traceToConstraints?: string[];
  source?: string[];
  notes?: string;
}

export interface NonFunctionalRequirements {
  performanceRequirements?: NonFunctionalRequirement[];
  safetyRequirements?: NonFunctionalRequirement[];
  securityRequirements?: NonFunctionalRequirement[];
  usabilityRequirements?: NonFunctionalRequirement[];
  reliabilityRequirements?: NonFunctionalRequirement[];
  availabilityRequirements?: NonFunctionalRequirement[];
  maintainabilityRequirements?: NonFunctionalRequirement[];
  portabilityRequirements?: NonFunctionalRequirement[];
  accessibilityRequirements?: NonFunctionalRequirement[];
  auditabilityRequirements?: NonFunctionalRequirement[];
  scalabilityRequirements?: NonFunctionalRequirement[];
  complianceRequirements?: NonFunctionalRequirement[];
  backupRecoveryRequirements?: NonFunctionalRequirement[];
}

/**
 * Export type for Section 4: System Features.
 *
 * This is used by Docxtemplater:
 *
 * {#features}
 * {name}
 * ...
 * {#relatedFunctionalRequirements}
 * {id}: {statement}
 * {/relatedFunctionalRequirements}
 * {/features}
 */
export interface ExportFeature {
  id: string;
  name: string;
  description: string;
  priority: string;
  relatedFunctionalRequirements: FunctionalRequirement[];
}

/**
 * Export type for Section 5: Other Nonfunctional Requirements.
 *
 * This allows the NFR section headers to be dynamic.
 *
 * Example output:
 * - Performance Requirements
 * - Security Requirements
 * - Usability Requirements
 *
 * Empty sections will not be exported if your mapper filters them out.
 */
export interface ExportNonFunctionalRequirementSection {
  title: string;
  requirements: NonFunctionalRequirement[];
}

/**
 * Final export data passed into Docxtemplater.
 *
 * This matches the corrected dynamic DOCX template.
 */
export interface SrsFrNfrExportData {
  projectName: string;
  features: ExportFeature[];
  nonFunctionalRequirementSections: ExportNonFunctionalRequirementSection[];
}