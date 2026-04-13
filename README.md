# Express.js Boilerplate

A TypeScript Express backend with health checks, SRS generation, and Swagger documentation.

## Getting Started

```bash
npm install
npm run dev
```

## API Documentation

- Swagger UI: `GET /api/docs`
- OpenAPI JSON: `GET /api/docs.json`

## Available Routes

- `GET /api/health` - Returns service health status
- `POST /api/srs/generate` - Generates SRS content via Gemini

## Environment Variables

Create a `.env` file with:

- `PORT` (optional, default from your server file)
- `GEMINI_API_KEY` (required for generation)
- `GEMINI_MODEL` (optional)
