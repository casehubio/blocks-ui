import { describe, it, expect, afterEach } from 'vitest';
import type { GraphModel } from '@casehubio/graph-core';
import './blocks-case-dependency-graph.js';

async function waitForGraph(el: any): Promise<void> {
  await el.updateComplete;
  await el.updateComplete;
}

const SAMPLE_MODEL: GraphModel = {
  nodes: [
    { id: 'a', type: 'case', properties: { label: 'Case A', status: 'RUNNING', domain: 'case' } },
    { id: 'b', type: 'case', properties: { label: 'Case B', status: 'COMPLETED', domain: 'case' } },
  ],
  edges: [
    { id: 'e1', type: 'parent_child', source: 'a', target: 'b' },
  ],
};

describe('blocks-case-dependency-graph', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('registers as a custom element', () => {
    expect(customElements.get('blocks-case-dependency-graph')).toBeDefined();
  });

  it('renders empty state when no data', async () => {
    const el = document.createElement('blocks-case-dependency-graph') as any;
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).toContain('No graph data');
  });

  it('renders SVG when graphData is set', async () => {
    const el = document.createElement('blocks-case-dependency-graph') as any;
    el.graphData = SAMPLE_MODEL;
    document.body.appendChild(el);
    await waitForGraph(el);
    const svg = el.shadowRoot!.querySelector('svg');
    expect(svg).toBeTruthy();
  });

  it('renders toolbar when data is present', async () => {
    const el = document.createElement('blocks-case-dependency-graph') as any;
    el.graphData = SAMPLE_MODEL;
    document.body.appendChild(el);
    await waitForGraph(el);
    const toolbar = el.shadowRoot!.querySelector('blocks-dependency-toolbar');
    expect(toolbar).toBeTruthy();
  });

  it('drops edges with dangling references', async () => {
    const model: GraphModel = {
      nodes: [{ id: 'a', type: 'case', properties: { label: 'A' } }],
      edges: [{ id: 'e1', type: 'parent_child', source: 'a', target: 'missing' }],
    };
    const el = document.createElement('blocks-case-dependency-graph') as any;
    el.graphData = model;
    document.body.appendChild(el);
    await el.updateComplete;
    await new Promise(r => setTimeout(r, 50));
    const lines = el.shadowRoot!.querySelectorAll('line');
    expect(lines.length).toBe(0);
  });

  it('exportDOT returns a DOT string', async () => {
    const el = document.createElement('blocks-case-dependency-graph') as any;
    el.graphData = SAMPLE_MODEL;
    document.body.appendChild(el);
    await el.updateComplete;
    const dot = el.exportDOT();
    expect(dot).toContain('digraph');
    expect(dot).toContain('"a"');
  });

  it('renders empty state for model with no nodes', async () => {
    const el = document.createElement('blocks-case-dependency-graph') as any;
    el.graphData = { nodes: [], edges: [] };
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).toContain('No graph data');
  });

  it('has accessible SVG with role and aria-label', async () => {
    const el = document.createElement('blocks-case-dependency-graph') as any;
    el.graphData = SAMPLE_MODEL;
    document.body.appendChild(el);
    await waitForGraph(el);
    const svg = el.shadowRoot!.querySelector('svg');
    expect(svg?.getAttribute('role')).toBe('img');
    expect(svg?.getAttribute('aria-label')).toContain('2 cases');
    expect(svg?.getAttribute('aria-label')).toContain('1 relationship');
  });
});
