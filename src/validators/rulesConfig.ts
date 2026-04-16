export const RULES_CONFIG = {
  vagueTerms: [
    'user-friendly',
    'easy to use',
    'fast',
    'efficient',
    'flexible',
    'secure enough',
    'intuitive',
    'quickly',
    'appropriate',
    'as needed',
    'where possible',
    'etc.',
    'and/or',
  ],
  requiredFields: {
    functional: [
      'id',
      'title',
      'statement',
      'rationale',
      'source',
      'priority',
      'fitCriterion',
      'verificationMethod',
      'traceToStakeholders',
      'traceToUseCases',
    ] as const,
    nonFunctional: [
      'id',
      'statement',
      'fitCriterion',
      'verificationMethod',
      'priority',
      'source',
    ] as const,
  },
  multiActionThresholds: {
    andCount: 2,
    semicolonCount: 1,
    commaCount: 4,
  },
  nearDuplicate: {
    similarityThreshold: 0.8,
  },
  scoring: {
    baseScore: 100,
    errorPenalty: 8,
    warningPenalty: 3,
  },
} as const;

