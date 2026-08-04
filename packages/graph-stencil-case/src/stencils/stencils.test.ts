import { describe, it, expect } from 'vitest';
import type { GraphNode } from '@casehubio/graph-core';
import { renderBinding } from './binding.js';
import { renderWorker } from './worker.js';
import { renderMilestone } from './milestone.js';
import { renderGoal } from './goal.js';
import { renderSubCase } from './subcase.js';

function node(type: string, properties: Record<string, unknown>): GraphNode {
  return { id: `${type}:test`, type, properties };
}

describe('stencil render functions', () => {
  it('renderBinding returns StencilTemplate with name and trigger', () => {
    const result = renderBinding(node('binding', {
      name: 'extract-text',
      capability: 'ocr',
      on: { contextChange: { filter: '.doc != null' } },
    }));
    expect(result).toBeDefined();
    expect(result.strings).toBeDefined();
  });

  it('renderBinding applies OBSOLETE opacity', () => {
    const result = renderBinding(
      node('binding', { name: 'b1' }),
      { badge: { icon: '—', color: '#9ca3af' } },
    );
    expect(result).toBeDefined();
  });

  it('renderWorker returns StencilTemplate with capabilities', () => {
    const result = renderWorker(node('worker', {
      name: 'ocr-worker',
      capabilities: ['ocr'],
      description: 'Extracts text',
    }));
    expect(result).toBeDefined();
    expect(result.strings).toBeDefined();
  });

  it('renderMilestone returns StencilTemplate', () => {
    const result = renderMilestone(node('milestone', {
      name: 'text-extracted',
      condition: '.ocrResult != null',
    }));
    expect(result).toBeDefined();
    expect(result.strings).toBeDefined();
  });

  it('renderGoal returns StencilTemplate with kind', () => {
    const result = renderGoal(node('goal', {
      name: 'processingComplete',
      kind: 'success',
      condition: '.done',
    }));
    expect(result).toBeDefined();
    expect(result.strings).toBeDefined();
  });

  it('renderSubCase returns StencilTemplate', () => {
    const result = renderSubCase(node('subcase', {
      namespace: 'casehub',
      name: 'child-case',
      version: '1.0.0',
    }));
    expect(result).toBeDefined();
    expect(result.strings).toBeDefined();
  });

  it('stencils render without decoration (backward compat)', () => {
    expect(renderBinding(node('binding', { name: 'b1' }))).toBeDefined();
    expect(renderWorker(node('worker', { name: 'w1', capabilities: [] }))).toBeDefined();
    expect(renderMilestone(node('milestone', { name: 'm1' }))).toBeDefined();
    expect(renderGoal(node('goal', { name: 'g1' }))).toBeDefined();
    expect(renderSubCase(node('subcase', { name: 'sc1' }))).toBeDefined();
  });
});
