import { describe, it, expect } from 'vitest';
import { lookupStatus, registerStatus } from './status.js';

describe('lookupStatus', () => {
  it('returns exact domain:state match', () => {
    const d = lookupStatus('case', 'STARTING');
    expect(d.category).toBe('info');
    expect(d.icon).toBe('◐');
  });

  it('falls back to cross-domain default when domain provided', () => {
    const d = lookupStatus('case', 'COMPLETED');
    expect(d.category).toBe('success');
    expect(d.icon).toBe('✓');
  });

  it('uses cross-domain default when domain is undefined', () => {
    const d = lookupStatus(undefined, 'COMPLETED');
    expect(d.category).toBe('success');
  });

  it('returns fallback for unknown state', () => {
    const d = lookupStatus('case', 'NONEXISTENT');
    expect(d.category).toBe('neutral');
    expect(d.icon).toBe('?');
  });

  it('does not scan per-domain entries when domain is undefined', () => {
    const d = lookupStatus(undefined, 'STARTING');
    expect(d.category).toBe('neutral');
    expect(d.icon).toBe('?');
  });

  describe('all built-in domains resolve', () => {
    const domains: Array<[string, string[]]> = [
      ['case', ['STARTING', 'RUNNING', 'WAITING', 'SUSPENDED', 'COMPLETED', 'FAULTED', 'CANCELLED']],
      ['task', ['PENDING', 'RUNNING', 'DELEGATED', 'SUSPENDED', 'COMPLETED', 'FAULTED', 'REJECTED', 'OBSOLETE', 'CANCELLED']],
      ['workitem', ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'FAULTED', 'DELEGATED', 'SUSPENDED', 'CANCELLED', 'EXPIRED', 'ESCALATED', 'OBSOLETE']],
      ['milestone', ['PENDING', 'ACTIVE', 'COMPLETED']],
      ['outcome', ['SUCCESS', 'DECLINED', 'FAILED', 'EXPIRED', 'ESCALATED', 'COMPLETED']],
      ['group', ['IN_PROGRESS', 'COMPLETED', 'REJECTED']],
      ['sla', ['NOT_STARTED', 'ON_TRACK', 'BREACHED']],
      ['node', ['PENDING', 'DISPATCHED', 'COMPLETED', 'FAILED', 'SKIPPED', 'CANCELLED']],
      ['session', ['ACTIVE', 'WAITING', 'IDLE']],
      ['commitment', ['OPEN', 'ACKNOWLEDGED', 'FULFILLED', 'FAILED', 'DECLINED', 'DELEGATED', 'EXPIRED']],
    ];

    for (const [domain, states] of domains) {
      for (const state of states) {
        it(`${domain}:${state} resolves to a non-fallback descriptor`, () => {
          const d = lookupStatus(domain, state);
          expect(d.icon).not.toBe('?');
        });
      }
    }
  });
});

describe('registerStatus', () => {
  it('overrides existing registration', () => {
    registerStatus('_test', 'FOO', { category: 'danger', icon: 'X' });
    expect(lookupStatus('_test', 'FOO').category).toBe('danger');
    registerStatus('_test', 'FOO', { category: 'success', icon: 'Y' });
    expect(lookupStatus('_test', 'FOO').category).toBe('success');
  });
});
