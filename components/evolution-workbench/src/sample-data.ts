import type {
  EvolutionStateSnapshot, ImprovementStreamView, ConductorInboxEntry,
  DenyPatternView, WatchPattern, StageDescriptor, CategoryDescriptor,
  GatePolicy,
} from '@casehubio/blocks-ui-evolution-config';

export const sampleState: EvolutionStateSnapshot = {
  caseId: '550e8400-e29b-41d4-a716-446655440000',
  timestamp: '2026-09-26T10:00:00Z',
  healthScore: 0.82,
  componentScores: {
    'test-coverage': 0.70,
    'ci-stability': 0.95,
    'dependency-freshness': 0.78,
    'lint-compliance': 0.88,
    'documentation': 0.80,
  },
  healthDelta: 0.03,
  healthWindowMinutes: 60,
  circuitBreakerState: 'CLOSED',
  categoryStates: {
    'dependency-update': { successCount: 12, failureCount: 1, rejectionCount: 0, paused: false, pausedUntil: null, suppressed: false },
    'lint-fix': { successCount: 8, failureCount: 0, rejectionCount: 2, paused: false, pausedUntil: null, suppressed: false },
    'coverage-gap': { successCount: 3, failureCount: 1, rejectionCount: 0, paused: true, pausedUntil: '2026-09-27T10:00:00Z', suppressed: false },
  },
  projectComplianceLevel: 'STANDARD',
  complianceEvaluatedAt: '2026-09-26T08:00:00Z',
  areaComplianceLevels: {
    'test-coverage': 'BASIC',
    'ci-stability': 'STANDARD',
    'dependency-freshness': 'BASIC',
    'lint-compliance': 'STANDARD',
    'documentation': 'BASIC',
  },
  activeImprovementCount: 2,
  dailyImprovementCount: 5,
  evolutionEnabled: true,
  pendingInboxCount: 1,
};

export const sampleStreams: ImprovementStreamView[] = [
  {
    improvementCaseId: '660e8400-0001-0000-0000-000000000001',
    category: 'dependency-update',
    target: 'quarkus-core',
    currentStage: 'implement',
    blockedBy: null,
    conflictBlocked: false,
    startedAt: '2026-09-26T06:00:00Z',
  },
  {
    improvementCaseId: '660e8400-0001-0000-0000-000000000002',
    category: 'lint-fix',
    target: 'auth-module',
    currentStage: 'pr-review',
    blockedBy: null,
    conflictBlocked: false,
    startedAt: '2026-09-26T07:00:00Z',
  },
  {
    improvementCaseId: '660e8400-0001-0000-0000-000000000003',
    category: 'coverage-gap',
    target: 'payment-service',
    currentStage: 'hypothesis-approval',
    blockedBy: '660e8400-0001-0000-0000-000000000001',
    conflictBlocked: true,
    startedAt: '2026-09-26T08:00:00Z',
  },
];

export const sampleInbox: ConductorInboxEntry[] = [
  {
    caseId: '550e8400-e29b-41d4-a716-446655440000',
    id: 'inbox-001', stage: 'pr-review', status: 'PENDING',
    category: 'lint-fix', areaId: 'lint-compliance',
    improvementCaseId: '660e8400-0001-0000-0000-000000000002',
    summary: 'Fix 12 lint violations in auth module — mostly unused imports and formatting',
    escalationTriggers: [{ layer: 'CONFIDENCE_SCORE', reason: 'High confidence (0.92)' }],
    confidence: 0.92, queuedAt: '2026-09-26T09:30:00Z',
    resolvedAt: null, timeoutMinutes: 1440, decision: null,
  },
  {
    caseId: '550e8400-e29b-41d4-a716-446655440000',
    id: 'inbox-002', stage: 'hypothesis-approval', status: 'APPROVED',
    category: 'dependency-update', areaId: 'dependency-freshness',
    improvementCaseId: '660e8400-0001-0000-0000-000000000001',
    summary: 'Upgrade quarkus-core from 3.35 to 3.36 — changelog reviewed, no breaking changes',
    escalationTriggers: [],
    confidence: 0.88, queuedAt: '2026-09-26T06:15:00Z',
    resolvedAt: '2026-09-26T06:20:00Z', timeoutMinutes: 720,
    decision: { outcome: 'APPROVED', reason: 'Changelog clean', feedback: null },
  },
  {
    caseId: '550e8400-e29b-41d4-a716-446655440000',
    id: 'inbox-003', stage: 'research-scope', status: 'TIMED_OUT',
    category: 'coverage-gap', areaId: 'test-coverage',
    improvementCaseId: null, summary: 'Research scope for payment-service test gaps',
    escalationTriggers: [{ layer: 'WATCH_PATTERN', reason: 'Matched pattern: payment-*' }],
    confidence: 0.45, queuedAt: '2026-09-25T10:00:00Z',
    resolvedAt: '2026-09-26T10:00:00Z', timeoutMinutes: 1440,
    decision: null,
  },
  {
    caseId: '550e8400-e29b-41d4-a716-446655440000',
    id: 'inbox-004', stage: 'implement', status: 'AUTO_APPROVED',
    category: 'lint-fix', areaId: null,
    improvementCaseId: '660e8400-0001-0000-0000-000000000004',
    summary: 'Auto-fix formatting in utility classes',
    escalationTriggers: [],
    confidence: 0.99, queuedAt: '2026-09-26T05:00:00Z',
    resolvedAt: '2026-09-26T05:00:00Z', timeoutMinutes: null,
    decision: { outcome: 'AUTO_APPROVED', reason: null, feedback: null },
  },
];

