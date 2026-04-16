"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const frNfr_1 = require("../validators/frNfr");
function createBaseDocument() {
    return {
        projectName: 'Clinic Appointment Booking System',
        assumptions: ['Users use modern browsers'],
        constraints: ['Prototype only supports web'],
        features: [
            {
                id: 'FEAT-001',
                name: 'Appointment Booking',
            },
        ],
        useCases: [
            {
                id: 'UC-001',
                name: 'Book Appointment',
            },
        ],
        functionalRequirements: [
            {
                id: 'FR-001',
                title: 'Book appointment',
                statement: 'The system shall allow patient appointment booking.',
                rationale: 'Core workflow',
                source: ['Vision'],
                priority: 'High',
                fitCriterion: '95% of booking requests are completed within 3 seconds.',
                verificationMethod: 'Test',
                traceToFeatures: ['FEAT-001'],
                traceToUseCases: ['UC-001'],
            },
        ],
        nonFunctionalRequirements: {
            performanceRequirements: [
                {
                    id: 'NFR-PERF-001',
                    title: 'Booking latency',
                    statement: 'The system shall return appointment booking confirmation within 3 seconds for 95% of valid booking requests.',
                    rationale: 'Responsive UX',
                    source: ['Architecture'],
                    priority: 'Medium',
                    fitCriterion: '95% of booking responses complete within 3 seconds under expected load.',
                    verificationMethod: 'Performance Test',
                    traceToFeatures: ['FEAT-001'],
                },
            ],
            securityRequirements: [],
            usabilityRequirements: [],
            reliabilityRequirements: [],
            availabilityRequirements: [],
            maintainabilityRequirements: [],
            portabilityRequirements: [],
            scalabilityRequirements: [],
            auditabilityRequirements: [],
            accessibilityRequirements: [],
            backupRecoveryRequirements: [],
            complianceRequirements: [],
        },
        qualityCheckSummary: {
            completenessNotes: [],
            ambiguityRisks: [],
            consistencyRisks: [],
            duplicationRisks: [],
            missingTraceLinks: [],
            assumptionsMade: [],
        },
    };
}
(0, node_test_1.default)('returns valid=true for a minimal well-formed payload', () => {
    const input = createBaseDocument();
    const result = (0, frNfr_1.validateGeneratedRequirements)(input);
    strict_1.default.equal(result.isValid, true);
    strict_1.default.equal(result.summary.errors, 0);
});
(0, node_test_1.default)('flags custom vague wording terms from ValidationConfig', () => {
    const input = createBaseDocument();
    input.functionalRequirements[0].statement = 'The system shall be snappy and responsive.';
    const result = (0, frNfr_1.validateGeneratedRequirements)(input, {
        vagueTerms: ['snappy'],
        duplicateSimilarityThreshold: 0.82,
        minimumStatementLength: 6,
        minimumFitCriterionLength: 4,
        maxAndCount: 2,
        maxOrCount: 1,
        maxSemicolonCount: 0,
        maxShallCount: 1,
        placeholderTerms: ['tbd'],
        weakFitCriterionTerms: ['works correctly'],
        infeasiblePhrases: ['never fail'],
        preferredNfrTraceCoverageThreshold: 0.6,
    });
    const vagueIssue = result.issues.find((issue) => issue.category === 'vague_wording');
    strict_1.default.ok(vagueIssue);
    strict_1.default.deepEqual(vagueIssue?.details?.matchedTerms, ['snappy']);
});
(0, node_test_1.default)('flags weak verifiability using the configured minimum fitCriterion length', () => {
    const input = createBaseDocument();
    input.functionalRequirements[0].fitCriterion = 'works correctly';
    const result = (0, frNfr_1.validateGeneratedRequirements)(input, {
        vagueTerms: ['user-friendly'],
        duplicateSimilarityThreshold: 0.82,
        minimumStatementLength: 6,
        minimumFitCriterionLength: 5,
        maxAndCount: 2,
        maxOrCount: 1,
        maxSemicolonCount: 0,
        maxShallCount: 1,
        placeholderTerms: ['tbd'],
        weakFitCriterionTerms: ['works correctly'],
        infeasiblePhrases: ['never fail'],
        preferredNfrTraceCoverageThreshold: 0.6,
    });
    const verifiabilityIssue = result.issues.find((issue) => issue.category === 'verifiability');
    strict_1.default.ok(verifiabilityIssue);
    strict_1.default.equal(verifiabilityIssue?.severity, 'error');
});
(0, node_test_1.default)('flags near duplicates when similarity threshold is lowered', () => {
    const input = createBaseDocument();
    input.functionalRequirements.push({
        ...input.functionalRequirements[0],
        id: 'FR-002',
        title: 'Book appointment in clinic',
        statement: 'The system shall allow a patient to book an appointment with a doctor.',
    });
    const result = (0, frNfr_1.validateGeneratedRequirements)(input, {
        vagueTerms: ['user-friendly'],
        duplicateSimilarityThreshold: 0.2,
        minimumStatementLength: 6,
        minimumFitCriterionLength: 4,
        maxAndCount: 2,
        maxOrCount: 1,
        maxSemicolonCount: 0,
        maxShallCount: 1,
        placeholderTerms: ['tbd'],
        weakFitCriterionTerms: ['works correctly'],
        infeasiblePhrases: ['never fail'],
        preferredNfrTraceCoverageThreshold: 0.6,
    });
    const duplicateIssue = result.issues.find((issue) => issue.category === 'duplicate' && issue.severity === 'warning');
    strict_1.default.ok(duplicateIssue);
    strict_1.default.ok(duplicateIssue?.details?.relatedRequirementIds?.includes('FR-002'));
});
(0, node_test_1.default)('flags vague wording and weak verifiability', () => {
    const input = createBaseDocument();
    input.functionalRequirements[0].statement = 'The system shall be user-friendly and fast.';
    input.functionalRequirements[0].fitCriterion = 'works correctly';
    const result = (0, frNfr_1.validateGeneratedRequirements)(input, {
        vagueTerms: ['user-friendly', 'fast'],
        duplicateSimilarityThreshold: 0.82,
        minimumStatementLength: 6,
        minimumFitCriterionLength: 4,
        maxAndCount: 2,
        maxOrCount: 1,
        maxSemicolonCount: 0,
        maxShallCount: 1,
        placeholderTerms: ['tbd'],
        weakFitCriterionTerms: ['works correctly'],
        infeasiblePhrases: ['never fail'],
        preferredNfrTraceCoverageThreshold: 0.6,
    });
    const categories = result.issues.map((issue) => issue.category);
    strict_1.default.equal(result.isValid, false);
    strict_1.default.ok(categories.includes('vague_wording'));
    strict_1.default.ok(categories.includes('verifiability'));
});
(0, node_test_1.default)('flags broken traceability and duplicate requirements', () => {
    const input = createBaseDocument();
    input.functionalRequirements.push({
        ...input.functionalRequirements[0],
        id: 'FR-002',
        traceToFeatures: ['FEAT-404'],
        traceToUseCases: ['UC-999'],
    });
    const result = (0, frNfr_1.validateGeneratedRequirements)(input);
    const duplicateIssue = result.issues.find((issue) => issue.category === 'duplicate');
    const traceIssue = result.issues.find((issue) => issue.category === 'traceability');
    strict_1.default.ok(Boolean(duplicateIssue));
    strict_1.default.ok(Boolean(traceIssue));
    const autoFixSuggestions = (0, frNfr_1.getAutoFixSuggestionsFromValidation)(result);
    strict_1.default.ok(autoFixSuggestions.length > 0);
});
