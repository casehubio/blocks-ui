import type { TimelineStrategy, StageConfig, NodeStatus } from '../types.js';
import { linearResolveStatus } from './state-progression.js';

export const COMMITMENT_STAGES: readonly StageConfig[] = [
  { key: 'COMMANDED', label: 'Commanded' },
  { key: 'ACKNOWLEDGED', label: 'Acknowledged' },
  { key: 'DONE', label: 'Done', terminal: 'success' },
  { key: 'DECLINED', label: 'Declined', terminal: 'failure' },
];

export interface CommitmentState {
  readonly id: string;
  readonly currentStage: string;
  readonly stages: ReadonlyArray<{
    readonly key: string;
    readonly actor?: string;
    readonly timestamp?: string;
    readonly status: string;
  }>;
  readonly messages?: ReadonlyArray<{
    readonly sender: string;
    readonly content: string;
    readonly timestamp: string;
  }>;
}

interface StateData {
  currentState: string;
  transitions?: ReadonlyArray<{ state: string; actor?: string; timestamp?: string }>;
}

type ResolveStatus = (
  stage: StageConfig,
  currentState: string,
  transitions: Array<{ state: string; actor?: string; timestamp?: string }>,
  stages: readonly StageConfig[],
) => NodeStatus;

export function commitmentLifecycleStrategy(options?: {
  stages?: StageConfig[];
  resolveStatus?: ResolveStatus;
}): TimelineStrategy<StateData> {
  const stages = options?.stages ?? COMMITMENT_STAGES;
  const resolve = options?.resolveStatus ?? linearResolveStatus;

  return {
    transformData(raw: unknown): StateData {
      const commitment = raw as CommitmentState;
      const transitions = commitment.stages.map(s => {
        const t: { state: string; actor?: string; timestamp?: string } = { state: s.key };
        if (s.actor !== undefined) t.actor = s.actor;
        if (s.timestamp !== undefined) t.timestamp = s.timestamp;
        return t;
      });
      return { currentState: commitment.currentStage, transitions };
    },
    toNodes(data: StateData) {
      const transitions = data.transitions ? [...data.transitions] : [];
      const transitionMap = new Map(transitions.map(t => [t.state, t]));

      return stages.map(stage => {
        const transition = transitionMap.get(stage.key);
        return {
          key: stage.key,
          label: stage.label,
          status: resolve(stage, data.currentState, transitions as Array<{ state: string; actor?: string; timestamp?: string }>, stages),
          timestamp: transition?.timestamp,
          actor: transition?.actor,
        };
      });
    },
    defaultLayout: 'horizontal',
  };
}
