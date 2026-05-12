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
import { createProjectRecord, getProjectByUserAndProjectId, updateGeneratedSrsForProject } from '../services/dynamoSrsStorage';
import type { DynamoGeneratedSrsPayload } from '../services/dynamoSrsStorage';
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

const mock_return: boolean = true;

const mockDetailedFrNfrResponse = {
  "success": true,
  "data": {
    "projectDescription": "A web-based system for booking, rescheduling, and cancelling doctor appointments.",
    "userId": "user-001",
    "updatedAt": "2026-05-12T08:19:27.591Z",
    "createdAt": "2026-05-12T08:19:27.591Z",
    "projectName": "Hospital Booking System",
    "generatedSrs": {
      "content": {
        "functionalRequirements": [
          {
            "preconditions": [
              "User is logged in as patient"
            ],
            "rationale": "Required for patients to initiate the booking process.",
            "source": [
              "Feature Input"
            ],
            "postconditions": [
              "Search criteria results displayed"
            ],
            "dependsOn": [],
            "conflictsWith": [],
            "fitCriterion": "The system returns search results within 2 seconds for a query.",
            "statement": "The system shall allow patients to query available doctor slots based on date and doctor ID.",
            "verificationMethod": "Test",
            "id": "FR-001",
            "title": "Search Available Slots",
            "traceToConstraints": [],
            "traceToFeatures": [
              "FEAT-001"
            ],
            "category": "Data Management",
            "priority": "High",
            "traceToAssumptions": [
              "ASM-002"
            ],
            "notes": ""
          },
          {
            "rationale": "Primary function of the booking system.",
            "traceToConstraints": [],
            "source": [
              "Feature Input"
            ],
            "verificationMethod": "Inspection",
            "id": "FR-002",
            "title": "Create Appointment",
            "traceToAssumptions": [],
            "category": "Workflow",
            "traceToFeatures": [
              "FEAT-001"
            ],
            "postconditions": [
              "Appointment status set to booked"
            ],
            "notes": "",
            "statement": "The system shall create an appointment record linked to a specific patient and doctor.",
            "dependsOn": [
              "FR-001"
            ],
            "conflictsWith": [],
            "priority": "High",
            "preconditions": [
              "Slot is available"
            ],
            "fitCriterion": "Database contains the new appointment record with status 'Booked'."
          },
          {
            "preconditions": [
              "Appointment exists"
            ],
            "priority": "High",
            "statement": "The system shall allow patients to update the date or cancel an existing appointment.",
            "verificationMethod": "Test",
            "traceToConstraints": [],
            "source": [
              "Feature Input"
            ],
            "title": "Modify Appointment",
            "dependsOn": [],
            "conflictsWith": [],
            "postconditions": [
              "Appointment record updated"
            ],
            "traceToFeatures": [
              "FEAT-002"
            ],
            "id": "FR-003",
            "notes": "",
            "rationale": "Required for appointment management.",
            "fitCriterion": "Appointment record reflects the new date or is marked as 'Cancelled'.",
            "category": "Workflow",
            "traceToAssumptions": []
          },
          {
            "traceToFeatures": [
              "FEAT-003"
            ],
            "category": "Reporting",
            "preconditions": [
              "User is logged in as doctor"
            ],
            "source": [
              "Feature Input"
            ],
            "rationale": "Required for doctors to manage their workload.",
            "id": "FR-004",
            "postconditions": [
              "Schedule displayed"
            ],
            "conflictsWith": [],
            "statement": "The system shall display the daily appointment list for the authenticated doctor.",
            "notes": "",
            "priority": "Medium",
            "fitCriterion": "The list includes all active appointments for the current day for the doctor.",
            "traceToConstraints": [],
            "verificationMethod": "Demonstration",
            "title": "View Doctor Schedule",
            "dependsOn": [
              "ASM-002"
            ],
            "traceToAssumptions": [
              "ASM-002"
            ]
          }
        ],
        "features": [
          {
            "description": "Patients can book appointments with available doctors.",
            "priority": "High",
            "id": "FEAT-001",
            "name": "Appointment Booking",
            "source": "Input"
          },
          {
            "source": "Input",
            "priority": "High",
            "description": "Patients can reschedule or cancel appointments.",
            "id": "FEAT-002",
            "name": "Appointment Management"
          },
          {
            "source": "Input",
            "description": "Doctors can view their daily appointment schedule.",
            "name": "Doctor Schedule View",
            "priority": "Medium",
            "id": "FEAT-003"
          }
        ],
        "assumptions": [
          {
            "id": "ASM-001",
            "source": "Input",
            "statement": "Users have stable internet connection",
            "rationale": "Required for web-based access to the system."
          },
          {
            "id": "ASM-002",
            "statement": "Authentication service is available to distinguish between patient and doctor roles.",
            "rationale": "Necessary to enforce role-based access for booking vs. viewing schedules.",
            "source": "Inferred"
          }
        ],
        "projectName": "Hospital Booking System",
        "constraints": [
          {
            "rationale": "System performance requirement for concurrent access.",
            "statement": "Must support 500 concurrent users",
            "source": "Input",
            "id": "CON-001"
          }
        ],
        "nonFunctionalRequirements": {
          "scalabilityRequirements": [],
          "usabilityRequirements": [],
          "auditabilityRequirements": [],
          "maintainabilityRequirements": [],
          "accessibilityRequirements": [],
          "backupRecoveryRequirements": [],
          "complianceRequirements": [],
          "reliabilityRequirements": [],
          "securityRequirements": [],
          "portabilityRequirements": [],
          "availabilityRequirements": [],
          "performanceRequirements": [
            {
              "id": "NFR-PERF-001",
              "traceToAssumptions": [],
              "notes": "",
              "rationale": "System must handle the specified concurrent load.",
              "title": "Concurrent User Support",
              "traceToConstraints": [
                "CON-001"
              ],
              "fitCriterion": "Performance test results showing 95th percentile response time < 3s.",
              "priority": "High",
              "traceToFeatures": [
                "FEAT-001",
                "FEAT-002",
                "FEAT-003"
              ],
              "statement": "The system shall maintain response times under 3 seconds for 500 concurrent users.",
              "verificationMethod": "Performance Test",
              "source": [
                "Constraint"
              ]
            }
          ]
        }
      },
      "validation": {
        "issues": [
          {
            "severity": "warning",
            "message": "Fit criterion appears weak or non-measurable.",
            "suggestion": "Rewrite fit criterion with measurable limits, scope, and test conditions.",
            "field": "fitCriterion",
            "details": {
              "expected": "Objective and testable condition (e.g., p95 <= 3s for 95% requests).",
              "matchedTerms": [],
              "actual": "Database contains the new appointment record with status 'Booked'."
            },
            "requirementId": "FR-002",
            "requirementType": "FR",
            "category": "verifiability"
          },
          {
            "suggestion": "Rewrite fit criterion with measurable limits, scope, and test conditions.",
            "severity": "warning",
            "requirementType": "FR",
            "requirementId": "FR-003",
            "message": "Fit criterion appears weak or non-measurable.",
            "category": "verifiability",
            "field": "fitCriterion",
            "details": {
              "matchedTerms": [],
              "actual": "Appointment record reflects the new date or is marked as 'Cancelled'.",
              "expected": "Objective and testable condition (e.g., p95 <= 3s for 95% requests)."
            }
          },
          {
            "severity": "warning",
            "message": "Fit criterion appears weak or non-measurable.",
            "requirementId": "FR-004",
            "field": "fitCriterion",
            "requirementType": "FR",
            "category": "verifiability",
            "details": {
              "actual": "The list includes all active appointments for the current day for the doctor.",
              "matchedTerms": [],
              "expected": "Objective and testable condition (e.g., p95 <= 3s for 95% requests)."
            },
            "suggestion": "Rewrite fit criterion with measurable limits, scope, and test conditions."
          }
        ],
        "byType": {
          "FR": {
            "issues": [
              {
                "severity": "warning",
                "category": "verifiability",
                "message": "Fit criterion appears weak or non-measurable.",
                "field": "fitCriterion",
                "details": {
                  "actual": "Database contains the new appointment record with status 'Booked'.",
                  "matchedTerms": [],
                  "expected": "Objective and testable condition (e.g., p95 <= 3s for 95% requests)."
                },
                "requirementId": "FR-002",
                "suggestion": "Rewrite fit criterion with measurable limits, scope, and test conditions.",
                "requirementType": "FR"
              },
              {
                "requirementId": "FR-003",
                "field": "fitCriterion",
                "severity": "warning",
                "message": "Fit criterion appears weak or non-measurable.",
                "suggestion": "Rewrite fit criterion with measurable limits, scope, and test conditions.",
                "details": {
                  "matchedTerms": [],
                  "actual": "Appointment record reflects the new date or is marked as 'Cancelled'.",
                  "expected": "Objective and testable condition (e.g., p95 <= 3s for 95% requests)."
                },
                "requirementType": "FR",
                "category": "verifiability"
              },
              {
                "requirementId": "FR-004",
                "suggestion": "Rewrite fit criterion with measurable limits, scope, and test conditions.",
                "field": "fitCriterion",
                "message": "Fit criterion appears weak or non-measurable.",
                "details": {
                  "matchedTerms": [],
                  "actual": "The list includes all active appointments for the current day for the doctor.",
                  "expected": "Objective and testable condition (e.g., p95 <= 3s for 95% requests)."
                },
                "requirementType": "FR",
                "category": "verifiability",
                "severity": "warning"
              }
            ],
            "summary": {
              "warnings": 3,
              "totalRequirements": 4,
              "errors": 0,
              "totalIssues": 3
            },
            "qualityScore": 85
          },
          "NFR": {
            "issues": [],
            "qualityScore": 100,
            "summary": {
              "totalIssues": 0,
              "errors": 0,
              "warnings": 0,
              "totalRequirements": 1
            }
          }
        },
        "isValid": true,
        "summary": {
          "warnings": 3,
          "errors": 0,
          "totalIssues": 3,
          "totalRequirements": 5
        },
        "qualityScore": 85
      },
      "autoFixSuggestions": [
        {
          "category": "verifiability",
          "requirementId": "FR-002",
          "requirementType": "FR",
          "message": "Fit criterion appears weak or non-measurable.",
          "suggestion": "Add a fit criterion with metric, threshold, and test condition (example: 95% <= 3 seconds under normal load)."
        },
        {
          "requirementType": "FR",
          "message": "Fit criterion appears weak or non-measurable.",
          "category": "verifiability",
          "requirementId": "FR-003",
          "suggestion": "Add a fit criterion with metric, threshold, and test condition (example: 95% <= 3 seconds under normal load)."
        },
        {
          "message": "Fit criterion appears weak or non-measurable.",
          "requirementType": "FR",
          "suggestion": "Add a fit criterion with metric, threshold, and test condition (example: 95% <= 3 seconds under normal load).",
          "requirementId": "FR-004",
          "category": "verifiability"
        }
      ],
      "prediction": [
        {
          "statement": "The system shall allow patients to query available doctor slots based on date and doctor ID.",
          "smell_boolean": 0,
          "confidence": 0.68,
          "id": "fr-001"
        },
        {
          "confidence": 0.61,
          "statement": "The system shall create an appointment record linked to a specific patient and doctor.",
          "smell_boolean": 0,
          "id": "fr-002"
        },
        {
          "statement": "The system shall allow patients to update the date or cancel an existing appointment.",
          "smell_boolean": 0,
          "id": "fr-003",
          "confidence": 0.54
        },
        {
          "smell_boolean": 0,
          "statement": "The system shall display the daily appointment list for the authenticated doctor.",
          "id": "fr-004",
          "confidence": 0.73
        },
        {
          "statement": "The system shall maintain response times under 3 seconds for 500 concurrent users.",
          "smell_boolean": 0,
          "confidence": 0.81,
          "id": "nfr-perf-001"
        }
      ]
    },
    "projectId": "9a010e7c-a482-4971-b3a6-a05a8242a30c"
  }
}

