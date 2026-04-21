export type RequirementType = 'FR' | 'NFR';

export type IssueSeverity = 'error' | 'warning';

export type ValidationCategory =
  | 'missing_field'
  | 'format'
  | 'vague_wording'
  | 'atomicity'
  | 'verifiability'
  | 'duplicate'
  | 'traceability'
  | 'consistency'
  | 'feasibility'
  | 'nfr_category';

export interface Feature {
  id: string;
  name: string;
  description?: string;
  priority?: string;
}

export interface UseCase {
  id: string;
  name: string;
  goal?: string;
  primaryActors?: string[];
  preconditions?: string[];
  trigger?: string;
  mainFlow?: string[];
  postconditions?: string[];
  relatedFeatures?: string[];
}

export interface BaseRequirement {
  id: string;
  title: string;
  statement: string;
  rationale: string;
  source: string[];
  priority: string;
  fitCriterion: string;
  verificationMethod: string;
  notes?: string;
}

export interface FunctionalRequirement extends BaseRequirement {
  category?: string;
  preconditions?: string[];
  postconditions?: string[];
  dependsOn?: string[];
  conflictsWith?: string[];
  traceToFeatures?: string[];
  traceToUseCases?: string[];
}

export interface NonFunctionalRequirement extends BaseRequirement {
  traceToFeatures?: string[];
  traceToUseCases?: string[];
}

export type NfrCategoryKey =
  | 'performanceRequirements'
  | 'securityRequirements'
  | 'usabilityRequirements'
  | 'reliabilityRequirements'
  | 'availabilityRequirements'
  | 'maintainabilityRequirements'
  | 'portabilityRequirements'
  | 'scalabilityRequirements'
  | 'auditabilityRequirements'
  | 'accessibilityRequirements'
  | 'backupRecoveryRequirements'
  | 'complianceRequirements';

export type NonFunctionalRequirementsMap = Record<NfrCategoryKey, NonFunctionalRequirement[]>;

export interface QualityCheckSummary {
  completenessNotes: string[];
  ambiguityRisks: string[];
  consistencyRisks: string[];
  duplicationRisks: string[];
  missingTraceLinks: string[];
  assumptionsMade: string[];
}

export interface GeneratedRequirementsDocument {
  projectName: string;
  assumptions: string[];
  constraints: string[];
  features: Feature[];
  useCases: UseCase[];
  functionalRequirements: FunctionalRequirement[];
  nonFunctionalRequirements: NonFunctionalRequirementsMap;
  qualityCheckSummary: QualityCheckSummary;
}

export interface ValidationIssueDetails {
  matchedTerms?: string[];
  relatedRequirementIds?: string[];
  expected?: string;
  actual?: string;
}

export interface ValidationIssue {
  requirementId: string;
  requirementType: RequirementType;
  category: ValidationCategory;
  severity: IssueSeverity;
  field: string;
  message: string;
  details?: ValidationIssueDetails;
  suggestion?: string;
}

export interface ValidationSummary {
  totalRequirements: number;
  totalIssues: number;
  errors: number;
  warnings: number;
}

export interface ValidationResult {
  isValid: boolean;
  summary: ValidationSummary;
  qualityScore: number;
  issues: ValidationIssue[];
}

export interface AutoFixSuggestion {
  requirementId: string;
  requirementType: RequirementType;
  category: ValidationCategory;
  message: string;
  suggestion: string;
}

export interface ValidationConfig {
  vagueTerms: string[];
  duplicateSimilarityThreshold: number;
  minimumStatementLength: number;
  minimumFitCriterionLength: number;
  maxAndCount: number;
  maxOrCount: number;
  maxSemicolonCount: number;
  maxShallCount: number;
  placeholderTerms: string[];
  weakFitCriterionTerms: string[];
  infeasiblePhrases: string[];
  preferredNfrTraceCoverageThreshold: number;
}

export type ValidatorConfig = ValidationConfig;

