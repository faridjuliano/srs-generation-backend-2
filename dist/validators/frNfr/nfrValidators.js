"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateNonFunctionalRequirementRules = validateNonFunctionalRequirementRules;
const constants_1 = require("./constants");
const utils_1 = require("./utils");
function createIssue(requirementId, field, severity, message, suggestion, details) {
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
function scoreCategoryLikelihood(text, category) {
    const keywords = constants_1.NFR_CATEGORY_KEYWORDS[category] || [];
    return keywords.reduce((score, keyword) => (text.includes((0, utils_1.normalizeText)(keyword)) ? score + 1 : score), 0);
}
function validateNonFunctionalRequirementRules(context) {
    const issues = [];
    for (const item of context.flattenedRequirements) {
        if (item.requirementType !== 'NFR' || !item.nfrCategory)
            continue;
        const traceToFeatures = (0, utils_1.normalizeArray)(item.requirement.traceToFeatures);
        if (context.document.features.length > 0 && traceToFeatures.length === 0) {
            issues.push(createIssue(item.requirement.id || 'UNKNOWN', 'traceToFeatures', 'warning', 'NFR has no feature trace link (preferred when applicable).', 'Link this NFR to related feature IDs when possible.'));
        }
        const combinedText = (0, utils_1.normalizeText)((0, utils_1.requirementText)(item.requirement));
        const currentScore = scoreCategoryLikelihood(combinedText, item.nfrCategory);
        let bestCategory = item.nfrCategory;
        let bestScore = currentScore;
        Object.keys(constants_1.NFR_CATEGORY_KEYWORDS).forEach((category) => {
            const score = scoreCategoryLikelihood(combinedText, category);
            if (score > bestScore) {
                bestScore = score;
                bestCategory = category;
            }
        });
        if (bestScore === 0) {
            issues.push(createIssue(item.requirement.id || 'UNKNOWN', 'category', 'warning', 'NFR category may be unclear based on requirement wording.', 'Add clearer category-specific terms and measurable quality attributes.'));
            continue;
        }
        if (bestCategory !== item.nfrCategory && bestScore > currentScore) {
            issues.push(createIssue(item.requirement.id || 'UNKNOWN', 'category', 'warning', `NFR may fit better under ${bestCategory}.`, 'Review category placement to improve quality attribute consistency.', { expected: item.nfrCategory, actual: bestCategory }));
        }
    }
    return issues;
}
