import { describe, it, expect } from 'vitest';
import { PROFESSION_PRESETS, PROFESSION_LIST } from './profession-presets.js';
import { ARCHETYPE_CONFIGS } from '@casehubio/agent-avatar-2d';

describe('PROFESSION_PRESETS', () => {
  it('has at least 5 professions', () => {
    expect(Object.keys(PROFESSION_PRESETS).length).toBeGreaterThanOrEqual(5);
  });

  it('every role maps to a valid archetype key', () => {
    for (const [profession, roles] of Object.entries(PROFESSION_PRESETS)) {
      for (const { role, archetype } of roles) {
        expect(ARCHETYPE_CONFIGS, `${profession}/${role} → ${archetype} not found`).toHaveProperty(archetype);
      }
    }
  });

  it('Software has at least 4 roles', () => {
    expect(PROFESSION_PRESETS['Software'].length).toBeGreaterThanOrEqual(4);
  });

  it('PROFESSION_LIST is sorted', () => {
    const sorted = [...PROFESSION_LIST].sort();
    expect(PROFESSION_LIST).toEqual(sorted);
  });
});
