"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_FR_NFR_VALIDATION_CONFIG = exports.FR_NFR_VALIDATOR_SUPPORTED_CATEGORIES = void 0;
exports.validateGeneratedRequirements = validateGeneratedRequirements;
exports.validateRequirements = validateRequirements;
exports.getAutoFixSuggestionsFromValidation = getAutoFixSuggestionsFromValidation;
const constants_1 = require("./constants");
const autoFixSuggestions_1 = require("./autoFixSuggestions");
const sharedValidators_1 = require("./sharedValidators");
const frValidators_1 = require("./frValidators");
const nfrValidators_1 = require("./nfrValidators");
const utils_1 = require("./utils");
function dedupeIssues(issues) {
    const seen = new Set();
    const output = [];
    for (const issue of issues) {
        const key = [
            issue.requirementId,
            issue.requirementType,
            issue.category,
            issue.field,
            issue.severity,
            issue.message,
            (issue.details?.relatedRequirementIds || []).join(','),
        ].join('|');
        if (!seen.has(key)) {
            seen.add(key);
            output.push(issue);
        }
    }
    return output;
}
function createSummary(totalRequirements, issues) {
    const errors = issues.filter((issue) => issue.severity === 'error').length;
    const warnings = issues.filter((issue) => issue.severity === 'warning').length;
    return {
        totalRequirements,
        totalIssues: issues.length,
        errors,
        warnings,
    };
}
function normalizeDocument(input) {
    return {
        projectName: input.projectName || '',
        assumptions: Array.isArray(input.assumptions) ? input.assumptions : [],
        constraints: Array.isArray(input.constraints) ? input.constraints : [],
        features: Array.isArray(input.features) ? input.features : [],
        useCases: Array.isArray(input.useCases) ? input.useCases : [],
        functionalRequirements: Array.isArray(input.functionalRequirements) ? input.functionalRequirements : [],
        nonFunctionalRequirements: (0, utils_1.ensureNfrMap)(input.nonFunctionalRequirements),
        qualityCheckSummary: {
            completenessNotes: input.qualityCheckSummary?.completenessNotes || [],
            ambiguityRisks: input.qualityCheckSummary?.ambiguityRisks || [],
            consistencyRisks: input.qualityCheckSummary?.consistencyRisks || [],
            duplicationRisks: input.qualityCheckSummary?.duplicationRisks || [],
            missingTraceLinks: input.qualityCheckSummary?.missingTraceLinks || [],
            assumptionsMade: input.qualityCheckSummary?.assumptionsMade || [],
        },
    };
}
function createValidationContext(input, config) {
    const safeDocument = normalizeDocument(input);
    const finalConfig = (0, utils_1.mergeValidationConfig)(config);
    return {
        document: safeDocument,
        config: finalConfig,
        flattenedRequirements: (0, utils_1.flattenRequirements)(safeDocument),
        featureIds: (0, utils_1.getFeatureIdSet)(safeDocument),
        useCaseIds: (0, utils_1.getUseCaseIdSet)(safeDocument),
    };
}
function validateGeneratedRequirements(input, config) {
    const context = createValidationContext(input, config);
    const issues = dedupeIssues([
        ...(0, sharedValidators_1.validateRequiredFields)(context),
        ...(0, sharedValidators_1.validateStatementFormat)(context),
        ...(0, sharedValidators_1.validateVagueWording)(context),
        ...(0, sharedValidators_1.validateAtomicity)(context),
        ...(0, sharedValidators_1.validateVerifiability)(context),
        ...(0, sharedValidators_1.validateDuplicates)(context),
        ...(0, sharedValidators_1.validateTraceability)(context),
        ...(0, sharedValidators_1.validateConsistency)(context),
        ...(0, sharedValidators_1.validateFeasibility)(context),
        ...(0, frValidators_1.validateFunctionalRequirementRules)(context),
        ...(0, nfrValidators_1.validateNonFunctionalRequirementRules)(context),
    ]);
    const summary = createSummary(context.flattenedRequirements.length, issues);
    return {
        isValid: summary.errors === 0,
        summary,
        issues,
    };
}
function validateRequirements(input, config) {
    return validateGeneratedRequirements(input, config);
}
function getAutoFixSuggestionsFromValidation(validationResult) {
    return (0, autoFixSuggestions_1.buildAutoFixSuggestions)(validationResult.issues);
}
exports.FR_NFR_VALIDATOR_SUPPORTED_CATEGORIES = constants_1.NFR_CATEGORIES;
exports.DEFAULT_FR_NFR_VALIDATION_CONFIG = constants_1.DEFAULT_VALIDATION_CONFIG;
