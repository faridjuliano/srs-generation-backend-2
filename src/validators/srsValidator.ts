import { RULES_CONFIG } from './rulesConfig';

export type Severity = 'error' | 'warning';

export interface Stakeholder {
  id: string;
  name: string;
  role?: string;
  description?: string;
  needs?: string[];
}

export interface UseCase {
  id?: string;
  identifier?: string;
  name: string;
  goal?: string;
  description?: string;
  actors?: string[];
  primaryActors?: string[];
  secondaryActors?: string[];
  preconditions?: string[];
  trigger?: string;
  mainFlow?: string[];
  alternativeFlow?: string[];
  alternativeFlows?: string[];
  postconditions?: string[];
  relatedRequirements?: string[];
  relatedFunctionalRequirements?: string[];
}

export interface FunctionalRequirement {
  id: string;
  title: string;
  statement: string;
  rationale: string;
  source: string[];
  priority: string;
  fitCriterion: string;
  verificationMethod: string;
  traceToStakeholders: string[];
  traceToUseCases: string[];
  dependsOn?: string[];
  conflictsWith?: string[];
  notes?: string;
}

export interface NonFunctionalRequirement {
  id: string;
  category?: string;
  title?: string;
  statement: string;
  rationale?: string;
  source: string[];
  priority: string;
  fitCriterion: string;
  verificationMethod: string;
  traceToFunctionalRequirements?: string[];
  notes?: string;
}

export interface SRSDocument {
  stakeholders?: Stakeholder[];
  systemUseCases?: UseCase[];
  functionalRequirements?: FunctionalRequirement[];
  nonFunctionalRequirements?: NonFunctionalRequirement[];
  [key: string]: unknown;
}

export interface ValidationIssue {
  severity: Severity;
  code: string;
  message: string;
  requirementId?: string;
  relatedRequirementId?: string;
  path?: string;
  suggestion?: string;
}

export interface ValidationResult {
  passed: boolean;
  errorCount: number;
  warningCount: number;
  issues: ValidationIssue[];
  qualityScore: number;
}

const VAGUE_TERMS = RULES_CONFIG.vagueTerms;

const FUNCTIONAL_REQUIRED_FIELDS: ReadonlyArray<keyof FunctionalRequirement> = [
  ...RULES_CONFIG.requiredFields.functional,
];

const NON_FUNCTIONAL_REQUIRED_FIELDS: ReadonlyArray<keyof NonFunctionalRequirement> = [
  ...RULES_CONFIG.requiredFields.nonFunctional,
];

export function validateSRS(document: SRSDocument): ValidationResult {
  const issues: ValidationIssue[] = [
    ...checkMissingFields(document),
    ...checkDuplicateIds(document),
    ...checkBrokenTraceLinks(document),
    ...checkMissingSourceLinks(document),
    ...checkVagueWording(document),
    ...checkMultiActionRequirements(document),
    ...checkNearDuplicateRequirements(document)
  ];

  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;

  return {
    passed: errorCount === 0,
    errorCount,
    warningCount,
    issues,
    qualityScore: calculateQualityScore(issues)
  };
}

export function checkMissingFields(document: SRSDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  getFunctionalRequirements(document).forEach((req, index) => {
    FUNCTIONAL_REQUIRED_FIELDS.forEach((field) => {
      if (isMissing(req[field])) {
        issues.push({
          severity: 'error',
          code: 'FR_MISSING_FIELD',
          message: `Functional requirement is missing required field: ${field}`,
          requirementId: req.id,
          path: `functionalRequirements[${index}].${field}`,
          suggestion: `Populate ${field} with a valid value.`
        });
      }
    });
  });

  getNonFunctionalRequirements(document).forEach((req, index) => {
    NON_FUNCTIONAL_REQUIRED_FIELDS.forEach((field) => {
      if (isMissing(req[field])) {
        issues.push({
          severity: 'error',
          code: 'NFR_MISSING_FIELD',
          message: `Non-functional requirement is missing required field: ${field}`,
          requirementId: req.id,
          path: `nonFunctionalRequirements[${index}].${field}`,
          suggestion: `Populate ${field} with a valid value.`
        });
      }
    });
  });

  return issues;
}

