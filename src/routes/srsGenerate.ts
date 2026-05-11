import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import {
  generatePrompt,
  generateArchitectureDiagramPrompt,
  generateRevisionPrompt,
  generateFrNfrPrompt,
  generateFrNfrRevisionPrompt,
  frNfrDetailedPrompt,
  // frNfrLitePrompt
} from '../prompts/promptBuilder';
import { generateWithGemini } from '../services/geminiService';
import { repairJson } from '../services/jsonRepairService';
import { storeGeneratedSrs, retrieveStoredSrs } from '../services/srsStorage';
import { createProjectRecord } from '../services/dynamoSrsStorage';
import { validateSRS } from '../validators/srsValidator';
import { getAutoFixSuggestionsFromValidation, validateGeneratedRequirements } from '../validators/frNfr';
import type { FrNfrValidationMode, ValidationModel } from '../types/frNfrValidation';
import {convertFR, convertNFR} from "../utils/contentParser";

const router = Router();

const ENABLE_VALIDATION = true;
// hardcoded storage mode: 'json' => store only as JSON file; 'dynamo' => store in DynamoDB (and still write JSON file as backup)
const STORAGE_MODE: 'json' | 'dynamo' = 'dynamo';
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

const handlePrediction = (async (content: any) => {
  try {
    const nfr = convertNFR(content)
    const fr = convertFR(content)
    const predictUrl = process.env.PREDICT_API_URL + "predict";
    const Pred = await fetch(predictUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([...fr, ...nfr]),
    });

    const rawBody = await Pred.text();
    return JSON.parse(rawBody);
  } catch (error) {
    console.error('Predict proxy error:', error);
  }
})

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
    const { projectName, projectVision, validationModel } = req.body || {};

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

    const resolvedValidationModel: FrNfrValidationMode = validationModel === undefined ? 'rule-based' : validationModel;
    if (
      resolvedValidationModel !== 'rule-based'
      && resolvedValidationModel !== 'gemini'
      && resolvedValidationModel !== 'no-validation'
    ) {
      return res.status(400).json({
        success: false,
        error: 'Request body "validationModel" must be "rule-based", "gemini", or "no-validation".',
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

    const shouldValidate = resolvedValidationModel !== 'no-validation';
    const validation = shouldValidate
      ? await validateGeneratedRequirements(parsed as any, {
          validationModel: resolvedValidationModel as ValidationModel,
        })
      : null;
    const autoFixSuggestions = validation ? getAutoFixSuggestionsFromValidation(validation) : null;

    return res.json({
      success: true,
      content: parsed,
      validation,
      autoFixSuggestions,
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
    const { content, instruction, validationModel } = req.body || {};

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

    const resolvedValidationModel: FrNfrValidationMode = validationModel === undefined ? 'rule-based' : validationModel;
    if (
      resolvedValidationModel !== 'rule-based'
      && resolvedValidationModel !== 'gemini'
      && resolvedValidationModel !== 'no-validation'
    ) {
      return res.status(400).json({
        success: false,
        error: 'Request body "validationModel" must be "rule-based", "gemini", or "no-validation".',
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

    const shouldValidate = resolvedValidationModel !== 'no-validation';
    const validation = shouldValidate
      ? await validateGeneratedRequirements(revised as any, {
          validationModel: resolvedValidationModel as ValidationModel,
        })
      : null;
    const autoFixSuggestions = validation ? getAutoFixSuggestionsFromValidation(validation) : null;

    return res.json({
      success: true,
      content: revised,
      validation,
      autoFixSuggestions,
    });
  } catch (error) {
    console.error('FR/NFR reprompt error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to revise FR/NFR content',
    });
  }
});

router.post('/fr-nfr-detailed', async (req: Request, res: Response) => {
  try {
    const {
      userId,
      projectId,
      project_name,
      project_description,
      features,
      constraints = [],
      assumptions = [],
      validator_model
    } = req.body || {};

    if (typeof project_name !== 'string' || project_name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Request body must include a non-empty "project_name" string.',
      });
    }

    if (typeof project_description !== 'string' || project_description.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Request body must include a non-empty "project_description" string.',
      });
    }

    if (!Array.isArray(features)) {
      return res.status(400).json({
        success: false,
        error: 'Request body must include a "features" array.',
      });
    }

    if (features.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Request body must include at least one feature item in "features".',
      });
    }

    const normalizedFeatures = features.map((feature: unknown, index: number) => {
      if (!feature || typeof feature !== 'object' || Array.isArray(feature)) {
        return { error: `Feature at index ${index} must be an object with "name" and "description".` } as const;
      }

      const name = String((feature as { name?: unknown }).name || '').trim();
      const description = String((feature as { description?: unknown }).description || '').trim();

      if (!name || !description) {
        return { error: `Feature at index ${index} must include non-empty "name" and "description" strings.` } as const;
      }

      return { name, description } as const;
    });

    const invalidFeature = normalizedFeatures.find((item) => 'error' in item);
    if (invalidFeature && 'error' in invalidFeature) {
      return res.status(400).json({
        success: false,
        error: invalidFeature.error,
      });
    }

    const validatedFeatures = normalizedFeatures as Array<{ name: string; description: string }>;

    const resolvedValidationModel: FrNfrValidationMode = validator_model === undefined ? 'rule-based' : validator_model;
    if (
      resolvedValidationModel !== 'rule-based'
      && resolvedValidationModel !== 'gemini'
      && resolvedValidationModel !== 'no-validation'
    ) {
      return res.status(400).json({
        success: false,
        error: 'Request body "validator_model" must be "rule-based", "gemini", or "no-validation".',
      });
    }

    const detailedPrompt = frNfrDetailedPrompt({
      project_name: project_name.trim(),
      project_description: project_description.trim(),
      features: validatedFeatures,
      constraints: Array.isArray(constraints) ? constraints.filter((item): item is string => typeof item === 'string') : [],
      assumptions: Array.isArray(assumptions) ? assumptions.filter((item): item is string => typeof item === 'string') : [],
    });

    // const detailedPrompt = frNfrLitePrompt({
    //   project_name: project_name.trim(),
    //   project_description: project_description.trim(),
    //   features: validatedFeatures,
    //   constraints: Array.isArray(constraints) ? constraints.filter((item): item is string => typeof item === 'string') : [],
    //   assumptions: Array.isArray(assumptions) ? assumptions.filter((item): item is string => typeof item === 'string') : [],
    // });


    const rawText = await generateWithGemini(detailedPrompt);

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
        error: 'Model returned invalid detailed FR/NFR JSON object',
      });
    }

    // const normalizedDetailedOutput = normalizeDetailedGeneratedOutput(
    //   parsed as DetailedGenerationOutput,
    //   project_name.trim(),
    //   detailedInputFeatures,
    //   Array.isArray(constraints) ? constraints.filter((item): item is string => typeof item === 'string') : [],
    //   Array.isArray(assumptions) ? assumptions.filter((item): item is string => typeof item === 'string') : [],
    // );

    const shouldValidate = resolvedValidationModel !== 'no-validation';
    const validation = shouldValidate
      ? await validateGeneratedRequirements(parsed as any, {
          validationModel: resolvedValidationModel as ValidationModel,
        })
      : null;
    const autoFixSuggestions = validation ? getAutoFixSuggestionsFromValidation(validation) : null;
    const MLPrediction = await handlePrediction(parsed as Record<string, unknown>);

    let fileStorageResult: { id: string; filePath: string } | null = null;
    let dynamoRecord: any = null;

    // @ts-ignore
    if (STORAGE_MODE === 'json') {
      try {
        fileStorageResult = await storeGeneratedSrs({
          projectName: project_name.trim(),
          kind: 'srs-generation',
          payload: {
            // content: normalizedDetailedOutput as Record<string, unknown>,
            content: parsed as Record<string, unknown>,
            validation,
          },
        });
      } catch (err) {
        console.error('Failed to write JSON file for generated SRS:', err);
        return res.status(500).json({
          success: false,
          error: err instanceof Error ? err.message : 'Failed to persist to JSON storage',
        });
      }
    } else {
      // require a user identifier to store into DynamoDB
      if (typeof userId !== 'string' || !userId.trim().length) {
        return res.status(400).json({
          success: false,
          error: 'STORAGE_MODE is set to "dynamo" - request body must include a non-empty "userId" string to persist to DynamoDB.',
        });
      }

      const finalProjectId = typeof projectId === 'string' && projectId.trim().length > 0
        ? projectId.trim()
        : randomUUID();

      try {
        const userId_trimmed = userId.trim();
        const projectId_final = finalProjectId;
        const projectName_final = project_name.trim();
        const projectDescription_final = project_description.trim();

        const generatedSrsPayload = {
          content: parsed as Record<string, unknown>,
          prediction: MLPrediction,
          validation: validation || null,
          autoFixSuggestions: autoFixSuggestions || null,
        };

        dynamoRecord = await createProjectRecord({
          userId: userId_trimmed,
          projectId: projectId_final,
          projectName: projectName_final,
          projectDescription: projectDescription_final,
          generatedSrs: generatedSrsPayload,
        });
      } catch (err) {
        console.error('Failed to persist generated SRS to DynamoDB:', err);
        return res.status(500).json({
          success: false,
          error: err instanceof Error ? err.message : 'Failed to persist to DynamoDB',
        });
      }
    }

    return res.json({
      success: true,
      ...dynamoRecord
      // success: true,
      // userId: STORAGE_MODE === 'dynamo' && typeof userId === 'string' ? userId.trim() : undefined,
      // projectId: dynamoRecord?.projectId || undefined,
      //  fileStorage: fileStorageResult,
      // dynamoRecord,
      // content: parsed,
      // validation,
      // autoFixSuggestions,
      // prediction: MLPrediction
    });
  } catch (error) {
    console.error('Detailed FR/NFR generation error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate detailed FR/NFR content',
    });
  }
});

