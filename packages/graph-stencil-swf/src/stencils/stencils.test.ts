import { describe, it, expect } from 'vitest';
import { renderCall } from './call.js';
import { renderSet } from './set.js';
import { renderSwitch } from './switch.js';
import { renderRaise } from './raise.js';
import { renderTry } from './try.js';
import { renderTryCatch } from './try-catch.js';
import { renderStart, renderEnd, renderEntry, renderExit } from './boundary.js';
import { renderGeneric } from './generic.js';
import type { GraphNode } from '@casehubio/graph-core';

function makeNode(type: string, properties: Record<string, unknown> = {}): GraphNode {
  return { id: 'test-1', type, properties };
}

describe('SWF stencil render functions', () => {
  it('renderCall returns template for http call', () => {
    const result = renderCall(makeNode('swf-call', { call: 'http', label: 'fetchData' }));
    expect(result).toBeDefined();
    expect(result.values).toBeDefined();
  });

  it('renderCall handles casehub:dispatch', () => {
    const result = renderCall(makeNode('swf-call', { call: 'casehub:dispatch' }));
    expect(result).toBeDefined();
  });

  it('renderCall handles unknown call type with default icon', () => {
    const result = renderCall(makeNode('swf-call', { call: 'custom-function' }));
    expect(result).toBeDefined();
  });

  it('renderSet shows variable names', () => {
    const result = renderSet(makeNode('swf-set', { set: { output: 'value', count: 0 }, label: 'setVars' }));
    expect(result).toBeDefined();
  });

  it('renderSwitch shows case count', () => {
    const result = renderSwitch(makeNode('swf-switch', { switch: [{ when: 'a' }, { when: 'b' }], label: 'check' }));
    expect(result).toBeDefined();
  });

  it('renderRaise shows error title', () => {
    const result = renderRaise(makeNode('swf-raise', { raise: { error: { type: 'myErr', title: 'Failed' } }, label: 'fail' }));
    expect(result).toBeDefined();
  });

  it('renderTry returns template', () => {
    const result = renderTry(makeNode('swf-try', { label: 'tryBlock' }));
    expect(result).toBeDefined();
  });

  it('renderTryCatch shows error filter', () => {
    const result = renderTryCatch(makeNode('swf-try-catch', { errors: { with: { type: 'myErr' } }, label: 'catch' }));
    expect(result).toBeDefined();
  });

  it('boundary stencils render markers', () => {
    expect(renderStart(makeNode('swf-start'))).toBeDefined();
    expect(renderEnd(makeNode('swf-end'))).toBeDefined();
    expect(renderEntry(makeNode('swf-entry'))).toBeDefined();
    expect(renderExit(makeNode('swf-exit'))).toBeDefined();
  });

  it('renderGeneric shows originalType as label', () => {
    const result = renderGeneric(makeNode('swf-generic', { originalType: 'emit', label: 'emitEvent' }));
    expect(result).toBeDefined();
  });

  it('renderGeneric handles missing originalType', () => {
    const result = renderGeneric(makeNode('swf-generic', {}));
    expect(result).toBeDefined();
  });
});