export function checkDuplicateIds(document: SRSDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const allIds = collectAllIds(document);
  const idMap = new Map<string, string[]>();

  allIds.forEach(({ id, path }) => {
    if (!id) return;
    const existing = idMap.get(id) ?? [];
    existing.push(path);
    idMap.set(id, existing);
  });

  for (const [id, paths] of idMap.entries()) {
    if (paths.length > 1) {
      issues.push({
        severity: 'error',
        code: 'DUPLICATE_ID',
        message: `Duplicate ID detected: ${id}`,
        requirementId: id,
        path: paths.join(', '),
        suggestion: 'Use globally unique IDs across stakeholders, use cases, and requirements.'
      });
    }
  }

  return issues;
}

export function checkBrokenTraceLinks(document: SRSDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const stakeholderIds = new Set(getStakeholders(document).map(s => s.id).filter(Boolean));
  const useCaseIds = new Set(getUseCases(document).map(u => getUseCaseId(u)).filter(Boolean));

  getFunctionalRequirements(document).forEach((req, index) => {
    (req.traceToStakeholders || []).forEach((stakeholderId) => {
      if (!stakeholderIds.has(stakeholderId)) {
        issues.push({
          severity: 'error',
          code: 'BROKEN_TRACE_STAKEHOLDER',
          message: `Requirement references unknown stakeholder ID: ${stakeholderId}`,
          requirementId: req.id,
          path: `functionalRequirements[${index}].traceToStakeholders`,
          suggestion: 'Reference an existing stakeholder ID from the stakeholders section.'
        });
      }
    });

    (req.traceToUseCases || []).forEach((useCaseId) => {
      if (!useCaseIds.has(useCaseId)) {
        issues.push({
          severity: 'error',
          code: 'BROKEN_TRACE_USE_CASE',
          message: `Requirement references unknown use case ID: ${useCaseId}`,
          requirementId: req.id,
          path: `functionalRequirements[${index}].traceToUseCases`,
          suggestion: 'Reference an existing use case ID from the use case section.'
        });
      }
    });
  });

  return issues;
}

export function checkMissingSourceLinks(document: SRSDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  getFunctionalRequirements(document).forEach((req, index) => {
    if (!Array.isArray(req.source) || req.source.length === 0) {
      issues.push({
        severity: 'error',
        code: 'FR_MISSING_SOURCE',
        message: 'Functional requirement has no source link.',
        requirementId: req.id,
        path: `functionalRequirements[${index}].source`,
        suggestion: 'Add at least one source (stakeholder, document, regulation, or use case).'
      });
    }
  });

  getNonFunctionalRequirements(document).forEach((req, index) => {
    if (!Array.isArray(req.source) || req.source.length === 0) {
      issues.push({
        severity: 'error',
        code: 'NFR_MISSING_SOURCE',
        message: 'Non-functional requirement has no source link.',
        requirementId: req.id,
        path: `nonFunctionalRequirements[${index}].source`,
        suggestion: 'Add at least one source (stakeholder, policy, architecture decision, or standard).'
      });
    }
  });

  return issues;
}

export function checkVagueWording(document: SRSDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const req of getAllRequirements(document)) {
    const text = normalizeText(req.statement);

    for (const term of VAGUE_TERMS) {
      if (text.includes(term)) {
        issues.push({
          severity: 'warning',
          code: 'VAGUE_WORDING',
          message: `Vague wording detected: "${term}"`,
          requirementId: req.id,
          suggestion: 'Replace vague wording with measurable acceptance criteria.'
        });
      }
    }

    // In requirements specs, "shall" indicates mandatory behavior.
    if (/(\bshould\b|\bmay\b)/i.test(req.statement) && /\bsystem\b/i.test(req.statement)) {
      issues.push({
        severity: 'warning',
        code: 'WEAK_MODAL_VERB',
        message: 'Requirement uses "should" or "may" where mandatory wording may be expected.',
        requirementId: req.id,
        suggestion: 'Use "The system shall ..." for mandatory requirements.'
      });
    }
  }

  return dedupeIssues(issues);
}

