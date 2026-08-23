import { describe, it, expect } from 'vitest';
import { orchestrationEventsStrategy, orchestrationFilterCategory } from './orchestration-events.js';
import type { OrchestrationAuditEvent } from '@casehubio/blocks-ui-core';

function makeEvent(
  eventType: OrchestrationAuditEvent['eventType'],
  payload: OrchestrationAuditEvent['payload'],
  overrides?: Partial<OrchestrationAuditEvent>,
): OrchestrationAuditEvent {
  return {
    id: `e-${eventType}`,
    eventType,
    executionId: 'exec1',
    timestamp: '2026-01-01T00:00:00Z',
    payload,
    ...overrides,
  };
}

describe('orchestrationEventsStrategy', () => {
  it('has defaultLayout vertical', () => {
    expect(orchestrationEventsStrategy.defaultLayout).toBe('vertical');
  });

  it('supports pagination', () => {
    expect(orchestrationEventsStrategy.supportsPagination).toBe(true);
  });

  it('has transformData defined', () => {
    expect(orchestrationEventsStrategy.transformData).toBeDefined();
  });

  it('transformData extracts .content from paged response', () => {
    const paged = {
      content: [
        makeEvent('EXECUTION_STARTED', { type: 'EXECUTION_STARTED', model: {
          pattern: 'PARALLEL', failurePolicy: { routingFailureAction: 'FAIL', aggregationFailureAction: 'FAIL' },
        }}),
      ],
      page: 0, size: 20, totalElements: 1, totalPages: 1,
    };
    const result = orchestrationEventsStrategy.transformData!(paged);
    expect(result).toHaveLength(1);
    expect(result).toBe(paged.content);
  });

  it('transformData passes through plain array', () => {
    const events = [
      makeEvent('EXECUTION_STARTED', { type: 'EXECUTION_STARTED', model: {
        pattern: 'PARALLEL', failurePolicy: { routingFailureAction: 'FAIL', aggregationFailureAction: 'FAIL' },
      }}),
    ];
    const result = orchestrationEventsStrategy.transformData!(events);
    expect(result).toBe(events);
  });

  it('maps EXECUTION_STARTED to active node', () => {
    const events: OrchestrationAuditEvent[] = [
      makeEvent('EXECUTION_STARTED', { type: 'EXECUTION_STARTED', model: {
        pattern: 'PARALLEL', failurePolicy: { routingFailureAction: 'FAIL', aggregationFailureAction: 'FAIL' },
      }}),
    ];
    const nodes = orchestrationEventsStrategy.toNodes(events);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].status).toBe('active');
    expect(nodes[0].label).toContain('Execution started');
  });

  it('maps ROUTING_DECISION SELECTED to completed', () => {
    const events: OrchestrationAuditEvent[] = [
      makeEvent('ROUTING_DECISION', {
        type: 'ROUTING_DECISION', outcome: 'SELECTED',
        selectedAgents: [{ id: 'w1', type: 'WORKER', name: 'worker-1' }],
        reason: 'highest score',
      }),
    ];
    const nodes = orchestrationEventsStrategy.toNodes(events);
    expect(nodes[0].status).toBe('completed');
    expect(nodes[0].label).toContain('SELECTED');
  });

  it('maps ROUTING_DECISION UNRESOLVABLE to failed', () => {
    const events: OrchestrationAuditEvent[] = [
      makeEvent('ROUTING_DECISION', {
        type: 'ROUTING_DECISION', outcome: 'UNRESOLVABLE', reason: 'no candidates',
      }),
    ];
    const nodes = orchestrationEventsStrategy.toNodes(events);
    expect(nodes[0].status).toBe('failed');
  });

  it('maps AGENT_DISPATCHED to active', () => {
    const events: OrchestrationAuditEvent[] = [
      makeEvent('AGENT_DISPATCHED', {
        type: 'AGENT_DISPATCHED', agentRef: { id: 'w1', type: 'WORKER', name: 'worker-1' },
      }),
    ];
    const nodes = orchestrationEventsStrategy.toNodes(events);
    expect(nodes[0].status).toBe('active');
    expect(nodes[0].label).toContain('worker-1');
  });

  it('maps AGENT_RESULT to completed', () => {
    const events: OrchestrationAuditEvent[] = [
      makeEvent('AGENT_RESULT', {
        type: 'AGENT_RESULT', agentRef: { id: 'w1', type: 'WORKER', name: 'worker-1' },
        status: 'SUCCESS', duration: 1200,
      }),
    ];
    const nodes = orchestrationEventsStrategy.toNodes(events);
    expect(nodes[0].status).toBe('completed');
  });

  it('maps AGENT_FAILED to failed', () => {
    const events: OrchestrationAuditEvent[] = [
      makeEvent('AGENT_FAILED', {
        type: 'AGENT_FAILED', agentRef: { id: 'w1', type: 'WORKER' },
        status: 'FAILURE', error: 'timeout',
      }),
    ];
    const nodes = orchestrationEventsStrategy.toNodes(events);
    expect(nodes[0].status).toBe('failed');
  });

  it('maps ACTIVATION_EVALUATED met to completed', () => {
    const events: OrchestrationAuditEvent[] = [
      makeEvent('ACTIVATION_EVALUATED', {
        type: 'ACTIVATION_EVALUATED', conditionMet: true, conditionExpression: 'x > 0',
      }),
    ];
    const nodes = orchestrationEventsStrategy.toNodes(events);
    expect(nodes[0].status).toBe('completed');
    expect(nodes[0].label).toContain('met');
  });

  it('maps ACTIVATION_EVALUATED unmet to skipped', () => {
    const events: OrchestrationAuditEvent[] = [
      makeEvent('ACTIVATION_EVALUATED', {
        type: 'ACTIVATION_EVALUATED', conditionMet: false,
      }),
    ];
    const nodes = orchestrationEventsStrategy.toNodes(events);
    expect(nodes[0].status).toBe('skipped');
  });

  it('maps AGGREGATION_COMPLETED RESOLVED to completed', () => {
    const events: OrchestrationAuditEvent[] = [
      makeEvent('AGGREGATION_COMPLETED', {
        type: 'AGGREGATION_COMPLETED', outcome: 'RESOLVED',
      }),
    ];
    const nodes = orchestrationEventsStrategy.toNodes(events);
    expect(nodes[0].status).toBe('completed');
  });

  it('maps AGGREGATION_COMPLETED DEADLOCKED to failed', () => {
    const events: OrchestrationAuditEvent[] = [
      makeEvent('AGGREGATION_COMPLETED', {
        type: 'AGGREGATION_COMPLETED', outcome: 'DEADLOCKED',
      }),
    ];
    const nodes = orchestrationEventsStrategy.toNodes(events);
    expect(nodes[0].status).toBe('failed');
  });

  it('maps TERMINATION_EVALUATED COMPLETE to completed', () => {
    const events: OrchestrationAuditEvent[] = [
      makeEvent('TERMINATION_EVALUATED', {
        type: 'TERMINATION_EVALUATED', outcome: 'COMPLETE',
      }),
    ];
    const nodes = orchestrationEventsStrategy.toNodes(events);
    expect(nodes[0].status).toBe('completed');
  });

  it('maps EXECUTION_COMPLETED with COMPLETED result to completed', () => {
    const events: OrchestrationAuditEvent[] = [
      makeEvent('EXECUTION_COMPLETED', {
        type: 'EXECUTION_COMPLETED', result: 'COMPLETED',
      }),
    ];
    const nodes = orchestrationEventsStrategy.toNodes(events);
    expect(nodes[0].status).toBe('completed');
  });

  it('maps EXECUTION_COMPLETED with FAILED result to failed', () => {
    const events: OrchestrationAuditEvent[] = [
      makeEvent('EXECUTION_COMPLETED', {
        type: 'EXECUTION_COMPLETED', result: 'FAILED', reason: 'deadlock',
      }),
    ];
    const nodes = orchestrationEventsStrategy.toNodes(events);
    expect(nodes[0].status).toBe('failed');
  });

  it('sets iteration category when iteration is present', () => {
    const events: OrchestrationAuditEvent[] = [
      makeEvent('ROUTING_DECISION', {
        type: 'ROUTING_DECISION', outcome: 'SELECTED',
      }, { iteration: 2 }),
    ];
    const nodes = orchestrationEventsStrategy.toNodes(events);
    expect(nodes[0].category).toBe('iteration-2');
  });

  it('sets category from filter mapping when no iteration', () => {
    const events: OrchestrationAuditEvent[] = [
      makeEvent('AGGREGATION_COMPLETED', {
        type: 'AGGREGATION_COMPLETED', outcome: 'RESOLVED',
      }),
    ];
    const nodes = orchestrationEventsStrategy.toNodes(events);
    expect(nodes[0].category).toBe('aggregation');
  });
});

describe('orchestrationFilterCategory', () => {
  it('maps ROUTING_DECISION to routing', () => {
    expect(orchestrationFilterCategory('ROUTING_DECISION')).toBe('routing');
  });

  it('maps AGENT_DISPATCHED to dispatch', () => {
    expect(orchestrationFilterCategory('AGENT_DISPATCHED')).toBe('dispatch');
  });

  it('maps AGENT_RESULT to dispatch', () => {
    expect(orchestrationFilterCategory('AGENT_RESULT')).toBe('dispatch');
  });

  it('maps AGGREGATION_COMPLETED to aggregation', () => {
    expect(orchestrationFilterCategory('AGGREGATION_COMPLETED')).toBe('aggregation');
  });

  it('maps EXECUTION_STARTED to termination', () => {
    expect(orchestrationFilterCategory('EXECUTION_STARTED')).toBe('termination');
  });
});
