import { NfrCategoryKey, ValidationIssue } from '../../types/frNfrValidation';
import { NFR_CATEGORY_KEYWORDS } from './constants';
import { ValidationContext } from './sharedValidators';
import { normalizeArray, normalizeText, requirementText } from './utils';

function createIssue(
  requirementId: string,
  field: string,
  severity: ValidationIssue['severity'],
  message: string,
  suggestion: string,
  details?: ValidationIssue['details'],
): ValidationIssue {
  return {
    requirementId,
    requirementType: 'NFR',
    category: 'nfr_category',
    severity,
    field,
    message,
    details,
    suggestion,
  };
}

function scoreCategoryLikelihood(text: string, category: NfrCategoryKey): number {
  const keywords = NFR_CATEGORY_KEYWORDS[category] || [];
  return keywords.reduce((score, keyword) => (text.includes(normalizeText(keyword)) ? score + 1 : score), 0);
}

export function validateNonFunctionalRequirementRules(context: ValidationContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const item of context.flattenedRequirements) {
    if (item.requirementType !== 'NFR' || !item.nfrCategory) continue;

    const traceToFeatures = normalizeArray((item.requirement as { traceToFeatures?: string[] }).traceToFeatures);
    if (context.document.features.length > 0 && traceToFeatures.length === 0) {
      issues.push(
        createIssue(
          item.requirement.id || 'UNKNOWN',
          'traceToFeatures',
          'warning',
          'NFR has no feature trace link (preferred when applicable).',
          'Link this NFR to related feature IDs when possible.',
        ),
      );
    }

    const combinedText = normalizeText(requirementText(item.requirement));
    const currentScore = scoreCategoryLikelihood(combinedText, item.nfrCategory);

    let bestCategory: NfrCategoryKey = item.nfrCategory;
    let bestScore = currentScore;

    (Object.keys(NFR_CATEGORY_KEYWORDS) as NfrCategoryKey[]).forEach((category) => {
      const score = scoreCategoryLikelihood(combinedText, category);
      if (score > bestScore) {
        bestScore = score;
        bestCategory = category;
      }
    });

    if (bestScore === 0) {
      issues.push(
        createIssue(
          item.requirement.id || 'UNKNOWN',
          'category',
          'warning',
          'NFR category may be unclear based on requirement wording.',
          'Add clearer category-specific terms and measurable quality attributes.',
        ),
      );
      continue;
    }

    if (bestCategory !== item.nfrCategory && bestScore > currentScore) {
      issues.push(
        createIssue(
          item.requirement.id || 'UNKNOWN',
          'category',
          'warning',
          `NFR may fit better under ${bestCategory}.`,
          'Review category placement to improve quality attribute consistency.',
          { expected: item.nfrCategory, actual: bestCategory },
        ),
      );
    }
  }

  return issues;
}

