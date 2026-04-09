const { GoogleGenerativeAI } = require('@google/generative-ai');

const API_KEY = process.env.GEMINI_API_KEY;
const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

function getClient() {
  if (!API_KEY) {
    throw new Error('Missing GEMINI_API_KEY');
  }

  return new GoogleGenerativeAI(API_KEY);
}

async function generateText(prompt) {
  const genAI = getClient();
  const model = genAI.getGenerativeModel({ model: DEFAULT_MODEL });
  const result = await model.generateContent(prompt);
  const response = await result.response;

  return {
    model: DEFAULT_MODEL,
    text: response.text(),
  };
}

module.exports = {
  generateText,
};

