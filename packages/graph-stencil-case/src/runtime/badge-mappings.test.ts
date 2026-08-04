import { describe, it, expect } from 'vitest';
import {
  TASK_STATUS_DECORATIONS,
  MILESTONE_STATUS_DECORATIONS,
  UNKNOWN_DECORATION,
  TERMINAL_SEVERITY,
  isActiveStatus,
} from './badge-mappings.js';

describe('TASK_STATUS_DECORATIONS', () => {
  it('maps all 9 TaskStatus values', () => {
    const statuses = [
      'PENDING', 'RUNNING', 'DELEGATED', 'SUSPENDED',
      'COMPLETED', 'FAULTED', 'REJECTED', 'OBSOLETE', 'CANCELLED',
    ];
    for (const s of statuses) {
      expect(TASK_STATUS_DECORATIONS[s]).toBeDefined();
      expect(TASK_STATUS_DECORATIONS[s]!.badge).toBeDefined();
      expect(TASK_STATUS_DECORATIONS[s]!.badge!.icon).toBeTruthy();
      expect(TASK_STATUS_DECORATIONS[s]!.badge!.color).toBeTruthy();
    }
  });

  it('sets pulse only for RUNNING', () => {
    expect(TASK_STATUS_DECORATIONS['RUNNING']!.badge!.pulse).toBe(true);
    for (const s of ['PENDING', 'DELEGATED', 'SUSPENDED', 'COMPLETED', 'FAULTED', 'REJECTED', 'OBSOLETE', 'CANCELLED']) {
      expect(TASK_STATUS_DECORATIONS[s]!.badge!.pulse).toBeFalsy();
    }
  });

  it('sets border for active states except PENDING', () => {
    expect(TASK_STATUS_DECORATIONS['RUNNING']!.border).toBeDefined();
    expect(TASK_STATUS_DECORATIONS['DELEGATED']!.border).toBeDefined();
    expect(TASK_STATUS_DECORATIONS['SUSPENDED']!.border).toBeDefined();
    expect(TASK_STATUS_DECORATIONS['PENDING']!.border).toBeUndefined();
    expect(TASK_STATUS_DECORATIONS['COMPLETED']!.border).toBeUndefined();
  });
});

describe('MILESTONE_STATUS_DECORATIONS', () => {
  it('maps all 3 MilestoneLifecycleStatus values', () => {
    for (const s of ['PENDING', 'ACTIVE', 'COMPLETED']) {
      expect(MILESTONE_STATUS_DECORATIONS[s]).toBeDefined();
      expect(MILESTONE_STATUS_DECORATIONS[s]!.badge).toBeDefined();
    }
  });

  it('sets pulse only for ACTIVE', () => {
    expect(MILESTONE_STATUS_DECORATIONS['ACTIVE']!.badge!.pulse).toBe(true);
    expect(MILESTONE_STATUS_DECORATIONS['PENDING']!.badge!.pulse).toBeFalsy();
    expect(MILESTONE_STATUS_DECORATIONS['COMPLETED']!.badge!.pulse).toBeFalsy();
  });
});

describe('UNKNOWN_DECORATION', () => {
  it('has a gray question mark badge', () => {
    expect(UNKNOWN_DECORATION.badge!.icon).toBe('?');
    expect(UNKNOWN_DECORATION.badge!.color).toBe('#9ca3af');
  });
});

describe('TERMINAL_SEVERITY', () => {
  it('ranks FAULTED highest', () => {
    expect(TERMINAL_SEVERITY['FAULTED']!).toBeGreaterThan(TERMINAL_SEVERITY['REJECTED']!);
    expect(TERMINAL_SEVERITY['REJECTED']!).toBeGreaterThan(TERMINAL_SEVERITY['CANCELLED']!);
    expect(TERMINAL_SEVERITY['CANCELLED']!).toBeGreaterThan(TERMINAL_SEVERITY['OBSOLETE']!);
    expect(TERMINAL_SEVERITY['OBSOLETE']!).toBeGreaterThan(TERMINAL_SEVERITY['COMPLETED']!);
  });
});

describe('isActiveStatus', () => {
  it('returns true for active states', () => {
    for (const s of ['PENDING', 'RUNNING', 'DELEGATED', 'SUSPENDED']) {
      expect(isActiveStatus(s)).toBe(true);
    }
  });

  it('returns false for terminal states', () => {
    for (const s of ['COMPLETED', 'FAULTED', 'REJECTED', 'OBSOLETE', 'CANCELLED']) {
      expect(isActiveStatus(s)).toBe(false);
    }
  });

  it('returns false for unknown states', () => {
    expect(isActiveStatus('UNKNOWN')).toBe(false);
  });
});
