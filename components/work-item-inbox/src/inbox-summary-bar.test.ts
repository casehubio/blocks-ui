import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { InboxSummary } from '@casehubio/blocks-ui-core';
import './inbox-summary-bar.js';

const mockSummary: InboxSummary = {
  total: 25,
  byStatus: { PENDING: 10, ASSIGNED: 12, IN_PROGRESS: 3 },
  byPriority: { LOW: 5, MEDIUM: 10, HIGH: 8, URGENT: 2 },
  overdue: 3,
  claimDeadlineBreached: 1,
};

describe('inbox-summary-bar', () => {
  let el: HTMLElement & { summary: InboxSummary | null; overdueActive: boolean; claimBreachActive: boolean };

  beforeEach(async () => {
    el = document.createElement('inbox-summary-bar') as any;
    el.summary = mockSummary;
    document.body.appendChild(el);
    await (el as any).updateComplete;
  });

  afterEach(() => el.remove());

  it('renders total count as non-clickable badge', () => {
    const total = el.shadowRoot!.querySelector('.badge.total');
    expect(total).toBeTruthy();
    expect(total!.textContent).toContain('25');
    // Total should be a span (not a button) — it's informational, not a filter
    expect(total!.tagName).toBe('SPAN');
  });

  it('does NOT render priority badges (priority filtering belongs in filter pills)', () => {
    const priorityBadges = el.shadowRoot!.querySelectorAll('.badge.priority');
    expect(priorityBadges.length).toBe(0);
  });

  it('shows overdue count when non-zero', () => {
    const overdue = el.shadowRoot!.querySelector('.badge.overdue');
    expect(overdue).toBeTruthy();
    expect(overdue!.textContent).toContain('3');
  });

  it('hides overdue badge when zero', async () => {
    el.summary = { ...mockSummary, overdue: 0 };
    await (el as any).updateComplete;
    const overdue = el.shadowRoot!.querySelector('.badge.overdue');
    expect(overdue).toBeFalsy();
  });

  it('emits filter-click event on overdue badge click', async () => {
    const handler = vi.fn();
    el.addEventListener('filter-click', handler);
    const overdue = el.shadowRoot!.querySelector('.badge.overdue') as HTMLElement;
    overdue.click();
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ detail: { type: 'overdue', value: null } }),
    );
  });

  it('shows active state on overdue badge when overdueActive is true', async () => {
    el.overdueActive = true;
    await (el as any).updateComplete;
    const overdue = el.shadowRoot!.querySelector('.badge.overdue');
    expect(overdue!.classList.contains('active')).toBe(true);
  });

  it('shows active state on claim breach badge when claimBreachActive is true', async () => {
    el.claimBreachActive = true;
    await (el as any).updateComplete;
    const breach = el.shadowRoot!.querySelector('.badge.claim-breach');
    expect(breach!.classList.contains('active')).toBe(true);
  });

  it('shows claim breach count when non-zero', () => {
    const breach = el.shadowRoot!.querySelector('.badge.claim-breach');
    expect(breach).toBeTruthy();
    expect(breach!.textContent).toContain('1');
  });
});
