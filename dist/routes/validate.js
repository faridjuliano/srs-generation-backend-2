"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const srsValidator_1 = require("../validators/srsValidator");
const router = (0, express_1.Router)();
router.post('/validate', async (req, res) => {
    try {
        const payload = req.body;
        if (!payload || typeof payload !== 'object') {
            return res.status(400).json({
                success: false,
                error: 'Invalid payload: must be a JSON object',
            });
        }
        const { content } = payload;
        if (!content || typeof content !== 'object') {
            return res.status(400).json({
                success: false,
                error: 'Invalid content: missing or invalid SRS content',
            });
        }
        // Validate the SRS content
        const validationResult = (0, srsValidator_1.validateSRS)(content);
        // Calculate quality score based on issues
        const issues = validationResult.issues || [];
        const errorCount = issues.filter((i) => i.severity === 'error').length;
        const warningCount = issues.filter((i) => i.severity === 'warning').length;
        const qualityScore = Math.max(0, 100 - errorCount * 10 - warningCount * 5);
        return res.json({
            success: true,
            validation: {
                passed: errorCount === 0,
                errorCount,
                warningCount,
                issues,
                qualityScore,
            },
        });
    }
    catch (error) {
        console.error('SRS validation error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Validation failed',
        });
    }
});
exports.default = router;
