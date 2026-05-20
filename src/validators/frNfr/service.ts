import {
  AutoFixSuggestion,
  FunctionalRequirement,
  GeneratedRequirementsDocument,
  NonFunctionalRequirement,
  ValidationConfig,
  ValidationIssue,
  ValidationResult,
} from '../../types/frNfrValidation';
import type { ValidationModel, ValidationOptions } from '../../types/frNfrValidation';
import { generateGeminiValidatorPrompt } from '../../prompts/promptBuilder';
import type { RequirementInput, RequirementType, ValidatorInput } from '../../prompts/promptBuilder';
import { generateWithGemini } from '../../services/geminiService';
import { repairJson } from '../../services/jsonRepairService';
import { DEFAULT_VALIDATION_CONFIG, NFR_CATEGORIES } from './constants';
import { buildAutoFixSuggestions } from './autoFixSuggestions';
import {
  validateAtomicity,
  validateConsistency,
  validateDuplicates,
  validateFeasibility,
  validateRequiredFields,
  validateStatementFormat,
  validateTraceability,
  validateVagueWording,
  validateVerifiability,
  ValidationContext,
} from './sharedValidators';
import { validateFunctionalRequirementRules } from './frValidators';
import { validateNonFunctionalRequirementRules } from './nfrValidators';
import { ensureNfrMap, flattenRequirements, getFeatureIdSet, getUseCaseIdSet, mergeValidationConfig } from './utils';

function dedupeIssues(issues: ValidationIssue[]): ValidationIssue[] {
  const seen = new Set<string>();
  const output: ValidationIssue[] = [];

  for (const issue of issues) {
    const key = [
      issue.requirementId,
      issue.requirementType,
      issue.category,
      issue.field,
      issue.severity,
      issue.message,
      (issue.details?.relatedRequirementIds || []).join(','),
    ].join('|');

    if (!seen.has(key)) {
      seen.add(key);
      output.push(issue);
    }
  }

  return output;
}

function createSummary(totalRequirements: number, issues: ValidationIssue[]): ValidationResult['summary'] {
  const errors = issues.filter((issue) => issue.severity === 'error').length;
  const warnings = issues.filter((issue) => issue.severity === 'warning').length;

  return {
    totalRequirements,
    totalIssues: issues.length,
    errors,
    warnings,
  };
}

function calculateQualityScore(issues: ValidationIssue[]): number {
  const errorCount = issues.filter((issue) => issue.severity === 'error').length;
  const warningCount = issues.filter((issue) => issue.severity === 'warning').length;
  return Math.max(0, 100 - errorCount * 10 - warningCount * 5);
}

function normalizeDocument(input: GeneratedRequirementsDocument): GeneratedRequirementsDocument {
  return {
    projectName: input.projectName || '',
    assumptions: Array.isArray(input.assumptions) ? input.assumptions : [],
    constraints: Array.isArray(input.constraints) ? input.constraints : [],
    features: Array.isArray(input.features) ? input.features : [],
    useCases: Array.isArray(input.useCases) ? input.useCases : [],
    functionalRequirements: Array.isArray(input.functionalRequirements) ? input.functionalRequirements : [],
    nonFunctionalRequirements: ensureNfrMap(input.nonFunctionalRequirements),
    qualityCheckSummary: {
      completenessNotes: input.qualityCheckSummary?.completenessNotes || [],
      ambiguityRisks: input.qualityCheckSummary?.ambiguityRisks || [],
      consistencyRisks: input.qualityCheckSummary?.consistencyRisks || [],
      duplicationRisks: input.qualityCheckSummary?.duplicationRisks || [],
      missingTraceLinks: input.qualityCheckSummary?.missingTraceLinks || [],
      assumptionsMade: input.qualityCheckSummary?.assumptionsMade || [],
    },
  };
}

function createValidationContext(
  input: GeneratedRequirementsDocument,
  config?: Partial<ValidationConfig>,
): ValidationContext {
  const safeDocument = normalizeDocument(input);
  const finalConfig = mergeValidationConfig(config);

  return {
    document: safeDocument,
    config: finalConfig,
    flattenedRequirements: flattenRequirements(safeDocument),
    featureIds: getFeatureIdSet(safeDocument),
    useCaseIds: getUseCaseIdSet(safeDocument),
  };
}

