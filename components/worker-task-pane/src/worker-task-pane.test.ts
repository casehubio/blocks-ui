import { describe, it, expect, vi, afterEach } from 'vitest';
import { emitPagesEvent } from '@casehubio/pages-data';
import type { WorkerTaskResponse } from './types.js';
import './worker-task-pane.js';

const SEED_TASKS: WorkerTaskResponse[] = [
  {
    taskId: 'task-1',
    capabilityTag: 'entity-resolution',
    caseId: 'INV-003',
    dispatchedAt: '2026-09-01T09:00:00Z',
    commandParams: { entityIds: ['E-100', 'E-101'] },
    investigationSummary: { flagReason: 'Name match', riskScore: 0.82 },
  },
  {
    taskId: 'task-2',
    capabilityTag: 'pattern-analysis',
    caseId: 'INV-007',
    assigneeId: 'user-1',
    dispatchedAt: '2026-09-01T10:00:00Z',
    commandParams: { patternType: 'structuring' },
    investigationSummary: { flagReason: 'Threshold split', riskScore: 0.65 },
  },
  {
    taskId: 'task-3',
    capabilityTag: 'osint-screening',
    caseId: 'INV-012',
    dispatchedAt: '2026-09-01T11:00:00Z',
    commandParams: { screeningType: 'pep' },
    investigationSummary: { flagReason: 'PEP match', riskScore: 0.91 },
  },
];

function createElement(data: WorkerTaskResponse[] = SEED_TASKS) {
  const el = document.createElement('blocks-worker-task-pane') as any;
  el.data = data;
  el.selectionTopic = 'test-worker';
  document.body.appendChild(el);
  return el;
}

