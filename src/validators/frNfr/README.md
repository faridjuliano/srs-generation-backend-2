# FR/NFR Validator Module

## Purpose

Rule-based quality validator for generated FR/NFR requirement JSON. It returns structured issues and targeted auto-fix suggestions.

## Main Entry Points

- `validateGeneratedRequirements(input, config?)`
- `validateRequirements(input, config?)`
- `getAutoFixSuggestionsFromValidation(validationResult)`

## Rule Buckets

- Required fields
- Statement format
- Vague wording
- Atomicity
- Verifiability
- Duplicate/near-duplicate
- Traceability
- Consistency (heuristic)
- NFR category fit
- Feasibility (heuristic)

## Quick Test

```bash
npm run test:validator
```