function toGeminiRequirementInput(
  requirementType: RequirementType,
  requirement: FunctionalRequirement | NonFunctionalRequirement,
): RequirementInput {
  const source = requirement.source.join('; ');

  const traceToFeatures = Array.isArray(requirement.traceToFeatures)
    ? requirement.traceToFeatures
    : [];
  const traceToUseCases = Array.isArray(requirement.traceToUseCases)
    ? requirement.traceToUseCases
    : [];

  return {
    id: requirement.id,
    type: requirementType,
    title: requirement.title,
    description: requirement.statement,
    rationale: requirement.rationale,
    source,
    trace_link: traceToFeatures[0] || traceToUseCases[0],
    priority: requirement.priority,
    fit_criterion: requirement.fitCriterion,
    category:
      requirementType === 'FR' && 'category' in requirement && typeof requirement.category === 'string'
        ? requirement.category
        : undefined,
  };
}

function buildGeminiValidatorInput(
  document: GeneratedRequirementsDocument,
  requirementType: RequirementType,
): ValidatorInput {
  const sourceRequirements = requirementType === 'FR'
    ? document.functionalRequirements
    : Object.values(document.nonFunctionalRequirements).flat();

  return {
    project_context: {
      project_name: document.projectName,
      scope_note: `Auto-validate ${requirementType} requirements generated by FR/NFR endpoint.`,
    },
    template_type: requirementType,
    requirements: sourceRequirements.map((requirement) => toGeminiRequirementInput(requirementType, requirement)),
  };
}

type GeminiSeverity = 'FAIL' | 'WARNING' | 'PASS';

interface GeminiIssue {
  severity?: GeminiSeverity;
  rule?: string;
  message?: string;
  evidence?: string;
  related_requirement_ids?: string[];
  suggestion?: string;
}

interface GeminiRequirementResult {
  id?: string;
  type?: RequirementType;
  issues?: GeminiIssue[];
}

interface GeminiCrossRequirementFinding {
  severity?: 'WARNING' | 'FAIL';
  rule?: string;
  message?: string;
  related_requirement_ids?: string[];
  suggestion?: string;
}

interface GeminiValidationOutput {
  summary?: {
    overall_score?: number;
  };
  requirement_results?: GeminiRequirementResult[];
  cross_requirement_findings?: GeminiCrossRequirementFinding[];
}

function mapGeminiRuleToCategory(rule?: string): ValidationIssue['category'] {
  switch ((rule || '').toLowerCase()) {
    case 'missing_required_field':
      return 'missing_field';
    case 'vague_wording':
      return 'vague_wording';
    case 'duplicate':
      return 'duplicate';
    case 'missing_trace':
      return 'traceability';
    case 'unverifiable':
      return 'verifiability';
    case 'combined_requirement':
      return 'atomicity';
    case 'ambiguity':
      return 'format';
    case 'inconsistency':
    case 'terminology_conflict':
      return 'consistency';
    default:
      return 'consistency';
  }
}

function mapGeminiSeverityToIssueSeverity(severity?: GeminiSeverity): ValidationIssue['severity'] | null {
  if (severity === 'FAIL') return 'error';
  if (severity === 'WARNING') return 'warning';
  return null;
}

function normalizeRequirementType(value?: string, fallback?: RequirementType): RequirementType {
  if (value === 'FR' || value === 'NFR') return value;
  return fallback || 'FR';
}

