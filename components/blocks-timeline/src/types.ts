import type { TemplateResult } from 'lit';

export type NodeStatus = 'completed' | 'active' | 'pending' | 'failed' | 'skipped';

export interface TimelineNode {
  key: string;
  label: string;
  status: NodeStatus;
  timestamp?: string;
  actor?: string;
  detail?: unknown;
  category?: string;
}

export type Layout = 'vertical' | 'horizontal' | 'compact';

export interface TimelineStrategy<T = unknown> {
  toNodes(data: T): TimelineNode[];
  transformData?: (raw: unknown) => T;
  defaultLayout: Layout;
  renderNode?: (node: TimelineNode) => TemplateResult;
  renderDetail?: (node: TimelineNode) => TemplateResult;
  filterCategories?: string[];
}

export interface StageConfig {
  key: string;
  label: string;
  icon?: string;
  terminal?: 'success' | 'failure';
}
