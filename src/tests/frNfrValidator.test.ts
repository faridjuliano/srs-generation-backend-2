import test from 'node:test';
import assert from 'node:assert/strict';
import { GeneratedRequirementsDocument } from '../types/frNfrValidation';
import { getAutoFixSuggestionsFromValidation, validateGeneratedRequirements } from '../validators/frNfr';

function createBaseDocument(): GeneratedRequirementsDocument {
  return {
    projectName: 'Clinic Appointment Booking System',
    assumptions: ['Users use modern browsers'],
    constraints: ['Prototype only supports web'],
    features: [
      {
        id: 'FEAT-001',
        name: 'Appointment Booking',
      },
    ],
    useCases: [
      {
        id: 'UC-001',
        name: 'Book Appointment',
      },
    ],
    functionalRequirements: [
      {
        id: 'FR-001',
        title: 'Book appointment',
        statement: 'The system shall allow patient appointment booking.',
        rationale: 'Core workflow',
        source: ['Vision'],
        priority: 'High',
        fitCriterion: '95% of booking requests are completed within 3 seconds.',
        verificationMethod: 'Test',
        traceToFeatures: ['FEAT-001'],
        traceToUseCases: ['UC-001'],
      },
    ],
    nonFunctionalRequirements: {
      performanceRequirements: [
        {
          id: 'NFR-PERF-001',
          title: 'Booking latency',
          statement:
            'The system shall return appointment booking confirmation within 3 seconds for 95% of valid booking requests.',
          rationale: 'Responsive UX',
          source: ['Architecture'],
          priority: 'Medium',
          fitCriterion: '95% of booking responses complete within 3 seconds under expected load.',
          verificationMethod: 'Performance Test',
          traceToFeatures: ['FEAT-001'],
        },
      ],
      securityRequirements: [],
      usabilityRequirements: [],
      reliabilityRequirements: [],
      availabilityRequirements: [],
      maintainabilityRequirements: [],
      portabilityRequirements: [],
      scalabilityRequirements: [],
      auditabilityRequirements: [],
      accessibilityRequirements: [],
      backupRecoveryRequirements: [],
      complianceRequirements: [],
    },
    qualityCheckSummary: {
      completenessNotes: [],
      ambiguityRisks: [],
      consistencyRisks: [],
      duplicationRisks: [],
      missingTraceLinks: [],
      assumptionsMade: [],
    },
  };
}

test('returns valid=true for a minimal well-formed payload', async () => {
  const input = createBaseDocument();
  const result = await validateGeneratedRequirements(input);

  assert.equal(result.isValid, true);
  assert.equal(result.summary.errors, 0);
  assert.equal(result.qualityScore, 100);
});

test('supports gemini validation model when GEMINI_API_KEY is configured', { skip: !process.env.GEMINI_API_KEY }, async () => {
  const input = createBaseDocument();
  const result = await validateGeneratedRequirements(input, {
    validationModel: 'gemini',
  });

  assert.equal(typeof result.isValid, 'boolean');
  assert.ok(result.summary.totalRequirements >= 0);
  assert.ok(result.qualityScore >= 0);
});

test('flags custom vague wording terms from ValidationConfig', async () => {
  const input = createBaseDocument();
  input.functionalRequirements[0].statement = 'The system shall be snappy and responsive.';

  const result = await validateGeneratedRequirements(input, {
    vagueTerms: ['snappy'],
    duplicateSimilarityThreshold: 0.82,
    minimumStatementLength: 6,
    minimumFitCriterionLength: 4,
    maxAndCount: 2,
    maxOrCount: 1,
    maxSemicolonCount: 0,
    maxShallCount: 1,
    placeholderTerms: ['tbd'],
    weakFitCriterionTerms: ['works correctly'],
    infeasiblePhrases: ['never fail'],
    preferredNfrTraceCoverageThreshold: 0.6,
  });

  const vagueIssue = result.issues.find((issue) => issue.category === 'vague_wording');

  assert.ok(vagueIssue);
  assert.deepEqual(vagueIssue?.details?.matchedTerms, ['snappy']);
});

