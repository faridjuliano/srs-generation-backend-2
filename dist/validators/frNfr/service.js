"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_FR_NFR_VALIDATION_CONFIG = exports.FR_NFR_VALIDATOR_SUPPORTED_CATEGORIES = void 0;
exports.validateGeneratedRequirements = validateGeneratedRequirements;
exports.validateRequirements = validateRequirements;
exports.validateGeneratedRequirementsWithModel = validateGeneratedRequirementsWithModel;
exports.getAutoFixSuggestionsFromValidation = getAutoFixSuggestionsFromValidation;
const promptBuilder_1 = require("../../prompts/promptBuilder");
const geminiService_1 = require("../../services/geminiService");
const jsonRepairService_1 = require("../../services/jsonRepairService");
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
function calculateQualityScore(issues) {
    const errorCount = issues.filter((issue) => issue.severity === 'error').length;
    const warningCount = issues.filter((issue) => issue.severity === 'warning').length;
    return Math.max(0, 100 - errorCount * 10 - warningCount * 5);
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
function toGeminiRequirementInput(requirementType, requirement) {
    const source = requirement.source.join('; ');
    const traceToFeatures = Array.isArray(requirement.traceToFeatures)
        ? requirement.traceToFeatures
        : [];
    const traceToUseCases = Array.isArray(requirement.traceToUseCases)
        ? requirement.traceToUseCases
        : [];
    return {
        id: requirement.id,
        type: requirementType,
        title: requirement.title,
        description: requirement.statement,
        rationale: requirement.rationale,
        source,
        trace_link: traceToFeatures[0] || traceToUseCases[0],
        priority: requirement.priority,
        fit_criterion: requirement.fitCriterion,
        category: requirementType === 'FR' && 'category' in requirement && typeof requirement.category === 'string'
            ? requirement.category
            : undefined,
    };
}
function buildGeminiValidatorInput(document, requirementType) {
    const sourceRequirements = requirementType === 'FR'
        ? document.functionalRequirements
        : Object.values(document.nonFunctionalRequirements).flat();
    return {
        project_context: {
            project_name: document.projectName,
            scope_note: `Auto-validate ${requirementType} requirements generated by FR/NFR endpoint.`,
        },
        template_type: requirementType,
        requirements: sourceRequirements.map((requirement) => toGeminiRequirementInput(requirementType, requirement)),
    };
}
function mapGeminiRuleToCategory(rule) {
    switch ((rule || '').toLowerCase()) {
        case 'missing_required_field':
            return 'missing_field';
        case 'vague_wording':
            return 'vague_wording';
        case 'duplicate':
            return 'duplicate';
        case 'missing_trace':
            return 'traceability';
        case 'unverifiable':
            return 'verifiability';
        case 'combined_requirement':
            return 'atomicity';
        case 'ambiguity':
            return 'format';
        case 'inconsistency':
        case 'terminology_conflict':
            return 'consistency';
        default:
            return 'consistency';
    }
}
function mapGeminiSeverityToIssueSeverity(severity) {
    if (severity === 'FAIL')
        return 'error';
    if (severity === 'WARNING')
        return 'warning';
    return null;
}
function normalizeRequirementType(value, fallback) {
    if (value === 'FR' || value === 'NFR')
        return value;
    return fallback || 'FR';
}
function buildValidationResultFromGeminiOutputs(outputs, context) {
    const issues = [];
    let geminiScore = null;
    for (const output of outputs) {
        if (typeof output.summary?.overall_score === 'number') {
            geminiScore = output.summary.overall_score;
        }
        for (const requirementResult of output.requirement_results || []) {
            const requirementId = requirementResult.id || 'UNKNOWN';
            const requirementType = normalizeRequirementType(requirementResult.type);
            for (const issue of requirementResult.issues || []) {
                const severity = mapGeminiSeverityToIssueSeverity(issue.severity);
                if (!severity)
                    continue;
                issues.push({
                    requirementId,
                    requirementType,
                    category: mapGeminiRuleToCategory(issue.rule),
                    severity,
                    field: 'statement',
                    message: issue.message || 'Gemini validator reported an issue.',
                    details: {
                        actual: issue.evidence,
                        relatedRequirementIds: issue.related_requirement_ids,
                    },
                    suggestion: issue.suggestion,
                });
            }
        }
        for (const crossFinding of output.cross_requirement_findings || []) {
            const severity = crossFinding.severity === 'FAIL' ? 'error' : 'warning';
            const relatedIds = Array.isArray(crossFinding.related_requirement_ids) ? crossFinding.related_requirement_ids : [];
            const primaryRequirementId = relatedIds[0] || 'CROSS-REQ';
            const inferredType = primaryRequirementId.startsWith('NFR-') ? 'NFR' : 'FR';
            issues.push({
                requirementId: primaryRequirementId,
                requirementType: inferredType,
                category: mapGeminiRuleToCategory(crossFinding.rule),
                severity,
                field: 'statement',
                message: crossFinding.message || 'Gemini detected a cross-requirement issue.',
                details: {
                    relatedRequirementIds: relatedIds,
                },
                suggestion: crossFinding.suggestion,
            });
        }
    }
    const dedupedIssues = dedupeIssues(issues);
    const summary = createSummary(context.flattenedRequirements.length, dedupedIssues);
    const qualityScore = typeof geminiScore === 'number' ? Math.max(0, Math.min(100, geminiScore)) : calculateQualityScore(dedupedIssues);
    return {
        isValid: summary.errors === 0,
        summary,
        qualityScore,
        issues: dedupedIssues,
    };
}
async function runGeminiValidation(input) {
    const prompt = (0, promptBuilder_1.generateGeminiValidatorPrompt)(input);
    const raw = await (0, geminiService_1.generateWithGemini)(prompt);
    try {
        return JSON.parse(raw);
    }
    catch {
        const repaired = await (0, jsonRepairService_1.repairJson)(raw);
        return JSON.parse(repaired);
    }
}
function validateGeneratedRequirementsRuleBased(input, config) {
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
        qualityScore: calculateQualityScore(issues),
        issues,
    };
}
async function validateGeneratedRequirementsWithGemini(input, config) {
    const safeDocument = normalizeDocument(input);
    const context = createValidationContext(safeDocument, config);
    const frPromptInput = buildGeminiValidatorInput(safeDocument, 'FR');
    const nfrPromptInput = buildGeminiValidatorInput(safeDocument, 'NFR');
    const outputs = await Promise.all([
        runGeminiValidation(frPromptInput),
        runGeminiValidation(nfrPromptInput),
    ]);
    return buildValidationResultFromGeminiOutputs(outputs, context);
}
async function validateGeneratedRequirements(input, options) {
    const validationModel = options && 'validationModel' in options ? options.validationModel : 'rule-based';
    const config = options && 'config' in options ? options.config : options;
    if (validationModel === 'gemini') {
        return validateGeneratedRequirementsWithGemini(input, config);
    }
    return validateGeneratedRequirementsRuleBased(input, config);
}
async function validateRequirements(input, options) {
    return validateGeneratedRequirements(input, options);
}
async function validateGeneratedRequirementsWithModel(input, validationModel = 'rule-based', config) {
    return validateGeneratedRequirements(input, { validationModel, config });
}
function getAutoFixSuggestionsFromValidation(validationResult) {
    return (0, autoFixSuggestions_1.buildAutoFixSuggestions)(validationResult.issues);
}
exports.FR_NFR_VALIDATOR_SUPPORTED_CATEGORIES = constants_1.NFR_CATEGORIES;
exports.DEFAULT_FR_NFR_VALIDATION_CONFIG = constants_1.DEFAULT_VALIDATION_CONFIG;
