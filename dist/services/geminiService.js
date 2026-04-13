"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateWithGemini = generateWithGemini;
const generative_ai_1 = require("@google/generative-ai");
function extractText(response) {
    let text = response.text();
    if (!text || text.trim().length === 0) {
        const fallback = response.candidates?.[0]?.content?.parts
            ?.map(part => part.text)
            .filter(Boolean)
            .join('');
        if (fallback)
            text = fallback;
    }
    return text || '';
}
async function generateWithGemini(prompt) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey)
        throw new Error('GEMINI_API_KEY is missing');
    const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 8000,
            responseMimeType: 'application/json'
        }
    });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return extractText(response);
}
