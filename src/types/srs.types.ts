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

export interface ExportFeature {
  number: string;
  id: string;
  name: string;
  description: string;
  priority: string;
  relatedFunctionalRequirements: FunctionalRequirement[];
}

export interface SrsFrNfrExportData {
  features: ExportFeature[];

  performanceRequirements: NonFunctionalRequirement[];
  safetyRequirements: NonFunctionalRequirement[];
  securityRequirements: NonFunctionalRequirement[];
  usabilityRequirements: NonFunctionalRequirement[];
  reliabilityRequirements: NonFunctionalRequirement[];
  availabilityRequirements: NonFunctionalRequirement[];
  maintainabilityRequirements: NonFunctionalRequirement[];
  portabilityRequirements: NonFunctionalRequirement[];
  accessibilityRequirements: NonFunctionalRequirement[];
  auditabilityRequirements: NonFunctionalRequirement[];
  scalabilityRequirements: NonFunctionalRequirement[];
  complianceRequirements: NonFunctionalRequirement[];
  backupRecoveryRequirements: NonFunctionalRequirement[];
}

