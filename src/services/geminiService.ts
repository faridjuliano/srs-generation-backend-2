import { GoogleGenerativeAI } from '@google/generative-ai';

function extractText(response: {
  text: () => string;
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}): string {
  let text = response.text();

  if (!text || text.trim().length === 0) {
    const fallback = response.candidates?.[0]?.content?.parts
      ?.map(part => part.text)
      .filter(Boolean)
      .join('');

    if (fallback) text = fallback;
  }

  return text || '';
}

export async function generateWithGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is missing');

  const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const genAI = new GoogleGenerativeAI(apiKey);

  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 9000,
      responseMimeType: 'application/json'
    }
  });

  const result = await model.generateContent(prompt);
  const response = await result.response;
  return extractText(response as any);
}