export const sampleDenyPatterns: DenyPatternView = {
  staticPatterns: [
    'ImprovementBudgetEnforcer', 'EvolutionTicker',
    'ImprovementCircuitBreaker', 'RegressionDetector',
    'ConfidenceScorer', 'HealthScoreTracker',
  ],
  dynamicPatterns: [
    { pattern: 'AuthController', addedBy: 'admin', addedAt: '2026-09-20T14:00:00Z' },
    { pattern: 'PaymentGateway', addedBy: 'ops-team', addedAt: '2026-09-22T09:00:00Z' },
  ],
};

export const sampleWatchPatterns: WatchPattern[] = [
  { id: 'wp-001', category: 'lint-fix', areaId: null, targetPattern: null, minEstimatedSize: null, createdAt: '2026-09-20T10:00:00Z' },
  { id: 'wp-002', category: null, areaId: 'test-coverage', targetPattern: 'payment-*', minEstimatedSize: 50, createdAt: '2026-09-21T11:00:00Z' },
  { id: 'wp-003', category: 'dependency-update', areaId: null, targetPattern: null, minEstimatedSize: 100, createdAt: '2026-09-22T12:00:00Z' },
];

export const sampleStages: StageDescriptor[] = [
  { id: 'introspect', name: 'Introspect', ordinal: 0, gateCheckpoint: false, domainId: 'code-evolution' },
  { id: 'research-scope', name: 'Research Scope', ordinal: 1, gateCheckpoint: true, domainId: 'code-evolution' },
  { id: 'search', name: 'Search', ordinal: 2, gateCheckpoint: false, domainId: 'code-evolution' },
  { id: 'analyze', name: 'Analyze', ordinal: 3, gateCheckpoint: false, domainId: 'code-evolution' },
  { id: 'hypothesis-approval', name: 'Hypothesis Approval', ordinal: 4, gateCheckpoint: true, domainId: 'code-evolution' },
  { id: 'implementation-plan', name: 'Implementation Plan', ordinal: 5, gateCheckpoint: true, domainId: 'code-evolution' },
  { id: 'implement', name: 'Implement', ordinal: 6, gateCheckpoint: false, domainId: 'code-evolution' },
  { id: 'submit-pr', name: 'Submit PR', ordinal: 7, gateCheckpoint: false, domainId: 'code-evolution' },
  { id: 'pr-review', name: 'PR Review', ordinal: 8, gateCheckpoint: true, domainId: 'code-evolution' },
  { id: 'integrate', name: 'Integrate', ordinal: 9, gateCheckpoint: false, domainId: 'code-evolution' },
  { id: 'outcome-recording', name: 'Outcome Recording', ordinal: 10, gateCheckpoint: false, domainId: 'code-evolution' },
];

export const sampleCategories: CategoryDescriptor[] = [
  { id: 'dependency-update', name: 'Dependency Update', description: 'Bump outdated dependencies', domainId: 'code-evolution' },
  { id: 'lint-fix', name: 'Lint Fix', description: 'Fix linting and style violations', domainId: 'code-evolution' },
  { id: 'coverage-gap', name: 'Coverage Gap', description: 'Add tests for uncovered code', domainId: 'code-evolution' },
  { id: 'ci-triage', name: 'CI Triage', description: 'Fix CI pipeline failures', domainId: 'code-evolution' },
  { id: 'recipe', name: 'Recipe', description: 'Apply automated code transformation recipes', domainId: 'code-evolution' },
];

export const sampleGatePolicy: GatePolicy = {
  modes: {
    'research-scope': 'AUTO',
    'hypothesis-approval': 'NOTIFY',
    'implementation-plan': 'AUTO',
    'pr-review': 'GATED',
  },
  gateTimeoutMinutes: 720,
};
