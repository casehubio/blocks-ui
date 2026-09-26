import { describe, it, expect, vi, afterEach } from 'vitest';
import type { WatchPattern, CategoryDescriptor } from './types.js';
import './watch-pattern-editor.js';
import type { WatchPatternEditor } from './watch-pattern-editor.js';

function createElement(
  patterns?: readonly WatchPattern[],
  categories?: readonly CategoryDescriptor[],
  readonly = false,
): WatchPatternEditor {
  const el = document.createElement('blocks-watch-pattern-editor') as WatchPatternEditor;
  if (patterns) el.patterns = patterns;
  if (categories) el.categories = categories;
  el.readonly = readonly;
  document.body.appendChild(el);
  return el;
}

const SAMPLE_PATTERNS: WatchPattern[] = [
  { id: 'wp-1', category: 'lint-fix', areaId: null, targetPattern: '*.java', minEstimatedSize: null, createdAt: '2026-09-25T12:00:00Z' },
  { id: 'wp-2', category: null, areaId: 'test-coverage', targetPattern: null, minEstimatedSize: 50, createdAt: '2026-09-26T08:00:00Z' },
];

const SAMPLE_CATEGORIES: CategoryDescriptor[] = [
  { id: 'dependency-update', name: 'Dependency Update', description: 'Bump deps', domainId: 'code-evolution' },
  { id: 'lint-fix', name: 'Lint Fix', description: 'Fix lint', domainId: 'code-evolution' },
];

describe('blocks-watch-pattern-editor', () => {
  afterEach(() => {
    document.body.querySelectorAll('blocks-watch-pattern-editor').forEach(el => el.remove());
  });

  it('has correct ARIA attributes', async () => {
    const el = createElement(SAMPLE_PATTERNS);
    await el.updateComplete;
    expect(el.getAttribute('role')).toBe('region');
    expect(el.getAttribute('aria-label')).toBe('Watch pattern editor');
  });

  it('renders watch patterns in table', async () => {
    const el = createElement(SAMPLE_PATTERNS);
    await el.updateComplete;
    const table = el.shadowRoot!.querySelector('pages-table');
    expect(table).not.toBeNull();
  });

  it('shows add button when not readonly', async () => {
    const el = createElement(SAMPLE_PATTERNS);
    await el.updateComplete;
    const addBtn = el.shadowRoot!.querySelector('.btn-add');
    expect(addBtn).not.toBeNull();
  });

  it('hides add button in readonly mode', async () => {
    const el = createElement(SAMPLE_PATTERNS, undefined, true);
    await el.updateComplete;
    const addBtn = el.shadowRoot!.querySelector('.btn-add');
    expect(addBtn).toBeNull();
  });

  it('renders category dropdown when categories provided', async () => {
    const el = createElement(SAMPLE_PATTERNS, SAMPLE_CATEGORIES);
    await el.updateComplete;
    (el as any)._showAddForm = true;
    await el.updateComplete;
    const select = el.shadowRoot!.querySelector('select');
    expect(select).not.toBeNull();
    const options = select!.querySelectorAll('option');
    expect(options.length).toBe(3); // Any + 2 categories
  });

  it('renders text input when no categories provided', async () => {
    const el = createElement(SAMPLE_PATTERNS);
    await el.updateComplete;
    (el as any)._showAddForm = true;
    await el.updateComplete;
    const inputs = el.shadowRoot!.querySelectorAll('input[type="text"]');
    expect(inputs.length).toBeGreaterThanOrEqual(3); // category, area, target pattern
  });

  it('emits watch-pattern-changed on add', async () => {
    const el = createElement(SAMPLE_PATTERNS);
    await el.updateComplete;
    const handler = vi.fn();
    el.addEventListener('pages-event', handler);
    (el as any)._formData = { category: 'lint-fix', areaId: '', targetPattern: '', minEstimatedSize: '' };
    el._handleAdd();
    expect(handler).toHaveBeenCalledOnce();
    const detail = handler.mock.calls[0]![0].detail;
    expect(detail.topic).toBe('evolution:watch-pattern-changed');
    expect(detail.payload.action).toBe('add');
    expect(detail.payload.input.category).toBe('lint-fix');
  });

  it('does not emit when form is empty', async () => {
    const el = createElement(SAMPLE_PATTERNS);
    await el.updateComplete;
    const handler = vi.fn();
    el.addEventListener('pages-event', handler);
    (el as any)._formData = { category: '', areaId: '', targetPattern: '', minEstimatedSize: '' };
    el._handleAdd();
    expect(handler).not.toHaveBeenCalled();
  });

  it('shows empty message when no patterns', async () => {
    const el = createElement([]);
    await el.updateComplete;
    const empty = el.shadowRoot!.querySelector('.empty');
    expect(empty).not.toBeNull();
    expect(empty!.textContent).toContain('No active watch patterns');
  });

  it('configure() updates properties', async () => {
    const el = createElement();
    el.configure({ caseId: 'case-1', readonly: true, categories: SAMPLE_CATEGORIES });
    expect(el.caseId).toBe('case-1');
    expect(el.readonly).toBe(true);
    expect(el.categories).toEqual(SAMPLE_CATEGORIES);
  });
});
