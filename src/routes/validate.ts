import { Router, Request, Response } from 'express';
import { validateSRS } from '../validators/srsValidator';
import { getAutoFixSuggestionsFromValidation, validateGeneratedRequirements } from '../validators/frNfr';
import type { ValidationModel } from '../types/frNfrValidation';

const router = Router();

router.post('/validate', async (req: Request, res: Response) => {
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
    const validationResult = validateSRS(content);

    // Calculate quality score based on issues
    const issues = validationResult.issues || [];
    const errorCount = issues.filter((i: any) => i.severity === 'error').length;
    const warningCount = issues.filter((i: any) => i.severity === 'warning').length;
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
  } catch (error) {
    console.error('SRS validation error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Validation failed',
    });
  }
});

router.post('/validate-fr-nfr', async (req: Request, res: Response) => {
  try {
    const payload = req.body;

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid payload: must be a FR/NFR JSON object',
      });
    }

    const validationModel = (payload as { validationModel?: string }).validationModel;
    const allowedModels: ValidationModel[] = ['rule-based', 'gemini'];

    if (validationModel !== undefined && !allowedModels.includes(validationModel as ValidationModel)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid validationModel: must be "rule-based" or "gemini".',
      });
    }

    const validation = await validateGeneratedRequirements(payload as any, {
      validationModel: (validationModel as ValidationModel | undefined) || 'rule-based',
    });
    const autoFixSuggestions = getAutoFixSuggestionsFromValidation(validation);

    return res.json({
      success: true,
      validation,
      autoFixSuggestions,
    });
  } catch (error) {
    console.error('FR/NFR validation error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'FR/NFR validation failed',
    });
  }
});

export default router;
