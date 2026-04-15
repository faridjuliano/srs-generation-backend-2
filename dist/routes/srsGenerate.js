"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const promptBuilder_1 = require("../prompts/promptBuilder");
const geminiService_1 = require("../services/geminiService");
const jsonRepairService_1 = require("../services/jsonRepairService");
const srsValidator_1 = require("../validators/srsValidator");
const router = (0, express_1.Router)();
const ENABLE_VALIDATION = true;
const ACTIVE_PROMPT_SET = 'iso-strict';
function enforceCurrentDate(content) {
    const today = new Date().toISOString().slice(0, 10);
    const documentControl = content.documentControl;
    if (documentControl && typeof documentControl === 'object' && !Array.isArray(documentControl)) {
        documentControl.date = today;
    }
    const revisionHistory = content.revisionHistory;
    if (Array.isArray(revisionHistory)) {
        revisionHistory.forEach((item) => {
            if (item && typeof item === 'object' && !Array.isArray(item)) {
                item.date = today;
            }
        });
    }
    return content;
}
router.post('/generate', async (req, res) => {
    try {
        const { projectName, authorName, projectVision, srsStandard, uploadedFiles = [] } = req.body;
        if (!projectName || !projectVision || !srsStandard) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }
        const prompt = (0, promptBuilder_1.generatePrompt)({
            projectName,
            authorName: authorName || 'AI Generator',
            projectVision,
            srsStandard,
            uploadedFiles: Array.isArray(uploadedFiles) ? uploadedFiles : []
        }, ACTIVE_PROMPT_SET);
        const rawText = await (0, geminiService_1.generateWithGemini)(prompt);
        console.log('=== GEMINI RAW RESPONSE ===');
        console.log(rawText);
        console.log('=== END GEMINI RAW RESPONSE ===');
        let parsed;
        try {
            parsed = JSON.parse(rawText);
        }
        catch {
            const repaired = await (0, jsonRepairService_1.repairJson)(rawText);
            parsed = JSON.parse(repaired);
        }
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return res.status(500).json({
                success: false,
                error: 'Model returned invalid JSON object'
            });
        }
        const normalizedParsed = enforceCurrentDate(parsed);
        const architecturePrompt = (0, promptBuilder_1.generateArchitectureDiagramPrompt)(normalizedParsed);
        const architectureRawText = await (0, geminiService_1.generateWithGemini)(architecturePrompt);
        let architectureParsed;
        try {
            architectureParsed = JSON.parse(architectureRawText);
        }
        catch {
            const repairedArchitecture = await (0, jsonRepairService_1.repairJson)(architectureRawText);
            architectureParsed = JSON.parse(repairedArchitecture);
        }
        const diagrams = (architectureParsed &&
            typeof architectureParsed === 'object' &&
            !Array.isArray(architectureParsed))
            ? {
                sequenceDiagram: String(architectureParsed.sequenceDiagram || ''),
                classOrErdDiagram: String(architectureParsed.classOrErdDiagram || ''),
            }
            : {
                sequenceDiagram: '',
                classOrErdDiagram: '',
            };
        const validationResult = ENABLE_VALIDATION
            ? (0, srsValidator_1.validateSRS)(normalizedParsed)
            : null;
        return res.json({
            success: true,
            content: normalizedParsed,
            diagrams,
            validation: validationResult
        });
    }
    catch (error) {
        console.error('SRS generation error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to generate SRS'
        });
    }
});
router.post('/reprompt', async (req, res) => {
    try {
        const { content, instruction } = req.body || {};
        if (!content || typeof content !== 'object' || Array.isArray(content)) {
            return res.status(400).json({
                success: false,
                error: 'Request body must include a valid "content" object.',
            });
        }
        if (typeof instruction !== 'string' || instruction.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Request body must include a non-empty "instruction" string.',
            });
        }
        const revisionPrompt = (0, promptBuilder_1.generateRevisionPrompt)(content, instruction.trim());
        const rawText = await (0, geminiService_1.generateWithGemini)(revisionPrompt);
        let revised;
        try {
            revised = JSON.parse(rawText);
        }
        catch {
            const repaired = await (0, jsonRepairService_1.repairJson)(rawText);
            revised = JSON.parse(repaired);
        }
        if (!revised || typeof revised !== 'object' || Array.isArray(revised)) {
            return res.status(500).json({
                success: false,
                error: 'Model returned invalid revised JSON object',
            });
        }
        const normalizedRevised = enforceCurrentDate(revised);
        const validationResult = ENABLE_VALIDATION
            ? (0, srsValidator_1.validateSRS)(normalizedRevised)
            : null;
        return res.json({
            success: true,
            content: normalizedRevised,
            validation: validationResult,
        });
    }
    catch (error) {
        console.error('SRS reprompt error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to revise SRS',
        });
    }
});
exports.default = router;