router.post('/fr-nfr-detailed', async (req: Request, res: Response) => {
  try {
    if (mock_return) {
      return res.json(mockDetailedFrNfrResponse);
    }

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

    let dynamoRecord: any = null;

    // @ts-ignore
    if (STORAGE_MODE === 'json') {
      try {
        await storeGeneratedSrs({
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
      ...dynamoRecord,
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

router.post('/reprompt-fr-nfr-v2/:userId/:projectId', async (req: Request, res: Response) => {
  try {
    const { userId, projectId } = req.params;

    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Missing or invalid "userId" parameter.',
      });
    }

    if (!projectId || typeof projectId !== 'string' || projectId.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Missing or invalid "projectId" parameter.',
      });
    }

    const project = await getProjectByUserAndProjectId(userId, projectId);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
      });
    }

    console.log('=== REPROMT FR/NFR V2 PROJECT ===');
    console.log(project);

    const projectContent = project.generatedSrs && typeof project.generatedSrs === 'object' && !Array.isArray(project.generatedSrs)
      ? (project.generatedSrs as { content?: unknown }).content
      : null;

    if (!projectContent || typeof projectContent !== 'object' || Array.isArray(projectContent)) {
      return res.status(400).json({
        success: false,
        message: 'Project does not contain a valid generatedSrs.content object.',
      });
    }

    const instruction = typeof req.body?.instruction === 'string' && req.body.instruction.trim().length > 0
      ? req.body.instruction.trim()
      : 'Reprompt and improve the existing FR/NFR document. Return valid JSON only.';

    const revisionPrompt = generateFrNfrRevisionPrompt(projectContent as Record<string, unknown>, instruction);
    console.log('=== REPROMT FR/NFR V2 PROMPT ===');
    console.log(revisionPrompt);

    const rawText = await generateWithGemini(revisionPrompt);
    console.log('=== REPROMT FR/NFR V2 RAW GEMINI RESPONSE ===');
    console.log(rawText);

    let revised: unknown;
    try {
      revised = JSON.parse(rawText);
    } catch {
      const repaired = await repairJson(rawText);
      revised = JSON.parse(repaired);
    }

    console.log('=== REPROMT FR/NFR V2 PARSED RESPONSE ===');
    console.log(revised);

    const validatedRevised = await validateGeneratedRequirements(revised as any, {
      validationModel: 'rule-based',
    });
    const autoFixSuggestions = getAutoFixSuggestionsFromValidation(validatedRevised);
    const prediction = await handlePrediction(revised as Record<string, unknown>);

    console.log('=== REPROMT FR/NFR V2 RULE-BASED VALIDATION ===');
    console.log(validatedRevised);
    console.log('=== REPROMT FR/NFR V2 PREDICTION ===');
    console.log(prediction);

    const generatedSrsPayload: DynamoGeneratedSrsPayload = {
      content: revised as Record<string, unknown>,
      validation: validatedRevised,
      autoFixSuggestions,
      prediction: prediction || null,
    };

    const updatedProject = await updateGeneratedSrsForProject({
      userId: userId.trim(),
      projectId: projectId.trim(),
      generatedSrs: generatedSrsPayload,
    });

    if (!updatedProject) {
      return res.status(500).json({
        success: false,
        message: 'Failed to update project generated SRS in DynamoDB.',
      });
    }

    console.log('=== REPROMT FR/NFR V2 UPDATED PROJECT ===');
    console.log(updatedProject);
    console.log('=== END REPROMT FR/NFR V2 PROJECT ===');

    return res.json({
      success: true,
      data: updatedProject,
      reprompted: revised,
      validation: validatedRevised,
      autoFixSuggestions,
      prediction,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to reprompt project',
      error: error instanceof Error ? error.message : error,
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
