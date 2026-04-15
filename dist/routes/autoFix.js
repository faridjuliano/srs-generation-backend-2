"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const srsValidator_1 = require("../validators/srsValidator");
const router = (0, express_1.Router)();
function asRecord(value) {
    return value && typeof value === 'object' ? value : {};
}
function getFunctionalRequirements(content) {
    const primary = content['4FunctionalRequirements'];
    if (Array.isArray(primary))
        return primary;
    const fallback = content.functionalRequirements;
    if (Array.isArray(fallback))
        return fallback;
    return [];
}
function getStakeholderIds(content) {
    const context = asRecord(content['2ContextOfTheSystem']);
    const nested = context['2.3Stakeholders'];
    if (!Array.isArray(nested))
        return [];
    return nested
        .map(item => asRecord(item).id)
        .filter((id) => typeof id === 'string' && id.trim().length > 0);
}
function getUseCaseIds(content) {
    const section = asRecord(content['3SystemFeaturesAndUseCases']);
    const nested = section['3.2UseCases'];
    if (!Array.isArray(nested))
        return [];
    return nested
        .map(item => asRecord(item).id ?? asRecord(item).identifier)
        .filter((id) => typeof id === 'string' && id.trim().length > 0);
}
function parseUnknownIdFromMessage(message, kind) {
    const pattern = kind === 'stakeholder'
        ? /unknown stakeholder ID:\s*([A-Za-z0-9-_.]+)/i
        : /unknown use case ID:\s*([A-Za-z0-9-_.]+)/i;
    const match = message.match(pattern);
    return match?.[1] ?? null;
}
function parseNumericSuffix(value) {
    const match = value.match(/(\d+)$/);
    if (!match)
        return null;
    return Number.parseInt(match[1], 10);
}
function chooseBestReplacement(invalidId, availableIds) {
    if (availableIds.length === 0)
        return null;
    if (availableIds.includes(invalidId))
        return invalidId;
    const invalidPrefix = invalidId.split('-')[0];
    const samePrefix = availableIds.filter(id => id.split('-')[0] === invalidPrefix);
    const candidates = samePrefix.length > 0 ? samePrefix : availableIds;
    const invalidNum = parseNumericSuffix(invalidId);
    if (invalidNum === null)
        return candidates[0];
    let best = candidates[0];
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const candidate of candidates) {
        const candidateNum = parseNumericSuffix(candidate);
        if (candidateNum === null)
            continue;
        const distance = Math.abs(candidateNum - invalidNum);
        if (distance < bestDistance) {
            bestDistance = distance;
            best = candidate;
        }
    }
    return best;
}
function replaceInStringArray(value, from, to) {
    const arr = Array.isArray(value) ? value : [];
    const replaced = arr.map(item => (item === from ? to : String(item)));
    return Array.from(new Set(replaced));
}
function applyIssueDrivenFixes(content, issues) {
    const fixed = JSON.parse(JSON.stringify(content));
    const fixesApplied = [];
    const functionalRequirements = getFunctionalRequirements(fixed);
    const stakeholderIds = getStakeholderIds(fixed);
    const useCaseIds = getUseCaseIds(fixed);
    for (const issue of issues) {
        if (issue.code === 'BROKEN_TRACE_STAKEHOLDER' && issue.requirementId) {
            const invalidId = parseUnknownIdFromMessage(issue.message, 'stakeholder');
            if (!invalidId)
                continue;
            const replacementId = chooseBestReplacement(invalidId, stakeholderIds);
            if (!replacementId)
                continue;
            const requirement = functionalRequirements.find(req => String(req.id) === issue.requirementId);
            if (!requirement)
                continue;
            requirement.traceToStakeholders = replaceInStringArray(requirement.traceToStakeholders, invalidId, replacementId);
            fixesApplied.push(`Updated ${issue.requirementId} traceToStakeholders: ${invalidId} -> ${replacementId}`);
        }
        if (issue.code === 'BROKEN_TRACE_USE_CASE' && issue.requirementId) {
            const invalidId = parseUnknownIdFromMessage(issue.message, 'use case');
            if (!invalidId)
                continue;
            const replacementId = chooseBestReplacement(invalidId, useCaseIds);
            if (!replacementId)
                continue;
            const requirement = functionalRequirements.find(req => String(req.id) === issue.requirementId);
            if (!requirement)
                continue;
            requirement.traceToUseCases = replaceInStringArray(requirement.traceToUseCases, invalidId, replacementId);
            fixesApplied.push(`Updated ${issue.requirementId} traceToUseCases: ${invalidId} -> ${replacementId}`);
        }
    }
    return { fixed, fixesApplied };
}
router.post('/auto-fix', async (req, res) => {
    try {
        const payload = req.body;
        if (!payload || typeof payload !== 'object') {
            return res.status(400).json({
                success: false,
                error: 'Invalid payload: must be a JSON object.',
            });
        }
        const content = payload.content;
        if (!content || typeof content !== 'object' || Array.isArray(content)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid content: missing or invalid SRS content object.',
            });
        }
        const incomingIssues = Array.isArray(payload.validation?.issues)
            ? payload.validation?.issues
            : Array.isArray(payload.issues)
                ? payload.issues
                : [];
        const issuesToFix = incomingIssues.length > 0
            ? incomingIssues
            : (0, srsValidator_1.validateSRS)(content).issues;
        const { fixed, fixesApplied } = applyIssueDrivenFixes(content, issuesToFix);
        const validation = (0, srsValidator_1.validateSRS)(fixed);
        return res.json({
            success: true,
            content: fixed,
            fixesApplied,
            validation,
        });
    }
    catch (error) {
        console.error('SRS auto-fix error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Auto-fix failed',
        });
    }
});
exports.default = router;
