export { toGraph } from './adapter/case-adapter.js';
export type { AdapterResult } from './adapter/case-adapter.js';
export { applyPropertyEdit, addElement, removeElement, switchBindingTarget } from './adapter/yaml-editor.js';
export { GitHubBackend } from './persistence/github-backend.js';
export type { GitHubBackendConfig } from './persistence/github-backend.js';
export { registerCaseStencils } from './stencils/index.js';
export { renderBinding, renderWorker, renderMilestone, renderGoal, renderSubCase } from './stencils/index.js';
export { registerThumbnailRenderer, getThumbnailRenderer } from './thumbnail-registry.js';
export type { ThumbnailRenderer } from './thumbnail-registry.js';
export { toDecorations } from './runtime/runtime-adapter.js';
export type {
  CaseRuntimeState,
  PlanItemSnapshot,
  MilestoneSnapshot,
  TaskStatus,
  MilestoneLifecycleStatus,
} from './runtime/types.js';
export type {
  CaseDefinition,
  CaseDefinitionSpec,
  Binding,
  Worker,
  Milestone,
  Goal,
  SubCase,
  Capability,
  HumanTask,
  Trigger,
} from './types/case-definition.js';
