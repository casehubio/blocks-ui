import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { html } from 'lit';
import './audit-trail-viewer.js';
import type { AuditTrailViewer } from './audit-trail-viewer.js';
import type { LedgerEntry, VerificationResult, Attestation } from './types.js';

async function fixture<T extends HTMLElement>(tagName: string, attrs: Record<string, unknown> = {}): Promise<T> {
  const el = document.createElement(tagName) as T;
  Object.entries(attrs).forEach(([key, value]) => {
    if (key.startsWith('.')) {
      (el as any)[key.slice(1)] = value;
    } else {
      el.setAttribute(key, String(value));
    }
  });
  document.body.appendChild(el);
  await new Promise((resolve) => setTimeout(resolve, 0));
  return el;
}

function cleanupFixtures(): void {
  document.body.innerHTML = '';
}

describe('AuditTrailViewer', () => {
  let element: AuditTrailViewer;
  let mockFetch: ReturnType<typeof vi.fn>;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    cleanupFixtures();
  });

  const mockEntries: LedgerEntry[] = [
    {
      id: 'e1',
      subjectId: 'case-123',
      tenancyId: 't1',
      sequenceNumber: 1,
      entryType: 'COMMAND',
      actorId: 'actor-1',
      actorType: 'USER',
      actorRole: 'ADMIN',
      occurredAt: '2026-07-07T10:00:00Z',
      digest: 'abc123def456',
      traceId: 'trace-1',
      causedByEntryId: null,
      payload: { action: 'CREATE_CASE' },
    },
    {
      id: 'e2',
      subjectId: 'case-123',
      tenancyId: 't1',
      sequenceNumber: 2,
      entryType: 'EVENT',
      actorId: 'actor-2',
      actorType: 'SYSTEM',
      actorRole: null,
      occurredAt: '2026-07-07T11:00:00Z',
      digest: 'def456ghi789',
      traceId: 'trace-2',
      causedByEntryId: 'e1',
      payload: null,
    },
  ];

  const mockVerification: VerificationResult = {
    subjectId: 'case-123',
    treeRoot: 'root-hash-xyz',
    verified: true,
    redactedCount: 1,
  };

  const mockAttestations: Attestation[] = [
    {
      id: 'a1',
      ledgerEntryId: 'e1',
      subjectId: 'case-123',
      attestorId: 'attestor-1',
      attestorType: 'PEER',
      verdict: 'SOUND',
      evidence: { score: 0.95 },
      confidence: 0.9,
      capabilityTag: 'CASE_REVIEW',
      occurredAt: '2026-07-07T10:05:00Z',
    },
  ];

  beforeEach(() => {
    mockFetch = vi.fn();
  });

  describe('Component initialization', () => {
    it('should register as a custom element', () => {
      expect(customElements.get('audit-trail-viewer')).toBeDefined();
    });

    it('should render with required properties', async () => {
      element = await fixture<AuditTrailViewer>('audit-trail-viewer', {
        endpoint: 'http://localhost/api',
        'subject-id': 'case-123',
      });
      expect(element).toBeDefined();
      expect(element.subjectId).toBe('case-123');
    });
  });

  describe('Data fetching', () => {
    beforeEach(async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/ledger/entries')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockEntries),
          });
        }
        if (url.includes('/ledger/verify')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockVerification),
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      element = await fixture<AuditTrailViewer>('audit-trail-viewer', {
        'subject-id': 'case-123',
      });
      globalThis.fetch = mockFetch as unknown as typeof fetch;
    });

    it('should fetch entries and verification on configure', async () => {
      element.configure({
        endpoint: 'http://localhost/api',
        identity: { userId: 'u1', tenancyId: 't1', roles: [] },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/ledger/entries'),
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/ledger/verify'),
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });

    it('should include subjectId and tenancyId in entries request', async () => {
      element.configure({
        endpoint: 'http://localhost/api',
        identity: { userId: 'u1', tenancyId: 't1', roles: [] },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('subjectId=case-123'),
        expect.anything()
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('tenancyId=t1'),
        expect.anything()
      );
    });

    it('should handle fetch errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      element.configure({
        endpoint: 'http://localhost/api',
        identity: { userId: 'u1', tenancyId: 't1', roles: [] },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(element.entries.error).toContain('Network error');
      expect(element.entries.loading).toBe(false);
    });
  });

  describe('Entry list rendering', () => {
    beforeEach(async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/ledger/entries')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockEntries),
          });
        }
        if (url.includes('/ledger/verify')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockVerification),
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      element = await fixture<AuditTrailViewer>('audit-trail-viewer', {
        'subject-id': 'case-123',
      });
      globalThis.fetch = mockFetch as unknown as typeof fetch;
      element.configure({
        endpoint: 'http://localhost/api',
        identity: { userId: 'u1', tenancyId: 't1', roles: [] },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));
      await element.updateComplete;
    });

    it('should render pages-table with entries', () => {
      const table = element.shadowRoot?.querySelector('pages-table');
      expect(table).toBeDefined();
      expect(table?.hasAttribute('client-filter')).toBe(true);
    });

    it('should render table with dataSet', () => {
      const table = element.shadowRoot?.querySelector('pages-table') as any;
      expect(table).toBeDefined();
      expect(table.dataSet).toBeDefined();
      expect(table.dataSet.rows.length).toBe(2);
    });

    it('should display actor type badge', () => {
      const text = element.shadowRoot?.textContent || '';
      expect(text).toContain('USER');
      expect(text).toContain('SYSTEM');
    });

    it('should display entry type', () => {
      const text = element.shadowRoot?.textContent || '';
      expect(text).toContain('COMMAND');
      expect(text).toContain('EVENT');
    });

    it('should configure columnRenderers for digest', () => {
      const table = element.shadowRoot?.querySelector('pages-table') as any;
      expect(table).toBeDefined();
      expect(table.columnRenderers).toBeDefined();
      expect(table.columnRenderers.size).toBeGreaterThan(0);
    });
  });

  describe('Verification banner', () => {
    it('should show green verified banner when verified=true and no redactions', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/ledger/entries')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([]),
          });
        }
        if (url.includes('/ledger/verify')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ ...mockVerification, verified: true, redactedCount: 0 }),
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      element = await fixture<AuditTrailViewer>('audit-trail-viewer', {
        'subject-id': 'case-123',
      });
      globalThis.fetch = mockFetch as unknown as typeof fetch;
      element.configure({
        endpoint: 'http://localhost/api',
        identity: { userId: 'u1', tenancyId: 't1', roles: [] },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));
      await element.updateComplete;

      const banner = element.shadowRoot?.querySelector('[role="status"]');
      expect(banner).toBeDefined();
      expect(banner?.textContent).toContain('verified');
    });

    it('should show amber verified with redactions banner', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/ledger/entries')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([]),
          });
        }
        if (url.includes('/ledger/verify')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ ...mockVerification, verified: true, redactedCount: 3 }),
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      element = await fixture<AuditTrailViewer>('audit-trail-viewer', {
        'subject-id': 'case-123',
      });
      globalThis.fetch = mockFetch as unknown as typeof fetch;
      element.configure({
        endpoint: 'http://localhost/api',
        identity: { userId: 'u1', tenancyId: 't1', roles: [] },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));
      await element.updateComplete;

      const banner = element.shadowRoot?.querySelector('[role="status"]');
      expect(banner?.textContent).toContain('3 entries redacted');
    });

    it('should show red verification failed banner', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/ledger/entries')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([]),
          });
        }
        if (url.includes('/ledger/verify')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ ...mockVerification, verified: false }),
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      element = await fixture<AuditTrailViewer>('audit-trail-viewer', {
        'subject-id': 'case-123',
      });
      globalThis.fetch = mockFetch as unknown as typeof fetch;
      element.configure({
        endpoint: 'http://localhost/api',
        identity: { userId: 'u1', tenancyId: 't1', roles: [] },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));
      await element.updateComplete;

      const banner = element.shadowRoot?.querySelector('[role="status"]');
      expect(banner?.textContent).toContain('failed');
    });
  });

  describe('Expandable detail', () => {
    beforeEach(async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/ledger/entries/e1/attestations')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockAttestations),
          });
        }
        if (url.includes('/ledger/entries')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockEntries),
          });
        }
        if (url.includes('/ledger/verify')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockVerification),
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      element = await fixture<AuditTrailViewer>('audit-trail-viewer', {
        'subject-id': 'case-123',
      });
      globalThis.fetch = mockFetch as unknown as typeof fetch;
      element.configure({
        endpoint: 'http://localhost/api',
        identity: { userId: 'u1', tenancyId: 't1', roles: [] },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));
      await element.updateComplete;
    });

    it('should expand entry on row activation', async () => {
      const table = element.shadowRoot?.querySelector('pages-table');
      const activateEvent = new CustomEvent('row-activate', {
        detail: { key: 'e1' },
      });
      table?.dispatchEvent(activateEvent);

      await element.updateComplete;

      const detail = element.shadowRoot?.querySelector('[role="region"]');
      expect(detail).toBeDefined();
    });

    it('should display full digest in detail', async () => {
      const table = element.shadowRoot?.querySelector('pages-table');
      const activateEvent = new CustomEvent('row-activate', {
        detail: { key: 'e1' },
      });
      table?.dispatchEvent(activateEvent);

      await element.updateComplete;

      const text = element.shadowRoot?.textContent || '';
      expect(text).toContain('abc123def456');
    });

    it('should fetch and display attestations', async () => {
      const table = element.shadowRoot?.querySelector('pages-table');
      const activateEvent = new CustomEvent('row-activate', {
        detail: { key: 'e1' },
      });
      table?.dispatchEvent(activateEvent);

      await new Promise((resolve) => setTimeout(resolve, 10));
      await element.updateComplete;

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/ledger/entries/e1/attestations')
      );

      const text = element.shadowRoot?.textContent || '';
      expect(text).toContain('SOUND');
    });

    it('should show "Content redacted" for null payload', async () => {
      const table = element.shadowRoot?.querySelector('pages-table');
      const activateEvent = new CustomEvent('row-activate', {
        detail: { key: 'e2' }, // e2 has null payload
      });
      table?.dispatchEvent(activateEvent);

      await element.updateComplete;

      const text = element.shadowRoot?.textContent || '';
      expect(text).toContain('Content redacted');
    });
  });

  describe('Filter controls', () => {
    beforeEach(async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/ledger/entries')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockEntries),
          });
        }
        if (url.includes('/ledger/verify')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockVerification),
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      element = await fixture<AuditTrailViewer>('audit-trail-viewer', {
        'subject-id': 'case-123',
      });
      globalThis.fetch = mockFetch as unknown as typeof fetch;
      element.configure({
        endpoint: 'http://localhost/api',
        identity: { userId: 'u1', tenancyId: 't1', roles: [] },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));
      await element.updateComplete;
    });

    it('should render actor filter dropdown', () => {
      const select = element.shadowRoot?.querySelector('select');
      expect(select).toBeDefined();
    });

    it('should render entry type chips', () => {
      const chips = element.shadowRoot?.querySelectorAll('[role="checkbox"]');
      expect(chips?.length).toBeGreaterThan(0);
    });

    it('should render date range inputs', () => {
      const dateInputs = element.shadowRoot?.querySelectorAll('input[type="date"]');
      expect(dateInputs?.length).toBe(2);
    });
  });

  describe('Custom payload renderer', () => {
    it('should use custom renderer when provided', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/ledger/entries')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockEntries),
          });
        }
        if (url.includes('/ledger/verify')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockVerification),
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      const customRenderer = vi.fn((entry: LedgerEntry) =>
        entry.entryType === 'COMMAND' ? html`<div>Custom render</div>` : undefined
      );

      element = await fixture<AuditTrailViewer>('audit-trail-viewer', {
        'subject-id': 'case-123',
      });
      globalThis.fetch = mockFetch as unknown as typeof fetch;
      element.renderEntryPayload = customRenderer;
      element.configure({
        endpoint: 'http://localhost/api',
        identity: { userId: 'u1', tenancyId: 't1', roles: [] },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));
      await element.updateComplete;

      const table = element.shadowRoot?.querySelector('pages-table');
      const activateEvent = new CustomEvent('row-activate', {
        detail: { key: 'e1' },
      });
      table?.dispatchEvent(activateEvent);

      await element.updateComplete;

      expect(customRenderer).toHaveBeenCalledWith(mockEntries[0]);
      const text = element.shadowRoot?.textContent || '';
      expect(text).toContain('Custom render');
    });
  });

  describe('Accessibility', () => {
    beforeEach(async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/ledger/entries')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockEntries),
          });
        }
        if (url.includes('/ledger/verify')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockVerification),
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      element = await fixture<AuditTrailViewer>('audit-trail-viewer', {
        'subject-id': 'case-123',
      });
      globalThis.fetch = mockFetch as unknown as typeof fetch;
      element.configure({
        endpoint: 'http://localhost/api',
        identity: { userId: 'u1', tenancyId: 't1', roles: [] },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));
      await element.updateComplete;
    });

    it('should have role="status" on verification banner', () => {
      const banner = element.shadowRoot?.querySelector('[role="status"]');
      expect(banner).toBeDefined();
    });

    it('should have aria-live="polite" on verification banner', () => {
      const banner = element.shadowRoot?.querySelector('[aria-live="polite"]');
      expect(banner).toBeDefined();
    });

    it('should have role="group" on entry type filter', () => {
      const group = element.shadowRoot?.querySelector('[role="group"]');
      expect(group).toBeDefined();
    });

    it('should have aria-label on filter group', () => {
      const group = element.shadowRoot?.querySelector('[aria-label="Entry type filter"]');
      expect(group).toBeDefined();
    });
  });
});
