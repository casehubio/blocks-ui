import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LitElement } from 'lit';
import type { GraphEdit } from '@casehubio/graph-renderer';
import { DiagramBaseMixin } from './diagram-base-mixin.js';
import type { AdapterResult } from './diagram-base-mixin.js';

class TestDiagram extends DiagramBaseMixin(LitElement) {
  public appliedEdits: GraphEdit[] = [];

  protected _adaptYaml(yaml: string): AdapterResult {
    return { model: { nodes: [], edges: [] }, yamlPaths: new Map() };
  }

  protected _applyPropertyEdit(
    yaml: string,
    _nodePath: readonly (string | number)[],
    _field: (string | number)[],
    _value: unknown,
  ): string {
    return yaml;
  }

  protected override _applyGraphEdit(yaml: string, edit: GraphEdit): string {
    this.appliedEdits.push(edit);
    return yaml + '\n# edited';
  }

  protected _emptyTemplate(): string | null {
    return null;
  }
}

class FailingTestDiagram extends TestDiagram {
  protected override _applyGraphEdit(_yaml: string, _edit: GraphEdit): string {
    throw new Error('mutation failed');
  }
}

if (!customElements.get('test-diagram')) {
  customElements.define('test-diagram', TestDiagram);
}
if (!customElements.get('failing-test-diagram')) {
  customElements.define('failing-test-diagram', FailingTestDiagram);
}

describe('_handleMutation', () => {
  let el: TestDiagram;

  beforeEach(() => {
    el = new TestDiagram();
    (el as any)._currentYaml = 'original: yaml';
    (el as any)._savedYaml = 'original: yaml';
  });

  it('pushes undo, calls _applyGraphEdit, and updates yaml', () => {
    const edit: GraphEdit = { type: 'addNode', nodeType: 'worker' };
    el._handleMutation(edit);

    expect(el.appliedEdits).toHaveLength(1);
    expect(el.appliedEdits[0]).toEqual(edit);
    expect((el as any)._currentYaml).toBe('original: yaml\n# edited');
    expect((el as any)._undoStack).toHaveLength(1);
    expect((el as any)._undoStack[0]).toBe('original: yaml');
  });

  it('is no-op when readonly', () => {
    el.readonly = true;
    el._handleMutation({ type: 'addNode', nodeType: 'worker' });
    expect(el.appliedEdits).toHaveLength(0);
  });

  it('rolls back undo on _applyGraphEdit error', () => {
    const failing = new FailingTestDiagram();
    (failing as any)._currentYaml = 'original: yaml';
    (failing as any)._savedYaml = 'original: yaml';

    failing._handleMutation({ type: 'addNode', nodeType: 'worker' });

    expect((failing as any)._currentYaml).toBe('original: yaml');
    expect((failing as any)._error).toContain('mutation failed');
  });
});