export function checkMultiActionRequirements(document: SRSDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { andCount: andThreshold, semicolonCount: semicolonThreshold, commaCount: commaThreshold } =
    RULES_CONFIG.multiActionThresholds;

  for (const req of getAllRequirements(document)) {
    const statement = req.statement || '';
    const andCount = countMatches(statement.toLowerCase(), /\band\b/g);
    const semicolonCount = countMatches(statement, /;/g);
    const commaCount = countMatches(statement, /,/g);

    // Heuristic: too many connectors often means multiple atomic requirements in one sentence.
    const likelyMultiAction = andCount >= andThreshold || semicolonCount >= semicolonThreshold || commaCount >= commaThreshold;
    if (likelyMultiAction) {
      issues.push({
        severity: 'warning',
        code: 'MULTI_ACTION_REQUIREMENT',
        message: 'Requirement likely combines multiple actions and should be split.',
        requirementId: req.id,
        suggestion: 'Split this statement into separate atomic requirements with distinct IDs.'
      });
    }
  }

  return issues;
}

export function checkNearDuplicateRequirements(document: SRSDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const requirements = getAllRequirements(document);
  const threshold = RULES_CONFIG.nearDuplicate.similarityThreshold;

  for (let i = 0; i < requirements.length; i += 1) {
    for (let j = i + 1; j < requirements.length; j += 1) {
      const a = requirements[i];
      const b = requirements[j];

      const similarity = jaccardSimilarity(tokenize(a.statement), tokenize(b.statement));
      if (similarity >= threshold) {
        issues.push({
          severity: 'warning',
          code: 'NEAR_DUPLICATE_REQUIREMENT',
          message: `Near-duplicate requirements detected (similarity=${similarity.toFixed(2)}).`,
          requirementId: a.id,
          relatedRequirementId: b.id,
          suggestion: 'Merge, differentiate, or remove one of these requirements to avoid redundancy.'
        });
      }
    }
  }

  return issues;
}

export function calculateQualityScore(issues: ValidationIssue[]): number {
  const { baseScore, errorPenalty, warningPenalty } = RULES_CONFIG.scoring;
  const penalties = issues.reduce((total, issue) => {
    if (issue.severity === 'error') return total + errorPenalty;
    return total + warningPenalty;
  }, 0);

  return Math.max(0, baseScore - penalties);
}

function getStakeholders(document: SRSDocument): Stakeholder[] {
  if (Array.isArray(document.stakeholders)) return document.stakeholders;

  const context = asRecord(document['2ContextOfTheSystem']);
  const nested = context['2.3Stakeholders'];
  return Array.isArray(nested) ? (nested as Stakeholder[]) : [];
}

function getUseCases(document: SRSDocument): UseCase[] {
  if (Array.isArray(document.systemUseCases)) return document.systemUseCases;

  const featuresAndUseCases = asRecord(document['3SystemFeaturesAndUseCases']);
  const nested = featuresAndUseCases['3.2UseCases'];
  return Array.isArray(nested) ? (nested as UseCase[]) : [];
}

function getFunctionalRequirements(document: SRSDocument): FunctionalRequirement[] {
  if (Array.isArray(document.functionalRequirements)) return document.functionalRequirements;

  const nested = document['4FunctionalRequirements'];
  return Array.isArray(nested) ? (nested as FunctionalRequirement[]) : [];
}

function getNonFunctionalRequirements(document: SRSDocument): NonFunctionalRequirement[] {
  if (Array.isArray(document.nonFunctionalRequirements)) return document.nonFunctionalRequirements;

  const grouped = asRecord(document['5NonFunctionalRequirements']);
  const flattened: NonFunctionalRequirement[] = [];

  Object.values(grouped).forEach((value) => {
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        flattened.push(entry as NonFunctionalRequirement);
      });
    }
  });

  return flattened;
}

