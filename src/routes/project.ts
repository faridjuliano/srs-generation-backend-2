import express from 'express';
import {
  createProjectRecord,
  getProjectByUserAndProjectId,
  listProjectsByUser,
  updateGeneratedSrsForProject,
} from '../services/dynamoSrsStorage';
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDb } from "../config/dynamo";

const router = express.Router();

function pickFirstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
}

function normalizeGeneratedSrs(body: Record<string, unknown>) {
  if (body.generatedSrs && typeof body.generatedSrs === 'object' && !Array.isArray(body.generatedSrs)) {
    return body.generatedSrs as { content: Record<string, unknown>; validation?: unknown; autoFixSuggestions?: unknown };
  }

  const content = body.content && typeof body.content === 'object' && !Array.isArray(body.content)
    ? (body.content as Record<string, unknown>)
    : undefined;

  if (!content) return null;

  return {
    content,
    validation: body.validation,
    autoFixSuggestions: body.autoFixSuggestions,
  };
}

router.post('/', async (req, res) => {
  try {
    const body = (req.body || {}) as Record<string, unknown>;
    const userId = pickFirstString(body.userId, body.user_id);
    const projectName = pickFirstString(body.projectName, body.project_name);
    const projectDescription = pickFirstString(body.projectDescription, body.project_description, body.description);
    const projectId = pickFirstString(body.projectId, body.project_id);

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'Request body must include a non-empty "userId" string.',
      });
    }

    if (!projectName) {
      return res.status(400).json({
        success: false,
        error: 'Request body must include a non-empty "projectName" string.',
      });
    }

    const record = await createProjectRecord({
      userId,
      projectName,
      projectDescription,
      projectId,
      generatedSrs: normalizeGeneratedSrs(body),
    });

    return res.status(201).json({
      success: true,
      data: record,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to create project',
      error: error instanceof Error ? error.message : error,
    });
  }
});

router.get("/users/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await dynamoDb.send(
      new QueryCommand({
        TableName: process.env.DYNAMODB_TABLE!,
        KeyConditionExpression: "#userId = :userId",
        ExpressionAttributeNames: {
          "#userId": "userId",
          "#projectId": "projectId",
          "#projectName": "projectName",
          "#updatedAt": "updatedAt",
        },
        ExpressionAttributeValues: {
          ":userId": userId,
        },
        ProjectionExpression: "#projectId, #projectName, #updatedAt",
      })
    );

    let projects = result.Items ?? [];

    projects = projects.sort((a, b) => {
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    return res.status(200).json({
      success: true,
      projects: projects,
    });
  } catch (error) {
    console.error("Get projects error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get projects.",
    });
  }
});

router.get('/:userId', async (req, res) => {
  try {
    const projects = await listProjectsByUser(req.params.userId);

    return res.json({
      success: true,
      data: projects,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to get projects',
      error: error instanceof Error ? error.message : error,
    });
  }
});

router.get('/:userId/:projectId', async (req, res) => {
  try {
    const project = await getProjectByUserAndProjectId(req.params.userId, req.params.projectId);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
      });
    }

    return res.json({
      success: true,
      data: project,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to get project',
      error: error instanceof Error ? error.message : error,
    });
  }
});

router.patch('/:userId/:projectId/generated-srs', async (req, res) => {
  try {
    const generatedSrs = normalizeGeneratedSrs((req.body || {}) as Record<string, unknown>);

    if (!generatedSrs) {
      return res.status(400).json({
        success: false,
        message: 'Request body must include a valid "generatedSrs" object or a "content" object.',
      });
    }

    const updated = await updateGeneratedSrsForProject({
      userId: req.params.userId,
      projectId: req.params.projectId,
      generatedSrs,
    });

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
      });
    }

    return res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update generated SRS',
      error: error instanceof Error ? error.message : error,
    });
  }
});

export default router;