import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { columnId } from '@casehubio/pages-data/dist/dataset/types.js';
import '@casehubio/blocks-ui-case-explorer';
import { caseInstanceType, workerType } from '@casehubio/blocks-ui-case-explorer';
import type { EntityTypeRegistration, EntityListResponse, EntityInstance, EntityTreeNode } from '@casehubio/blocks-ui-case-explorer';

const MOCK_CASES: EntityInstance[] = [
  {
    id: 'case-1', type: 'case-instance', status: 'RUNNING', summary: 'PR Review #42 — feature/login',
    state: { branch: 'feature/login', commits: 3, author: 'alice' },
    availableCommands: [
      { name: 'suspend', label: 'Suspend', endpoint: '/api/cases/case-1/suspend' },
      { name: 'cancel', label: 'Cancel Case', endpoint: '/api/cases/case-1/cancel', severity: 'destructive', confirmation: true, confirmMessage: 'This will terminate all workers and close the case.' },
    ],
    createdAt: '2026-07-20T08:00:00Z',
  },
  {
    id: 'case-2', type: 'case-instance', status: 'COMPLETED', summary: 'PR Review #41 — fix/auth-token',
    state: { branch: 'fix/auth-token', commits: 1, author: 'bob' },
    availableCommands: [{ name: 'reopen', label: 'Reopen', endpoint: '/api/cases/case-2/reopen' }],
    createdAt: '2026-07-19T14:30:00Z', updatedAt: '2026-07-19T16:45:00Z',
  },
  {
    id: 'case-3', type: 'case-instance', status: 'RUNNING', summary: 'Merge Queue Batch #7',
    state: { batchSize: 5, merged: 2, pending: 3 },
    availableCommands: [
      { name: 'pause', label: 'Pause Queue', endpoint: '/api/cases/case-3/pause' },
      { name: 'skip', label: 'Skip Current', endpoint: '/api/cases/case-3/skip', confirmation: true },
    ],
    createdAt: '2026-07-20T09:15:00Z',
  },
];

const MOCK_WORKERS: EntityInstance[] = [
  {
    id: 'w-1', type: 'worker:flow', status: 'RUNNING', summary: 'Build Pipeline',
    state: { currentStep: 'compile', progress: 60, flowId: 'build-v2' },
    availableCommands: [
      { name: 'suspend', label: 'Suspend', endpoint: '/api/workers/w-1/suspend' },
      { name: 'skip-step', label: 'Skip Step', endpoint: '/api/workers/w-1/skip-step', confirmation: true },
    ],
    createdAt: '2026-07-20T08:05:00Z',
  },
  {
    id: 'w-2', type: 'worker:agent', status: 'RUNNING', summary: 'Security Review Agent',
    state: { sessionId: 'tmux-42', lastActivity: '2026-07-20T09:30:00Z' },
    availableCommands: [
      { name: 'interrupt', label: 'Interrupt', endpoint: '/api/workers/w-2/interrupt', severity: 'destructive', confirmation: true },
      { name: 'send-input', label: 'Send Input', endpoint: '/api/workers/w-2/input', parameters: [{ name: 'message', label: 'Message', type: 'string', required: true }] },
    ],
    createdAt: '2026-07-20T08:10:00Z',
  },
  {
    id: 'w-3', type: 'worker:human', status: 'PENDING', summary: 'Compliance Officer Review',
    state: { assignee: 'Charlie Kim', slaDeadline: '2026-07-21T08:00:00Z' },
    availableCommands: [
      { name: 'reassign', label: 'Reassign', endpoint: '/api/workers/w-3/reassign', parameters: [{ name: 'targetId', label: 'Assign To', type: 'string', required: true }] },
      { name: 'escalate', label: 'Escalate', endpoint: '/api/workers/w-3/escalate', severity: 'destructive' },
    ],
    createdAt: '2026-07-20T08:15:00Z',
  },
];

