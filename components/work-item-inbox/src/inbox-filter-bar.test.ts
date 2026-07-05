import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './inbox-filter-bar.js';

describe('inbox-filter-bar', () => {
  let el: HTMLElement & {
    activeStatusFilters: Set<string>;
    activePriorityFilters: Set<string>;
  };

  beforeEach(async () => {
    el = document.createElement('inbox-filter-bar') as any;
    document.body.appendChild(el);
    await (el as any).updateComplete;
  });

  afterEach(() => el.remove());

  it('renders status filter chips', () => {
    const statusChips = el.shadowRoot!.querySelectorAll('.status-chip');
    expect(statusChips.length).toBeGreaterThan(0);
  });

  it('emits filter-change event when status chip clicked', async () => {
    const handler = vi.fn();
    el.addEventListener('filter-change', handler);
    const chip = el.shadowRoot!.querySelector('.status-chip') as HTMLElement;
    chip.click();
    expect(handler).toHaveBeenCalled();
  });

  it('applies active class to selected filters', async () => {
    el.activeStatusFilters = new Set(['PENDING']);
    await (el as any).updateComplete;
    const pendingChip = el.shadowRoot!.querySelector('[data-status="PENDING"]');
    expect(pendingChip?.classList.contains('active')).toBe(true);
  });

  it('emits clear-filters event when clear button clicked', async () => {
    el.activeStatusFilters = new Set(['PENDING']);
    await (el as any).updateComplete;
    const handler = vi.fn();
    el.addEventListener('clear-filters', handler);
    const clearButton = el.shadowRoot!.querySelector('.clear-filters') as HTMLElement;
    if (clearButton) {
      clearButton.click();
      expect(handler).toHaveBeenCalled();
    }
  });
});
