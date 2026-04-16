"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateFunctionalRequirementRules = validateFunctionalRequirementRules;
const utils_1 = require("./utils");
function createIssue(requirementId, field, severity, message, suggestion) {
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
function validateFunctionalRequirementRules(context) {
    const issues = [];
    for (const item of context.flattenedRequirements) {
        if (item.requirementType !== 'FR')
            continue;
        const traceToFeatures = (0, utils_1.normalizeArray)(item.requirement.traceToFeatures);
        const traceToUseCases = (0, utils_1.normalizeArray)(item.requirement.traceToUseCases);
        if (traceToFeatures.length === 0 && traceToUseCases.length === 0) {
            issues.push(createIssue(item.requirement.id || 'UNKNOWN', 'traceLinks', 'error', 'FR must include at least one trace link to features or use cases.', 'Add traceToFeatures and/or traceToUseCases with valid IDs.'));
        }
    }
    return issues;
}