const MOCK_TREE: EntityTreeNode[] = [
  {
    id: 'case-1', type: 'case-instance', label: 'PR Review #42', status: 'RUNNING',
    children: [
      { id: 'w-1', type: 'worker:flow', label: 'Build Pipeline', status: 'RUNNING' },
      { id: 'w-2', type: 'worker:agent', label: 'Security Review', status: 'RUNNING' },
      {
        id: 'g-1', type: 'sub-case-group', label: 'Per-repo checks', status: 'RUNNING',
        groupInfo: { groupId: 'g-1', totalInGroup: 3, requiredCount: 2, completedCount: 1 },
        children: [
          {
            id: 'sc-1', type: 'case-instance', label: 'repo-frontend', status: 'COMPLETED',
            children: [
              { id: 'w-4', type: 'worker:flow', label: 'lint', status: 'COMPLETED' },
              { id: 'w-5', type: 'worker:flow', label: 'test', status: 'COMPLETED' },
            ],
          },
          {
            id: 'sc-2', type: 'case-instance', label: 'repo-backend', status: 'RUNNING',
            children: [
              { id: 'w-6', type: 'worker:flow', label: 'lint', status: 'COMPLETED' },
              { id: 'w-7', type: 'worker:flow', label: 'test', status: 'RUNNING' },
            ],
          },
          { id: 'sc-3', type: 'case-instance', label: 'repo-infra', status: 'PENDING' },
        ],
      },
      { id: 'w-3', type: 'worker:human', label: 'Compliance Review', status: 'PENDING' },
    ],
  },
];