function buildValidationResultFromGeminiOutputs(
  outputs: GeminiValidationOutput[],
  context: ValidationContext,
): ValidationResult & {
  byType?: {
    FR?: { issues: ValidationIssue[]; summary: ValidationResult['summary']; qualityScore: number };
    NFR?: { issues: ValidationIssue[]; summary: ValidationResult['summary']; qualityScore: number };
  };
} {
  const allIssues: ValidationIssue[] = [];
  const frIssues: ValidationIssue[] = [];
  const nfrIssues: ValidationIssue[] = [];
  let geminiScore: number | null = null;

  for (const output of outputs) {
    if (typeof output.summary?.overall_score === 'number') {
      geminiScore = output.summary.overall_score;
    }

    for (const requirementResult of output.requirement_results || []) {
      const requirementId = requirementResult.id || 'UNKNOWN';
      const requirementType = normalizeRequirementType(requirementResult.type);

      for (const issue of requirementResult.issues || []) {
        const severity = mapGeminiSeverityToIssueSeverity(issue.severity);
        if (!severity) continue;

        const newIssue: ValidationIssue = {
          requirementId,
          requirementType,
          category: mapGeminiRuleToCategory(issue.rule),
          severity,
          field: 'statement',
          message: issue.message || 'Gemini validator reported an issue.',
          details: {
            actual: issue.evidence,
            relatedRequirementIds: issue.related_requirement_ids,
          },
          suggestion: issue.suggestion,
        };

        allIssues.push(newIssue);
        if (requirementType === 'FR') {
          frIssues.push(newIssue);
        } else {
          nfrIssues.push(newIssue);
        }
      }
    }

    for (const crossFinding of output.cross_requirement_findings || []) {
      const severity: ValidationIssue['severity'] = crossFinding.severity === 'FAIL' ? 'error' : 'warning';
      const relatedIds = Array.isArray(crossFinding.related_requirement_ids) ? crossFinding.related_requirement_ids : [];
      const primaryRequirementId = relatedIds[0] || 'CROSS-REQ';
      const inferredType: RequirementType = primaryRequirementId.startsWith('NFR-') ? 'NFR' : 'FR';

      const newIssue: ValidationIssue = {
        requirementId: primaryRequirementId,
        requirementType: inferredType,
        category: mapGeminiRuleToCategory(crossFinding.rule),
        severity,
        field: 'statement',
        message: crossFinding.message || 'Gemini detected a cross-requirement issue.',
        details: {
          relatedRequirementIds: relatedIds,
        },
        suggestion: crossFinding.suggestion,
      };

      allIssues.push(newIssue);
      if (inferredType === 'FR') {
        frIssues.push(newIssue);
      } else {
        nfrIssues.push(newIssue);
      }
    }
  }

  const dedupedAllIssues = dedupeIssues(allIssues);
  const dedupedFrIssues = dedupeIssues(frIssues);
  const dedupedNfrIssues = dedupeIssues(nfrIssues);

  const frCount = context.flattenedRequirements.filter((req) => req.requirementType === 'FR').length;
  const nfrCount = context.flattenedRequirements.filter((req) => req.requirementType === 'NFR').length;

  const totalSummary = createSummary(context.flattenedRequirements.length, dedupedAllIssues);
  const frSummary = createSummary(frCount, dedupedFrIssues);
  const nfrSummary = createSummary(nfrCount, dedupedNfrIssues);

  const totalQualityScore = typeof geminiScore === 'number' ? Math.max(0, Math.min(100, geminiScore)) : calculateQualityScore(dedupedAllIssues);
  const frQualityScore = calculateQualityScore(dedupedFrIssues);
  const nfrQualityScore = calculateQualityScore(dedupedNfrIssues);

  return {
    isValid: totalSummary.errors === 0,
    summary: totalSummary,
    qualityScore: totalQualityScore,
    issues: dedupedAllIssues,
    byType: {
      FR: { issues: dedupedFrIssues, summary: frSummary, qualityScore: frQualityScore },
      NFR: { issues: dedupedNfrIssues, summary: nfrSummary, qualityScore: nfrQualityScore },
    },
  };
}

async function runGeminiValidation(input: ValidatorInput): Promise<GeminiValidationOutput> {
  const prompt = generateGeminiValidatorPrompt(input);
  const raw = await generateWithGemini(prompt);

  try {
    return JSON.parse(raw) as GeminiValidationOutput;
  } catch {
    const repaired = await repairJson(raw);
    return JSON.parse(repaired) as GeminiValidationOutput;
  }
}


