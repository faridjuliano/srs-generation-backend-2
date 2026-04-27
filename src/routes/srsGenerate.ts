import { Router, Request, Response } from 'express';
import {
  generatePrompt,
  generateArchitectureDiagramPrompt,
  generateRevisionPrompt,
  generateFrNfrPrompt,
  generateFrNfrRevisionPrompt,
  frNfrDetailedPrompt,
  frNfrLitePrompt
} from '../prompts/promptBuilder';
import { generateWithGemini } from '../services/geminiService';
import { repairJson } from '../services/jsonRepairService';
import { validateSRS } from '../validators/srsValidator';
import { getAutoFixSuggestionsFromValidation, validateGeneratedRequirements } from '../validators/frNfr';
import type { FrNfrValidationMode, ValidationModel } from '../types/frNfrValidation';

const router = Router();

const ENABLE_VALIDATION = true;
const ACTIVE_PROMPT_SET: 'default' | 'iso-strict' | 'ieee-strict' = 'iso-strict';

type DetailedRequirementItem = {
  id?: string;
  title?: string;
  description?: string;
  actor?: string;
  action?: string;
  object?: string;
  condition?: string;
  constraint?: string;
  priority?: string;
  source?: string;
  trace_link?: string;
  fit_criterion?: string;
  category?: string;
};

type DetailedGenerationOutput = {
  requirements?: {
    functional_requirements?: DetailedRequirementItem[];
    non_functional_requirements?: DetailedRequirementItem[];
  };
};

function buildSequentialIds(prefix: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => `${prefix}-${String(index + 1).padStart(3, '0')}`);
}

function splitSources(source?: string): string[] {
  if (!source || source.trim().length === 0) return [];
  return source.split(/[,;|]/).map((item) => item.trim()).filter(Boolean);
}

