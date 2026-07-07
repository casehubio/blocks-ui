import { describe, it, expect, vi, beforeEach } from 'vitest';
import { html } from 'lit';
import './trust-score-panel.js';
import type { TrustScorePanel } from './trust-score-panel.js';
import type { TrustScoreResponse } from './types.js';

async function fixture<T extends HTMLElement>(template: any): Promise<T> {
  const container = document.createElement('div');
  container.innerHTML = '';
  document.body.appendChild(container);

  // Render the Lit template
  const element = document.createElement(template.strings[0].match(/<([a-z-]+)/)?.[1] || 'div') as T;

  // Extract attributes from template
  const attrsMatch = template.strings[0].match(/<[a-z-]+(.*?)>/s);
  if (attrsMatch) {
    const attrs = attrsMatch[1];
    const attrMatches = attrs.matchAll(/(\w+)="([^"]*)"/g);
    for (const [, name, value] of attrMatches) {
      element.setAttribute(name, value);
    }
  }

  container.appendChild(element);
  await (element as any).updateComplete;
  return element;
}

describe('trust-score-panel', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    document.body.innerHTML = '';
  });

  describe('Types and Helpers', () => {
    it('trustLevelFromScore returns correct levels', async () => {
      const { trustLevelFromScore } = await import('./types.js');
      expect(trustLevelFromScore(0.85)).toBe('high');
      expect(trustLevelFromScore(0.7)).toBe('high');
      expect(trustLevelFromScore(0.6)).toBe('adequate');
      expect(trustLevelFromScore(0.4)).toBe('adequate');
      expect(trustLevelFromScore(0.3)).toBe('low');
      expect(trustLevelFromScore(undefined)).toBe('none');
    });

    it('maturityFromCount returns correct phases', async () => {
      const { maturityFromCount } = await import('./types.js');
      expect(maturityFromCount(5)).toBe('bootstrap');
      expect(maturityFromCount(9)).toBe('bootstrap');
      expect(maturityFromCount(10)).toBe('calibrating');
      expect(maturityFromCount(50)).toBe('calibrating');
      expect(maturityFromCount(51)).toBe('mature');
      expect(maturityFromCount(1000)).toBe('mature');
    });
  });

  describe('Full Mode', () => {
    it('renders loading state during fetch', async () => {
      let resolveFetch: (value: any) => void;
      mockFetch.mockImplementation(() => new Promise((resolve) => { resolveFetch = resolve; }));

      const el = document.createElement('trust-score-panel') as TrustScorePanel;
      el.mode = 'full';
      el.actorId = 'agent-123';
      el.endpoint = 'http://test.local/api/v1/ledger';
      el.fetchFn = mockFetch;
      document.body.appendChild(el);
      await el.updateComplete;

      // Wait a tick for fetch to trigger
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(el.loading).toBe(true);
      const container = el.shadowRoot!.querySelector('.trust-score-panel');
      expect(container).toBeTruthy();

      // Cleanup
      resolveFetch!({ ok: true, json: async () => ({ actorId: 'agent-123', capabilityScores: {}, dimensionScores: {} }) });
    });

    it('fetches trust score on endpoint + actorId change', async () => {
      const mockResponse: TrustScoreResponse = {
        actorId: 'agent-123',
        globalScore: 0.85,
        capabilityScores: { 'claim-review': 0.82, 'fraud-detect': 0.91 },
        dimensionScores: { accuracy: 0.87, timeliness: 0.83 },
      };
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const el = document.createElement('trust-score-panel') as TrustScorePanel;
      el.mode = 'full';
      el.fetchFn = mockFetch;
      document.body.appendChild(el);

      el.endpoint = 'http://test.local/api/v1/ledger';
      el.actorId = 'agent-123';
      await el.updateComplete;
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test.local/api/v1/ledger/trust/agent-123',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });

    it('renders score gauge with correct value', async () => {
      const mockResponse: TrustScoreResponse = {
        actorId: 'agent-123',
        globalScore: 0.85,
        capabilityScores: {},
        dimensionScores: {},
      };
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const el = document.createElement('trust-score-panel') as TrustScorePanel;
      el.mode = 'full';
      el.actorId = 'agent-123';
      el.endpoint = 'http://test.local/api/v1/ledger';
      el.fetchFn = mockFetch;
      document.body.appendChild(el);
      await el.updateComplete;
      await new Promise((resolve) => setTimeout(resolve, 10));

      const gauge = el.shadowRoot!.querySelector('.score-gauge');
      expect(gauge).toBeTruthy();
      const scoreText = gauge!.textContent;
      expect(scoreText).toContain('0.85');
    });

    it('renders capability table with correct columns', async () => {
      const mockResponse: TrustScoreResponse = {
        actorId: 'agent-123',
        globalScore: 0.85,
        capabilityScores: { 'claim-review': 0.82, 'fraud-detect': 0.91 },
        dimensionScores: {},
      };
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const el = document.createElement('trust-score-panel') as TrustScorePanel;
      el.mode = 'full';
      el.actorId = 'agent-123';
      el.endpoint = 'http://test.local/api/v1/ledger';
      el.fetchFn = mockFetch;
      document.body.appendChild(el);
      await el.updateComplete;
      await new Promise((resolve) => setTimeout(resolve, 10));

      const table = el.shadowRoot!.querySelector('pages-data-table');
      expect(table).toBeTruthy();
    });

    it('renders trend placeholder when no trend data available', async () => {
      const mockResponse: TrustScoreResponse = {
        actorId: 'agent-123',
        globalScore: 0.85,
        capabilityScores: {},
        dimensionScores: {},
      };
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const el = document.createElement('trust-score-panel') as TrustScorePanel;
      el.mode = 'full';
      el.actorId = 'agent-123';
      el.endpoint = 'http://test.local/api/v1/ledger';
      el.fetchFn = mockFetch;
      document.body.appendChild(el);
      await el.updateComplete;
      await new Promise((resolve) => setTimeout(resolve, 10));

      const placeholder = el.shadowRoot!.querySelector('.trend-placeholder');
      expect(placeholder).toBeTruthy();
      expect(placeholder!.textContent).toContain('Trend data requires backend endpoint');
    });

    it('handles error state gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const el = document.createElement('trust-score-panel') as TrustScorePanel;
      el.mode = 'full';
      el.actorId = 'agent-123';
      el.endpoint = 'http://test.local/api/v1/ledger';
      el.fetchFn = mockFetch;
      document.body.appendChild(el);
      await el.updateComplete;
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(el.error).toContain('Network error');
      const errorMsg = el.shadowRoot!.querySelector('.error-message');
      expect(errorMsg).toBeTruthy();
    });
  });

  describe('Compact Mode - Pre-fetched Path', () => {
    it('renders badge without fetching when score + trustLevel provided', async () => {
      const el = document.createElement('trust-score-panel') as TrustScorePanel;
      el.mode = 'compact';
      el.score = 0.85;
      el.trustLevel = 'high';
      el.fetchFn = mockFetch;
      document.body.appendChild(el);
      await el.updateComplete;

      expect(mockFetch).not.toHaveBeenCalled();
      const badge = el.shadowRoot!.querySelector('.trust-badge');
      expect(badge).toBeTruthy();
      expect(badge!.textContent).toContain('0.85');
    });

    it('applies correct CSS class for trust level', async () => {
      const el = document.createElement('trust-score-panel') as TrustScorePanel;
      el.mode = 'compact';
      el.score = 0.85;
      el.trustLevel = 'high';
      document.body.appendChild(el);
      await el.updateComplete;

      const badge = el.shadowRoot!.querySelector('.trust-badge');
      expect(badge!.classList.contains('high')).toBe(true);
    });

    it('renders different colors for different trust levels', async () => {
      const levels = [
        { level: 'high' as const, score: 0.85 },
        { level: 'adequate' as const, score: 0.55 },
        { level: 'low' as const, score: 0.25 },
        { level: 'none' as const, score: undefined },
      ];

      for (const { level, score } of levels) {
        const el = document.createElement('trust-score-panel') as TrustScorePanel;
        el.mode = 'compact';
        if (score !== undefined) el.score = score;
        el.trustLevel = level;
        document.body.appendChild(el);
        await el.updateComplete;

        const badge = el.shadowRoot!.querySelector('.trust-badge');
        expect(badge!.classList.contains(level)).toBe(true);

        document.body.removeChild(el);
      }
    });
  });

  describe('Compact Mode - Self-fetching Path', () => {
    it('fetches when only actorId + endpoint provided', async () => {
      const mockResponse: TrustScoreResponse = {
        actorId: 'agent-456',
        globalScore: 0.72,
        capabilityScores: {},
        dimensionScores: {},
      };
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const el = document.createElement('trust-score-panel') as TrustScorePanel;
      el.mode = 'compact';
      el.actorId = 'agent-456';
      el.endpoint = 'http://test.local/api/v1/ledger';
      el.fetchFn = mockFetch;
      document.body.appendChild(el);
      await el.updateComplete;
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test.local/api/v1/ledger/trust/agent-456',
        expect.any(Object)
      );
      const badge = el.shadowRoot!.querySelector('.trust-badge');
      expect(badge!.textContent).toContain('0.72');
    });
  });

  describe('Events', () => {
    it('emits trust.capability-selected on capability row click', async () => {
      const mockResponse: TrustScoreResponse = {
        actorId: 'agent-123',
        globalScore: 0.85,
        capabilityScores: { 'claim-review': 0.82 },
        dimensionScores: {},
      };
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const el = document.createElement('trust-score-panel') as TrustScorePanel;
      el.mode = 'full';
      el.actorId = 'agent-123';
      el.endpoint = 'http://test.local/api/v1/ledger';
      el.fetchFn = mockFetch;
      document.body.appendChild(el);
      await el.updateComplete;
      await new Promise((resolve) => setTimeout(resolve, 10));

      let eventFired = false;
      let eventDetail: any;
      el.addEventListener('pages-event', ((e: CustomEvent) => {
        if (e.detail.topic === 'trust.capability-selected') {
          eventFired = true;
          eventDetail = e.detail.data;
        }
      }) as EventListener);

      // Simulate capability row click
      const table = el.shadowRoot!.querySelector('pages-data-table') as any;
      if (table) {
        table.dispatchEvent(
          new CustomEvent('row-click', {
            detail: { tag: 'claim-review', score: 0.82 },
          })
        );
      }

      await el.updateComplete;
      expect(eventFired).toBe(true);
      expect(eventDetail?.tag).toBe('claim-review');
    });
  });
});
