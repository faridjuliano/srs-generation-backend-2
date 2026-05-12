import { randomUUID } from 'crypto';
import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoDb, TABLE_NAME } from '../config/dynamo';

export interface DynamoGeneratedSrsPayload {
  content: Record<string, unknown>;
  validation?: unknown;
  autoFixSuggestions?: unknown;
  prediction?: unknown;
}

export interface DynamoProjectRecord {
  userId: string;
  projectId: string;
  projectName: string;
  projectDescription?: string;
  generatedSrs?: DynamoGeneratedSrsPayload | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectInput {
  userId: string;
  projectName: string;
  projectDescription?: string;
  projectId?: string;
  generatedSrs?: DynamoGeneratedSrsPayload | null;
}

export interface UpdateGeneratedSrsInput {
  userId: string;
  projectId: string;
  generatedSrs: DynamoGeneratedSrsPayload;
}

function ensureTableName(): string {
  if (!TABLE_NAME) {
    throw new Error('Missing DynamoDB table name. Set DYNAMODB_TABLE in the environment.');
  }

  return TABLE_NAME;
}

function nowIso(): string {
  return new Date().toISOString();
}

export async function createProjectRecord(input: CreateProjectInput): Promise<DynamoProjectRecord> {
  const projectId = input.projectId?.trim() || randomUUID();
  const createdAt = nowIso();
  const record: DynamoProjectRecord = {
    userId: input.userId.trim(),
    projectId,
    projectName: input.projectName.trim(),
    createdAt,
    updatedAt: createdAt,
    generatedSrs: input.generatedSrs || null,
  };

  if (input.projectDescription?.trim()) {
    record.projectDescription = input.projectDescription.trim();
  }

  await dynamoDb.send(new PutCommand({
    TableName: ensureTableName(),
    Item: record,
  }));

  return record;
}

export async function listProjectsByUser(userId: string): Promise<DynamoProjectRecord[]> {
  const response = await dynamoDb.send(new QueryCommand({
    TableName: ensureTableName(),
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: {
      ':userId': userId.trim(),
    },
  }));

  return (response.Items || []) as DynamoProjectRecord[];
}

export async function getProjectByUserAndProjectId(userId: string, projectId: string): Promise<DynamoProjectRecord | null> {
  const response = await dynamoDb.send(new GetCommand({
    TableName: ensureTableName(),
    Key: {
      userId: userId.trim(),
      projectId: projectId.trim(),
    },
  }));

  return (response.Item as DynamoProjectRecord | undefined) || null;
}

export async function updateGeneratedSrsForProject(input: UpdateGeneratedSrsInput): Promise<DynamoProjectRecord | null> {
  const updatedAt = nowIso();
  try {
    const response = await dynamoDb.send(new UpdateCommand({
      TableName: ensureTableName(),
      Key: {
        userId: input.userId.trim(),
        projectId: input.projectId.trim(),
      },
      UpdateExpression: 'SET generatedSrs = :generatedSrs, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':generatedSrs': input.generatedSrs,
        ':updatedAt': updatedAt,
      },
      ConditionExpression: 'attribute_exists(userId) AND attribute_exists(projectId)',
      ReturnValues: 'ALL_NEW',
    }));

    return (response.Attributes as DynamoProjectRecord | undefined) || null;
  } catch (error) {
    return null;
  }
}
