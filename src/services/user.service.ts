import { GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoDb, USERS_TABLE } from '../config/dynamo';

export interface UserRecord {
  email: string;
  userId: string;
  fName?: string;
  lName?: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
}

function ensureUsersTableName(): string {
  if (!USERS_TABLE) {
    throw new Error('Missing USERS_TABLE environment variable. Set USERS_TABLE to your users DynamoDB table name.');
  }

  return USERS_TABLE;
}

export async function getUserByEmail(email: string): Promise<UserRecord | null> {
  const table = ensureUsersTableName();
  const key = { email: email.toLowerCase() };

  const response = await dynamoDb.send(new GetCommand({
    TableName: table,
    Key: key,
  }));

  return (response.Item as UserRecord | undefined) || null;
}

export async function createUser(record: UserRecord): Promise<void> {
  const table = ensureUsersTableName();

  await dynamoDb.send(new PutCommand({
    TableName: table,
    Item: record,
    // ensure we don't overwrite an existing user with same email
    ConditionExpression: 'attribute_not_exists(email)'
  }));
}

export async function touchUserUpdatedAt(email: string): Promise<void> {
  const table = ensureUsersTableName();
  const now = new Date().toISOString();

  await dynamoDb.send(new UpdateCommand({
    TableName: table,
    Key: { email: email.toLowerCase() },
    UpdateExpression: 'SET updatedAt = :u',
    ExpressionAttributeValues: { ':u': now },
  }));
}