router.post('/reprompt-fr-nfr-detailed', async (req: Request, res: Response) => {
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

    // No validationModel / validator_model accepted in this reprompt endpoint.
    // The server will always run the default validation after revision.

    // The reprompt flow expects a normalized FR/NFR document (same as /reprompt-fr-nfr).
    // If the caller passes a detailed/raw generator output, ask them to normalize first.
    const isNormalized = !!(content as any).functionalRequirements || !!(content as any).nonFunctionalRequirements;
    if (!isNormalized) {
      return res.status(400).json({
        success: false,
        error: 'For detailed reprompt please pass a normalized requirements document (functionalRequirements / nonFunctionalRequirements).',
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

    const validation = await validateGeneratedRequirements(revised as any);
    const autoFixSuggestions = getAutoFixSuggestionsFromValidation(validation);

    return res.json({
      success: true,
      content: revised,
      validation,
      autoFixSuggestions,
    });
  } catch (error) {
    console.error('Detailed FR/NFR reprompt error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to revise detailed FR/NFR content',
    });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid "id" parameter.',
      });
    }

    const record = await retrieveStoredSrs(id.trim());

    if (!record) {
      return res.status(404).json({
        success: false,
        error: `SRS record with id "${id}" not found.`,
      });
    }

    return res.json({
      success: true,
      record,
    });
  } catch (error) {
    console.error('SRS retrieval error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to retrieve SRS',
    });
  }
});

export default router;
