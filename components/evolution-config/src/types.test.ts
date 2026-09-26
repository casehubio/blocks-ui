import { describe, it, expect } from 'vitest';
import type {
  GateMode, GateOutcome, InboxEntryStatus, ConductorInboxEntry,
  EvolutionStateSnapshot, DenyPatternView, WatchPattern,
  StageDescriptor, CategoryDescriptor,
} from './types.js';

describe('types', () => {
  it('GateMode accepts all three values', () => {
    const modes: GateMode[] = ['GATED', 'AUTO', 'NOTIFY'];
    expect(modes).toHaveLength(3);
  });

  it('GateOutcome is APPROVED or REJECTED only', () => {
    const outcomes: GateOutcome[] = ['APPROVED', 'REJECTED'];
    expect(outcomes).toHaveLength(2);
  });

  it('InboxEntryStatus has all 6 engine values', () => {
    const statuses: InboxEntryStatus[] = [
      'PENDING', 'APPROVED', 'REJECTED', 'REDIRECTED', 'TIMED_OUT', 'AUTO_APPROVED',
    ];
    expect(statuses).toHaveLength(6);
  });

  it('ConductorInboxEntry has all 14 fields', () => {
    const entry: ConductorInboxEntry = {
      caseId: '00000000-0000-0000-0000-000000000001',
      id: 'entry-1', stage: 'pr-review', status: 'PENDING',
      category: 'lint-fix', areaId: null, improvementCaseId: null,
      summary: 'Fix lint violations in auth module',
      escalationTriggers: [{ layer: 'CONFIDENCE_SCORE', reason: 'High confidence' }],
      confidence: 0.85, queuedAt: '2026-09-26T10:00:00Z',
      resolvedAt: null, timeoutMinutes: 1440, decision: null,
    };
    expect(Object.keys(entry)).toHaveLength(14);
  });

  it('EvolutionStateSnapshot has all required fields', () => {
    const snapshot: EvolutionStateSnapshot = {
      caseId: '00000000-0000-0000-0000-000000000001',
      timestamp: '2026-09-26T10:00:00Z', healthScore: 0.82,
      componentScores: { 'test-coverage': 0.7, 'ci-stability': 0.9 },
      healthDelta: 0.03, healthWindowMinutes: 60,
      circuitBreakerState: 'CLOSED',
      categoryStates: {},
      projectComplianceLevel: 'BASIC',
      complianceEvaluatedAt: null,
      areaComplianceLevels: {},
      activeImprovementCount: 2, dailyImprovementCount: 5,
      evolutionEnabled: true, pendingInboxCount: 1,
    };
    expect(snapshot.healthScore).toBe(0.82);
    expect(snapshot.circuitBreakerState).toBe('CLOSED');
  });

  it('DenyPatternView has static and dynamic sections', () => {
    const view: DenyPatternView = {
      staticPatterns: ['EvolutionTicker', 'ImprovementBudgetEnforcer'],
      dynamicPatterns: [
        { pattern: 'AuthController', addedBy: 'admin', addedAt: '2026-09-25T12:00:00Z' },
      ],
    };
    expect(view.staticPatterns).toHaveLength(2);
    expect(view.dynamicPatterns).toHaveLength(1);
  });

  it('WatchPattern has all nullable fields', () => {
    const pattern: WatchPattern = {
      id: 'wp-1', category: null, areaId: null,
      targetPattern: '*.java', minEstimatedSize: null,
      createdAt: '2026-09-26T10:00:00Z',
    };
    expect(pattern.targetPattern).toBe('*.java');
    expect(pattern.category).toBeNull();
  });

  it('StageDescriptor includes gate checkpoint flag', () => {
    const stage: StageDescriptor = {
      id: 'pr-review', name: 'PR Review', ordinal: 8,
      gateCheckpoint: true, domainId: 'code-evolution',
    };
    expect(stage.gateCheckpoint).toBe(true);
  });

  it('CategoryDescriptor includes domain scope', () => {
    const cat: CategoryDescriptor = {
      id: 'dependency-update', name: 'Dependency Update',
      description: 'Bump outdated dependencies', domainId: 'code-evolution',
    };
    expect(cat.domainId).toBe('code-evolution');
  });
});
