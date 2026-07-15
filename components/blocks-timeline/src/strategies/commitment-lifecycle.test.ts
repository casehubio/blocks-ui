import { describe, it, expect } from 'vitest';
import {
  commitmentLifecycleStrategy,
  COMMITMENT_STAGES,
  type CommitmentState,
} from './commitment-lifecycle.js';
import { linearResolveStatus } from './state-progression.js';
import type { StageConfig } from '../types.js';

describe('commitmentLifecycleStrategy', () => {
  describe('COMMITMENT_STAGES', () => {
    it('has 4 stages', () => {
      expect(COMMITMENT_STAGES).toHaveLength(4);
    });

    it('defines COMMANDED, ACKNOWLEDGED, DONE, DECLINED', () => {
      expect(COMMITMENT_STAGES.map(s => s.key)).toEqual([
        'COMMANDED', 'ACKNOWLEDGED', 'DONE', 'DECLINED',
      ]);
    });

    it('marks DONE as terminal success', () => {
      expect(COMMITMENT_STAGES.find(s => s.key === 'DONE')!.terminal).toBe('success');
    });

    it('marks DECLINED as terminal failure', () => {
      expect(COMMITMENT_STAGES.find(s => s.key === 'DECLINED')!.terminal).toBe('failure');
    });

    it('has COMMANDED and ACKNOWLEDGED without terminal', () => {
      expect(COMMITMENT_STAGES.find(s => s.key === 'COMMANDED')!.terminal).toBeUndefined();
      expect(COMMITMENT_STAGES.find(s => s.key === 'ACKNOWLEDGED')!.terminal).toBeUndefined();
    });
  });

  describe('toNodes with default stages', () => {
    it('maps commitment stages to nodes', () => {
      const strategy = commitmentLifecycleStrategy();
      const nodes = strategy.toNodes({
        currentState: 'COMMANDED',
        transitions: [],
      });
      expect(nodes).toHaveLength(4);
      expect(nodes.map(n => n.key)).toEqual(['COMMANDED', 'ACKNOWLEDGED', 'DONE', 'DECLINED']);
    });

    it('uses stage labels as node labels', () => {
      const strategy = commitmentLifecycleStrategy();
      const nodes = strategy.toNodes({ currentState: 'COMMANDED', transitions: [] });
      expect(nodes[0]!.label).toBe('Commanded');
      expect(nodes[1]!.label).toBe('Acknowledged');
    });

    it('marks current stage as active for non-terminal', () => {
      const strategy = commitmentLifecycleStrategy();
      const nodes = strategy.toNodes({ currentState: 'ACKNOWLEDGED', transitions: [] });
      expect(nodes.find(n => n.key === 'ACKNOWLEDGED')!.status).toBe('active');
    });

    it('marks stages before current as completed (linearResolveStatus)', () => {
      const strategy = commitmentLifecycleStrategy();
      const nodes = strategy.toNodes({ currentState: 'ACKNOWLEDGED', transitions: [] });
      expect(nodes.find(n => n.key === 'COMMANDED')!.status).toBe('completed');
    });

    it('marks stages after current as pending', () => {
      const strategy = commitmentLifecycleStrategy();
      const nodes = strategy.toNodes({ currentState: 'ACKNOWLEDGED', transitions: [] });
      expect(nodes.find(n => n.key === 'DONE')!.status).toBe('pending');
      expect(nodes.find(n => n.key === 'DECLINED')!.status).toBe('pending');
    });

    it('marks DONE as completed when reached', () => {
      const strategy = commitmentLifecycleStrategy();
      const nodes = strategy.toNodes({ currentState: 'DONE', transitions: [] });
      expect(nodes.find(n => n.key === 'DONE')!.status).toBe('completed');
    });

    it('marks DECLINED as failed when reached', () => {
      const strategy = commitmentLifecycleStrategy();
      const nodes = strategy.toNodes({ currentState: 'DECLINED', transitions: [] });
      expect(nodes.find(n => n.key === 'DECLINED')!.status).toBe('failed');
    });

    it('populates actor and timestamp from transitions', () => {
      const strategy = commitmentLifecycleStrategy();
      const nodes = strategy.toNodes({
        currentState: 'ACKNOWLEDGED',
        transitions: [
          { state: 'COMMANDED', actor: 'requester', timestamp: '2026-01-01T00:00:00Z' },
          { state: 'ACKNOWLEDGED', actor: 'agent-1', timestamp: '2026-01-01T01:00:00Z' },
        ],
      });
      expect(nodes.find(n => n.key === 'COMMANDED')!.actor).toBe('requester');
      expect(nodes.find(n => n.key === 'COMMANDED')!.timestamp).toBe('2026-01-01T00:00:00Z');
      expect(nodes.find(n => n.key === 'ACKNOWLEDGED')!.actor).toBe('agent-1');
    });

    it('leaves actor/timestamp undefined for stages without transitions', () => {
      const strategy = commitmentLifecycleStrategy();
      const nodes = strategy.toNodes({ currentState: 'COMMANDED', transitions: [] });
      expect(nodes.find(n => n.key === 'DONE')!.actor).toBeUndefined();
      expect(nodes.find(n => n.key === 'DONE')!.timestamp).toBeUndefined();
    });
  });

  describe('transformData', () => {
    it('is defined', () => {
      expect(commitmentLifecycleStrategy().transformData).toBeDefined();
    });

    it('maps CommitmentState to StateData', () => {
      const strategy = commitmentLifecycleStrategy();
      const raw: CommitmentState = {
        id: 'c1',
        currentStage: 'ACKNOWLEDGED',
        stages: [
          { key: 'COMMANDED', status: 'completed', actor: 'sys', timestamp: '2026-01-01T00:00:00Z' },
          { key: 'ACKNOWLEDGED', status: 'active', actor: 'agent-1', timestamp: '2026-01-01T01:00:00Z' },
        ],
      };

      const transformed = strategy.transformData!(raw);
      expect(transformed).toEqual({
        currentState: 'ACKNOWLEDGED',
        transitions: [
          { state: 'COMMANDED', actor: 'sys', timestamp: '2026-01-01T00:00:00Z' },
          { state: 'ACKNOWLEDGED', actor: 'agent-1', timestamp: '2026-01-01T01:00:00Z' },
        ],
      });
    });

    it('handles empty stages array', () => {
      const strategy = commitmentLifecycleStrategy();
      const transformed = strategy.transformData!({
        id: 'c1',
        currentStage: 'COMMANDED',
        stages: [],
      });
      expect(transformed).toEqual({
        currentState: 'COMMANDED',
        transitions: [],
      });
    });

    it('preserves messages on the raw object (not in transformed)', () => {
      const strategy = commitmentLifecycleStrategy();
      const raw: CommitmentState = {
        id: 'c1',
        currentStage: 'COMMANDED',
        stages: [],
        messages: [{ sender: 'user', content: 'hello', timestamp: '2026-01-01T00:00:00Z' }],
      };
      const transformed = strategy.transformData!(raw);
      expect(transformed).not.toHaveProperty('messages');
    });
  });

  describe('custom stages', () => {
    it('uses custom stage definitions', () => {
      const customStages: StageConfig[] = [
        { key: 'REQUESTED', label: 'Requested' },
        { key: 'IN_PROGRESS', label: 'In Progress' },
        { key: 'COMPLETED', label: 'Completed', terminal: 'success' },
      ];
      const strategy = commitmentLifecycleStrategy({ stages: customStages });
      const nodes = strategy.toNodes({ currentState: 'IN_PROGRESS', transitions: [] });
      expect(nodes).toHaveLength(3);
      expect(nodes[1]!.label).toBe('In Progress');
      expect(nodes[1]!.status).toBe('active');
    });
  });

  describe('custom resolveStatus', () => {
    it('uses custom resolver', () => {
      const strategy = commitmentLifecycleStrategy({
        resolveStatus: () => 'completed',
      });
      const nodes = strategy.toNodes({ currentState: 'COMMANDED', transitions: [] });
      expect(nodes.every(n => n.status === 'completed')).toBe(true);
    });
  });

  describe('defaultLayout', () => {
    it('is horizontal', () => {
      expect(commitmentLifecycleStrategy().defaultLayout).toBe('horizontal');
    });
  });

  describe('edge cases', () => {
    it('handles unknown currentState — all pending', () => {
      const strategy = commitmentLifecycleStrategy();
      const nodes = strategy.toNodes({ currentState: 'NONEXISTENT', transitions: [] });
      expect(nodes.every(n => n.status === 'pending')).toBe(true);
    });

    it('handles duplicate transitions gracefully', () => {
      const strategy = commitmentLifecycleStrategy();
      const nodes = strategy.toNodes({
        currentState: 'ACKNOWLEDGED',
        transitions: [
          { state: 'COMMANDED', timestamp: '2026-01-01T00:00:00Z' },
          { state: 'COMMANDED', timestamp: '2026-01-01T00:01:00Z' },
        ],
      });
      expect(nodes.find(n => n.key === 'COMMANDED')!.status).toBe('completed');
    });
  });
});
