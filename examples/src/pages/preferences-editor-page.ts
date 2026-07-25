import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '@casehubio/blocks-ui-preferences-editor';
import type { ScopeNode, PreferenceSchemaDescriptor, PreferenceRecord } from '@casehubio/blocks-ui-preferences-editor';

const MOCK_SCHEMA: PreferenceSchemaDescriptor[] = [
  { namespace: 'casehub.work', name: 'sla.default-hours', qualifiedName: 'casehub.work.sla.default-hours', type: 'integer', label: 'Default SLA hours', description: 'Hours before an SLA breach triggers escalation', defaultValue: '24', multiValue: false, constraints: { min: 1, max: 720 }, options: [] },
  { namespace: 'casehub.work', name: 'sla.warning-threshold', qualifiedName: 'casehub.work.sla.warning-threshold', type: 'number', label: 'SLA warning threshold', description: 'Fraction of SLA elapsed before warning (0.0-1.0)', defaultValue: '0.75', multiValue: false, constraints: { min: 0.1, max: 0.99 }, options: [] },
  { namespace: 'casehub.work', name: 'delegation.decline-target', qualifiedName: 'casehub.work.delegation.decline-target', type: 'enum', label: 'Decline target', description: 'Where a declined delegation returns the work item', defaultValue: 'POOL', multiValue: false, constraints: {}, options: [{ value: 'POOL', label: 'Return to pool' }, { value: 'DELEGATOR', label: 'Return to delegator' }, { value: 'ESCALATE', label: 'Escalate to supervisor' }] },
  { namespace: 'casehub.work', name: 'delegation.auto-accept', qualifiedName: 'casehub.work.delegation.auto-accept', type: 'boolean', label: 'Auto-accept delegations', description: 'Automatically accept incoming delegations', defaultValue: 'false', multiValue: false, constraints: {}, options: [] },
  { namespace: 'casehub.work', name: 'claim.max-concurrent', qualifiedName: 'casehub.work.claim.max-concurrent', type: 'integer', label: 'Max concurrent claims', description: 'Maximum work items a single user can claim simultaneously', defaultValue: '10', multiValue: false, constraints: { min: 1, max: 100 }, options: [] },
  { namespace: 'casehub.work', name: 'escalation.policy', qualifiedName: 'casehub.work.escalation.policy', type: 'enum', label: 'Escalation policy', description: 'Default escalation behaviour when SLA is breached', defaultValue: 'NOTIFY', multiValue: false, constraints: {}, options: [{ value: 'NOTIFY', label: 'Notify supervisor' }, { value: 'REASSIGN', label: 'Auto-reassign' }, { value: 'EXTEND', label: 'Extend SLA by 50%' }, { value: 'FAIL', label: 'Mark as failed' }] },
  { namespace: 'casehub.platform', name: 'debug.enabled', qualifiedName: 'casehub.platform.debug.enabled', type: 'boolean', label: 'Debug mode', description: 'Enable verbose logging and diagnostic endpoints', defaultValue: 'false', multiValue: false, constraints: {}, options: [] },
  { namespace: 'casehub.platform', name: 'session.timeout', qualifiedName: 'casehub.platform.session.timeout', type: 'duration', label: 'Session timeout', description: 'Idle session timeout before automatic logout', defaultValue: 'PT30M', multiValue: false, constraints: { min: 'PT1M', max: 'PT24H' }, options: [] },
  { namespace: 'casehub.platform', name: 'allowed-origins', qualifiedName: 'casehub.platform.allowed-origins', type: 'string', label: 'Allowed CORS origins', description: 'Comma-separated list of allowed CORS origins', defaultValue: '', multiValue: false, constraints: {}, options: [] },
  { namespace: 'casehub.platform', name: 'locale', qualifiedName: 'casehub.platform.locale', type: 'enum', label: 'Default locale', description: 'Language and region for date/number formatting', defaultValue: 'en-GB', multiValue: false, constraints: {}, options: [{ value: 'en-GB', label: 'English (UK)' }, { value: 'en-US', label: 'English (US)' }, { value: 'de-DE', label: 'German' }, { value: 'fr-FR', label: 'French' }, { value: 'ja-JP', label: 'Japanese' }] },
  { namespace: 'casehub.platform', name: 'timezone', qualifiedName: 'casehub.platform.timezone', type: 'string', label: 'Default timezone', description: 'IANA timezone identifier', defaultValue: 'UTC', multiValue: false, constraints: {}, options: [] },
  { namespace: 'casehub.notification', name: 'digest.interval', qualifiedName: 'casehub.notification.digest.interval', type: 'duration', label: 'Digest interval', description: 'How often digest notifications are batched and sent', defaultValue: 'PT1H', multiValue: false, constraints: { min: 'PT5M', max: 'PT24H' }, options: [] },
  { namespace: 'casehub.notification', name: 'quiet-hours.enabled', qualifiedName: 'casehub.notification.quiet-hours.enabled', type: 'boolean', label: 'Quiet hours enabled', description: 'Suppress non-urgent notifications during quiet hours', defaultValue: 'false', multiValue: false, constraints: {}, options: [] },
  { namespace: 'casehub.notification', name: 'quiet-hours.start', qualifiedName: 'casehub.notification.quiet-hours.start', type: 'string', label: 'Quiet hours start', description: 'Start time in HH:MM format', defaultValue: '22:00', multiValue: false, constraints: { pattern: '^[0-2][0-9]:[0-5][0-9]$' }, options: [] },
  { namespace: 'casehub.notification', name: 'quiet-hours.end', qualifiedName: 'casehub.notification.quiet-hours.end', type: 'string', label: 'Quiet hours end', description: 'End time in HH:MM format', defaultValue: '08:00', multiValue: false, constraints: { pattern: '^[0-2][0-9]:[0-5][0-9]$' }, options: [] },
  { namespace: 'casehub.notification', name: 'max-retries', qualifiedName: 'casehub.notification.max-retries', type: 'integer', label: 'Max delivery retries', description: 'Number of times to retry failed notification delivery', defaultValue: '3', multiValue: false, constraints: { min: 0, max: 10 }, options: [] },
  { namespace: 'casehub.trust', name: 'initial-score', qualifiedName: 'casehub.trust.initial-score', type: 'number', label: 'Initial trust score', description: 'Trust score assigned to new actors before any evidence', defaultValue: '0.5', multiValue: false, constraints: { min: 0, max: 1 }, options: [] },
  { namespace: 'casehub.trust', name: 'decay.enabled', qualifiedName: 'casehub.trust.decay.enabled', type: 'boolean', label: 'Trust decay enabled', description: 'Gradually reduce trust scores when no activity is recorded', defaultValue: 'true', multiValue: false, constraints: {}, options: [] },
  { namespace: 'casehub.trust', name: 'decay.interval', qualifiedName: 'casehub.trust.decay.interval', type: 'duration', label: 'Trust decay interval', description: 'Time between trust score decay evaluations', defaultValue: 'P7D', multiValue: false, constraints: { min: 'P1D', max: 'P90D' }, options: [] },
  { namespace: 'casehub.trust', name: 'routing.threshold', qualifiedName: 'casehub.trust.routing.threshold', type: 'number', label: 'Routing threshold', description: 'Minimum trust score required for automatic routing', defaultValue: '0.7', multiValue: false, constraints: { min: 0, max: 1 }, options: [] },
  { namespace: 'casehub.trust', name: 'routing.borderline-margin', qualifiedName: 'casehub.trust.routing.borderline-margin', type: 'number', label: 'Borderline margin', description: 'Score range around threshold that triggers human review', defaultValue: '0.05', multiValue: false, constraints: { min: 0, max: 0.2 }, options: [] },
];

