const express = require('express');
const { generateText } = require('./utils/gemini');

const app = express();

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/', (req, res) => {
  res.json({ message: 'Express app is running' });
});

app.post('/generate', async (req, res) => {
  const { prompt } = req.body || {};

  if (!isNonEmptyString(prompt)) {
    return res.status(400).json({
      ok: false,
      error: {
        code: 'INVALID_PROMPT',
        message: 'Request body must include a non-empty "prompt" string.',
      },
    });
  }

  try {
    const result = await generateText(prompt.trim());

    return res.json({
      ok: true,
      model: result.model,
      text: result.text,
    });
  } catch (error) {
    const isMissingKey = error && error.message === 'Missing GEMINI_API_KEY';

    return res.status(isMissingKey ? 500 : 502).json({
      ok: false,
      error: {
        code: isMissingKey ? 'MISSING_GEMINI_API_KEY' : 'GEMINI_REQUEST_FAILED',
        message: isMissingKey
          ? 'GEMINI_API_KEY is not configured on the server.'
          : 'Failed to generate content from Gemini.',
      },
    });
  }
});

module.exports = app;

