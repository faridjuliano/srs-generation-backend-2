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
    '/api/srs/auto-fix': {
      post: {
        tags: ['SRS'],
        summary: 'Auto-fix SRS content',
        description: 'Automatically repair common SRS structure issues, missing fields, and type mismatches.',
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
                },
                required: ['content'],
              },
              example: {
                content: {
                  documentControl: {
                    projectName: 'My Project',
                  },
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
                  required: ['success', 'content', 'validation'],
                },
                example: {
                  success: true,
                  content: {
                    documentControl: {
                      documentTitle: 'Software Requirements Specification',
                      projectName: 'My Project',
                      documentId: 'SRS-001',
                      version: '1.0',
                      status: 'Draft',
                      date: '2026-04-13',
                      preparedBy: 'AI Generator',
                      reviewedBy: '',
                      approvedBy: '',
                    },
                  },
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
  },
};

export default openApiSpec;

