import { Router, Request, Response } from 'express';
import { generatePrompt, generateArchitectureDiagramPrompt, generateRevisionPrompt, generateFrNfrPrompt, generateFrNfrRevisionPrompt } from '../prompts/promptBuilder';
import { generateWithGemini } from '../services/geminiService';
import { repairJson } from '../services/jsonRepairService';
import { validateSRS } from '../validators/srsValidator';

const router = Router();

const ENABLE_VALIDATION = true;
const ACTIVE_PROMPT_SET: 'default' | 'iso-strict' | 'ieee-strict' = 'iso-strict';

function enforceCurrentDate(content: Record<string, unknown>): Record<string, unknown> {
  const today = new Date().toISOString().slice(0, 10);

  const documentControl = content.documentControl;
  if (documentControl && typeof documentControl === 'object' && !Array.isArray(documentControl)) {
    (documentControl as Record<string, unknown>).date = today;
  }

  const revisionHistory = content.revisionHistory;
  if (Array.isArray(revisionHistory)) {
    revisionHistory.forEach((item) => {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        (item as Record<string, unknown>).date = today;
      }
    });
  }

  return content;
}

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

    const normalizedParsed = enforceCurrentDate(parsed as Record<string, unknown>);

    const architecturePrompt = generateArchitectureDiagramPrompt(normalizedParsed);
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
      ? validateSRS(normalizedParsed as any)
      : null;

    return res.json({
      success: true,
      content: normalizedParsed,
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

router.post('/reprompt', async (req: Request, res: Response) => {
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

    const revisionPrompt = generateRevisionPrompt(content, instruction.trim());
    const rawText = await generateWithGemini(revisionPrompt);

    let revised: unknown;
    try {
      revised = JSON.parse(rawText);
    } catch {
      const repaired = await repairJson(rawText);
      revised = JSON.parse(repaired);
    }

    if (!revised || typeof revised !== 'object' || Array.isArray(revised)) {
      return res.status(500).json({
        success: false,
        error: 'Model returned invalid revised JSON object',
      });
    }

    const normalizedRevised = enforceCurrentDate(revised as Record<string, unknown>);

    const validationResult = ENABLE_VALIDATION
      ? validateSRS(normalizedRevised as any)
      : null;

    return res.json({
      success: true,
      content: normalizedRevised,
      validation: validationResult,
    });
  } catch (error) {
    console.error('SRS reprompt error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to revise SRS',
    });
  }
});

router.post('/generate-fr-nfr', async (req: Request, res: Response) => {
  try {
    const { projectName, projectVision } = req.body || {};

    if (typeof projectName !== 'string' || projectName.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Request body must include a non-empty "projectName" string.',
      });
    }

    if (typeof projectVision !== 'string' || projectVision.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Request body must include a non-empty "projectVision" string.',
      });
    }

    const prompt = generateFrNfrPrompt(projectName.trim(), projectVision.trim());
    const rawText = await generateWithGemini(prompt);

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
        error: 'Model returned invalid FR/NFR JSON object',
      });
    }

    return res.json({
      success: true,
      content: parsed,
    });
  } catch (error) {
    console.error('FR/NFR generation error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate FR/NFR content',
    });
  }
});

router.post('/reprompt-fr-nfr', async (req: Request, res: Response) => {
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

    const revisionPrompt = generateFrNfrRevisionPrompt(content, instruction.trim());
    const rawText = await generateWithGemini(revisionPrompt);

    let revised: unknown;
    try {
      revised = JSON.parse(rawText);
    } catch {
      const repaired = await repairJson(rawText);
      revised = JSON.parse(repaired);
    }

    if (!revised || typeof revised !== 'object' || Array.isArray(revised)) {
      return res.status(500).json({
        success: false,
        error: 'Model returned invalid FR/NFR revised JSON object',
      });
    }

    return res.json({
      success: true,
      content: revised,
    });
  } catch (error) {
    console.error('FR/NFR reprompt error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to revise FR/NFR content',
    });
  }
});

export default router;
