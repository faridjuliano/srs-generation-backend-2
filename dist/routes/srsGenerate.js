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
        const architecturePrompt = (0, promptBuilder_1.generateArchitectureDiagramPrompt)(parsed);
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
            ? (0, srsValidator_1.validateSRS)(parsed)
            : null;
        return res.json({
            success: true,
            content: parsed,
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
exports.default = router;