test('flags weak verifiability using the configured minimum fitCriterion length', async () => {
  const input = createBaseDocument();
  input.functionalRequirements[0].fitCriterion = 'works correctly';

  const result = await validateGeneratedRequirements(input, {
    vagueTerms: ['user-friendly'],
    duplicateSimilarityThreshold: 0.82,
    minimumStatementLength: 6,
    minimumFitCriterionLength: 5,
    maxAndCount: 2,
    maxOrCount: 1,
    maxSemicolonCount: 0,
    maxShallCount: 1,
    placeholderTerms: ['tbd'],
    weakFitCriterionTerms: ['works correctly'],
    infeasiblePhrases: ['never fail'],
    preferredNfrTraceCoverageThreshold: 0.6,
  });

  const verifiabilityIssue = result.issues.find((issue) => issue.category === 'verifiability');

  assert.ok(verifiabilityIssue);
  assert.equal(verifiabilityIssue?.severity, 'error');
});

test('flags near duplicates when similarity threshold is lowered', async () => {
  const input = createBaseDocument();
  input.functionalRequirements.push({
    ...input.functionalRequirements[0],
    id: 'FR-002',
    title: 'Book appointment in clinic',
    statement: 'The system shall allow a patient to book an appointment with a doctor.',
  });

  const result = await validateGeneratedRequirements(input, {
    vagueTerms: ['user-friendly'],
    duplicateSimilarityThreshold: 0.2,
    minimumStatementLength: 6,
    minimumFitCriterionLength: 4,
    maxAndCount: 2,
    maxOrCount: 1,
    maxSemicolonCount: 0,
    maxShallCount: 1,
    placeholderTerms: ['tbd'],
    weakFitCriterionTerms: ['works correctly'],
    infeasiblePhrases: ['never fail'],
    preferredNfrTraceCoverageThreshold: 0.6,
  });

  const duplicateIssue = result.issues.find((issue) => issue.category === 'duplicate' && issue.severity === 'warning');

  assert.ok(duplicateIssue);
  assert.ok(duplicateIssue?.details?.relatedRequirementIds?.includes('FR-002'));
});

test('flags vague wording and weak verifiability', async () => {
  const input = createBaseDocument();
  input.functionalRequirements[0].statement = 'The system shall be user-friendly and fast.';
  input.functionalRequirements[0].fitCriterion = 'works correctly';

  const result = await validateGeneratedRequirements(input, {
    vagueTerms: ['user-friendly', 'fast'],
    duplicateSimilarityThreshold: 0.82,
    minimumStatementLength: 6,
    minimumFitCriterionLength: 4,
    maxAndCount: 2,
    maxOrCount: 1,
    maxSemicolonCount: 0,
    maxShallCount: 1,
    placeholderTerms: ['tbd'],
    weakFitCriterionTerms: ['works correctly'],
    infeasiblePhrases: ['never fail'],
    preferredNfrTraceCoverageThreshold: 0.6,
  });
  const categories = result.issues.map((issue) => issue.category);

  assert.equal(result.isValid, false);
  assert.ok(categories.includes('vague_wording'));
  assert.ok(categories.includes('verifiability'));
});

test('flags broken traceability and duplicate requirements', async () => {
  const input = createBaseDocument();

  input.functionalRequirements.push({
    ...input.functionalRequirements[0],
    id: 'FR-002',
    traceToFeatures: ['FEAT-404'],
    traceToUseCases: ['UC-999'],
  });

  const result = await validateGeneratedRequirements(input);
  const duplicateIssue = result.issues.find((issue) => issue.category === 'duplicate');
  const traceIssue = result.issues.find((issue) => issue.category === 'traceability');

  assert.ok(Boolean(duplicateIssue));
  assert.ok(Boolean(traceIssue));

  const autoFixSuggestions = getAutoFixSuggestionsFromValidation(result);
  assert.ok(autoFixSuggestions.length > 0);
});

