import { describe, it, expect, vi } from 'vitest';
import { EvolutionApi } from './api.js';
import type { DenyPatternView, GatePolicy } from './types.js';

function mockFetch(response: unknown, status = 200): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(response),
  }) as unknown as typeof fetch;
}

describe('EvolutionApi', () => {
  it('getDenyPatterns sends GET with caseId and tenancyId', async () => {
    const view: DenyPatternView = { staticPatterns: ['Foo'], dynamicPatterns: [] };
    const fn = mockFetch(view);
    const api = new EvolutionApi('/api/evolution', fn);
    const result = await api.getDenyPatterns('case-1', 'tenant-1');
    expect(result).toEqual(view);
    expect(fn).toHaveBeenCalledWith(
      expect.stringContaining('/getDenyPatterns?caseId=case-1&tenancyId=tenant-1'),
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('addDenyPattern sends POST with pattern', async () => {
    const fn = mockFetch(undefined);
    const api = new EvolutionApi('/api/evolution', fn);
    await api.addDenyPattern('case-1', 'tenant-1', 'SomeClass');
    expect(fn).toHaveBeenCalledWith(
      expect.stringContaining('/addDenyPattern'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ caseId: 'case-1', tenancyId: 'tenant-1', pattern: 'SomeClass' }),
      }),
    );
  });

  it('removeDenyPattern sends POST', async () => {
    const fn = mockFetch(undefined);
    const api = new EvolutionApi('/api/evolution', fn);
    await api.removeDenyPattern('case-1', 'tenant-1', 'SomeClass');
    expect(fn).toHaveBeenCalledWith(
      expect.stringContaining('/removeDenyPattern'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('addWatchPattern spreads input fields', async () => {
    const fn = mockFetch(undefined);
    const api = new EvolutionApi('/api/evolution', fn);
    await api.addWatchPattern('case-1', 'tenant-1', {
      category: 'lint-fix', targetPattern: '*.java',
    });
    const body = JSON.parse((fn as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.category).toBe('lint-fix');
    expect(body.targetPattern).toBe('*.java');
    expect(body.caseId).toBe('case-1');
  });

  it('resolveGate sends GateOutcome not InboxEntryStatus', async () => {
    const fn = mockFetch(undefined);
    const api = new EvolutionApi('/api/evolution', fn);
    await api.resolveGate('case-1', 'tenant-1', 'entry-1', 'APPROVED', 'looks good');
    const body = JSON.parse((fn as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.outcome).toBe('APPROVED');
    expect(body.reason).toBe('looks good');
  });

  it('setGatePolicy sends full GatePolicy object', async () => {
    const fn = mockFetch(undefined);
    const api = new EvolutionApi('/api/evolution', fn);
    const policy: GatePolicy = { modes: { 'pr-review': 'GATED' }, gateTimeoutMinutes: 720 };
    await api.setGatePolicy('case-1', 'tenant-1', policy);
    const body = JSON.parse((fn as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.policy).toEqual(policy);
  });

  it('getGatePolicy sends GET', async () => {
    const policy: GatePolicy = { modes: { 'pr-review': 'GATED' }, gateTimeoutMinutes: null };
    const fn = mockFetch(policy);
    const api = new EvolutionApi('/api/evolution', fn);
    const result = await api.getGatePolicy('case-1', 'tenant-1');
    expect(result).toEqual(policy);
  });

  it('resetCircuitBreaker sends POST', async () => {
    const fn = mockFetch(undefined);
    const api = new EvolutionApi('/api/evolution', fn);
    await api.resetCircuitBreaker('case-1');
    expect(fn).toHaveBeenCalledWith(
      expect.stringContaining('/resetCircuitBreaker'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('throws on non-OK response', async () => {
    const fn = mockFetch(undefined, 500);
    const api = new EvolutionApi('/api/evolution', fn);
    await expect(api.getDenyPatterns('c', 't')).rejects.toThrow('500');
  });

  it('encodes tenancyId in query params', async () => {
    const fn = mockFetch({ staticPatterns: [], dynamicPatterns: [] });
    const api = new EvolutionApi('/api/evolution', fn);
    await api.getDenyPatterns('case-1', 'tenant/with spaces');
    expect(fn).toHaveBeenCalledWith(
      expect.stringContaining('tenancyId=tenant%2Fwith%20spaces'),
      expect.any(Object),
    );
  });
});
