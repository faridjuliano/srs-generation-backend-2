import { Router, Request, Response } from 'express';
import { generatePrompt, generateArchitectureDiagramPrompt } from '../prompts/promptBuilder';
import { generateWithGemini } from '../services/geminiService';
import { repairJson } from '../services/jsonRepairService';
import { validateSRS } from '../validators/srsValidator';

const router = Router();

const ENABLE_VALIDATION = true;
const ACTIVE_PROMPT_SET: 'default' | 'iso-strict' | 'ieee-strict' = 'iso-strict';

router.post('/generate', async (req: Request, res: Response) => {
  try {
    const {
      projectName,
      authorName,
      projectVision,
      srsStandard,
      uploadedFiles = []
    } = req.body;

    if (!projectName || !projectVision || !srsStandard) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    const prompt = generatePrompt(
      {
        projectName,
        authorName: authorName || 'AI Generator',
        projectVision,
        srsStandard,
        uploadedFiles: Array.isArray(uploadedFiles) ? uploadedFiles : []
      },
      ACTIVE_PROMPT_SET
    );

    const rawText = await generateWithGemini(prompt);

    console.log('=== GEMINI RAW RESPONSE ===');
    console.log(rawText);
    console.log('=== END GEMINI RAW RESPONSE ===');

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      const repaired = await repairJson(rawText);
      parsed = JSON.parse(repaired);
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return res.status(500).json({
        success: false,
        error: 'Model returned invalid JSON object'
      });
    }

    const architecturePrompt = generateArchitectureDiagramPrompt(parsed);
    const architectureRawText = await generateWithGemini(architecturePrompt);

    let architectureParsed: unknown;
    try {
      architectureParsed = JSON.parse(architectureRawText);
    } catch {
      const repairedArchitecture = await repairJson(architectureRawText);
      architectureParsed = JSON.parse(repairedArchitecture);
    }

    const diagrams = (
      architectureParsed &&
      typeof architectureParsed === 'object' &&
      !Array.isArray(architectureParsed)
    )
      ? {
          sequenceDiagram: String((architectureParsed as any).sequenceDiagram || ''),
          classOrErdDiagram: String((architectureParsed as any).classOrErdDiagram || ''),
        }
      : {
          sequenceDiagram: '',
          classOrErdDiagram: '',
        };

    const validationResult = ENABLE_VALIDATION
      ? validateSRS(parsed as any)
      : null;

    return res.json({
      success: true,
      content: parsed,
      diagrams,
      validation: validationResult
    });
  } catch (error) {
    console.error('SRS generation error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate SRS'
    });
  }
});

export default router;
