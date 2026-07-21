import { initMockState } from './mock/mock-state.js';

async function bootstrap() {
  const app = document.getElementById('app')!;
  app.textContent = 'Loading mock data...';

  await initMockState();

  // Import pages and shell AFTER mocks are installed
  await import('./shell.js');
  await import('./pages/row-page.js');
  await import('./pages/inbox-page.js');
  await import('./pages/detail-page.js');
  await import('./pages/queue-inbox-page.js');
  await import('./pages/workbench-page.js');
  await import('./pages/sla-indicator-page.js');
  await import('./pages/kpi-metric-row-page.js');
  await import('./pages/approval-gate-page.js');
  await import('./pages/confirm-dialog-page.js');
  await import('./pages/data-table-page.js');
  await import('./pages/notification-page.js');
  await import('./pages/audit-trail-page.js');
  await import('./pages/timeline-events-page.js');
  await import('./pages/timeline-commitment-page.js');
  await import('./pages/timeline-custom-page.js');

  await import('./pages/trust-score-page.js');
  await import('./pages/channel-activity-page.js');

  await import('./pages/commitment-lifecycle-page.js');
  await import('./pages/similarity-panel-page.js');
  await import('./pages/trust-feedback-page.js');
  await import('./pages/compliance-summary-page.js');
  await import('./pages/gdpr-erasure-page.js');
  await import('./pages/sla-breach-policy-page.js');
  await import('./pages/grouped-data-view-page.js');
  await import('./pages/case-explorer-page.js');
  await import('./pages/trust-workbench-page.js');

  app.textContent = '';
  app.appendChild(document.createElement('example-shell'));
}

bootstrap().catch(err => {
  console.error('Failed to bootstrap examples:', err);
  document.getElementById('app')!.textContent = `Error: ${err.message}`;
});
