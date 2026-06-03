import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDb } from "../config/dynamo";

export async function getUserProjects(userId: string) {
  const result = await dynamoDb.send(
    new QueryCommand({
      TableName: process.env.PROJECTS_TABLE!,
      KeyConditionExpression: "#userId = :userId",
      ExpressionAttributeNames: {
        "#userId": "userId",
        "#projectId": "projectId",
        "#projectName": "projectName",
      },
      ExpressionAttributeValues: {
        ":userId": userId,
      },
      ProjectionExpression: "#projectId, #projectName",
    })
  );

  return result.Items ?? [];
}