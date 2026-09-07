import { describe, it, expect } from 'vitest';
import { orgLayoutOptions } from './layout-strategy.js';

describe('orgLayoutOptions', () => {
  it('maps tree to mrtree DOWN', () => {
    const opts = orgLayoutOptions('tree');
    expect(opts.algorithm).toBe('mrtree');
    expect(opts.direction).toBe('DOWN');
  });

  it('maps flow to layered RIGHT', () => {
    const opts = orgLayoutOptions('flow');
    expect(opts.algorithm).toBe('layered');
    expect(opts.direction).toBe('RIGHT');
  });

  it('maps star to mrtree DOWN', () => {
    const opts = orgLayoutOptions('star');
    expect(opts.algorithm).toBe('mrtree');
    expect(opts.direction).toBe('DOWN');
  });

  it('maps force to force', () => {
    const opts = orgLayoutOptions('force');
    expect(opts.algorithm).toBe('force');
  });

  it('maps circular to stress', () => {
    const opts = orgLayoutOptions('circular');
    expect(opts.algorithm).toBe('stress');
  });

  it('maps layered to layered DOWN', () => {
    const opts = orgLayoutOptions('layered');
    expect(opts.algorithm).toBe('layered');
    expect(opts.direction).toBe('DOWN');
  });

  it('maps nested to layered with extra padding', () => {
    const opts = orgLayoutOptions('nested');
    expect(opts.algorithm).toBe('layered');
    expect(opts.containerPadding).toBeGreaterThan(20);
  });

  it('maps hub-spoke to stress', () => {
    const opts = orgLayoutOptions('hub-spoke');
    expect(opts.algorithm).toBe('stress');
  });

  it('maps radial to radial', () => {
    const opts = orgLayoutOptions('radial');
    expect(opts.algorithm).toBe('radial');
  });

  it('maps grid to layered with spacing', () => {
    const opts = orgLayoutOptions('grid');
    expect(opts.algorithm).toBe('layered');
    expect(opts.direction).toBe('DOWN');
  });

  it('always includes spacing', () => {
    const strategies = [
      'star', 'tree', 'circular', 'layered', 'nested',
      'hub-spoke', 'flow', 'radial', 'grid', 'force',
    ] as const;
    for (const s of strategies) {
      const opts = orgLayoutOptions(s);
      expect(opts.spacing).toBeGreaterThan(0);
    }
  });
});
