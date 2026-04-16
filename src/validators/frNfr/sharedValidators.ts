import {
  FunctionalRequirement,
  GeneratedRequirementsDocument,
  ValidationCategory,
  ValidationIssue,
  ValidationConfig,
} from '../../types/frNfrValidation';
import {
  FlattenedRequirement,
  containsAny,
  countPattern,
  isBlank,
  jaccardSimilarity,
  normalizeArray,
  normalizeText,
  requirementText,
  tokenize,
  wordCount,
} from './utils';
import { REQUIRED_REQUIREMENT_FIELDS } from './constants';

export interface ValidationContext {
  document: GeneratedRequirementsDocument;
  config: ValidationConfig;
  flattenedRequirements: FlattenedRequirement[];
  featureIds: Set<string>;
  useCaseIds: Set<string>;
}

function createIssue(
  requirement: FlattenedRequirement,
  category: ValidationCategory,
  field: string,
  severity: ValidationIssue['severity'],
  message: string,
  suggestion: string,
  details?: ValidationIssue['details'],
): ValidationIssue {
  return {
    requirementId: requirement.requirement.id || 'UNKNOWN',
    requirementType: requirement.requirementType,
    category,
    severity,
    field,
    message,
    details,
    suggestion,
  };
}

function priorityRank(priority: string): number {
  const normalized = normalizeText(priority);
  if (normalized === 'critical') return 4;
  if (normalized === 'high') return 3;
  if (normalized === 'medium') return 2;
  if (normalized === 'low') return 1;
  return 0;
}

function hasContradictoryAccessIntent(a: string, b: string): boolean {
  const left = normalizeText(a);
  const right = normalizeText(b);
  const restrictive = /\bonly admin\b|\bonly administrator\b/;
  const broad = /\bany user\b|\ball users\b|\bany authenticated user\b/;
  const actionTerms = ['delete', 'remove', 'cancel', 'approve', 'update', 'modify', 'view'];

  const actionOverlap = actionTerms.some((term) => left.includes(term) && right.includes(term));
  if (!actionOverlap) return false;

  return (restrictive.test(left) && broad.test(right)) || (restrictive.test(right) && broad.test(left));
}

export function validateRequiredFields(context: ValidationContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const item of context.flattenedRequirements) {
    const requirement = item.requirement;

    for (const field of REQUIRED_REQUIREMENT_FIELDS) {
      if (isBlank(requirement[field])) {
        issues.push(
          createIssue(
            item,
            'missing_field',
            field,
            'error',
            `Missing required field: ${field}`,
            `Provide a valid value for ${field}.`,
          ),
        );
      }
    }
  }

  return issues;
}

export function validateStatementFormat(context: ValidationContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const item of context.flattenedRequirements) {
    const statement = item.requirement.statement || '';
    const normalizedStatement = normalizeText(statement);

    if (!/^the system shall\b/i.test(statement.trim())) {
      issues.push(
        createIssue(
          item,
          'format',
          'statement',
          'warning',
          'Statement should start with "The system shall".',
          'Rewrite using a mandatory form: "The system shall ...".',
        ),
      );
    }

    if (wordCount(statement) < context.config.minimumStatementLength) {
      issues.push(
        createIssue(
          item,
          'format',
          'statement',
          'warning',
          'Statement is too short and may be underspecified.',
          'Add actors, conditions, and expected behavior in one clear sentence.',
        ),
      );
    }

    const matchedPlaceholderTerms = context.config.placeholderTerms.filter((term) => {
      const normalizedTerm = normalizeText(term);
      if (!normalizedTerm) return false;
      const escapedTerm = normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`\\b${escapedTerm}\\b`, 'i').test(normalizedStatement);
    });

    if (matchedPlaceholderTerms.length > 0) {
      issues.push(
        createIssue(
          item,
          'format',
          'statement',
          'error',
          'Statement appears to contain placeholder text.',
          'Replace placeholder text with testable behavior.',
          { matchedTerms: matchedPlaceholderTerms },
        ),
      );
    }
  }

  return issues;
}

