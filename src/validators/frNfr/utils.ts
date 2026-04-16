import {
  FunctionalRequirement,
  GeneratedRequirementsDocument,
  NfrCategoryKey,
  NonFunctionalRequirement,
  NonFunctionalRequirementsMap,
  RequirementType,
  ValidationConfig,
} from '../../types/frNfrValidation';
import { DEFAULT_VALIDATION_CONFIG, NFR_CATEGORIES } from './constants';

export interface FlattenedRequirement {
  requirementType: RequirementType;
  nfrCategory?: NfrCategoryKey;
  requirement: FunctionalRequirement | NonFunctionalRequirement;
}

export function mergeValidationConfig(config?: Partial<ValidationConfig>): ValidationConfig {
  if (!config) return DEFAULT_VALIDATION_CONFIG;

  return {
    ...DEFAULT_VALIDATION_CONFIG,
    ...config,
    vagueTerms: config.vagueTerms || DEFAULT_VALIDATION_CONFIG.vagueTerms,
    placeholderTerms: config.placeholderTerms || DEFAULT_VALIDATION_CONFIG.placeholderTerms,
    weakFitCriterionTerms: config.weakFitCriterionTerms || DEFAULT_VALIDATION_CONFIG.weakFitCriterionTerms,
    infeasiblePhrases: config.infeasiblePhrases || DEFAULT_VALIDATION_CONFIG.infeasiblePhrases,
  };
}

export const mergeConfig = mergeValidationConfig;

export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function wordCount(value: string): number {
  if (!value.trim()) return 0;
  return value.trim().split(/\s+/).length;
}

export function tokenize(value: string): Set<string> {
  const tokens = normalizeText(value)
    .split(' ')
    .filter((token) => token.length > 2);
  return new Set(tokens);
}

export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;

  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }

  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function normalizeArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item).trim())
    .filter((item) => item.length > 0);
}

export function isBlank(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

export function flattenRequirements(document: GeneratedRequirementsDocument): FlattenedRequirement[] {
  const flattened: FlattenedRequirement[] = [];

  for (const requirement of document.functionalRequirements || []) {
    flattened.push({ requirementType: 'FR', requirement });
  }

  const nfr = ensureNfrMap(document.nonFunctionalRequirements);
  for (const category of NFR_CATEGORIES) {
    const requirements = nfr[category] || [];
    for (const requirement of requirements) {
      flattened.push({ requirementType: 'NFR', nfrCategory: category, requirement });
    }
  }

  return flattened;
}

export function ensureNfrMap(map?: Partial<NonFunctionalRequirementsMap>): NonFunctionalRequirementsMap {
  const safeMap = {} as NonFunctionalRequirementsMap;

  for (const category of NFR_CATEGORIES) {
    safeMap[category] = Array.isArray(map?.[category]) ? map![category] as NonFunctionalRequirement[] : [];
  }

  return safeMap;
}

export function getFeatureIdSet(document: GeneratedRequirementsDocument): Set<string> {
  return new Set((document.features || []).map((feature) => feature.id).filter((id) => id && id.trim().length > 0));
}

export function getUseCaseIdSet(document: GeneratedRequirementsDocument): Set<string> {
  return new Set((document.useCases || []).map((useCase) => useCase.id).filter((id) => id && id.trim().length > 0));
}

export function requirementText(requirement: FunctionalRequirement | NonFunctionalRequirement): string {
  return [requirement.title, requirement.statement, requirement.fitCriterion]
    .filter((part) => part.trim().length > 0)
    .join(' ');
}

export function countPattern(value: string, pattern: RegExp): number {
  return value.match(pattern)?.length || 0;
}

export function containsAny(value: string, terms: string[]): string[] {
  const normalized = normalizeText(value);
  return terms.filter((term) => normalized.includes(normalizeText(term)));
}