//this one
function validateGeneratedRequirementsRuleBased(
  input: GeneratedRequirementsDocument,
  config?: Partial<ValidationConfig>,
): ValidationResult & {
  byType?: {
    FR?: { issues: ValidationIssue[]; summary: ValidationResult['summary']; qualityScore: number };
    NFR?: { issues: ValidationIssue[]; summary: ValidationResult['summary']; qualityScore: number };
  };
} {
  const context = createValidationContext(input, config);

  const allIssues = [
    ...validateRequiredFields(context),
    ...validateStatementFormat(context),
    ...validateVagueWording(context),
    ...validateAtomicity(context),
    ...validateVerifiability(context),
    ...validateDuplicates(context),
    ...validateTraceability(context),
    ...validateConsistency(context),
    ...validateFeasibility(context),
    ...validateFunctionalRequirementRules(context),
    ...validateNonFunctionalRequirementRules(context),
  ];

  const dedupedAllIssues = dedupeIssues(allIssues);
  const frIssues = dedupedAllIssues.filter((issue) => issue.requirementType === 'FR');
  const nfrIssues = dedupedAllIssues.filter((issue) => issue.requirementType === 'NFR');

  const frCount = context.flattenedRequirements.filter((req) => req.requirementType === 'FR').length;
  const nfrCount = context.flattenedRequirements.filter((req) => req.requirementType === 'NFR').length;

  const totalSummary = createSummary(context.flattenedRequirements.length, dedupedAllIssues);
  const frSummary = createSummary(frCount, frIssues);
  const nfrSummary = createSummary(nfrCount, nfrIssues);

  const totalQualityScore = calculateQualityScore(dedupedAllIssues);
  const frQualityScore = calculateQualityScore(frIssues);
  const nfrQualityScore = calculateQualityScore(nfrIssues);

  return {
    isValid: totalSummary.errors === 0,
    summary: totalSummary,
    qualityScore: totalQualityScore,
    issues: dedupedAllIssues,
    byType: {
      FR: { issues: frIssues, summary: frSummary, qualityScore: frQualityScore },
      NFR: { issues: nfrIssues, summary: nfrSummary, qualityScore: nfrQualityScore },
    },
  };
}

async function validateGeneratedRequirementsWithGemini(
  input: GeneratedRequirementsDocument,
  config?: Partial<ValidationConfig>,
): Promise<ValidationResult> {
  const safeDocument = normalizeDocument(input);
  const context = createValidationContext(safeDocument, config);

  const frPromptInput = buildGeminiValidatorInput(safeDocument, 'FR');
  const nfrPromptInput = buildGeminiValidatorInput(safeDocument, 'NFR');

  const outputs = await Promise.all([
    runGeminiValidation(frPromptInput),
    runGeminiValidation(nfrPromptInput),
  ]);

  return buildValidationResultFromGeminiOutputs(outputs, context);
}

export async function validateGeneratedRequirements(
  input: GeneratedRequirementsDocument,
  options?: Partial<ValidationOptions> | Partial<ValidationConfig>,
): Promise<ValidationResult> {
  const validationModel =
    options && 'validationModel' in options ? options.validationModel : 'rule-based';
  const config = options && 'config' in options ? options.config : options;

  if (validationModel === 'gemini') {
    return validateGeneratedRequirementsWithGemini(input, config as Partial<ValidationConfig> | undefined);
  }

  return validateGeneratedRequirementsRuleBased(input, config as Partial<ValidationConfig> | undefined);
}

export async function validateRequirements(
  input: GeneratedRequirementsDocument,
  options?: Partial<ValidationOptions> | Partial<ValidationConfig>,
): Promise<ValidationResult> {
  return validateGeneratedRequirements(input, options);
}

export async function validateGeneratedRequirementsWithModel(
  input: GeneratedRequirementsDocument,
  validationModel: ValidationModel = 'rule-based',
  config?: Partial<ValidationConfig>,
): Promise<ValidationResult> {
  return validateGeneratedRequirements(input, { validationModel, config });
}

export function getAutoFixSuggestionsFromValidation(
  validationResult: ValidationResult,
): AutoFixSuggestion[] {
  return buildAutoFixSuggestions(validationResult.issues);
}

export const FR_NFR_VALIDATOR_SUPPORTED_CATEGORIES = NFR_CATEGORIES;
export const DEFAULT_FR_NFR_VALIDATION_CONFIG = DEFAULT_VALIDATION_CONFIG;


