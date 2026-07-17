import { describe, it, expect } from 'vitest';
import type { TimelineNode, TimelineStrategy, StageConfig, Layout, NodeStatus, PaginationMeta } from './types.js';

describe('types', () => {
  it('TimelineNode accepts all valid statuses', () => {
    const statuses: NodeStatus[] = ['completed', 'active', 'pending', 'failed', 'skipped'];
    statuses.forEach(status => {
      const node: TimelineNode = { key: 'k', label: 'l', status };
      expect(node.status).toBe(status);
    });
  });

  it('TimelineNode optional fields default to undefined', () => {
    const node: TimelineNode = { key: 'k', label: 'l', status: 'pending' };
    expect(node.timestamp).toBeUndefined();
    expect(node.actor).toBeUndefined();
    expect(node.detail).toBeUndefined();
    expect(node.category).toBeUndefined();
  });

  it('Layout type accepts all valid values', () => {
    const layouts: Layout[] = ['vertical', 'horizontal', 'compact'];
    expect(layouts).toHaveLength(3);
  });

  it('StageConfig terminal field distinguishes success from failure', () => {
    const success: StageConfig = { key: 'DONE', label: 'Done', terminal: 'success' };
    const failure: StageConfig = { key: 'FAILED', label: 'Failed', terminal: 'failure' };
    const waypoint: StageConfig = { key: 'OPEN', label: 'Open' };
    expect(success.terminal).toBe('success');
    expect(failure.terminal).toBe('failure');
    expect(waypoint.terminal).toBeUndefined();
  });

  it('TimelineStrategy contract is satisfiable', () => {
    const strategy: TimelineStrategy<string[]> = {
      toNodes: (data) => data.map((d, i) => ({ key: String(i), label: d, status: 'pending' as const })),
      defaultLayout: 'vertical',
    };
    const nodes = strategy.toNodes(['a', 'b']);
    expect(nodes).toHaveLength(2);
    expect(nodes[0]!.label).toBe('a');
  });

  it('PaginationMeta holds page state', () => {
    const meta: PaginationMeta = { page: 0, totalPages: 5, totalElements: 100 };
    expect(meta.page).toBe(0);
    expect(meta.totalPages).toBe(5);
    expect(meta.totalElements).toBe(100);
  });

  it('TimelineStrategy pagination fields are optional', () => {
    const strategy: TimelineStrategy<string[]> = {
      toNodes: (data) => data.map((d, i) => ({ key: String(i), label: d, status: 'pending' as const })),
      defaultLayout: 'vertical',
    };
    expect(strategy.supportsPagination).toBeUndefined();
    expect(strategy.extractPaginationMeta).toBeUndefined();
  });

  it('TimelineStrategy with pagination extracts meta', () => {
    const strategy: TimelineStrategy<string[]> = {
      toNodes: (data) => data.map((d, i) => ({ key: String(i), label: d, status: 'pending' as const })),
      defaultLayout: 'vertical',
      supportsPagination: true,
      extractPaginationMeta: (raw) => {
        const r = raw as { page: number; totalPages: number; totalElements: number };
        return r.page != null ? { page: r.page, totalPages: r.totalPages, totalElements: r.totalElements } : undefined;
      },
    };
    expect(strategy.supportsPagination).toBe(true);
    expect(strategy.extractPaginationMeta!({ page: 1, totalPages: 3, totalElements: 60 }))
      .toEqual({ page: 1, totalPages: 3, totalElements: 60 });
  });

  it('TimelineStrategy with transformData processes raw input', () => {
    const strategy: TimelineStrategy<string[]> = {
      toNodes: (data) => data.map((d, i) => ({ key: String(i), label: d, status: 'pending' as const })),
      transformData: (raw) => (raw as { items: string[] }).items,
      defaultLayout: 'vertical',
    };
    const raw = { items: ['x', 'y'] };
    const transformed = strategy.transformData!(raw);
    expect(strategy.toNodes(transformed)).toHaveLength(2);
  });
});