function mockFetch(url: string): Promise<Response> {
  const u = new URL(url);
  const path = u.pathname;

  if (path.endsWith('/cases') || path.endsWith('/cases/')) {
    const body: EntityListResponse = { entities: MOCK_CASES, totalCount: MOCK_CASES.length };
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  }
  if (path.endsWith('/workers') || path.endsWith('/workers/')) {
    const body: EntityListResponse = { entities: MOCK_WORKERS, totalCount: MOCK_WORKERS.length };
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  }
  if (path.match(/\/cases\/[^/]+\/tree$/)) {
    return Promise.resolve(new Response(JSON.stringify(MOCK_TREE), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  }
  if (path.match(/\/cases\/[^/]+$/)) {
    const id = path.split('/').pop()!;
    const entity = MOCK_CASES.find(c => c.id === id) ?? MOCK_CASES[0]!;
    return Promise.resolve(new Response(JSON.stringify(entity), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  }
  if (path.match(/\/workers\/[^/]+$/)) {
    const id = path.split('/').pop()!;
    const entity = MOCK_WORKERS.find(w => w.id === id) ?? MOCK_WORKERS[0]!;
    return Promise.resolve(new Response(JSON.stringify(entity), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  }
  if (path.match(/\/(suspend|cancel|reopen|pause|skip|interrupt|reassign|escalate|send-input|skip-step)$/)) {
    return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  }
  return Promise.resolve(new Response('Not Found', { status: 404 }));
}

@customElement('case-explorer-page')
export class CaseExplorerPage extends LitElement {
  @state() private _activeDemo = 'composed';
  @state() private _eventLog: string[] = [];

  static override styles = css`
    :host { display: block; padding: 16px; overflow-y: auto; height: calc(100vh - 32px); }
    h2 { margin: 0 0 8px; font-size: 1.25rem; }
    h3 { margin: 24px 0 8px; font-size: 1rem; font-weight: 600; }
    p { margin: 0 0 12px; font-size: 0.875rem; color: var(--pages-muted-color, #666); }

    .demo-tabs { display: flex; gap: 2px; margin-bottom: 16px; flex-wrap: wrap; }
    .demo-tabs button {
      padding: 6px 14px; border: 1px solid var(--pages-border-color, #ccc);
      background: var(--pages-surface-color, #fff); cursor: pointer;
      font-size: 0.8125rem; border-radius: 4px;
    }
    .demo-tabs button.active {
      background: var(--pages-primary-color, #0066cc); color: #fff;
      border-color: var(--pages-primary-color, #0066cc);
    }

    .demo-section {
      border: 1px solid var(--pages-border-color, #ccc);
      border-radius: 8px; overflow: hidden; margin-bottom: 16px;
    }
    .demo-section.tall { height: 500px; }
    .demo-section.medium { height: 300px; }
    .demo-section.short { min-height: 60px; padding: 12px; }

    .event-log { font-size: 0.8125rem; color: var(--pages-muted-color, #666); max-height: 120px; overflow-y: auto; margin-top: 8px; }
    .event-log div { padding: 2px 0; border-bottom: 1px solid var(--pages-border-color, #eee); }

    .code { font-family: monospace; font-size: 0.8125rem; background: var(--pages-neutral-2, #f5f5f5); padding: 8px 12px; border-radius: 4px; margin: 8px 0; overflow-x: auto; white-space: pre; }
  `;

  override connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener('pages-event', this._onEvent as EventListener);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('pages-event', this._onEvent as EventListener);
  }

  private _onEvent = (e: CustomEvent): void => {
    const topic = e.detail?.topic as string;
    if (topic && (topic.includes('selected') || topic.includes('entity') || topic.includes('case-explorer'))) {
      this._eventLog = [...this._eventLog.slice(-19), `${new Date().toLocaleTimeString()} — ${topic}: ${JSON.stringify(e.detail.payload)}`];
    }
  };

  override render() {
    return html`
      <h2>Case Explorer Components</h2>
      <div class="demo-tabs">
        ${(['composed', 'entity-list', 'entity-detail', 'entity-tree', 'entity-command-bar', 'convenience'] as const).map(tab => html`
          <button class=${this._activeDemo === tab ? 'active' : ''} @click=${() => { this._activeDemo = tab; }}>${tab}</button>
        `)}
      </div>
      ${this._renderDemo()}
      ${this._eventLog.length > 0 ? html`<div class="event-log">${this._eventLog.map(entry => html`<div>${entry}</div>`)}</div>` : ''}
    `;
  }

  private _renderDemo() {
    switch (this._activeDemo) {
      case 'composed': return this._renderComposed();
      case 'entity-list': return this._renderEntityList();
      case 'entity-detail': return this._renderEntityDetail();
      case 'entity-tree': return this._renderEntityTree();
      case 'entity-command-bar': return this._renderCommandBar();
      case 'convenience': return this._renderConvenience();
      default: return html``;
    }
  }

  private _renderComposed() {
    const types: EntityTypeRegistration[] = [
      caseInstanceType({ listEndpoint: '/api/cases' }),
      workerType({ listEndpoint: '/api/workers' }),
    ];
    return html`
      <h3>Full Case Explorer (composed)</h3>
      <p>Entity type tabs, list/tree mode toggle, split-workbench layout, breadcrumb navigation, detail panel with commands.</p>
      <div class="code">&lt;case-explorer .entityTypes=\${[caseInstanceType({...}), workerType({...})]} /&gt;</div>
      <div class="demo-section tall">
        <case-explorer .entityTypes=${types} .fetchFn=${mockFetch}></case-explorer>
      </div>
    `;
  }

  private _renderEntityList() {
    const caseReg = caseInstanceType({ listEndpoint: '/api/cases' });
    const workerReg = workerType({ listEndpoint: '/api/workers' });
    return html`
      <h3>entity-list — Standalone case list</h3>
      <p>Cursor-aware fetch, TypedDataSet conversion, filter controls, EntitySelection emission on row click.</p>
      <div class="code">&lt;entity-list .registration=\${caseInstanceType({listEndpoint: '/api/cases'})} selection-topic="demo-case" /&gt;</div>
      <div class="demo-section medium">
        <entity-list .registration=${caseReg} .fetchFn=${mockFetch} selection-topic="demo-case"></entity-list>
      </div>

      <h3>entity-list — Standalone worker list</h3>
      <p>Same component, different registration. Shows workers across all cases.</p>
      <div class="code">&lt;entity-list .registration=\${workerType({listEndpoint: '/api/workers'})} selection-topic="demo-worker" /&gt;</div>
      <div class="demo-section medium">
        <entity-list .registration=${workerReg} .fetchFn=${mockFetch} selection-topic="demo-worker"></entity-list>
      </div>
    `;
  }

  private _renderEntityDetail() {
    const caseReg = caseInstanceType({ listEndpoint: '/api/cases' });
    return html`
      <h3>entity-detail — Standalone</h3>
      <p>Fetches full EntityInstance on selection. Three-tier renderer resolution, command bar, relationship tabs. Click a case in the list above to populate.</p>
      <div class="code">&lt;entity-list .registration=\${reg} selection-topic="detail-demo" /&gt;
&lt;entity-detail .registration=\${reg} selection-topic="detail-demo" /&gt;</div>
      <div class="demo-section medium">
        <entity-list .registration=${caseReg} .fetchFn=${mockFetch} selection-topic="detail-demo"></entity-list>
      </div>
      <div class="demo-section medium">
        <entity-detail .registration=${caseReg} .fetchFn=${mockFetch} selection-topic="detail-demo"></entity-detail>
      </div>
    `;
  }

  private _renderEntityTree() {
    return html`
      <h3>entity-tree — Collapsible hierarchy</h3>
      <p>ARIA tree with expand/collapse, lazy loading, M-of-N group progress, node selection. Click nodes to emit EntitySelection.</p>
      <div class="code">&lt;entity-tree .nodes=\${treeData} selection-topic="tree-demo" /&gt;</div>
      <div class="demo-section medium">
        <entity-tree .nodes=${MOCK_TREE} selection-topic="tree-demo" .fetchFn=${mockFetch}></entity-tree>
      </div>
    `;
  }

  private _renderCommandBar() {
    return html`
      <h3>entity-command-bar — Normal commands</h3>
      <p>Renders buttons from availableCommands. Click executes POST to endpoint.</p>
      <div class="code">&lt;entity-command-bar .commands=\${[{name:'suspend', label:'Suspend', endpoint:'...'}]} /&gt;</div>
      <div class="demo-section short">
        <entity-command-bar
          .commands=${MOCK_CASES[0]!.availableCommands}
          entity-id="case-1" entity-type="case-instance"
          .fetchFn=${mockFetch}
        ></entity-command-bar>
      </div>

      <h3>entity-command-bar — Destructive with confirmation</h3>
      <p>Destructive severity shows danger styling. Confirmation opens blocks-confirm-dialog before executing.</p>
      <div class="demo-section short">
        <entity-command-bar
          .commands=${MOCK_WORKERS[1]!.availableCommands}
          entity-id="w-2" entity-type="worker:agent"
          .fetchFn=${mockFetch}
        ></entity-command-bar>
      </div>

      <h3>entity-command-bar — All worker types</h3>
      <p>Flow worker (suspend, skip-step), Agent worker (interrupt, send-input), Human worker (reassign, escalate).</p>
      ${MOCK_WORKERS.map(w => html`
        <p style="font-weight:500; margin-top:12px">${w.summary} (${w.type})</p>
        <div class="demo-section short">
          <entity-command-bar
            .commands=${w.availableCommands}
            entity-id=${w.id} entity-type=${w.type}
            .fetchFn=${mockFetch}
          ></entity-command-bar>
        </div>
      `)}
    `;
  }

  private _renderConvenience() {
    return html`
      <h3>case-instance-list — Convenience wrapper</h3>
      <p>Pre-configured entity-list with case columns. Drop-in with just an endpoint.</p>
      <div class="code">&lt;case-instance-list endpoint="/api/cases" /&gt;</div>
      <div class="demo-section medium">
        <case-instance-list endpoint="/api/cases" .fetchFn=${mockFetch} selection-topic="conv-case"></case-instance-list>
      </div>

      <h3>worker-list — Convenience wrapper</h3>
      <p>Pre-configured entity-list with worker columns.</p>
      <div class="code">&lt;worker-list endpoint="/api/workers" /&gt;</div>
      <div class="demo-section medium">
        <worker-list endpoint="/api/workers" .fetchFn=${mockFetch} selection-topic="conv-worker"></worker-list>
      </div>
    `;
  }
}
