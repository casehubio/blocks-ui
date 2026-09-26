import { describe, it, expect, vi, afterEach } from 'vitest';
import type { DenyPatternView } from './types.js';
import './deny-pattern-editor.js';
import type { DenyPatternEditor } from './deny-pattern-editor.js';

function createElement(patterns?: DenyPatternView, readonly = false): DenyPatternEditor {
  const el = document.createElement('blocks-deny-pattern-editor') as DenyPatternEditor;
  if (patterns) el.patterns = patterns;
  el.readonly = readonly;
  document.body.appendChild(el);
  return el;
}

const SAMPLE_VIEW: DenyPatternView = {
  staticPatterns: ['ImprovementBudgetEnforcer', 'EvolutionTicker'],
  dynamicPatterns: [
    { pattern: 'AuthController', addedBy: 'admin', addedAt: '2026-09-25T12:00:00Z' },
    { pattern: 'PaymentService', addedBy: 'ops', addedAt: '2026-09-26T08:00:00Z' },
  ],
};

describe('blocks-deny-pattern-editor', () => {
  afterEach(() => {
    document.body.querySelectorAll('blocks-deny-pattern-editor').forEach(el => el.remove());
  });

  it('has correct ARIA attributes', async () => {
    const el = createElement(SAMPLE_VIEW);
    await el.updateComplete;
    expect(el.getAttribute('role')).toBe('region');
    expect(el.getAttribute('aria-label')).toBe('Deny pattern editor');
  });

  it('renders structural patterns as read-only list', async () => {
    const el = createElement(SAMPLE_VIEW);
    await el.updateComplete;
    const items = el.shadowRoot!.querySelectorAll('[role="listitem"]');
    expect(items.length).toBe(2);
    expect(items[0]!.textContent).toContain('ImprovementBudgetEnforcer');
    expect(items[1]!.textContent).toContain('EvolutionTicker');
  });

  it('renders dynamic patterns in table', async () => {
    const el = createElement(SAMPLE_VIEW);
    await el.updateComplete;
    const table = el.shadowRoot!.querySelector('pages-table');
    expect(table).not.toBeNull();
  });

  it('shows section headers', async () => {
    const el = createElement(SAMPLE_VIEW);
    await el.updateComplete;
    const headers = el.shadowRoot!.querySelectorAll('.section-header');
    expect(headers.length).toBe(2);
    expect(headers[0]!.textContent).toContain('Structural');
    expect(headers[1]!.textContent).toContain('Dynamic');
  });

  it('shows add button when not readonly', async () => {
    const el = createElement(SAMPLE_VIEW);
    await el.updateComplete;
    const addBtn = el.shadowRoot!.querySelector('.btn-add');
    expect(addBtn).not.toBeNull();
  });

  it('hides add button and delete buttons in readonly mode', async () => {
    const el = createElement(SAMPLE_VIEW, true);
    await el.updateComplete;
    const addBtn = el.shadowRoot!.querySelector('.btn-add');
    expect(addBtn).toBeNull();
    const deleteButtons = el.shadowRoot!.querySelectorAll('button[aria-label*="Delete"]');
    expect(deleteButtons.length).toBe(0);
  });

  it('emits evolution:deny-pattern-changed on add in inline mode', async () => {
    const el = createElement(SAMPLE_VIEW);
    await el.updateComplete;
    const handler = vi.fn();
    el.addEventListener('pages-event', handler);
    el._handleAdd('NewPattern');
    expect(handler).toHaveBeenCalledOnce();
    const detail = handler.mock.calls[0]![0].detail;
    expect(detail.topic).toBe('evolution:deny-pattern-changed');
    expect(detail.payload.action).toBe('add');
    expect(detail.payload.pattern).toBe('NewPattern');
  });

  it('does not emit on empty pattern', async () => {
    const el = createElement(SAMPLE_VIEW);
    await el.updateComplete;
    const handler = vi.fn();
    el.addEventListener('pages-event', handler);
    el._handleAdd('  ');
    expect(handler).not.toHaveBeenCalled();
  });

  it('shows empty message when no dynamic patterns', async () => {
    const el = createElement({
      staticPatterns: ['Foo'],
      dynamicPatterns: [],
    });
    await el.updateComplete;
    const empty = el.shadowRoot!.querySelector('.empty');
    expect(empty).not.toBeNull();
    expect(empty!.textContent).toContain('No dynamic deny patterns');
  });

  it('configure() updates properties', async () => {
    const el = createElement();
    el.configure({ caseId: 'case-1', tenancyId: 'tenant-1', readonly: true });
    expect(el.caseId).toBe('case-1');
    expect(el.tenancyId).toBe('tenant-1');
    expect(el.readonly).toBe(true);
  });

  it('shows loading state', async () => {
    const el = createElement();
    (el as any)._loading = true;
    await el.updateComplete;
    const loading = el.shadowRoot!.querySelector('.loading');
    expect(loading).not.toBeNull();
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
