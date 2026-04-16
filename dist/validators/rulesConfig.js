"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RULES_CONFIG = void 0;
exports.RULES_CONFIG = {
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
        ],
        nonFunctional: [
            'id',
            'statement',
            'fitCriterion',
            'verificationMethod',
            'priority',
            'source',
        ],
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
};
