import { describe, it, expect, vi, afterEach } from 'vitest';
import type { ConductorInboxEntry } from './types.js';
import './evolution-inbox.js';
import type { EvolutionInbox } from './evolution-inbox.js';

function createElement(inbox?: ConductorInboxEntry[]): EvolutionInbox {
  const el = document.createElement('blocks-evolution-inbox') as EvolutionInbox;
  if (inbox) el.inbox = inbox;
  document.body.appendChild(el);
  return el;
}

const SAMPLE_INBOX: ConductorInboxEntry[] = [
  {
    caseId: '550e8400-e29b-41d4-a716-446655440000',
    id: 'inbox-001', stage: 'pr-review', status: 'PENDING',
    category: 'lint-fix', areaId: 'lint-compliance',
    improvementCaseId: '660e8400-0001-0000-0000-000000000002',
    summary: 'Fix 12 lint violations in auth module',
    escalationTriggers: [{ layer: 'CONFIDENCE_SCORE', reason: 'High confidence (0.92)' }],
    confidence: 0.92, queuedAt: '2026-09-26T09:30:00Z',
    resolvedAt: null, timeoutMinutes: 1440, decision: null,
  },
  {
    caseId: '550e8400-e29b-41d4-a716-446655440000',
    id: 'inbox-002', stage: 'hypothesis-approval', status: 'APPROVED',
    category: 'dependency-update', areaId: 'dependency-freshness',
    improvementCaseId: '660e8400-0001-0000-0000-000000000001',
    summary: 'Upgrade quarkus-core from 3.35 to 3.36',
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
];

describe('blocks-evolution-inbox', () => {
  afterEach(() => {
    document.body.querySelectorAll('blocks-evolution-inbox').forEach(el => el.remove());
  });

  it('has correct ARIA attributes', async () => {
    const el = createElement(SAMPLE_INBOX);
    await el.updateComplete;
    expect(el.getAttribute('role')).toBe('region');
    expect(el.getAttribute('aria-label')).toBe('Conductor inbox');
  });

  it('renders pages-table with inbox data', async () => {
    const el = createElement(SAMPLE_INBOX);
    await el.updateComplete;
    const table = el.shadowRoot!.querySelector('pages-table');
    expect(table).not.toBeNull();
  });

  it('shows empty state when no entries', async () => {
    const el = createElement([]);
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).toContain('No inbox entries');
  });

  it('hides actions in readonly mode', async () => {
    const el = createElement(SAMPLE_INBOX);
    el.readonly = true;
    await el.updateComplete;
    const table = el.shadowRoot!.querySelector('pages-table');
    expect(table).not.toBeNull();
  });

  it('sets aria-busy during loading', async () => {
    const el = createElement();
    (el as any)._loading = true;
    await el.updateComplete;
    expect(el.getAttribute('aria-busy')).toBe('true');
  });

  it('shows error state', async () => {
    const el = createElement();
    (el as any)._error = 'Network error';
    await el.updateComplete;
    const error = el.shadowRoot!.querySelector('.error');
    expect(error).not.toBeNull();
    expect(error!.textContent).toContain('Network error');
  });
});
