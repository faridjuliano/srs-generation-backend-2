"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
                description: 'Generates only features, use cases, functional requirements, non-functional requirements, and quality summary.',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    projectName: { type: 'string', example: 'Inventory Management System' },
                                    projectVision: { type: 'string', example: 'A web application for tracking stock levels and low inventory alerts.' },
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
                                    },
                                    required: ['success', 'content'],
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
                description: 'Sends existing FR/NFR-only JSON content and user instruction to Gemini, then returns revised FR/NFR JSON.',
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
    },
};
exports.default = openApiSpec;