const MOCK_RECORDS: PreferenceRecord[] = [
  { tenancyId: 't1', scope: 'system', namespace: 'casehub.work', name: 'sla.default-hours', subKey: '', value: '24' },
  { tenancyId: 't1', scope: 'system', namespace: 'casehub.work', name: 'sla.warning-threshold', subKey: '', value: '0.75' },
  { tenancyId: 't1', scope: 'system', namespace: 'casehub.work', name: 'claim.max-concurrent', subKey: '', value: '10' },
  { tenancyId: 't1', scope: 'system', namespace: 'casehub.platform', name: 'session.timeout', subKey: '', value: 'PT30M' },
  { tenancyId: 't1', scope: 'system', namespace: 'casehub.platform', name: 'timezone', subKey: '', value: 'UTC' },
  { tenancyId: 't1', scope: 'system', namespace: 'casehub.notification', name: 'digest.interval', subKey: '', value: 'PT1H' },
  { tenancyId: 't1', scope: 'system', namespace: 'casehub.notification', name: 'max-retries', subKey: '', value: '3' },
  { tenancyId: 't1', scope: 'system', namespace: 'casehub.trust', name: 'initial-score', subKey: '', value: '0.5' },
  { tenancyId: 't1', scope: 'system', namespace: 'casehub.trust', name: 'routing.threshold', subKey: '', value: '0.7' },
  { tenancyId: 't1', scope: 'system', namespace: 'casehub.trust', name: 'routing.borderline-margin', subKey: '', value: '0.05' },
  { tenancyId: 't1', scope: 'tenant/acme', namespace: 'casehub.work', name: 'sla.default-hours', subKey: '', value: '8' },
  { tenancyId: 't1', scope: 'tenant/acme', namespace: 'casehub.work', name: 'sla.warning-threshold', subKey: '', value: '0.5' },
  { tenancyId: 't1', scope: 'tenant/acme', namespace: 'casehub.work', name: 'escalation.policy', subKey: '', value: 'REASSIGN' },
  { tenancyId: 't1', scope: 'tenant/acme', namespace: 'casehub.platform', name: 'debug.enabled', subKey: '', value: 'true' },
  { tenancyId: 't1', scope: 'tenant/acme', namespace: 'casehub.platform', name: 'locale', subKey: '', value: 'ja-JP' },
  { tenancyId: 't1', scope: 'tenant/acme', namespace: 'casehub.platform', name: 'allowed-origins', subKey: '', value: 'https://acme.example.com' },
  { tenancyId: 't1', scope: 'tenant/acme', namespace: 'casehub.notification', name: 'quiet-hours.enabled', subKey: '', value: 'true' },
  { tenancyId: 't1', scope: 'tenant/acme', namespace: 'casehub.notification', name: 'quiet-hours.start', subKey: '', value: '21:00' },
  { tenancyId: 't1', scope: 'tenant/acme', namespace: 'casehub.notification', name: 'quiet-hours.end', subKey: '', value: '07:00' },
  { tenancyId: 't1', scope: 'tenant/acme', namespace: 'casehub.trust', name: 'routing.threshold', subKey: '', value: '0.8' },
  { tenancyId: 't1', scope: 'tenant/acme/team/compliance', namespace: 'casehub.work', name: 'sla.default-hours', subKey: '', value: '4' },
  { tenancyId: 't1', scope: 'tenant/acme/team/compliance', namespace: 'casehub.work', name: 'delegation.auto-accept', subKey: '', value: 'false' },
  { tenancyId: 't1', scope: 'tenant/acme/team/compliance', namespace: 'casehub.work', name: 'claim.max-concurrent', subKey: '', value: '3' },
  { tenancyId: 't1', scope: 'tenant/acme/team/compliance', namespace: 'casehub.work', name: 'escalation.policy', subKey: '', value: 'FAIL' },
  { tenancyId: 't1', scope: 'tenant/acme/team/compliance', namespace: 'casehub.trust', name: 'routing.threshold', subKey: '', value: '0.95' },
  { tenancyId: 't1', scope: 'tenant/acme/team/compliance', namespace: 'casehub.trust', name: 'routing.borderline-margin', subKey: '', value: '0.02' },
  { tenancyId: 't1', scope: 'tenant/acme/team/engineering', namespace: 'casehub.work', name: 'sla.default-hours', subKey: '', value: '48' },
  { tenancyId: 't1', scope: 'tenant/acme/team/engineering', namespace: 'casehub.work', name: 'delegation.auto-accept', subKey: '', value: 'true' },
  { tenancyId: 't1', scope: 'tenant/acme/team/engineering', namespace: 'casehub.work', name: 'claim.max-concurrent', subKey: '', value: '25' },
  { tenancyId: 't1', scope: 'tenant/acme/team/engineering', namespace: 'casehub.work', name: 'escalation.policy', subKey: '', value: 'EXTEND' },
  { tenancyId: 't1', scope: 'tenant/globex', namespace: 'casehub.platform', name: 'locale', subKey: '', value: 'de-DE' },
  { tenancyId: 't1', scope: 'tenant/globex', namespace: 'casehub.platform', name: 'session.timeout', subKey: '', value: 'PT15M' },
  { tenancyId: 't1', scope: 'tenant/globex', namespace: 'casehub.platform', name: 'timezone', subKey: '', value: 'Europe/Berlin' },
  { tenancyId: 't1', scope: 'tenant/globex', namespace: 'casehub.notification', name: 'digest.interval', subKey: '', value: 'PT4H' },
  { tenancyId: 't1', scope: 'tenant/globex/team/operations', namespace: 'casehub.notification', name: 'max-retries', subKey: '', value: '5' },
  { tenancyId: 't1', scope: 'tenant/globex/team/operations', namespace: 'casehub.trust', name: 'decay.enabled', subKey: '', value: 'false' },
];