function normalizeDetailedGeneratedOutput(
  parsed: DetailedGenerationOutput,
  projectName: string,
  inputFeatures: Array<{ id: string; name: string; description: string }>,
  constraints: string[],
  assumptions: string[],
): any {
  const functionalRequirements = parsed.requirements?.functional_requirements || [];
  const nonFunctionalRequirements = parsed.requirements?.non_functional_requirements || [];

  const featureIndexByName = new Map<string, { id: string; name: string; description: string }>();
  inputFeatures.forEach((feature) => {
    featureIndexByName.set(feature.name.trim().toLowerCase(), feature);
    featureIndexByName.set(feature.description.trim().toLowerCase(), feature);
  });

  const derivedUseCaseIds = buildSequentialIds('UC', inputFeatures.length);
  const derivedUseCases = inputFeatures.map((feature, index) => ({
    id: derivedUseCaseIds[index],
    name: feature.name,
    goal: feature.description,
    primaryActors: [],
    preconditions: [],
    trigger: '',
    mainFlow: [],
    postconditions: [],
    relatedFeatures: [feature.id],
  }));

  const normalizedFunctionalRequirements = functionalRequirements.map((req, index) => {
    const matchedFeature = req.trace_link
      ? featureIndexByName.get(req.trace_link.trim().toLowerCase())
      : undefined;
    const matchedUseCase = matchedFeature
      ? derivedUseCases.find((item) => item.relatedFeatures.includes(matchedFeature.id))
      : undefined;

    const actor = req.actor?.trim() || 'System User';
    const action = req.action?.trim() || 'perform';
    const object = req.object?.trim() || req.description?.trim() || 'the requested behavior';

    return {
      id: req.id?.trim() || `FR-${String(index + 1).padStart(3, '0')}`,
      title: req.title?.trim() || `${actor} ${action}`,
      statement: req.description?.trim() || `${actor} shall ${action} ${object}.`,
      rationale: `Derived from ${matchedFeature?.name || req.source || 'project context'}.`,
      source: splitSources(req.source).length > 0 ? splitSources(req.source) : [projectName],
      priority: (req.priority?.trim() || 'Medium') as 'High' | 'Medium' | 'Low',
      fitCriterion: req.fit_criterion?.trim() || `The requirement is satisfied when ${req.description?.trim() || object} is implemented and verifiable.`,
      verificationMethod: 'Test',
      preconditions: req.condition?.trim() ? [req.condition.trim()] : [],
      postconditions: req.constraint?.trim() ? [req.constraint.trim()] : [],
      dependsOn: [],
      conflictsWith: [],
      traceToFeatures: matchedFeature ? [matchedFeature.id] : [],
      traceToUseCases: matchedUseCase ? [matchedUseCase.id] : [],
      notes: '',
    };
  });

  const nfrCategoryMap: Record<string, keyof import('../types/frNfrValidation').NonFunctionalRequirementsMap> = {
    performance: 'performanceRequirements',
    security: 'securityRequirements',
    usability: 'usabilityRequirements',
    reliability: 'reliabilityRequirements',
    availability: 'availabilityRequirements',
    maintainability: 'maintainabilityRequirements',
    scalability: 'scalabilityRequirements',
    compatibility: 'portabilityRequirements',
  };

  const normalizedNonFunctionalRequirements: import('../types/frNfrValidation').NonFunctionalRequirementsMap = {
    performanceRequirements: [],
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
  };

  nonFunctionalRequirements.forEach((req, index) => {
    const categoryKey = nfrCategoryMap[(req.category || '').trim().toLowerCase()] || 'performanceRequirements';
    const matchedFeature = req.trace_link
      ? featureIndexByName.get(req.trace_link.trim().toLowerCase())
      : undefined;

    normalizedNonFunctionalRequirements[categoryKey].push({
      id: req.id?.trim() || `NFR-${String(index + 1).padStart(3, '0')}`,
      title: req.title?.trim() || `${req.category || 'Quality'} requirement`,
      statement: req.description?.trim() || `The system shall ${req.description?.trim() || 'meet the stated quality attribute'}.`,
      rationale: `Derived from ${matchedFeature?.name || req.source || 'project context'}.`,
      source: splitSources(req.source).length > 0 ? splitSources(req.source) : [projectName],
      priority: 'Medium',
      fitCriterion: req.fit_criterion?.trim() || `The requirement is satisfied when ${req.description?.trim() || 'the quality attribute'} is verifiable against the project context.`,
      verificationMethod: 'Test',
      traceToFeatures: matchedFeature ? [matchedFeature.id] : [],
      traceToUseCases: matchedFeature ? [derivedUseCases.find((item) => item.relatedFeatures.includes(matchedFeature.id))?.id || ''].filter(Boolean) as string[] : [],
      notes: '',
    });
  });

  return {
    projectName,
    assumptions,
    constraints,
    features: inputFeatures,
    useCases: derivedUseCases,
    functionalRequirements: normalizedFunctionalRequirements,
    nonFunctionalRequirements: normalizedNonFunctionalRequirements,
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

router.post('/nf-nfr-detailed', async (req: Request, res: Response) => {
  try {
    const {
      project_name,
      project_description,
      features,
      constraints = [],
      assumptions = [],
      validator_model,
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

    const detailedFeatureIds = buildSequentialIds('FEAT', validatedFeatures.length);
    const detailedInputFeatures = validatedFeatures.map((feature, index) => ({
      id: detailedFeatureIds[index],
      name: feature.name,
      description: feature.description,
    }));

    // const detailedPrompt = frNfrDetailedPrompt({
    //   project_name: project_name.trim(),
    //   project_description: project_description.trim(),
    //   features: validatedFeatures,
    //   constraints: Array.isArray(constraints) ? constraints.filter((item): item is string => typeof item === 'string') : [],
    //   assumptions: Array.isArray(assumptions) ? assumptions.filter((item): item is string => typeof item === 'string') : [],
    // });
    const detailedPrompt = frNfrLitePrompt({
      project_name: project_name.trim(),
      project_description: project_description.trim(),
      features: validatedFeatures,
      constraints: Array.isArray(constraints) ? constraints.filter((item): item is string => typeof item === 'string') : [],
      assumptions: Array.isArray(assumptions) ? assumptions.filter((item): item is string => typeof item === 'string') : [],
    });


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

    const normalizedDetailedOutput = normalizeDetailedGeneratedOutput(
      parsed as DetailedGenerationOutput,
      project_name.trim(),
      detailedInputFeatures,
      Array.isArray(constraints) ? constraints.filter((item): item is string => typeof item === 'string') : [],
      Array.isArray(assumptions) ? assumptions.filter((item): item is string => typeof item === 'string') : [],
    );

    // TODO: Re-enable detailed FR/NFR validation after prompt/normalization stabilization.
    // const shouldValidate = resolvedValidationModel !== 'no-validation';
    // const validation = shouldValidate
    //   ? await validateGeneratedRequirements(normalizedDetailedOutput as any, {
    //       validationModel: resolvedValidationModel as ValidationModel,
    //     })
    //   : null;
    // const autoFixSuggestions = validation ? getAutoFixSuggestionsFromValidation(validation) : null;
    const validation = null;
    const autoFixSuggestions = null;

    return res.json({
      success: true,
      content: parsed,
      validation,
      autoFixSuggestions,
    });
  } catch (error) {
    console.error('Detailed FR/NFR generation error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate detailed FR/NFR content',
    });
  }
});

export default router;
