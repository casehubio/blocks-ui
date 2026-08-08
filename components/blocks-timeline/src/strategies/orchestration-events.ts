import { html } from 'lit';
import type { TimelineNode, TimelineStrategy, NodeStatus } from '../types.js';
import type {
  OrchestrationAuditEvent, OrchestrationEventType, OrchestrationPayload,
} from '@casehubio/blocks-ui-core';

const FILTER_MAP: Record<OrchestrationEventType, string> = {
  ROUTING_DECISION: 'routing',
  ACTIVATION_EVALUATED: 'activation',
  AGENT_DISPATCHED: 'dispatch',
  AGENT_RESULT: 'dispatch',
  AGENT_FAILED: 'dispatch',
  AGGREGATION_COMPLETED: 'aggregation',
  TERMINATION_EVALUATED: 'termination',
  EXECUTION_STARTED: 'termination',
  EXECUTION_COMPLETED: 'termination',
};

export function orchestrationFilterCategory(eventType: OrchestrationEventType): string {
  return FILTER_MAP[eventType] ?? 'termination';
}

function nodeLabel(payload: OrchestrationPayload): string {
  switch (payload.type) {
    case 'EXECUTION_STARTED': return 'Execution started';
    case 'ROUTING_DECISION': return `Routing: ${payload.outcome}`;
    case 'ACTIVATION_EVALUATED': return `Activation: ${payload.conditionMet ? 'met' : 'unmet'}`;
    case 'AGENT_DISPATCHED': return `Dispatched: ${payload.agentRef.name ?? payload.agentRef.id}`;
    case 'AGENT_RESULT': return `Result: ${payload.agentRef.name ?? payload.agentRef.id}`;
    case 'AGENT_FAILED': return `Failed: ${payload.agentRef.name ?? payload.agentRef.id}`;
    case 'AGGREGATION_COMPLETED': return `Aggregation: ${payload.outcome}`;
    case 'TERMINATION_EVALUATED': return `Termination: ${payload.outcome}`;
    case 'EXECUTION_COMPLETED': return 'Execution completed';
  }
}

function nodeStatus(payload: OrchestrationPayload): NodeStatus {
  switch (payload.type) {
    case 'EXECUTION_STARTED': return 'active';
    case 'ROUTING_DECISION':
      return payload.outcome === 'SELECTED' ? 'completed' : 'failed';
    case 'ACTIVATION_EVALUATED':
      return payload.conditionMet ? 'completed' : 'skipped';
    case 'AGENT_DISPATCHED': return 'active';
    case 'AGENT_RESULT': return 'completed';
    case 'AGENT_FAILED': return 'failed';
    case 'AGGREGATION_COMPLETED':
      if (payload.outcome === 'RESOLVED') return 'completed';
      if (payload.outcome === 'PARTIAL') return 'active';
      return 'failed';
    case 'TERMINATION_EVALUATED':
      if (payload.outcome === 'COMPLETE') return 'completed';
      if (payload.outcome === 'CONTINUE') return 'active';
      return 'failed';
    case 'EXECUTION_COMPLETED':
      return payload.result === 'COMPLETED' ? 'completed' : 'failed';
  }
}

function toNode(event: OrchestrationAuditEvent): TimelineNode {
  const filterCat = orchestrationFilterCategory(event.eventType);
  return {
    key: event.id,
    label: nodeLabel(event.payload),
    status: nodeStatus(event.payload),
    timestamp: event.timestamp,
    detail: event.payload,
    category: event.iteration != null ? `iteration-${event.iteration}` : filterCat,
  };
}

function renderDetail(node: TimelineNode) {
  const payload = node.detail as OrchestrationPayload;
  if (!payload) return html``;

  switch (payload.type) {
    case 'EXECUTION_STARTED':
      return html`<div style="font-size: 12px; color: var(--pages-neutral-11, #333);">Pattern: ${payload.model.pattern} | Routing failure: ${payload.model.failurePolicy.routingFailureAction} | Aggregation failure: ${payload.model.failurePolicy.aggregationFailureAction}</div>`;
    case 'ROUTING_DECISION': {
      const agents = payload.selectedAgents ?? [];
      return html`
        <div style="font-size: 12px; color: var(--pages-neutral-11, #333);">
          ${agents.length > 0 ? html`<div>Selected: ${agents.map(a => html`<span style="display: inline-block; padding: 2px 6px; border-radius: 3px; font-size: 11px; font-weight: 500; background: var(--pages-accent-3, #dbeafe); color: var(--pages-accent-11, #1e40af); margin-right: 4px;">${a.name ?? a.id} [${a.type}]</span>`)}</div>` : ''}
          ${payload.reason ? html`<div style="margin-top: 4px; font-style: italic; color: var(--pages-neutral-9, #888);">${payload.reason}</div>` : ''}
        </div>`;
    }
    case 'ACTIVATION_EVALUATED':
      return html`<div style="font-size: 12px; color: var(--pages-neutral-11, #333);">${payload.conditionExpression ? html`Condition: <code style="font-family: var(--pages-font-mono, monospace); font-size: 11px; background: var(--pages-neutral-2, #f5f5f5); padding: 1px 4px; border-radius: 2px;">${payload.conditionExpression}</code>` : ''}</div>`;
    case 'AGENT_DISPATCHED':
      return html`<div style="font-size: 12px; color: var(--pages-neutral-11, #333);"><span style="display: inline-block; padding: 2px 6px; border-radius: 3px; font-size: 11px; font-weight: 500; background: var(--pages-neutral-3, #e5e5e5); color: var(--pages-neutral-11, #333);">${payload.agentRef.type}</span> ${payload.agentRef.name ?? payload.agentRef.id}</div>`;
    case 'AGENT_RESULT':
    case 'AGENT_FAILED':
      return html`<div style="font-size: 12px; color: var(--pages-neutral-11, #333);">Status: ${payload.status}${payload.duration != null ? html` | Duration: ${payload.duration}ms` : ''}${payload.error ? html` | Error: ${payload.error}` : ''}${payload.detail ? html` | ${payload.detail}` : ''}</div>`;
    case 'AGGREGATION_COMPLETED':
      return html`<div style="font-size: 12px; color: var(--pages-neutral-11, #333);">Outcome: ${payload.outcome}${payload.remainingCount != null ? html` | Remaining: ${payload.remainingCount}` : ''}</div>`;
    case 'TERMINATION_EVALUATED':
      return html`<div style="font-size: 12px; color: var(--pages-neutral-11, #333);">Decision: ${payload.outcome}${payload.reason ? html` | ${payload.reason}` : ''}</div>`;
    case 'EXECUTION_COMPLETED':
      return html`<div style="font-size: 12px; color: var(--pages-neutral-11, #333);">Result: ${payload.result}${payload.reason ? html` | ${payload.reason}` : ''}</div>`;
  }
}

export const orchestrationEventsStrategy: TimelineStrategy<OrchestrationAuditEvent[]> = {
  toNodes(data: OrchestrationAuditEvent[]): TimelineNode[] {
    return data.map(toNode);
  },
  defaultLayout: 'vertical',
  renderDetail,
  filterCategories: ['routing', 'activation', 'dispatch', 'aggregation', 'termination'],
  supportsPagination: true,
};
