# Express.js Boilerplate

A minimal Express.js application with a health check endpoint and a Gemini-powered text generation route.

## Getting Started

```bash
npm install
npm run dev
```

## Available Routes

- `GET /` - Returns a basic status message
- `GET /health` - Returns `{ "status": "ok" }`
- `POST /generate` - Sends a prompt to Gemini and returns generated text

## Environment Variables

Create a `.env` file from `.env.example` and set `GEMINI_API_KEY`.

## Generate Endpoint

Example request:

```bash
curl -X POST http://localhost:3000/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Write a one-sentence welcome message for a new Express app."}'
```

Example response:

```json
{
  "ok": true,
  "model": "gemini-1.5-flash",
  "text": "Welcome to your Express app!"
}
```