const SCOPE_TREE: readonly ScopeNode[] = [
  { path: 'system', label: 'System', children: [
    { path: 'tenant/acme', label: 'Acme Corp', children: [
      { path: 'tenant/acme/team/compliance', label: 'Compliance' },
      { path: 'tenant/acme/team/engineering', label: 'Engineering' },
      { path: 'tenant/acme/team/sales', label: 'Sales' },
    ]},
    { path: 'tenant/globex', label: 'Globex Industries', children: [
      { path: 'tenant/globex/team/operations', label: 'Operations' },
      { path: 'tenant/globex/team/research', label: 'Research' },
    ]},
  ]},
];

function mockFetch(url: string, init?: RequestInit): Promise<Response> {
  const method = init?.method ?? 'GET';
  if (method === 'GET' && url.includes('/schema')) {
    return Promise.resolve(new Response(JSON.stringify(MOCK_SCHEMA), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  }
  if (method === 'GET') {
    return Promise.resolve(new Response(JSON.stringify(MOCK_RECORDS), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  }
  if (method === 'PUT' || method === 'DELETE') {
    return Promise.resolve(new Response(null, { status: 204 }));
  }
  return Promise.resolve(new Response('Not Found', { status: 404 }));
}

@customElement('blocks-example-preferences-editor')
export class PreferencesEditorPage extends LitElement {
  @state() private _eventLog: string[] = [];

  static override styles = css`
    :host { display: block; padding: 16px; overflow-y: auto; height: calc(100vh - 32px); }
    h2 { margin: 0 0 8px; font-size: 1.25rem; }
    h3 { margin: 24px 0 8px; font-size: 1rem; font-weight: 600; }
    p { margin: 0 0 12px; font-size: 0.875rem; color: var(--pages-muted-color, #666); }
    .demo-section { border: 1px solid var(--pages-border-color, #ccc); border-radius: 8px; overflow: hidden; height: 500px; }
    .event-log { font-size: 0.8125rem; color: var(--pages-muted-color, #666); max-height: 120px; overflow-y: auto; margin-top: 8px; }
    .event-log div { padding: 2px 0; border-bottom: 1px solid var(--pages-border-color, #eee); }
    .stats { display: flex; gap: 16px; margin-bottom: 12px; font-size: 0.8125rem; color: var(--pages-muted-color, #666); }
    .stats span { background: var(--pages-neutral-2, #f5f5f5); padding: 4px 10px; border-radius: 4px; }
  `;

  override render() {
    return html`
      <h2>Preferences Editor</h2>
      <p>Tree-table UI for scope-aware preference management. Scope nodes expand to show preference leaves with inheritance indicators. Type-aware editors driven by schema metadata.</p>

      <div class="stats">
        <span>21 schema keys</span>
        <span>4 namespaces</span>
        <span>36 records</span>
        <span>8 scope nodes</span>
      </div>

      <h3>Full editor — system / tenant / team hierarchy</h3>
      <p>Work items (SLA, delegation, claims, escalation), platform (debug, session, locale, CORS), notifications (digest, quiet hours, retries), and trust scoring (initial score, decay, routing). Acme: strict compliance, relaxed engineering. Globex: German locale, short sessions.</p>
      <div class="demo-section" style="height:600px;">
        <blocks-preferences-editor
          .scopeTree=${SCOPE_TREE}
          endpoint="/preferences"
          .fetchFn=${mockFetch}
          @preference-changed=${this._onChanged}
          @preference-deleted=${this._onDeleted}
        ></blocks-preferences-editor>
      </div>
      ${this._eventLog.length > 0 ? html`
        <h3>Event log</h3>
        <div class="event-log">${this._eventLog.map(entry => html`<div>${entry}</div>`)}</div>
      ` : ''}
    `;
  }

  private _onChanged = (e: CustomEvent) => {
    this._eventLog = [...this._eventLog.slice(-9),
      `${new Date().toLocaleTimeString()} — changed: ${e.detail.qualifiedName} at ${e.detail.scope}: ${e.detail.oldValue ?? '(none)'} → ${e.detail.newValue}`];
  };

  private _onDeleted = (e: CustomEvent) => {
    this._eventLog = [...this._eventLog.slice(-9),
      `${new Date().toLocaleTimeString()} — deleted: ${e.detail.qualifiedName} at ${e.detail.scope}`];
  };
}