function getAllRequirements(document: SRSDocument): Array<FunctionalRequirement | NonFunctionalRequirement> {
  return [...getFunctionalRequirements(document), ...getNonFunctionalRequirements(document)];
}

function getUseCaseId(useCase: UseCase): string {
  return useCase.id || useCase.identifier || '';
}

function collectAllIds(document: SRSDocument): Array<{ id: string; path: string }> {
  const results: Array<{ id: string; path: string }> = [];

  getStakeholders(document).forEach((item, index) => {
    results.push({ id: item.id, path: `stakeholders[${index}].id` });
  });

  getUseCases(document).forEach((item, index) => {
    results.push({ id: getUseCaseId(item), path: `systemUseCases[${index}].id` });
  });

  getFunctionalRequirements(document).forEach((item, index) => {
    results.push({ id: item.id, path: `functionalRequirements[${index}].id` });
  });

  getNonFunctionalRequirements(document).forEach((item, index) => {
    results.push({ id: item.id, path: `nonFunctionalRequirements[${index}].id` });
  });

  return results;
}

function dedupeIssues(issues: ValidationIssue[]): ValidationIssue[] {
  const seen = new Set<string>();
  const output: ValidationIssue[] = [];

  issues.forEach((issue) => {
    const key = [issue.code, issue.requirementId, issue.relatedRequirementId, issue.message].join('|');
    if (!seen.has(key)) {
      seen.add(key);
      output.push(issue);
    }
  });

  return output;
}

function isMissing(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value: string): Set<string> {
  const tokens = normalizeText(value)
    .split(' ')
    .map(token => token.trim())
    .filter(token => token.length > 2);
  return new Set(tokens);
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;

  let intersection = 0;
  a.forEach((token) => {
    if (b.has(token)) intersection += 1;
  });

  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function countMatches(value: string, pattern: RegExp): number {
  const matches = value.match(pattern);
  return matches ? matches.length : 0;
}

// Example usage for Node.js backend integration.
export function runValidatorExample(): ValidationResult {
  const example: SRSDocument = {
    stakeholders: [
      { id: 'STK-001', name: 'Warehouse Clerk' },
      { id: 'STK-002', name: 'Inventory Manager' }
    ],
    systemUseCases: [
      { identifier: 'UC-001', name: 'Receive Stock' },
      { identifier: 'UC-002', name: 'Issue Stock' }
    ],
    functionalRequirements: [
      {
        id: 'FR-001',
        title: 'Inbound Recording',
        statement: 'The system shall record inbound stock transactions in real time.',
        rationale: 'Track stock movement accurately.',
        source: ['Project Vision'],
        priority: 'High',
        fitCriterion: 'Transaction is visible within 2 seconds.',
        verificationMethod: 'Test',
        traceToStakeholders: ['STK-001'],
        traceToUseCases: ['UC-001']
      },
      {
        id: 'FR-002',
        title: 'Outbound Recording',
        statement: 'The system should quickly process outbound transactions and/or notify users as needed.',
        rationale: 'Support fulfillment workflow.',
        source: [],
        priority: 'High',
        fitCriterion: 'Outbound transaction persists to storage.',
        verificationMethod: 'Test',
        traceToStakeholders: ['STK-999'],
        traceToUseCases: ['UC-002']
      }
    ],
    nonFunctionalRequirements: [
      {
        id: 'NFR-001',
        category: 'Performance',
        statement: 'The system shall process 95% of requests under 2 seconds.',
        source: ['Architecture Decision Log'],
        priority: 'High',
        fitCriterion: 'p95 < 2000ms',
        verificationMethod: 'Performance Test'
      }
    ]
  };

  return validateSRS(example);
}

// Keep explicit reference so IDE inspections do not flag this exported helper as unused.
void runValidatorExample;





