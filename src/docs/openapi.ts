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
  },
};

export default openApiSpec;

