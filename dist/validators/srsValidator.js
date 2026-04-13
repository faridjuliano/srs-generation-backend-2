"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateSRS = validateSRS;
exports.checkMissingFields = checkMissingFields;
exports.checkDuplicateIds = checkDuplicateIds;
exports.checkBrokenTraceLinks = checkBrokenTraceLinks;
exports.checkMissingSourceLinks = checkMissingSourceLinks;
exports.checkVagueWording = checkVagueWording;
exports.checkMultiActionRequirements = checkMultiActionRequirements;
exports.checkNearDuplicateRequirements = checkNearDuplicateRequirements;
exports.calculateQualityScore = calculateQualityScore;
exports.runValidatorExample = runValidatorExample;
const VAGUE_TERMS = [
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
    'and/or'
];
const FUNCTIONAL_REQUIRED_FIELDS = [
    'id',
    'title',
    'statement',
    'rationale',
    'source',
    'priority',
    'fitCriterion',
    'verificationMethod',
    'traceToStakeholders',
    'traceToUseCases'
];
const NON_FUNCTIONAL_REQUIRED_FIELDS = [
    'id',
    'statement',
    'fitCriterion',
    'verificationMethod',
    'priority',
    'source'
];
function validateSRS(document) {
    const issues = [
        ...checkMissingFields(document),
        ...checkDuplicateIds(document),
        ...checkBrokenTraceLinks(document),
        ...checkMissingSourceLinks(document),
        ...checkVagueWording(document),
        ...checkMultiActionRequirements(document),
        ...checkNearDuplicateRequirements(document)
    ];
    const errorCount = issues.filter(i => i.severity === 'error').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;
    return {
        passed: errorCount === 0,
        errorCount,
        warningCount,
        issues,
        qualityScore: calculateQualityScore(issues)
    };
}
function checkMissingFields(document) {
    const issues = [];
    getFunctionalRequirements(document).forEach((req, index) => {
        FUNCTIONAL_REQUIRED_FIELDS.forEach((field) => {
            if (isMissing(req[field])) {
                issues.push({
                    severity: 'error',
                    code: 'FR_MISSING_FIELD',
                    message: `Functional requirement is missing required field: ${field}`,
                    requirementId: req.id,
                    path: `functionalRequirements[${index}].${field}`,
                    suggestion: `Populate ${field} with a valid value.`
                });
            }
        });
    });
    getNonFunctionalRequirements(document).forEach((req, index) => {
        NON_FUNCTIONAL_REQUIRED_FIELDS.forEach((field) => {
            if (isMissing(req[field])) {
                issues.push({
                    severity: 'error',
                    code: 'NFR_MISSING_FIELD',
                    message: `Non-functional requirement is missing required field: ${field}`,
                    requirementId: req.id,
                    path: `nonFunctionalRequirements[${index}].${field}`,
                    suggestion: `Populate ${field} with a valid value.`
                });
            }
        });
    });
    return issues;
}
function checkDuplicateIds(document) {
    const issues = [];
    const allIds = collectAllIds(document);
    const idMap = new Map();
    allIds.forEach(({ id, path }) => {
        if (!id)
            return;
        const existing = idMap.get(id) ?? [];
        existing.push(path);
        idMap.set(id, existing);
    });
    for (const [id, paths] of idMap.entries()) {
        if (paths.length > 1) {
            issues.push({
                severity: 'error',
                code: 'DUPLICATE_ID',
                message: `Duplicate ID detected: ${id}`,
                requirementId: id,
                path: paths.join(', '),
                suggestion: 'Use globally unique IDs across stakeholders, use cases, and requirements.'
            });
        }
    }
    return issues;
}
function checkBrokenTraceLinks(document) {
    const issues = [];
    const stakeholderIds = new Set(getStakeholders(document).map(s => s.id).filter(Boolean));
    const useCaseIds = new Set(getUseCases(document).map(u => getUseCaseId(u)).filter(Boolean));
    getFunctionalRequirements(document).forEach((req, index) => {
        (req.traceToStakeholders || []).forEach((stakeholderId) => {
            if (!stakeholderIds.has(stakeholderId)) {
                issues.push({
                    severity: 'error',
                    code: 'BROKEN_TRACE_STAKEHOLDER',
                    message: `Requirement references unknown stakeholder ID: ${stakeholderId}`,
                    requirementId: req.id,
                    path: `functionalRequirements[${index}].traceToStakeholders`,
                    suggestion: 'Reference an existing stakeholder ID from the stakeholders section.'
                });
            }
        });
        (req.traceToUseCases || []).forEach((useCaseId) => {
            if (!useCaseIds.has(useCaseId)) {
                issues.push({
                    severity: 'error',
                    code: 'BROKEN_TRACE_USE_CASE',
                    message: `Requirement references unknown use case ID: ${useCaseId}`,
                    requirementId: req.id,
                    path: `functionalRequirements[${index}].traceToUseCases`,
                    suggestion: 'Reference an existing use case ID from the use case section.'
                });
            }
        });
    });
    return issues;
}
function checkMissingSourceLinks(document) {
    const issues = [];
    getFunctionalRequirements(document).forEach((req, index) => {
        if (!Array.isArray(req.source) || req.source.length === 0) {
            issues.push({
                severity: 'error',
                code: 'FR_MISSING_SOURCE',
                message: 'Functional requirement has no source link.',
                requirementId: req.id,
                path: `functionalRequirements[${index}].source`,
                suggestion: 'Add at least one source (stakeholder, document, regulation, or use case).'
            });
        }
    });
    getNonFunctionalRequirements(document).forEach((req, index) => {
        if (!Array.isArray(req.source) || req.source.length === 0) {
            issues.push({
                severity: 'error',
                code: 'NFR_MISSING_SOURCE',
                message: 'Non-functional requirement has no source link.',
                requirementId: req.id,
                path: `nonFunctionalRequirements[${index}].source`,
                suggestion: 'Add at least one source (stakeholder, policy, architecture decision, or standard).'
            });
        }
    });
    return issues;
}
function checkVagueWording(document) {
    const issues = [];
    for (const req of getAllRequirements(document)) {
        const text = normalizeText(req.statement);
        for (const term of VAGUE_TERMS) {
            if (text.includes(term)) {
                issues.push({
                    severity: 'warning',
                    code: 'VAGUE_WORDING',
                    message: `Vague wording detected: "${term}"`,
                    requirementId: req.id,
                    suggestion: 'Replace vague wording with measurable acceptance criteria.'
                });
            }
        }
        // In requirements specs, "shall" indicates mandatory behavior.
        if (/(\bshould\b|\bmay\b)/i.test(req.statement) && /\bsystem\b/i.test(req.statement)) {
            issues.push({
                severity: 'warning',
                code: 'WEAK_MODAL_VERB',
                message: 'Requirement uses "should" or "may" where mandatory wording may be expected.',
                requirementId: req.id,
                suggestion: 'Use "The system shall ..." for mandatory requirements.'
            });
        }
    }
    return dedupeIssues(issues);
}
function checkMultiActionRequirements(document) {
    const issues = [];
    for (const req of getAllRequirements(document)) {
        const statement = req.statement || '';
        const andCount = countMatches(statement.toLowerCase(), /\band\b/g);
        const semicolonCount = countMatches(statement, /;/g);
        const commaCount = countMatches(statement, /,/g);
        // Heuristic: too many connectors often means multiple atomic requirements in one sentence.
        const likelyMultiAction = andCount >= 2 || semicolonCount >= 1 || commaCount >= 4;
        if (likelyMultiAction) {
            issues.push({
                severity: 'warning',
                code: 'MULTI_ACTION_REQUIREMENT',
                message: 'Requirement likely combines multiple actions and should be split.',
                requirementId: req.id,
                suggestion: 'Split this statement into separate atomic requirements with distinct IDs.'
            });
        }
    }
    return issues;
}
function checkNearDuplicateRequirements(document) {
    const issues = [];
    const requirements = getAllRequirements(document);
    const threshold = 0.8;
    for (let i = 0; i < requirements.length; i += 1) {
        for (let j = i + 1; j < requirements.length; j += 1) {
            const a = requirements[i];
            const b = requirements[j];
            const similarity = jaccardSimilarity(tokenize(a.statement), tokenize(b.statement));
            if (similarity >= threshold) {
                issues.push({
                    severity: 'warning',
                    code: 'NEAR_DUPLICATE_REQUIREMENT',
                    message: `Near-duplicate requirements detected (similarity=${similarity.toFixed(2)}).`,
                    requirementId: a.id,
                    relatedRequirementId: b.id,
                    suggestion: 'Merge, differentiate, or remove one of these requirements to avoid redundancy.'
                });
            }
        }
    }
    return issues;
}
function calculateQualityScore(issues) {
    const startingScore = 100;
    const penalties = issues.reduce((total, issue) => {
        if (issue.severity === 'error')
            return total + 8;
        return total + 3;
    }, 0);
    return Math.max(0, startingScore - penalties);
}
function getStakeholders(document) {
    if (Array.isArray(document.stakeholders))
        return document.stakeholders;
    const context = asRecord(document['2ContextOfTheSystem']);
    const nested = context['2.3Stakeholders'];
    return Array.isArray(nested) ? nested : [];
}
function getUseCases(document) {
    if (Array.isArray(document.systemUseCases))
        return document.systemUseCases;
    const featuresAndUseCases = asRecord(document['3SystemFeaturesAndUseCases']);
    const nested = featuresAndUseCases['3.2UseCases'];
    return Array.isArray(nested) ? nested : [];
}
function getFunctionalRequirements(document) {
    if (Array.isArray(document.functionalRequirements))
        return document.functionalRequirements;
    const nested = document['4FunctionalRequirements'];
    return Array.isArray(nested) ? nested : [];
}
function getNonFunctionalRequirements(document) {
    if (Array.isArray(document.nonFunctionalRequirements))
        return document.nonFunctionalRequirements;
    const grouped = asRecord(document['5NonFunctionalRequirements']);
    const flattened = [];
    Object.values(grouped).forEach((value) => {
        if (Array.isArray(value)) {
            value.forEach((entry) => {
                flattened.push(entry);
            });
        }
    });
    return flattened;
}
function getAllRequirements(document) {
    return [...getFunctionalRequirements(document), ...getNonFunctionalRequirements(document)];
}
function getUseCaseId(useCase) {
    return useCase.id || useCase.identifier || '';
}
function collectAllIds(document) {
    const results = [];
    getStakeholders(document).forEach((item, index) => {
        results.push({ id: item.id, path: `stakeholders[${index}].id` });
    });
    getUseCases(document).forEach((item, index) => {
        results.push({ id: getUseCaseId(item), path: `systemUseCases[${index}].id` });
    });
    getFunctionalRequirements(document).forEach((item, index) => {
        results.push({ id: item.id, path: `functionalRequirements[${index}].id` });
    });
    getNonFunctionalRequirements(document).forEach((item, index) => {
        results.push({ id: item.id, path: `nonFunctionalRequirements[${index}].id` });
    });
    return results;
}
function dedupeIssues(issues) {
    const seen = new Set();
    const output = [];
    issues.forEach((issue) => {
        const key = [issue.code, issue.requirementId, issue.relatedRequirementId, issue.message].join('|');
        if (!seen.has(key)) {
            seen.add(key);
            output.push(issue);
        }
    });
    return output;
}
function isMissing(value) {
    if (value === null || value === undefined)
        return true;
    if (typeof value === 'string')
        return value.trim().length === 0;
    if (Array.isArray(value))
        return value.length === 0;
    return false;
}
function asRecord(value) {
    return value && typeof value === 'object' ? value : {};
}
function normalizeText(value) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
function tokenize(value) {
    const tokens = normalizeText(value)
        .split(' ')
        .map(token => token.trim())
        .filter(token => token.length > 2);
    return new Set(tokens);
}
function jaccardSimilarity(a, b) {
    if (a.size === 0 && b.size === 0)
        return 1;
    if (a.size === 0 || b.size === 0)
        return 0;
    let intersection = 0;
    a.forEach((token) => {
        if (b.has(token))
            intersection += 1;
    });
    const union = a.size + b.size - intersection;
    return union === 0 ? 0 : intersection / union;
}
function countMatches(value, pattern) {
    const matches = value.match(pattern);
    return matches ? matches.length : 0;
}
// Example usage for Node.js backend integration.
function runValidatorExample() {
    const example = {
        stakeholders: [
            { id: 'STK-001', name: 'Warehouse Clerk' },
            { id: 'STK-002', name: 'Inventory Manager' }
        ],
        systemUseCases: [
            { identifier: 'UC-001', name: 'Receive Stock' },
            { identifier: 'UC-002', name: 'Issue Stock' }
        ],
        functionalRequirements: [
            {
                id: 'FR-001',
                title: 'Inbound Recording',
                statement: 'The system shall record inbound stock transactions in real time.',
                rationale: 'Track stock movement accurately.',
                source: ['Project Vision'],
                priority: 'High',
                fitCriterion: 'Transaction is visible within 2 seconds.',
                verificationMethod: 'Test',
                traceToStakeholders: ['STK-001'],
                traceToUseCases: ['UC-001']
            },
            {
                id: 'FR-002',
                title: 'Outbound Recording',
                statement: 'The system should quickly process outbound transactions and/or notify users as needed.',
                rationale: 'Support fulfillment workflow.',
                source: [],
                priority: 'High',
                fitCriterion: 'Outbound transaction persists to storage.',
                verificationMethod: 'Test',
                traceToStakeholders: ['STK-999'],
                traceToUseCases: ['UC-002']
            }
        ],
        nonFunctionalRequirements: [
            {
                id: 'NFR-001',
                category: 'Performance',
                statement: 'The system shall process 95% of requests under 2 seconds.',
                source: ['Architecture Decision Log'],
                priority: 'High',
                fitCriterion: 'p95 < 2000ms',
                verificationMethod: 'Performance Test'
            }
        ]
    };
    return validateSRS(example);
}
// Keep explicit reference so IDE inspections do not flag this exported helper as unused.
void runValidatorExample;