describe('blocks-worker-task-pane', () => {
  let el: any;

  afterEach(() => {
    el?.remove();
  });

  it('renders with role="region" and aria-label', async () => {
    el = createElement();
    await el.updateComplete;
    expect(el.getAttribute('role')).toBe('region');
    expect(el.getAttribute('aria-label')).toBe('Worker task pane');
  });

  it('renders list-pane with derived dataset from inline data', async () => {
    el = createElement();
    await el.updateComplete;
    const listPane = el.shadowRoot!.querySelector('blocks-list-pane');
    expect(listPane).toBeTruthy();
    expect(listPane!.dataSet).toBeTruthy();
    expect(listPane!.dataSet!.rows.length).toBe(3);
  });

  it('renders split-workbench in split layout mode', async () => {
    el = createElement();
    await el.updateComplete;
    const workbench = el.shadowRoot!.querySelector('pages-split-workbench');
    expect(workbench).toBeTruthy();
  });

  it('renders vertical flex in stacked layout mode', async () => {
    el = createElement();
    el.layout = 'stacked';
    await el.updateComplete;
    const workbench = el.shadowRoot!.querySelector('pages-split-workbench');
    expect(workbench).toBeNull();
    const stacked = el.shadowRoot!.querySelector('.stacked-layout');
    expect(stacked).toBeTruthy();
  });

  it('shows empty detail message when no selection', async () => {
    el = createElement();
    await el.updateComplete;
    const empty = el.shadowRoot!.querySelector('.empty-detail');
    expect(empty).toBeTruthy();
  });

  it('fetches from endpoint when set', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(SEED_TASKS),
    });
    vi.stubGlobal('fetch', mockFetch);

    el = document.createElement('blocks-worker-task-pane') as any;
    el.endpoint = '/api/worker-tasks';
    el.selectionTopic = 'test-worker';
    document.body.appendChild(el);
    await el.updateComplete;
    await vi.waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/worker-tasks');
    });

    vi.unstubAllGlobals();
  });

  it('selects item and shows detail column', async () => {
    el = createElement();
    await el.updateComplete;

    emitPagesEvent(document, 'test-worker:selected', { taskId: 'task-1' });
    await el.updateComplete;

    const detail = el.shadowRoot!.querySelector('.detail-column');
    expect(detail).toBeTruthy();
    const responseSection = el.shadowRoot!.querySelector('[role="form"]');
    expect(responseSection).toBeTruthy();
  });

  it('filters tasks by identity groups', async () => {
    el = createElement();
    el.identity = { userId: 'user-1', displayName: 'Test', groups: ['entity-resolution'] };
    await el.updateComplete;

    const listPane = el.shadowRoot!.querySelector('blocks-list-pane');
    // Only task-1 matches entity-resolution group; task-2 has assigneeId=user-1 but wrong capability
    expect(listPane!.dataSet!.rows.length).toBe(1);
  });

  it('shows claim button when claimEndpoint set and task not claimed', async () => {
    el = createElement();
    el.claimEndpoint = '/api/claim';
    el.identity = { userId: 'user-1', displayName: 'Test', groups: [] };
    await el.updateComplete;

    emitPagesEvent(document, 'test-worker:selected', { taskId: 'task-1' });
    await el.updateComplete;

    const claimBtn = el.shadowRoot!.querySelector('[data-action="claim"]');
    expect(claimBtn).toBeTruthy();
    const submitBtn = el.shadowRoot!.querySelector('[data-action="submit"]');
    expect(submitBtn).toBeNull();
  });

  it('skips claim when task is pre-assigned to current user', async () => {
    el = createElement();
    el.claimEndpoint = '/api/claim';
    el.identity = { userId: 'user-1', displayName: 'Test', groups: [] };
    await el.updateComplete;

    emitPagesEvent(document, 'test-worker:selected', { taskId: 'task-2' });
    await el.updateComplete;

    const claimBtn = el.shadowRoot!.querySelector('[data-action="claim"]');
    expect(claimBtn).toBeNull();
    const submitBtn = el.shadowRoot!.querySelector('[data-action="submit"]');
    expect(submitBtn).toBeTruthy();
  });

  it('dispatches worker-task:responded event on submit', async () => {
    el = createElement();
    await el.updateComplete;

    emitPagesEvent(document, 'test-worker:selected', { taskId: 'task-1' });
    await el.updateComplete;

    (el as any)._workspaceResult = { fields: { risk: 'low' }, confidence: 0.9 };
    await el.updateComplete;

    const handler = vi.fn();
    el.addEventListener('worker-task:responded', handler);

    const submitBtn = el.shadowRoot!.querySelector('[data-action="submit"]') as HTMLButtonElement;
    submitBtn.click();
    await el.updateComplete;

    expect(handler).toHaveBeenCalledOnce();
    const detail = handler.mock.calls[0][0].detail;
    expect(detail.type).toBe('RESPONSE');
    expect(detail.taskId).toBe('task-1');
    expect(detail.result.confidence).toBe(0.9);
  });

  it('submit button disabled when no workspace result', async () => {
    el = createElement();
    await el.updateComplete;

    emitPagesEvent(document, 'test-worker:selected', { taskId: 'task-1' });
    await el.updateComplete;

    const submitBtn = el.shadowRoot!.querySelector('[data-action="submit"]') as HTMLButtonElement;
    expect(submitBtn.getAttribute('aria-disabled')).toBe('true');
  });

  it('dispatches worker-task:declined event', async () => {
    el = createElement();
    await el.updateComplete;

    emitPagesEvent(document, 'test-worker:selected', { taskId: 'task-1' });
    await el.updateComplete;

    const handler = vi.fn();
    el.addEventListener('worker-task:declined', handler);

    const declineBtn = el.shadowRoot!.querySelector('[data-action="decline"]') as HTMLButtonElement;
    declineBtn.click();
    await el.updateComplete;

    const confirmBtn = el.shadowRoot!.querySelector('[data-action="confirm-decline"]') as HTMLButtonElement;
    confirmBtn.click();
    await el.updateComplete;

    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0].detail.type).toBe('DECLINE');
    expect(handler.mock.calls[0][0].detail.taskId).toBe('task-1');
  });
});
