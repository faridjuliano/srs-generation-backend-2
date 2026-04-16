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
- `POST /api/srs/generate-fr-nfr` - Generates FR/NFR-focused JSON only and validates output
- `POST /api/srs/reprompt` - Revises existing SRS content via a follow-up Gemini instruction
- `POST /api/srs/reprompt-fr-nfr` - Revises FR/NFR-only JSON via a follow-up Gemini instruction and validates output
- `POST /api/srs/validate` - Validates edited SRS content
- `POST /api/srs/validate-fr-nfr` - Validates FR/NFR JSON payloads with issue-level diagnostics and suggestions
- `POST /api/srs/auto-fix` - Applies issue-driven fixes and re-validates

## Validator Module

- Location: `src/validators/frNfr`
- Main function: `validateGeneratedRequirements(input, config?)`
- Suggestions helper: `getAutoFixSuggestionsFromValidation(validationResult)`

## Test Commands

```bash
npm run test
npm run test:validator
```

## Environment Variables

Create a `.env` file with:

- `PORT` (optional, default from your server file)
- `GEMINI_API_KEY` (required for generation)
- `GEMINI_MODEL` (optional)
