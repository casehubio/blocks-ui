import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockState } from './mock-state.js';
import type { WorkItemResponse, QueueView } from '@casehubio/blocks-ui-core';

const mockItems: WorkItemResponse[] = [
  {
    id: 'wi-001', title: 'Test item 1', status: 'PENDING', priority: 'HIGH',
    assigneeId: null, candidateGroups: 'compliance', createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(), version: 1, labels: [{ name: 'domain', value: 'aml' }],
    description: null, types: ['compliance'], category: 'compliance', formKey: null, owner: null,
    candidateUsers: null, requiredCapabilities: null, createdBy: 'system',
    delegationDeclineTarget: null, delegationChain: null, priorStatus: null,
    payload: null, resolution: null, claimDeadline: null, expiresAt: null,
    followUpDate: null, assignedAt: null, startedAt: null, completedAt: null,
    suspendedAt: null, confidenceScore: null, callerRef: null, templateId: null,
    outcome: null, permittedOutcomes: null, inputDataSchema: null,
    outputDataSchema: null, excludedUsers: null, scope: null,
    percentComplete: null, statusNote: null,
  } as WorkItemResponse,
];

const mockQueues: QueueView[] = [
  { id: 'q-001', name: 'Compliance Review', labelPattern: 'domain=aml', scope: null },
];

describe('MockState', () => {
  let state: MockState;

  beforeEach(() => {
    state = new MockState(mockItems, mockQueues, [], [], []);
  });

  it('returns all items', () => {
    expect(state.getItems()).toHaveLength(1);
  });

  it('returns item by id', () => {
    expect(state.getItem('wi-001')?.title).toBe('Test item 1');
  });

  it('computes inbox summary', () => {
    const summary = state.getSummary();
    expect(summary.total).toBe(1);
    expect(summary.byStatus['PENDING']).toBe(1);
    expect(summary.byPriority['HIGH']).toBe(1);
  });

  it('matches queue items by label pattern', () => {
    const items = state.getQueueItems('q-001');
    expect(items).toHaveLength(1);
    expect(items[0]!.id).toBe('wi-001');
  });

  it('applies claim action and emits event', () => {
    const handler = vi.fn();
    state.onEvent(handler);
    state.applyAction('wi-001', 'claim', { actor: 'user-1' });
    expect(state.getItem('wi-001')?.status).toBe('ASSIGNED');
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'ASSIGNED', workItemId: 'wi-001' })
    );
  });

  it('applies complete action', () => {
    state.applyAction('wi-001', 'claim', { actor: 'user-1' });
    state.applyAction('wi-001', 'start', { actor: 'user-1' });
    state.applyAction('wi-001', 'complete', { actor: 'user-1', outcome: 'approved' });
    expect(state.getItem('wi-001')?.status).toBe('COMPLETED');
  });

  it('does not match queue items when label pattern does not match', () => {
    const items = state.getQueueItems('nonexistent-queue');
    expect(items).toHaveLength(0);
  });

  it('returns empty for queue with non-matching label pattern', () => {
    const stateWithMismatch = new MockState(
      mockItems,
      [{ id: 'q-wrong', name: 'Wrong', labelPattern: 'domain=clinical', scope: null }],
      [], [], [],
    );
    expect(stateWithMismatch.getQueueItems('q-wrong')).toHaveLength(0);
  });

  it('updates assigneeId on claim action', () => {
    state.applyAction('wi-001', 'claim', { actor: 'demo-user' });
    expect(state.getItem('wi-001')?.assigneeId).toBe('demo-user');
  });

  it('recomputes summary after state mutation', () => {
    state.applyAction('wi-001', 'claim', { actor: 'user-1' });
    const summary = state.getSummary();
    expect(summary.byStatus['ASSIGNED']).toBe(1);
    expect(summary.byStatus['PENDING']).toBeUndefined();
  });
});
