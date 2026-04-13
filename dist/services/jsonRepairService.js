"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.repairJson = repairJson;
const generative_ai_1 = require("@google/generative-ai");
async function repairJson(invalidJson) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey)
        throw new Error('GEMINI_API_KEY is missing');
    const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
        generationConfig: {
            temperature: 0,
            maxOutputTokens: 8000,
            responseMimeType: 'application/json'
        }
    });
    const prompt = `
You are a strict JSON repair tool.
Return JSON only.
Repair this content into valid JSON:
${invalidJson}
`;
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
}
