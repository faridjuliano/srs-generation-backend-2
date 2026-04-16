import { ValidationIssue } from '../../types/frNfrValidation';
import { normalizeArray } from './utils';
import { ValidationContext } from './sharedValidators';

function createIssue(
  requirementId: string,
  field: string,
  severity: ValidationIssue['severity'],
  message: string,
  suggestion: string,
): ValidationIssue {
  return {
    requirementId,
    requirementType: 'FR',
    category: 'traceability',
    severity,
    field,
    message,
    suggestion,
  };
}

export function validateFunctionalRequirementRules(context: ValidationContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const item of context.flattenedRequirements) {
    if (item.requirementType !== 'FR') continue;

    const traceToFeatures = normalizeArray((item.requirement as { traceToFeatures?: string[] }).traceToFeatures);
    const traceToUseCases = normalizeArray((item.requirement as { traceToUseCases?: string[] }).traceToUseCases);

    if (traceToFeatures.length === 0 && traceToUseCases.length === 0) {
      issues.push(
        createIssue(
          item.requirement.id || 'UNKNOWN',
          'traceLinks',
          'error',
          'FR must include at least one trace link to features or use cases.',
          'Add traceToFeatures and/or traceToUseCases with valid IDs.',
        ),
      );
    }
  }

  return issues;
}

