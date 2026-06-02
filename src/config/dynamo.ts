import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import dotenv from "dotenv";

dotenv.config();

const client = new DynamoDBClient({
  region: process.env.AWS_REGION,
});

export const dynamoDb = DynamoDBDocumentClient.from(client);

// Main application table used by project storage (old name: DYNAMODB_TABLE)
export const TABLE_NAME = process.env.DYNAMODB_TABLE;

// Users table: separate table name expected in USERS_TABLE env var
export const USERS_TABLE = process.env.USERS_TABLE;
