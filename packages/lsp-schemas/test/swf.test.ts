import { describe, it, expect } from 'vitest';
import { createSchemaRegistry, handleCompletion, createServerHandler } from '@casehubio/pages-lsp';
import { swfFormat } from '../src/formats/swf.js';

describe('SWF format', () => {
  it('detects .swf.yaml by extension', () => {
    const registry = createSchemaRegistry();
    registry.register(swfFormat);
    const detected = registry.detect('file:///app/flow.swf.yaml', '');
    expect(detected?.formatId).toBe('swf');
  });

  it('detects SWF from content (do: at root)', () => {
    const registry = createSchemaRegistry();
    registry.register(swfFormat);
    const content = 'document:\n  dsl: 1.0.0\ndo:\n  - step1:\n      call: http:get\n';
    const detected = registry.detect('file:///app/flow.yaml', content);
    expect(detected?.formatId).toBe('swf');
  });

  it('does not detect without do:', () => {
    const registry = createSchemaRegistry();
    registry.register(swfFormat);
    const content = 'document:\n  dsl: 1.0.0\nsteps:\n  - step1: {}\n';
    const detected = registry.detect('file:///app/flow.yaml', content);
    expect(detected).toBeUndefined();
  });

  it('extracts task key definitions', () => {
    const registry = createSchemaRegistry();
    registry.register(swfFormat);
    const handler = createServerHandler(registry);
    const content = [
      'do:',
      '  - fetchData:',
      '      call: http:get',
      '  - processData:',
      '      set:',
      '        result: done',
    ].join('\n');
    handler.onDidOpen('file:///flow.swf.yaml', content);
    const result = handler.onPrepareRename('file:///flow.swf.yaml', { line: 1, character: 6 });
    expect(result).not.toBeNull();
    expect(result!.placeholder).toBe('fetchData');
  });

  it('renames task key and then: references', () => {
    const registry = createSchemaRegistry();
    registry.register(swfFormat);
    const handler = createServerHandler(registry);
    const content = [
      'do:',
      '  - fetchData:',
      '      call: http:get',
      '  - processData:',
      '      set:',
      '        result: done',
      '      then: fetchData',
    ].join('\n');
    handler.onDidOpen('file:///flow.swf.yaml', content);
    const result = handler.onRename('file:///flow.swf.yaml', { line: 1, character: 6 }, 'getData');
    expect(result).not.toBeNull();
    const edits = result!.changes['file:///flow.swf.yaml']!;
    expect(edits.length).toBeGreaterThanOrEqual(2);
  });

  it('does not treat flow directives as references', () => {
    const registry = createSchemaRegistry();
    registry.register(swfFormat);
    const handler = createServerHandler(registry);
    const content = [
      'do:',
      '  - step1:',
      '      call: http:get',
      '      then: continue',
    ].join('\n');
    handler.onDidOpen('file:///flow.swf.yaml', content);
    const refs = handler.onReferences('file:///flow.swf.yaml', { line: 1, character: 6 });
    const refNames = refs.map(() => 'ref');
    expect(refs).toHaveLength(1);
  });
});