export function validateVagueWording(context: ValidationContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const item of context.flattenedRequirements) {
    const statement = item.requirement.statement || '';
    const matchedTerms = containsAny(statement, context.config.vagueTerms);

    if (matchedTerms.length > 0) {
      issues.push(
        createIssue(
          item,
          'vague_wording',
          'statement',
          'warning',
          'Vague or weakly verifiable wording detected.',
          'Replace vague wording with measurable thresholds or objective conditions.',
          { matchedTerms },
        ),
      );
    }
  }

  return issues;
}

export function validateAtomicity(context: ValidationContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const item of context.flattenedRequirements) {
    const statement = item.requirement.statement || '';
    const lowerStatement = statement.toLowerCase();

    const andCount = countPattern(lowerStatement, /\band\b/g);
    const orCount = countPattern(lowerStatement, /\bor\b/g);
    const semicolonCount = countPattern(statement, /;/g);
    const shallCount = countPattern(lowerStatement, /\bshall\b/g);

    const likelyCombined =
      andCount > context.config.maxAndCount ||
      orCount > context.config.maxOrCount ||
      semicolonCount > context.config.maxSemicolonCount ||
      shallCount > context.config.maxShallCount;

    if (likelyCombined) {
      issues.push(
        createIssue(
          item,
          'atomicity',
          'statement',
          'warning',
          'Requirement may combine multiple behaviors and should be split.',
          'Split into atomic requirements, each with one verifiable behavior.',
          {
            actual: `and=${andCount}, or=${orCount}, semicolons=${semicolonCount}, shall=${shallCount}`,
            expected: 'One primary behavior per requirement statement.',
          },
        ),
      );
    }
  }

  return issues;
}

export function validateVerifiability(context: ValidationContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const item of context.flattenedRequirements) {
    const fitCriterion = item.requirement.fitCriterion || '';

    if (isBlank(fitCriterion)) {
      issues.push(
        createIssue(
          item,
          'verifiability',
          'fitCriterion',
          'error',
          'Missing fit criterion. Requirement is not verifiable.',
          'Add measurable acceptance criteria with explicit pass/fail conditions.',
        ),
      );
      continue;
    }

    const weakTerms = containsAny(fitCriterion, context.config.weakFitCriterionTerms);
    const shortCriterion = wordCount(fitCriterion) < context.config.minimumFitCriterionLength;
    const measurableHint = /(\d+|<=|>=|<|>|within|percent|ms|seconds|minutes|hours|requests)/i.test(fitCriterion);

    if (weakTerms.length > 0 || shortCriterion || !measurableHint) {
      issues.push(
        createIssue(
          item,
          'verifiability',
          'fitCriterion',
          weakTerms.length > 0 ? 'error' : 'warning',
          'Fit criterion appears weak or non-measurable.',
          'Rewrite fit criterion with measurable limits, scope, and test conditions.',
          {
            matchedTerms: weakTerms,
            actual: fitCriterion,
            expected: 'Objective and testable condition (e.g., p95 <= 3s for 95% requests).',
          },
        ),
      );
    }
  }

  return issues;
}

