import { registerStatus } from '@casehubio/pages-ui-components/status-badge';

registerStatus('conversation', 'OPEN',           { category: 'neutral',  icon: '○' });
registerStatus('conversation', 'ACTIVE',         { category: 'info',     icon: '⟳' });
registerStatus('conversation', 'AGREED',         { category: 'success',  icon: '✓' });
registerStatus('conversation', 'DISPUTED',       { category: 'danger',   icon: '✕' });
registerStatus('conversation', 'PENDING_HUMAN',  { category: 'warning',  icon: '⚑' });
registerStatus('conversation', 'DECLINED',       { category: 'success',  icon: '✓' });
registerStatus('conversation', 'VERIFIED',       { category: 'success',  icon: '✓✓' });
registerStatus('conversation', 'DEFERRED',       { category: 'neutral',  icon: '⏸' });
registerStatus('conversation', 'HUMAN_OVERRIDE', { category: 'warning',  icon: '👤' });

registerStatus('epistemic', 'ESTABLISHED', { category: 'success',  icon: '●' });
registerStatus('epistemic', 'PENDING',     { category: 'warning',  icon: '◐' });
registerStatus('epistemic', 'DISPUTED',    { category: 'danger',   icon: '○' });

export * from './types.js';
export { ConvergenceIndicator } from './blocks-convergence-indicator.js';
export { CommonGroundPanel } from './blocks-common-ground-panel.js';
export { PointList } from './blocks-point-list.js';
export { PointDetail } from './blocks-point-detail.js';
export { ConversationWorkbench } from './blocks-conversation-workbench.js';
export type { ConvergenceIndicatorProps } from './blocks-convergence-indicator.js';
export type { CommonGroundPanelProps } from './blocks-common-ground-panel.js';
export type { ConversationWorkbenchProps } from './blocks-conversation-workbench.js';
export type { PointListProps } from './blocks-point-list.js';
export type { PointDetailProps } from './blocks-point-detail.js';
