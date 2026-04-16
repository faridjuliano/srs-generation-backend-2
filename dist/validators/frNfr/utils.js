"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mergeConfig = void 0;
exports.mergeValidationConfig = mergeValidationConfig;
exports.normalizeText = normalizeText;
exports.wordCount = wordCount;
exports.tokenize = tokenize;
exports.jaccardSimilarity = jaccardSimilarity;
exports.normalizeArray = normalizeArray;
exports.isBlank = isBlank;
exports.flattenRequirements = flattenRequirements;
exports.ensureNfrMap = ensureNfrMap;
exports.getFeatureIdSet = getFeatureIdSet;
exports.getUseCaseIdSet = getUseCaseIdSet;
exports.requirementText = requirementText;
exports.countPattern = countPattern;
exports.containsAny = containsAny;
const constants_1 = require("./constants");
function mergeValidationConfig(config) {
    if (!config)
        return constants_1.DEFAULT_VALIDATION_CONFIG;
    return {
        ...constants_1.DEFAULT_VALIDATION_CONFIG,
        ...config,
        vagueTerms: config.vagueTerms || constants_1.DEFAULT_VALIDATION_CONFIG.vagueTerms,
        placeholderTerms: config.placeholderTerms || constants_1.DEFAULT_VALIDATION_CONFIG.placeholderTerms,
        weakFitCriterionTerms: config.weakFitCriterionTerms || constants_1.DEFAULT_VALIDATION_CONFIG.weakFitCriterionTerms,
        infeasiblePhrases: config.infeasiblePhrases || constants_1.DEFAULT_VALIDATION_CONFIG.infeasiblePhrases,
    };
}
exports.mergeConfig = mergeValidationConfig;
function normalizeText(value) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
function wordCount(value) {
    if (!value.trim())
        return 0;
    return value.trim().split(/\s+/).length;
}
function tokenize(value) {
    const tokens = normalizeText(value)
        .split(' ')
        .filter((token) => token.length > 2);
    return new Set(tokens);
}
function jaccardSimilarity(a, b) {
    if (a.size === 0 && b.size === 0)
        return 1;
    if (a.size === 0 || b.size === 0)
        return 0;
    let intersection = 0;
    for (const token of a) {
        if (b.has(token))
            intersection += 1;
    }
    const union = a.size + b.size - intersection;
    return union === 0 ? 0 : intersection / union;
}
function normalizeArray(value) {
    if (!Array.isArray(value))
        return [];
    return value
        .map((item) => String(item).trim())
        .filter((item) => item.length > 0);
}
function isBlank(value) {
    if (value === null || value === undefined)
        return true;
    if (typeof value === 'string')
        return value.trim().length === 0;
    if (Array.isArray(value))
        return value.length === 0;
    return false;
}
function flattenRequirements(document) {
    const flattened = [];
    for (const requirement of document.functionalRequirements || []) {
        flattened.push({ requirementType: 'FR', requirement });
    }
    const nfr = ensureNfrMap(document.nonFunctionalRequirements);
    for (const category of constants_1.NFR_CATEGORIES) {
        const requirements = nfr[category] || [];
        for (const requirement of requirements) {
            flattened.push({ requirementType: 'NFR', nfrCategory: category, requirement });
        }
    }
    return flattened;
}
function ensureNfrMap(map) {
    const safeMap = {};
    for (const category of constants_1.NFR_CATEGORIES) {
        safeMap[category] = Array.isArray(map?.[category]) ? map[category] : [];
    }
    return safeMap;
}
function getFeatureIdSet(document) {
    return new Set((document.features || []).map((feature) => feature.id).filter((id) => id && id.trim().length > 0));
}
function getUseCaseIdSet(document) {
    return new Set((document.useCases || []).map((useCase) => useCase.id).filter((id) => id && id.trim().length > 0));
}
function requirementText(requirement) {
    return [requirement.title, requirement.statement, requirement.fitCriterion]
        .filter((part) => part.trim().length > 0)
        .join(' ');
}
function countPattern(value, pattern) {
    return value.match(pattern)?.length || 0;
}
function containsAny(value, terms) {
    const normalized = normalizeText(value);
    return terms.filter((term) => normalized.includes(normalizeText(term)));
}
