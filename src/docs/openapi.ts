const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'SRS Generation Backend API',
    version: '1.0.0',
    description: 'API documentation for health checks and Gemini-powered SRS generation.',
  },
  servers: [
    {
      url: 'http://localhost:3001',
      description: 'Local development server',
    },
  ],
  tags: [
    { name: 'Health', description: 'Service availability endpoints' },
    { name: 'SRS', description: 'SRS generation endpoints' },
    { name: 'Validation', description: 'SRS validation endpoints' },
    { name: 'Projects', description: 'Project persistence and generated SRS storage endpoints' },
  ],
  paths: {
    '/api/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        responses: {
          '200': {
            description: 'Service is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    service: { type: 'string', example: 'backend' },
                    timestamp: { type: 'string', format: 'date-time' },
                  },
                  required: ['status', 'service', 'timestamp'],
                },
              },
            },
          },
        },
      },
    },
    '/api/srs/generate': {
      post: {
        tags: ['SRS'],
        summary: 'Generate SRS JSON content',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  projectName: { type: 'string', example: 'Inventory Management System' },
                  authorName: { type: 'string', example: 'AI Generator' },
                  projectVision: { type: 'string', example: 'A web app to track warehouse stock in real time.' },
                  srsStandard: { type: 'string', example: 'ISO/IEC/IEEE 29148:2018' },
                  uploadedFiles: {
                    type: 'array',
                    items: { type: 'string' },
                    example: ['System context note', 'Stakeholder interview summary'],
                  },
                },
                required: ['projectName', 'projectVision', 'srsStandard'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'SRS content generated successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    content: { type: 'object', additionalProperties: true },
                    diagrams: {
                      type: 'object',
                      properties: {
                        sequenceDiagram: { type: 'string', example: 'sequenceDiagram\nactor User\nUser->>System: Request action' },
                        classOrErdDiagram: { type: 'string', example: 'classDiagram\nclass User {\n  +id: string\n}' },
                      },
                      required: ['sequenceDiagram', 'classOrErdDiagram'],
                    },
                    validation: { type: 'object', nullable: true, additionalProperties: true },
                  },
                  required: ['success', 'content', 'diagrams'],
                },
              },
            },
          },
          '400': {
            description: 'Missing required fields',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    error: { type: 'string', example: 'Missing required fields' },
                  },
                  required: ['success', 'error'],
                },
              },
            },
          },
          '500': {
            description: 'Generation failed',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    error: { type: 'string', example: 'Failed to generate SRS' },
                  },
                  required: ['success', 'error'],
                },
              },
            },
          },
        },
      },
    },
    '/api/srs/reprompt': {
      post: {
        tags: ['SRS'],
        summary: 'Revise existing SRS using follow-up prompt',
        description: 'Sends existing SRS content and user instruction to Gemini, then returns revised SRS plus validation.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  content: {
                    type: 'object',
                    description: 'Existing SRS JSON object to revise',
                    additionalProperties: true,
                  },
                  instruction: {
                    type: 'string',
                    example: 'Update non-functional requirements to include MFA and tighten availability target to 99.95%.',
                  },
                },
                required: ['content', 'instruction'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'SRS revised successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    content: { type: 'object', additionalProperties: true },
                    validation: { type: 'object', nullable: true, additionalProperties: true },
                  },
                  required: ['success', 'content'],
                },
              },
            },
          },
          '400': {
            description: 'Invalid request payload',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    error: { type: 'string' },
                  },
                  required: ['success', 'error'],
                },
              },
            },
          },
          '500': {
            description: 'Revision failed',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    error: { type: 'string', example: 'Failed to revise SRS' },
                  },
                  required: ['success', 'error'],
                },
              },
            },
          },
        },
      },
    },
    '/api/srs/generate-fr-nfr': {
      post: {
        tags: ['SRS'],
        summary: 'Generate FR/NFR-only JSON',
        description: 'Generates FR/NFR-focused JSON, validates it automatically, and returns issue-driven auto-fix suggestions.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  projectName: { type: 'string', example: 'Inventory Management System' },
                  projectVision: { type: 'string', example: 'A web application for tracking stock levels and low inventory alerts.' },
                  validationModel: {
                    type: 'string',
                    enum: ['rule-based', 'gemini', 'no-validation'],
                    example: 'rule-based',
                    description: 'Optional validator selection for FR/NFR post-generation validation. Use "no-validation" to skip validation.',
                  },
                },
                required: ['projectName', 'projectVision'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'FR/NFR content generated successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    content: { type: 'object', additionalProperties: true },
                    validation: { $ref: '#/components/schemas/FrNfrValidationResult', nullable: true },
                    autoFixSuggestions: {
                      type: 'array',
                      nullable: true,
                      items: { $ref: '#/components/schemas/AutoFixSuggestion' },
                    },
                  },
                  required: ['success', 'id', 'filePath', 'content', 'validation', 'autoFixSuggestions'],
                },
              },
            },
          },
          '400': {
            description: 'Missing required fields',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    error: { type: 'string', example: 'Request body must include a non-empty "projectName" string.' },
                  },
                  required: ['success', 'error'],
                },
              },
            },
          },
          '500': {
            description: 'Generation failed',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    error: { type: 'string', example: 'Failed to generate FR/NFR content' },
                  },
                  required: ['success', 'error'],
                },
              },
            },
          },
        },
      },
    },
    '/api/srs/reprompt-fr-nfr': {
      post: {
        tags: ['SRS'],
        summary: 'Revise FR/NFR-only JSON using follow-up prompt',
        description: 'Sends existing FR/NFR-only JSON content and user instruction to Gemini, then returns revised FR/NFR JSON with validation and auto-fix suggestions.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  content: {
                    type: 'object',
                    description: 'Existing FR/NFR JSON object to revise',
                    additionalProperties: true,
                  },
                  instruction: {
                    type: 'string',
                    example: 'Add security requirements for MFA and improve performance targets.',
                  },
                  validationModel: {
                    type: 'string',
                    enum: ['rule-based', 'gemini', 'no-validation'],
                    example: 'rule-based',
                    description: 'Optional validator selection for FR/NFR post-revision validation. Use "no-validation" to skip validation.',
                  },
                },
                required: ['content', 'instruction'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'FR/NFR revised successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    content: { type: 'object', additionalProperties: true },
                    validation: { $ref: '#/components/schemas/FrNfrValidationResult', nullable: true },
                    autoFixSuggestions: {
                      type: 'array',
                      nullable: true,
                      items: { $ref: '#/components/schemas/AutoFixSuggestion' },
                    },
                  },
                  required: ['success', 'content', 'validation', 'autoFixSuggestions'],
                },
              },
            },
          },
          '400': {
            description: 'Invalid request payload',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    error: { type: 'string' },
                  },
                  required: ['success', 'error'],
                },
              },
            },
          },
          '500': {
            description: 'Revision failed',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    error: { type: 'string', example: 'Failed to revise FR/NFR content' },
                  },
                  required: ['success', 'error'],
                },
              },
            },
          },
        },
      },
    },
    '/api/srs/fr-nfr-detailed': {
      post: {
        tags: ['SRS'],
        summary: 'Generate detailed FR/NFR JSON',
        description: 'Generates detailed FR/NFR content from structured project inputs, validates it using the selected validator model, and stores the generated SRS inside DynamoDB under the current project record. When DynamoDB storage is enabled, `userId` is required.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  userId: { type: 'string', example: 'user-123' },
                  projectId: { type: 'string', example: 'proj-456', description: 'Optional. If omitted, the backend generates one.' },
                  project_name: { type: 'string', example: 'Hospital Booking System' },
                  project_description: {
                    type: 'string',
                    example: 'A web-based system for booking, rescheduling, and cancelling doctor appointments.',
                  },
                  features: {
                    type: 'array',
                    minItems: 1,
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string', example: 'Appointment Booking' },
                        description: { type: 'string', example: 'Patients can book appointments with available doctors.' },
                      },
                      required: ['name', 'description'],
                      minProperties: 2,
                    },
                  },
                  constraints: {
                    type: 'array',
                    items: { type: 'string' },
                    example: ['Must support 500 concurrent users'],
                  },
                  assumptions: {
                    type: 'array',
                    items: { type: 'string' },
                    example: ['Users have stable internet connection'],
                  },
                  validator_model: {
                    type: 'string',
                    enum: ['rule-based', 'gemini', 'no-validation'],
                    example: 'rule-based',
                  },
                },
                required: ['userId', 'project_name', 'project_description', 'features'],
                allOf: [
                  {
                    type: 'object',
                    properties: {
                      project_name: { type: 'string', minLength: 1 },
                      project_description: { type: 'string', minLength: 1 },
                    },
                  },
                ],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Detailed FR/NFR content generated successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                        userId: { type: 'string', example: 'user-123', nullable: true },
                        projectId: { type: 'string', example: 'proj-456', nullable: true },
                        fileStorage: {
                          type: 'object',
                          nullable: true,
                          properties: {
                            id: { type: 'string', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
                            filePath: { type: 'string', example: '/Users/.../src/database/a1b2c3d4-e5f6-7890-abcd-ef1234567890.json' },
                          },
                          required: ['id', 'filePath'],
                        },
                        dynamoRecord: { $ref: '#/components/schemas/DynamoProjectRecord', nullable: true },
                    content: { type: 'object', additionalProperties: true },
                    validation: { $ref: '#/components/schemas/FrNfrValidationResult', nullable: true },
                    autoFixSuggestions: {
                      type: 'array',
                      nullable: true,
                      items: { $ref: '#/components/schemas/AutoFixSuggestion' },
                    },
                  },
                      required: ['success', 'content', 'validation', 'autoFixSuggestions'],
                },
              },
            },
          },
          '400': {
            description: 'Missing required fields',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    error: { type: 'string', example: 'Request body must include a non-empty "project_name" string.' },
                  },
                  required: ['success', 'error'],
                },
              },
            },
          },
          '500': {
            description: 'Generation failed',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    error: { type: 'string', example: 'Failed to generate detailed FR/NFR content' },
                  },
                  required: ['success', 'error'],
                },
              },
            },
          },
        },
      },
    },
    '/api/srs/reprompt-fr-nfr-detailed': {
      post: {
        tags: ['SRS'],
        summary: 'Revise detailed FR/NFR JSON using follow-up prompt',
        description: 'Sends existing normalized FR/NFR JSON content (functionalRequirements / nonFunctionalRequirements) and user instruction to Gemini, then returns revised FR/NFR JSON with validation and auto-fix suggestions. This reprompt endpoint does not accept validator selection or validator configuration in the request payload.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  content: {
                    type: 'object',
                    description: 'Existing normalized FR/NFR JSON object to revise (must include functionalRequirements or nonFunctionalRequirements)',
                    additionalProperties: true,
                  },
                  instruction: {
                    type: 'string',
                    example: 'Clarify ambiguous fit criteria and merge duplicate NFRs.',
                  },
                  // validationModel / validator_model / validator_config removed from reprompt payload
                },
                required: ['content', 'instruction'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Detailed FR/NFR revised successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    content: { type: 'object', additionalProperties: true },
                    validation: { $ref: '#/components/schemas/FrNfrValidationResult', nullable: true },
                    autoFixSuggestions: {
                      type: 'array',
                      nullable: true,
                      items: { $ref: '#/components/schemas/AutoFixSuggestion' },
                    },
                  },
                  required: ['success', 'content'],
                },
              },
            },
          },
          '400': {
            description: 'Invalid request payload',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    error: { type: 'string' },
                  },
                  required: ['success', 'error'],
                },
              },
            },
          },
          '500': {
            description: 'Revision failed',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    error: { type: 'string', example: 'Failed to revise detailed FR/NFR content' },
                  },
                  required: ['success', 'error'],
                },
              },
            },
          },
        },
      },
    },
    '/api/srs/validate': {
      post: {
        tags: ['Validation'],
        summary: 'Validate edited SRS content',
        description: 'Re-validate SRS content after user edits and return validation report',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  content: {
                    type: 'object',
                    description: 'The SRS object to validate',
                    additionalProperties: true,
                  },
                },
                required: ['content'],
              },
              example: {
                content: {
                  documentControl: {
                    documentTitle: 'Software Requirements Specification',
                    projectName: 'Inventory Management System',
                    documentId: 'SRS-001',
                    version: '1.0',
                    status: 'Draft',
                    date: '2023-10-27',
                    preparedBy: 'AI Generator',
                    reviewedBy: 'QA Team',
                    approvedBy: 'Project Lead',
                  },
                  revisionHistory: [
                    {
                      version: '1.0',
                      date: '2023-10-27',
                      author: 'AI Generator',
                      changes: 'Initial draft',
                    },
                  ],
                  tableOfContents: { autoGenerated: true },
                  '1Introduction': {
                    '1.1Purpose': 'System purpose description',
                    '1.2Scope': 'System scope description',
                    '1.3IntendedAudience': ['Developers', 'QA'],
                    '1.4SystemOverview': 'Overview here',
                    '1.5DefinitionsAcronymsAbbreviations': [],
                    '1.6References': [],
                    '1.7DocumentOverview': 'Document overview',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Validation completed',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    validation: {
                      type: 'object',
                      properties: {
                        passed: { type: 'boolean', example: true },
                        errorCount: { type: 'integer', example: 0 },
                        warningCount: { type: 'integer', example: 0 },
                        issues: {
                          type: 'array',
                          items: { type: 'object', additionalProperties: true },
                        },
                        qualityScore: { type: 'integer', example: 100 },
                      },
                      required: ['passed', 'errorCount', 'warningCount', 'issues', 'qualityScore'],
                    },
                  },
                  required: ['success', 'validation'],
                },
                example: {
                  success: true,
                  validation: {
                    passed: true,
                    errorCount: 0,
                    warningCount: 0,
                    issues: [],
                    qualityScore: 100,
                  },
                },
              },
            },
          },
          '400': {
            description: 'Invalid payload',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    error: { type: 'string', example: 'Invalid content: missing or invalid SRS content' },
                  },
                  required: ['success', 'error'],
                },
              },
            },
          },
          '500': {
            description: 'Validation failed',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    error: { type: 'string', example: 'Validation failed' },
                  },
                  required: ['success', 'error'],
                },
              },
            },
          },
        },
      },
    },
    '/api/srs/validate-fr-nfr': {
      post: {
        tags: ['Validation'],
        summary: 'Validate FR/NFR-only content',
        description: 'Validates FR/NFR JSON content and returns structured issues plus auto-fix suggestions.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                allOf: [
                  { $ref: '#/components/schemas/GeneratedRequirementsDocument' },
                  {
                    type: 'object',
                    properties: {
                      validationModel: {
                        type: 'string',
                        enum: ['rule-based', 'gemini'],
                        example: 'rule-based',
                        description: 'Optional validator selection for FR/NFR validation.',
                      },
                    },
                  },
                ],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'FR/NFR validation completed',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    validation: { $ref: '#/components/schemas/FrNfrValidationResult' },
                    autoFixSuggestions: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/AutoFixSuggestion' },
                    },
                  },
                  required: ['success', 'validation', 'autoFixSuggestions'],
                },
              },
            },
          },
          '400': {
            description: 'Invalid payload',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    error: { type: 'string', example: 'Invalid payload: must be a FR/NFR JSON object' },
                  },
                  required: ['success', 'error'],
                },
              },
            },
          },
          '500': {
            description: 'Validation failed',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    error: { type: 'string', example: 'FR/NFR validation failed' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/srs/auto-fix': {
      post: {
        tags: ['SRS'],
        summary: 'Auto-fix SRS content',
        description: 'Applies fixes based on validation issues from payload.validation.issues (or payload.issues), then re-validates.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  content: {
                    type: 'object',
                    description: 'The SRS object to auto-fix',
                    additionalProperties: true,
                  },
                  validation: {
                    type: 'object',
                    properties: {
                      issues: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            severity: { type: 'string', example: 'error' },
                            code: { type: 'string', example: 'BROKEN_TRACE_STAKEHOLDER' },
                            message: { type: 'string', example: 'Requirement references unknown stakeholder ID: STK-001' },
                            requirementId: { type: 'string', example: 'FR-001' },
                            path: { type: 'string', example: 'functionalRequirements[0].traceToStakeholders' },
                            suggestion: { type: 'string', example: 'Reference an existing stakeholder ID from the stakeholders section.' },
                          },
                        },
                      },
                    },
                  },
                },
                required: ['content'],
              },
              example: {
                content: {
                  '2ContextOfTheSystem': {
                    '2.3Stakeholders': [{ id: 'STK-010' }, { id: 'STK-2000' }],
                  },
                  '4FunctionalRequirements': [
                    { id: 'FR-001', traceToStakeholders: ['STK-001'], traceToUseCases: ['UC-001'] },
                  ],
                },
                validation: {
                  issues: [
                    {
                      severity: 'error',
                      code: 'BROKEN_TRACE_STAKEHOLDER',
                      message: 'Requirement references unknown stakeholder ID: STK-001',
                      requirementId: 'FR-001',
                    },
                  ],
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Auto-fix completed successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    content: { type: 'object', additionalProperties: true },
                    fixesApplied: {
                      type: 'array',
                      items: { type: 'string' },
                    },
                    validation: {
                      type: 'object',
                      properties: {
                        passed: { type: 'boolean', example: true },
                        errorCount: { type: 'integer', example: 0 },
                        warningCount: { type: 'integer', example: 0 },
                        issues: { type: 'array', items: {} },
                        qualityScore: { type: 'integer', example: 100 },
                      },
                    },
                  },
                  required: ['success', 'content', 'fixesApplied', 'validation'],
                },
                example: {
                  success: true,
                  content: {
                    '4FunctionalRequirements': [
                      { id: 'FR-001', traceToStakeholders: ['STK-010'], traceToUseCases: ['UC-001'] },
                    ],
                  },
                  fixesApplied: ['Updated FR-001 traceToStakeholders: STK-001 -> STK-010'],
                  validation: {
                    passed: true,
                    errorCount: 0,
                    warningCount: 0,
                    issues: [],
                    qualityScore: 100,
                  },
                },
              },
            },
          },
          '400': {
            description: 'Invalid payload',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    error: { type: 'string' },
                  },
                },
              },
            },
          },
          '500': {
            description: 'Auto-fix failed',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    error: { type: 'string', example: 'Auto-fix failed' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/projects': {
      post: {
        tags: ['Projects'],
        summary: 'Create a project record',
        description: 'Creates a DynamoDB project record that can later store generated SRS content.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  userId: { type: 'string', example: 'user-123' },
                  projectId: { type: 'string', example: 'proj-456', description: 'Optional project identifier.' },
                  projectName: { type: 'string', example: 'Hospital Booking System' },
                  projectDescription: { type: 'string', example: 'A web-based system for booking, rescheduling, and cancelling doctor appointments.' },
                  generatedSrs: {
                    type: 'object',
                    additionalProperties: true,
                    description: 'Optional generated SRS payload to persist alongside the project.',
                  },
                },
                required: ['userId', 'projectName'],
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Project created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/DynamoProjectRecord' },
                  },
                  required: ['success', 'data'],
                },
              },
            },
          },
        },
      },
    },
    '/api/projects/{userId}': {
      get: {
        tags: ['Projects'],
        summary: 'Get a project list by userId',
        parameters: [
          {
            name: 'userId',
            in: 'path',
            required: true,
            schema: { type: 'string', example: 'user-123' },
          },
        ],
        responses: {
          '200': {
            description: 'Projects returned',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/DynamoProjectRecord' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/projects/{userId}/{projectId}': {
      get: {
        tags: ['Projects'],
        summary: 'Get a project by userId and projectId',
        parameters: [
          { name: 'userId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'projectId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Project returned',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/DynamoProjectRecord' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/projects/{userId}/{projectId}/generated-srs': {
      patch: {
        tags: ['Projects'],
        summary: 'Update generated SRS for a project',
        parameters: [
          { name: 'userId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'projectId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  generatedSrs: {
                    type: 'object',
                    additionalProperties: true,
                  },
                  content: { type: 'object', additionalProperties: true },
                  validation: { type: 'object', additionalProperties: true },
                  autoFixSuggestions: { type: 'array', items: { type: 'object' } },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Generated SRS updated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/DynamoProjectRecord' },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      ValidationIssueDetails: {
        type: 'object',
        properties: {
          matchedTerms: { type: 'array', items: { type: 'string' } },
          relatedRequirementIds: { type: 'array', items: { type: 'string' } },
          expected: { type: 'string' },
          actual: { type: 'string' },
        },
      },
      ValidationIssue: {
        type: 'object',
        properties: {
          requirementId: { type: 'string', example: 'FR-001' },
          requirementType: { type: 'string', enum: ['FR', 'NFR'], example: 'FR' },
          category: {
            type: 'string',
            enum: [
              'missing_field',
              'format',
              'vague_wording',
              'atomicity',
              'verifiability',
              'duplicate',
              'traceability',
              'consistency',
              'feasibility',
              'nfr_category',
            ],
            example: 'vague_wording',
          },
          severity: { type: 'string', enum: ['error', 'warning'], example: 'warning' },
          field: { type: 'string', example: 'statement' },
          message: { type: 'string', example: 'Requirement statement contains vague wording.' },
          details: { $ref: '#/components/schemas/ValidationIssueDetails' },
          suggestion: { type: 'string', example: 'Replace vague terms with measurable targets.' },
        },
        required: ['requirementId', 'requirementType', 'category', 'severity', 'field', 'message'],
      },
      ValidationSummary: {
        type: 'object',
        properties: {
          totalRequirements: { type: 'integer', example: 12 },
          totalIssues: { type: 'integer', example: 3 },
          errors: { type: 'integer', example: 1 },
          warnings: { type: 'integer', example: 2 },
        },
        required: ['totalRequirements', 'totalIssues', 'errors', 'warnings'],
      },
      FrNfrValidationResult: {
        type: 'object',
        properties: {
          isValid: { type: 'boolean', example: false },
          summary: { $ref: '#/components/schemas/ValidationSummary' },
          qualityScore: { type: 'integer', example: 85 },
          issues: {
            type: 'array',
            items: { $ref: '#/components/schemas/ValidationIssue' },
          },
        },
        required: ['isValid', 'summary', 'qualityScore', 'issues'],
      },
      AutoFixSuggestion: {
        type: 'object',
        properties: {
          requirementId: { type: 'string', example: 'NFR-PERF-001' },
          requirementType: { type: 'string', enum: ['FR', 'NFR'], example: 'NFR' },
          category: {
            type: 'string',
            enum: [
              'missing_field',
              'format',
              'vague_wording',
              'atomicity',
              'verifiability',
              'duplicate',
              'traceability',
              'consistency',
              'feasibility',
              'nfr_category',
            ],
            example: 'verifiability',
          },
          message: { type: 'string', example: 'Fit criterion is too vague.' },
          suggestion: {
            type: 'string',
            example: 'Add a measurable fit criterion with metric, threshold, and test condition.',
          },
        },
        required: ['requirementId', 'requirementType', 'category', 'message', 'suggestion'],
      },
      GeneratedRequirementsDocument: {
        type: 'object',
        properties: {
          projectName: { type: 'string', example: 'Clinic Appointment Booking System' },
          assumptions: { type: 'array', items: { type: 'string' } },
          constraints: { type: 'array', items: { type: 'string' } },
          features: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', example: 'FEAT-001' },
                name: { type: 'string', example: 'Appointment Booking' },
                description: { type: 'string' },
                priority: { type: 'string', example: 'High' },
              },
              required: ['id', 'name'],
            },
          },
          useCases: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', example: 'UC-001' },
                name: { type: 'string', example: 'Book Appointment' },
                goal: { type: 'string' },
                primaryActors: { type: 'array', items: { type: 'string' } },
                preconditions: { type: 'array', items: { type: 'string' } },
                trigger: { type: 'string' },
                mainFlow: { type: 'array', items: { type: 'string' } },
                postconditions: { type: 'array', items: { type: 'string' } },
                relatedFeatures: { type: 'array', items: { type: 'string' } },
              },
              required: ['id', 'name'],
            },
          },
          functionalRequirements: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', example: 'FR-001' },
                title: { type: 'string' },
                statement: { type: 'string', example: 'The system shall allow a patient to book an appointment.' },
                category: { type: 'string' },
                rationale: { type: 'string' },
                source: { type: 'array', items: { type: 'string' } },
                priority: { type: 'string' },
                fitCriterion: { type: 'string' },
                verificationMethod: { type: 'string' },
                preconditions: { type: 'array', items: { type: 'string' } },
                postconditions: { type: 'array', items: { type: 'string' } },
                dependsOn: { type: 'array', items: { type: 'string' } },
                conflictsWith: { type: 'array', items: { type: 'string' } },
                traceToFeatures: { type: 'array', items: { type: 'string' } },
                traceToUseCases: { type: 'array', items: { type: 'string' } },
                notes: { type: 'string' },
              },
              required: ['id', 'title', 'statement', 'rationale', 'source', 'priority', 'fitCriterion', 'verificationMethod'],
            },
          },
          nonFunctionalRequirements: {
            type: 'object',
            properties: {
              performanceRequirements: { type: 'array', items: { $ref: '#/components/schemas/NonFunctionalRequirement' } },
              securityRequirements: { type: 'array', items: { $ref: '#/components/schemas/NonFunctionalRequirement' } },
              usabilityRequirements: { type: 'array', items: { $ref: '#/components/schemas/NonFunctionalRequirement' } },
              reliabilityRequirements: { type: 'array', items: { $ref: '#/components/schemas/NonFunctionalRequirement' } },
              availabilityRequirements: { type: 'array', items: { $ref: '#/components/schemas/NonFunctionalRequirement' } },
              maintainabilityRequirements: { type: 'array', items: { $ref: '#/components/schemas/NonFunctionalRequirement' } },
              portabilityRequirements: { type: 'array', items: { $ref: '#/components/schemas/NonFunctionalRequirement' } },
              scalabilityRequirements: { type: 'array', items: { $ref: '#/components/schemas/NonFunctionalRequirement' } },
              auditabilityRequirements: { type: 'array', items: { $ref: '#/components/schemas/NonFunctionalRequirement' } },
              accessibilityRequirements: { type: 'array', items: { $ref: '#/components/schemas/NonFunctionalRequirement' } },
              backupRecoveryRequirements: { type: 'array', items: { $ref: '#/components/schemas/NonFunctionalRequirement' } },
              complianceRequirements: { type: 'array', items: { $ref: '#/components/schemas/NonFunctionalRequirement' } },
            },
          },
          qualityCheckSummary: {
            type: 'object',
            properties: {
              completenessNotes: { type: 'array', items: { type: 'string' } },
              ambiguityRisks: { type: 'array', items: { type: 'string' } },
              consistencyRisks: { type: 'array', items: { type: 'string' } },
              duplicationRisks: { type: 'array', items: { type: 'string' } },
              missingTraceLinks: { type: 'array', items: { type: 'string' } },
              assumptionsMade: { type: 'array', items: { type: 'string' } },
            },
            required: [
              'completenessNotes',
              'ambiguityRisks',
              'consistencyRisks',
              'duplicationRisks',
              'missingTraceLinks',
              'assumptionsMade',
            ],
          },
        },
        required: ['projectName', 'functionalRequirements', 'nonFunctionalRequirements', 'qualityCheckSummary'],
      },
      NonFunctionalRequirement: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'NFR-PERF-001' },
          title: { type: 'string' },
          statement: { type: 'string' },
          rationale: { type: 'string' },
          source: { type: 'array', items: { type: 'string' } },
          priority: { type: 'string' },
          fitCriterion: { type: 'string' },
          verificationMethod: { type: 'string' },
          traceToFeatures: { type: 'array', items: { type: 'string' } },
          traceToUseCases: { type: 'array', items: { type: 'string' } },
          notes: { type: 'string' },
        },
        required: ['id', 'title', 'statement', 'rationale', 'source', 'priority', 'fitCriterion', 'verificationMethod'],
      },
      DynamoProjectRecord: {
        type: 'object',
        properties: {
          userId: { type: 'string', example: 'user-123' },
          projectId: { type: 'string', example: 'proj-456' },
          projectName: { type: 'string', example: 'Hospital Booking System' },
          projectDescription: { type: 'string', nullable: true },
          generatedSrs: {
            type: 'object',
            nullable: true,
            additionalProperties: true,
          },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
        required: ['userId', 'projectId', 'projectName', 'createdAt', 'updatedAt'],
      },
    },
  },
};

export default openApiSpec;

