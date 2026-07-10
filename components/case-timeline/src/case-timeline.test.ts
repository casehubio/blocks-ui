import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { html, render } from 'lit';
import './case-timeline.js';
import type { CaseTimeline } from './case-timeline.js';
import type { CaseEvent, PagedResponse, EventLogEntryResponse } from './types.js';

async function fixture<T extends HTMLElement>(template: ReturnType<typeof html>): Promise<T> {
  const container = document.createElement('div');
  document.body.appendChild(container);
  render(template, container);
  const element = container.firstElementChild as T;
  await element.updateComplete;
  return element;
}

describe('CaseTimeline', () => {
  let element: CaseTimeline;
  let mockFetch: ReturnType<typeof vi.fn>;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    document.body.innerHTML = '';
  });

  const mockEvents: EventLogEntryResponse[] = [
    {
      eventType: 'CASE_STARTED',
      streamType: 'CASE',
      timestamp: '2026-07-01T10:00:00Z',
      payload: { caseType: 'FRAUD_INVESTIGATION' },
      metadata: { userId: 'user-1' },
    },
    {
      eventType: 'TASK_CREATED',
      streamType: 'WORKER',
      timestamp: '2026-07-01T10:05:00Z',
      payload: { taskId: 'task-1', title: 'Review documents' },
    },
    {
      eventType: 'MILESTONE_REACHED',
      streamType: 'CASE',
      timestamp: '2026-07-01T11:00:00Z',
      payload: { milestoneName: 'Initial assessment complete' },
    },
    {
      eventType: 'AGENT_DISPATCHED',
      streamType: 'WORKER',
      timestamp: '2026-07-01T11:30:00Z',
      payload: { agentId: 'agent-42', workerId: 'worker-1' },
      metadata: { trustScore: 0.85, workerName: 'Alice' },
    },
    {
      eventType: 'TASK_COMPLETED',
      streamType: 'WORKER',
      timestamp: '2026-07-01T12:00:00Z',
      payload: { taskId: 'task-1' },
    },
    {
      eventType: 'ACTION_GATE_APPROVED',
      streamType: 'ORCHESTRATION',
      timestamp: '2026-07-01T12:30:00Z',
      payload: { gateId: 'gate-1', approver: 'manager-1' },
    },
    {
      eventType: 'CASE_COMPLETED',
      streamType: 'CASE',
      timestamp: '2026-07-01T13:00:00Z',
      payload: { resolution: 'APPROVED' },
    },
  ];

  beforeEach(() => {
    mockFetch = vi.fn((url: string) => {
      const urlObj = new URL(url, 'http://localhost');
      if (urlObj.pathname.includes('/cases/') && urlObj.pathname.endsWith('/events')) {
        const response: PagedResponse<EventLogEntryResponse> = {
          content: mockEvents,
          page: 0,
          size: 20,
          totalElements: mockEvents.length,
          totalPages: 1,
        };
        return Promise.resolve(new Response(JSON.stringify(response), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }));
      }
      return Promise.reject(new Error('Not found'));
    });
  });

  describe('Core functionality', () => {
    it('should define the custom element', () => {
      const el = document.createElement('case-timeline');
      expect(el).toBeInstanceOf(HTMLElement);
    });

    it('should fetch events on configure()', async () => {
      element = await fixture(html`<case-timeline></case-timeline>`);
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      element.configure({
        endpoint: '/api/v1',
        identity: { userId: 'user-1', tenancyId: 'tenant-1', roles: [] },
        caseId: 'case-123',
      });

      await element.updateComplete;
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/cases/case-123/events'),
        expect.any(Object)
      );
    });

    it('should display loading state', async () => {
      element = await fixture(html`<case-timeline></case-timeline>`);
      element.loading = true;
      await element.updateComplete;

      const container = element.shadowRoot!.querySelector('.timeline-container');
      expect(container?.textContent).toContain('Loading timeline');
    });

    it('should display error state', async () => {
      element = await fixture(html`<case-timeline case-id="case-123"></case-timeline>`);
      element.error = 'Failed to load events';
      await element.updateComplete;

      const container = element.shadowRoot!.querySelector('.timeline-container');
      expect(container?.textContent).toContain('Failed to load timeline');
    });
  });

  describe('Full mode rendering', () => {
    beforeEach(async () => {
      element = await fixture(html`<case-timeline mode="full"></case-timeline>`);
      globalThis.fetch = mockFetch as unknown as typeof fetch;
      element.configure({
        endpoint: '/api/v1',
        identity: { userId: 'user-1', tenancyId: 'tenant-1', roles: [] },
        caseId: 'case-123',
      });
      await element.updateComplete;
      await new Promise(resolve => setTimeout(resolve, 10));
      await element.updateComplete;
    });

    it('should render timeline as a vertical list', () => {
      const timeline = element.shadowRoot!.querySelector('.timeline');
      expect(timeline).toBeTruthy();
      expect(timeline?.getAttribute('role')).toBe('list');
    });

    it('should render all events as nodes', () => {
      const nodes = element.shadowRoot!.querySelectorAll('.timeline-node');
      expect(nodes.length).toBe(mockEvents.length);
    });

    it('should categorize lifecycle events correctly', () => {
      const lifecycleNodes = element.shadowRoot!.querySelectorAll('.timeline-node.lifecycle');
      expect(lifecycleNodes.length).toBe(2); // CASE_STARTED, CASE_COMPLETED
    });

    it('should categorize task events correctly', () => {
      const taskNodes = element.shadowRoot!.querySelectorAll('.timeline-node.task');
      expect(taskNodes.length).toBe(2); // TASK_CREATED, TASK_COMPLETED
    });

    it('should categorize milestone events correctly', () => {
      const milestoneNodes = element.shadowRoot!.querySelectorAll('.timeline-node.milestone');
      expect(milestoneNodes.length).toBe(1); // MILESTONE_REACHED
    });

    it('should display timestamp for each event', () => {
      const firstNode = element.shadowRoot!.querySelector('.timeline-node');
      // Check for time string (format is locale-dependent, could be "10:00 AM" or similar)
      const timestamp = firstNode?.querySelector('.timestamp');
      expect(timestamp?.textContent).toBeTruthy();
      expect(timestamp?.textContent).toMatch(/\d{1,2}:\d{2}/);
    });

    it('should display event type badge', () => {
      const badges = element.shadowRoot!.querySelectorAll('.event-type-badge');
      expect(badges.length).toBe(mockEvents.length);
    });

    it('should make payload expandable on click', async () => {
      const firstNode = element.shadowRoot!.querySelector('.timeline-node') as HTMLElement;
      const expandButton = firstNode.querySelector('.expand-button') as HTMLElement;

      expect(expandButton?.getAttribute('aria-expanded')).toBe('false');
      expandButton.click();
      await element.updateComplete;

      expect(expandButton?.getAttribute('aria-expanded')).toBe('true');
      expect(firstNode.querySelector('.payload-detail')).toBeTruthy();
    });

    it('should emit timeline.event-selected on node click', async () => {
      const handler = vi.fn();
      element.addEventListener('pages-event', handler);

      const firstNode = element.shadowRoot!.querySelector('.timeline-node') as HTMLElement;
      const nodeBody = firstNode.querySelector('.node-body') as HTMLElement;
      nodeBody.click();

      await element.updateComplete;

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: expect.objectContaining({
            topic: 'timeline.event-selected',
          }),
        })
      );
    });

    it('should emit work-item.selected for task nodes', async () => {
      const handler = vi.fn();
      element.addEventListener('pages-event', handler);

      const taskNode = element.shadowRoot!.querySelector('.timeline-node.task') as HTMLElement;
      const nodeBody = taskNode.querySelector('.node-body') as HTMLElement;
      nodeBody.click();

      await element.updateComplete;

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: expect.objectContaining({
            topic: 'work-item.selected',
            payload: expect.objectContaining({
              workItemId: 'task-1',
            }),
          }),
        })
      );
    });
  });

  describe('Compact mode rendering', () => {
    beforeEach(async () => {
      element = await fixture(html`<case-timeline mode="compact"></case-timeline>`);
      globalThis.fetch = mockFetch as unknown as typeof fetch;
      element.configure({
        endpoint: '/api/v1',
        identity: { userId: 'user-1', tenancyId: 'tenant-1', roles: [] },
        caseId: 'case-123',
      });
      await element.updateComplete;
      await new Promise(resolve => setTimeout(resolve, 10));
      await element.updateComplete;
    });

    it('should render as horizontal strip', () => {
      const strip = element.shadowRoot!.querySelector('.compact-strip');
      expect(strip).toBeTruthy();
      expect(strip?.getAttribute('role')).toBe('img');
    });

    it('should show only lifecycle and milestone events', () => {
      const dots = element.shadowRoot!.querySelectorAll('.event-dot');
      // CASE_STARTED, MILESTONE_REACHED, CASE_COMPLETED = 3 events
      expect(dots.length).toBe(3);
    });

    it('should truncate when > 7 events (first 3 + last 2 + ellipsis)', async () => {
      // Add more lifecycle/milestone events to trigger truncation
      const manyEvents: EventLogEntryResponse[] = [
        { eventType: 'CASE_STARTED', streamType: 'CASE', timestamp: '2026-07-01T10:00:00Z', payload: {} },
        { eventType: 'MILESTONE_REACHED', streamType: 'CASE', timestamp: '2026-07-01T10:10:00Z', payload: {} },
        { eventType: 'MILESTONE_REACHED', streamType: 'CASE', timestamp: '2026-07-01T10:20:00Z', payload: {} },
        { eventType: 'MILESTONE_REACHED', streamType: 'CASE', timestamp: '2026-07-01T10:30:00Z', payload: {} },
        { eventType: 'MILESTONE_REACHED', streamType: 'CASE', timestamp: '2026-07-01T10:40:00Z', payload: {} },
        { eventType: 'MILESTONE_REACHED', streamType: 'CASE', timestamp: '2026-07-01T10:50:00Z', payload: {} },
        { eventType: 'MILESTONE_REACHED', streamType: 'CASE', timestamp: '2026-07-01T11:00:00Z', payload: {} },
        { eventType: 'CASE_COMPLETED', streamType: 'CASE', timestamp: '2026-07-01T12:00:00Z', payload: {} },
      ];

      mockFetch.mockImplementation(() => {
        const response: PagedResponse<EventLogEntryResponse> = {
          content: manyEvents,
          page: 0,
          size: 20,
          totalElements: manyEvents.length,
          totalPages: 1,
        };
        return Promise.resolve(new Response(JSON.stringify(response), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }));
      });

      element.configure({
        endpoint: '/api/v1',
        identity: { userId: 'user-1', tenancyId: 'tenant-1', roles: [] },
        caseId: 'case-999',
      });

      await element.updateComplete;
      await new Promise(resolve => setTimeout(resolve, 10));
      await element.updateComplete;

      const dots = element.shadowRoot!.querySelectorAll('.event-dot');
      const ellipsis = element.shadowRoot!.querySelector('.ellipsis');

      // First 3 + last 2 + ellipsis = 6 total rendered
      expect(dots.length).toBe(5);
      expect(ellipsis).toBeTruthy();
      expect(ellipsis?.textContent).toContain('+3'); // 8 total - 5 shown = 3 hidden
    });

    it('should show CSS tooltip on dot hover', () => {
      const firstDot = element.shadowRoot!.querySelector('.event-dot') as HTMLElement;
      expect(firstDot.getAttribute('data-tooltip')).toBeTruthy();
    });

    it('should emit timeline.expand-requested on strip click', async () => {
      const handler = vi.fn();
      element.addEventListener('pages-event', handler);

      const strip = element.shadowRoot!.querySelector('.compact-strip') as HTMLElement;
      strip.click();

      await element.updateComplete;

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: expect.objectContaining({
            topic: 'timeline.expand-requested',
          }),
        })
      );
    });
  });

  describe('Filter bar', () => {
    beforeEach(async () => {
      element = await fixture(html`<case-timeline mode="full"></case-timeline>`);
      globalThis.fetch = mockFetch as unknown as typeof fetch;
      element.configure({
        endpoint: '/api/v1',
        identity: { userId: 'user-1', tenancyId: 'tenant-1', roles: [] },
        caseId: 'case-123',
      });
      await element.updateComplete;
      await new Promise(resolve => setTimeout(resolve, 10));
      await element.updateComplete;
    });

    it('should render stream type filter chips', () => {
      const filterBar = element.shadowRoot!.querySelector('.filter-bar');
      expect(filterBar).toBeTruthy();

      const chips = filterBar!.querySelectorAll('.filter-chip');
      expect(chips.length).toBeGreaterThan(0);
    });

    it('should toggle stream type filter on chip click', async () => {
      const caseChip = Array.from(
        element.shadowRoot!.querySelectorAll('.filter-chip')
      ).find(chip => chip.textContent?.includes('CASE')) as HTMLElement;

      expect(caseChip.getAttribute('aria-checked')).toBe('true');

      caseChip.click();
      await element.updateComplete;

      expect(caseChip.getAttribute('aria-checked')).toBe('false');

      // Should hide CASE stream events
      const lifecycleNodes = element.shadowRoot!.querySelectorAll('.timeline-node.lifecycle');
      expect(lifecycleNodes.length).toBe(0);
    });

    it('should filter nodes based on active stream types', async () => {
      const workerChip = Array.from(
        element.shadowRoot!.querySelectorAll('.filter-chip')
      ).find(chip => chip.textContent?.includes('WORKER')) as HTMLElement;

      workerChip.click(); // disable WORKER stream
      await element.updateComplete;

      const taskNodes = element.shadowRoot!.querySelectorAll('.timeline-node.task');
      const agentNodes = element.shadowRoot!.querySelectorAll('.timeline-node.agent');

      expect(taskNodes.length).toBe(0);
      expect(agentNodes.length).toBe(0);
    });
  });

  describe('Accessibility', () => {
    beforeEach(async () => {
      element = await fixture(html`<case-timeline mode="full"></case-timeline>`);
      globalThis.fetch = mockFetch as unknown as typeof fetch;
      element.configure({
        endpoint: '/api/v1',
        identity: { userId: 'user-1', tenancyId: 'tenant-1', roles: [] },
        caseId: 'case-123',
      });
      await element.updateComplete;
      await new Promise(resolve => setTimeout(resolve, 10));
      await element.updateComplete;
    });

    it('should have role="list" on timeline container', () => {
      const timeline = element.shadowRoot!.querySelector('.timeline');
      expect(timeline?.getAttribute('role')).toBe('list');
    });

    it('should have role="listitem" on each node', () => {
      const nodes = element.shadowRoot!.querySelectorAll('.timeline-node');
      nodes.forEach(node => {
        expect(node.getAttribute('role')).toBe('listitem');
      });
    });

    it('should have aria-label summarizing event on each node', () => {
      const firstNode = element.shadowRoot!.querySelector('.timeline-node');
      const ariaLabel = firstNode?.getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();
      // aria-label replaces underscores with spaces for better screen reader output
      expect(ariaLabel).toContain('CASE STARTED');
    });

    it('should have aria-expanded on expand buttons', () => {
      const expandButton = element.shadowRoot!.querySelector('.expand-button');
      expect(expandButton?.getAttribute('aria-expanded')).toBe('false');
    });

    it('should support keyboard navigation (Arrow Up/Down)', async () => {
      const timeline = element.shadowRoot!.querySelector('.timeline');
      const firstNode = timeline!.querySelector('.timeline-node') as HTMLElement;

      firstNode.focus();
      // With Shadow DOM, activeElement is the host, not the internal node
      expect(element.shadowRoot!.activeElement).toBe(firstNode);

      // Simulate ArrowDown
      firstNode.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      await element.updateComplete;
      await new Promise(resolve => setTimeout(resolve, 10));

      const secondNode = timeline!.querySelectorAll('.timeline-node')[1] as HTMLElement;
      expect(element.shadowRoot!.activeElement).toBe(secondNode);
    });
  });
});