export function validateDuplicates(context: ValidationContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const items = context.flattenedRequirements;

  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      const left = items[i];
      const right = items[j];
      const leftText = normalizeText(left.requirement.statement || '');
      const rightText = normalizeText(right.requirement.statement || '');

      if (!leftText || !rightText) continue;

      if (leftText === rightText) {
        issues.push(
          createIssue(
            left,
            'duplicate',
            'statement',
            'error',
            'Exact duplicate requirement statement detected.',
            'Merge or remove one duplicate and keep a single authoritative requirement.',
            { relatedRequirementIds: [right.requirement.id] },
          ),
        );
        continue;
      }

      if (left.requirementType !== right.requirementType) continue;

      const similarity = jaccardSimilarity(tokenize(leftText), tokenize(rightText));
      if (similarity >= context.config.duplicateSimilarityThreshold) {
        issues.push(
          createIssue(
            left,
            'duplicate',
            'statement',
            'warning',
            `Near-duplicate requirement detected (similarity=${similarity.toFixed(2)}).`,
            'Clarify differences or merge if both requirements describe the same behavior.',
            {
              relatedRequirementIds: [right.requirement.id],
              actual: similarity.toFixed(2),
              expected: `< ${context.config.duplicateSimilarityThreshold}`,
            },
          ),
        );
      }
    }
  }

  return issues;
}

export function validateTraceability(context: ValidationContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const item of context.flattenedRequirements) {
    const sources = normalizeArray(item.requirement.source);
    if (sources.length === 0) {
      issues.push(
        createIssue(
          item,
          'traceability',
          'source',
          'error',
          'Requirement is missing source traceability.',
          'Add at least one source item for requirement origin.',
        ),
      );
    }

    const featureTraces = normalizeArray((item.requirement as FunctionalRequirement).traceToFeatures);
    for (const featureId of featureTraces) {
      if (!context.featureIds.has(featureId)) {
        issues.push(
          createIssue(
            item,
            'traceability',
            'traceToFeatures',
            'error',
            `Broken feature trace reference: ${featureId}`,
            'Use existing feature IDs from the features list.',
            { actual: featureId },
          ),
        );
      }
    }

    const useCaseTraces = normalizeArray((item.requirement as FunctionalRequirement).traceToUseCases);
    for (const useCaseId of useCaseTraces) {
      if (!context.useCaseIds.has(useCaseId)) {
        issues.push(
          createIssue(
            item,
            'traceability',
            'traceToUseCases',
            'error',
            `Broken use case trace reference: ${useCaseId}`,
            'Use existing use case IDs from the useCases list.',
            { actual: useCaseId },
          ),
        );
      }
    }
  }

  return issues;
}

export function validateConsistency(context: ValidationContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const items = context.flattenedRequirements;

  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      const left = items[i];
      const right = items[j];
      if (left.requirementType !== right.requirementType) continue;

      const similarity = jaccardSimilarity(
        tokenize(requirementText(left.requirement)),
        tokenize(requirementText(right.requirement)),
      );

      const leftPriority = priorityRank(left.requirement.priority || '');
      const rightPriority = priorityRank(right.requirement.priority || '');
      if (similarity >= 0.78 && leftPriority > 0 && rightPriority > 0 && leftPriority !== rightPriority) {
        issues.push(
          createIssue(
            left,
            'consistency',
            'priority',
            'warning',
            'Similar requirements have conflicting priorities.',
            'Align priorities or clarify scope differences between these requirements.',
            { relatedRequirementIds: [right.requirement.id] },
          ),
        );
      }

      if (hasContradictoryAccessIntent(left.requirement.statement || '', right.requirement.statement || '')) {
        issues.push(
          createIssue(
            left,
            'consistency',
            'statement',
            'warning',
            'Potentially contradictory access intent detected.',
            'Harmonize actor permissions and document explicit role boundaries.',
            { relatedRequirementIds: [right.requirement.id] },
          ),
        );
      }
    }
  }

  return issues;
}

export function validateFeasibility(context: ValidationContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const item of context.flattenedRequirements) {
    const matchedTerms = containsAny(item.requirement.statement || '', context.config.infeasiblePhrases);
    if (matchedTerms.length > 0) {
      issues.push(
        createIssue(
          item,
          'feasibility',
          'statement',
          'warning',
          'Potentially unrealistic or absolute wording detected.',
          'Use realistic targets and define conditions where the metric applies.',
          { matchedTerms },
        ),
      );
    }
  }

  return issues;
}


