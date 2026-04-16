import {
  AutoFixSuggestion,
  ValidationCategory,
  ValidationIssue,
} from '../../types/frNfrValidation';

const CATEGORY_SUGGESTION_MAP: Record<ValidationCategory, string> = {
  missing_field: 'Fill all required metadata fields before finalizing this requirement.',
  format: 'Rewrite the statement as "The system shall ..." with specific behavior.',
  vague_wording: 'Replace vague terms with measurable thresholds or objective criteria.',
  atomicity: 'Split this requirement into smaller atomic requirements with separate IDs.',
  verifiability: 'Add a measurable fit criterion and explicit verification conditions.',
  duplicate: 'Merge, remove, or clarify duplicated requirements.',
  traceability: 'Add or repair trace links to valid features/use cases and source references.',
  consistency: 'Align conflicting intent, scope, and priority with related requirements.',
  feasibility: 'Replace absolute wording with realistic targets and constraints.',
  nfr_category: 'Move this NFR to a better category or add category-specific wording.',
};

export function buildAutoFixSuggestions(issues: ValidationIssue[]): AutoFixSuggestion[] {
  const seen = new Set<string>();
  const suggestions: AutoFixSuggestion[] = [];

  for (const issue of issues) {
    const key = [issue.requirementId, issue.category, issue.field].join('|');
    if (seen.has(key)) continue;
    seen.add(key);

    let suggestion = issue.suggestion || CATEGORY_SUGGESTION_MAP[issue.category];

    if (issue.category === 'verifiability' && issue.field === 'fitCriterion') {
      suggestion = 'Add a fit criterion with metric, threshold, and test condition (example: 95% <= 3 seconds under normal load).';
    }

    if (issue.category === 'traceability') {
      suggestion = 'Provide valid trace links and source references (feature/use case IDs must exist in the document).';
    }

    if (issue.category === 'atomicity') {
      suggestion = 'Split this requirement into two or more requirements, each expressing one verifiable behavior.';
    }

    suggestions.push({
      requirementId: issue.requirementId,
      requirementType: issue.requirementType,
      category: issue.category,
      message: issue.message,
      suggestion,
    });
  }

  return suggestions;
}

