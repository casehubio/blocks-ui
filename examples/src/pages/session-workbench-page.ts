import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '@casehubio/blocks-ui-session-workbench';
import type { SessionResponse } from '@casehubio/blocks-ui-session-list';

const MOCK_SESSIONS: SessionResponse[] = [
  {
    id: 'sess-a1b2', name: 'cl-devtown-reviewer', workingDir: '/home/dev/casehub/devtown',
    command: 'claude --resume', status: 'ACTIVE', createdAt: '2026-07-27T08:15:00Z',
    lastActive: '2026-07-27T10:42:00Z', wsUrl: 'ws://localhost:3100/sess-a1b2',
    browserUrl: 'http://localhost:3100/sess-a1b2', caseId: 'case-pr-review-42',
  },
  {
    id: 'sess-c3d4', name: 'cl-engine-worker', workingDir: '/home/dev/casehub/engine',
    command: 'claude', status: 'WAITING', createdAt: '2026-07-27T09:00:00Z',
    lastActive: '2026-07-27T10:30:00Z', wsUrl: 'ws://localhost:3100/sess-c3d4',
    browserUrl: 'http://localhost:3100/sess-c3d4',
  },
  {
    id: 'sess-e5f6', name: 'cl-security-scan', workingDir: '/home/dev/casehub/ledger',
    command: 'claude -p security-review', status: 'IDLE', createdAt: '2026-07-26T14:00:00Z',
    lastActive: '2026-07-26T16:45:00Z', wsUrl: 'ws://localhost:3100/sess-e5f6',
    browserUrl: 'http://localhost:3100/sess-e5f6',
  },
  {
    id: 'sess-g7h8', name: 'cl-test-runner', workingDir: '/home/dev/casehub/work',
    command: 'claude --resume', status: 'ACTIVE', createdAt: '2026-07-27T07:30:00Z',
    lastActive: '2026-07-27T10:41:00Z', wsUrl: 'ws://localhost:3100/sess-g7h8',
    browserUrl: 'http://localhost:3100/sess-g7h8', caseId: 'case-ci-batch-7',
  },
];

const MOCK_TERMINALS: Record<string, string> = {
  'sess-a1b2': `\x1b[32m❯\x1b[0m claude --resume
Resuming session cl-devtown-reviewer...

\x1b[36mReading CLAUDE.md...\x1b[0m
\x1b[36mLoading project context...\x1b[0m

I'll review the PR changes now. Let me start by examining the diff.

\x1b[33m$ git diff main --stat\x1b[0m
 src/main/java/io/casehub/devtown/app/PrReviewCaseService.java | 42 +++++---
 src/test/java/io/casehub/devtown/app/PrReviewCaseServiceTest.java | 18 +++
 2 files changed, 45 insertions(+), 15 deletions(-)

The changes look focused on the PR review service. Let me check the test coverage...

\x1b[33m$ mvn test -pl app -Dtest=PrReviewCaseServiceTest\x1b[0m
[INFO] Tests run: 12, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS

All tests pass. The refactoring maintains backward compatibility.
`,
  'sess-c3d4': `\x1b[32m❯\x1b[0m claude
Starting new session cl-engine-worker...

\x1b[36mReading CLAUDE.md...\x1b[0m

\x1b[33m$ mvn test -pl engine-core\x1b[0m
[INFO] Running io.casehub.engine.core.SpiRegistryTest
[INFO] Tests run: 8, Failures: 0, Errors: 0, Skipped: 0
[INFO] Running io.casehub.engine.core.ExpressionEvaluatorTest
[INFO] Tests run: 14, Failures: 2, Errors: 0, Skipped: 0

\x1b[31m[ERROR] ExpressionEvaluatorTest.shouldResolveNestedPath:42 expected:<"London"> but was:<null>\x1b[0m
\x1b[31m[ERROR] ExpressionEvaluatorTest.shouldHandleMissingField:58 expected NPE not thrown\x1b[0m

Two test failures in the expression evaluator — nested path resolution returns null when intermediate nodes are missing.

Investigating...
`,
  'sess-e5f6': `\x1b[32m❯\x1b[0m claude -p security-review
Running security review on casehub/ledger...

\x1b[36mScanning for OWASP Top 10...\x1b[0m

\x1b[33m$ grep -rn "Runtime.exec\|ProcessBuilder" src/\x1b[0m
No matches found.

\x1b[33m$ grep -rn "SELECT.*\+.*\\"" src/\x1b[0m
No matches found — parameterised queries throughout.

\x1b[32m✓\x1b[0m No command injection vectors
\x1b[32m✓\x1b[0m No SQL injection vectors
\x1b[33m⚠\x1b[0m JWT expiry set to 24h — consider reducing to 1h for admin tokens

Review complete. 0 critical, 0 high, 1 medium finding.
`,
  'sess-g7h8': `\x1b[32m❯\x1b[0m claude --resume
Resuming session cl-test-runner...

\x1b[36mReading CLAUDE.md...\x1b[0m

\x1b[33m$ mvn verify -pl integration-tests\x1b[0m
[INFO] Running io.casehub.work.CaseLicycleIT
[INFO] Tests run: 6, Failures: 0, Errors: 0, Skipped: 0
[INFO] Running io.casehub.work.SlaEscalationIT
[INFO] Tests run: 4, Failures: 0, Errors: 0, Skipped: 0
[INFO] Running io.casehub.work.QueueRoutingIT
[INFO] Tests run: 9, Failures: 0, Errors: 0, Skipped: 1
[INFO] BUILD SUCCESS

All integration tests pass. The skipped test (QueueRoutingIT#shouldRerouteOnPriorityChange) depends on the priority-requeue feature not yet merged.
`,
};

const MOCK_GIT_STATUSES: Record<string, object> = {
  'sess-a1b2': {
    gitRepo: true, githubRepo: 'casehubio/devtown', branch: 'issue-42-pr-review-sla',
    pr: {
      number: 87, title: 'feat: SLA-bounded PR review with escalation',
      url: 'https://github.com/casehubio/devtown/pull/87', state: 'OPEN',
      checksTotal: 5, checksPassed: 4, checksFailed: 0, checksPending: 1,
    },
  },
  'sess-c3d4': {
    gitRepo: true, githubRepo: 'casehubio/engine', branch: 'issue-55-expression-spi',
    pr: null,
  },
  'sess-e5f6': {
    gitRepo: true, githubRepo: 'casehubio/ledger', branch: 'main',
    pr: null,
  },
  'sess-g7h8': {
    gitRepo: true, githubRepo: 'casehubio/work', branch: 'issue-19-queue-routing',
    pr: {
      number: 34, title: 'feat: queue-based routing with SLA awareness',
      url: 'https://github.com/casehubio/work/pull/34', state: 'OPEN',
      checksTotal: 3, checksPassed: 3, checksFailed: 0, checksPending: 0,
    },
  },
};

const MOCK_HEALTHS: Record<string, Array<{ port: number; up: boolean; responseMs: number }>> = {
  'sess-a1b2': [
    { port: 3100, up: true, responseMs: 12 },
    { port: 8080, up: true, responseMs: 45 },
    { port: 5432, up: true, responseMs: 3 },
  ],
  'sess-c3d4': [
    { port: 8080, up: true, responseMs: 38 },
    { port: 5432, up: true, responseMs: 5 },
    { port: 6379, up: false, responseMs: 0 },
  ],
  'sess-e5f6': [
    { port: 8080, up: true, responseMs: 22 },
    { port: 5432, up: true, responseMs: 4 },
  ],
  'sess-g7h8': [
    { port: 8080, up: true, responseMs: 51 },
    { port: 5432, up: true, responseMs: 7 },
    { port: 9090, up: true, responseMs: 15 },
  ],
};

let nextId = 100;

@customElement('blocks-example-session-workbench')
export class ExampleSessionWorkbench extends LitElement {
  @state() private _sessions = [...MOCK_SESSIONS];
  @state() private _eventLog: string[] = [];

  static override styles = css`
    :host { display: block; height: 100%; padding: 16px; }
    h2 { margin: 0 0 4px; font-size: 20px; font-weight: 600; color: var(--pages-neutral-12, #0a0a0a); }
    p { margin: 0 0 16px; color: var(--pages-neutral-9, #404040); font-size: 14px; }
    .workbench-container { height: calc(100% - 140px); border: 1px solid var(--pages-neutral-4, #d4d4d4); border-radius: 8px; overflow: hidden; }
    .event-log { margin-top: 12px; padding: 8px 12px; background: var(--pages-neutral-2, #f5f5f5); border-radius: 4px; font-size: 12px; font-family: monospace; color: var(--pages-neutral-9, #404040); max-height: 80px; overflow-y: auto; }
    .event-log-item { padding: 2px 0; }
    .event-log-empty { color: var(--pages-neutral-7, #525252); font-style: italic; }
  `;

  private _mockFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = init?.method ?? 'GET';

    if (url === '/api/sessions' && method === 'GET') {
      return new Response(JSON.stringify(this._sessions), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }

    if (url === '/api/sessions' && method === 'POST') {
      const body = JSON.parse(init?.body as string);
      const created: SessionResponse = {
        id: `sess-new-${nextId++}`, name: `cl-${body.name}`,
        workingDir: body.workingDir ?? `/home/dev/${body.name}`,
        command: body.command ?? 'claude', status: 'IDLE',
        createdAt: new Date().toISOString(), lastActive: new Date().toISOString(),
        wsUrl: `ws://localhost:3100/sess-new-${nextId}`,
        browserUrl: `http://localhost:3100/sess-new-${nextId}`,
      };
      this._sessions = [created, ...this._sessions];
      this._eventLog = [...this._eventLog, `POST /api/sessions → created "${created.name}"`];
      return new Response(JSON.stringify(created), {
        status: 201, headers: { 'Content-Type': 'application/json' },
      });
    }

    const deleteMatch = url.match(/^\/api\/sessions\/([^/]+)$/);
    if (deleteMatch && method === 'DELETE') {
      const id = deleteMatch[1]!;
      const name = this._sessions.find(s => s.id === id)?.name ?? id;
      this._sessions = this._sessions.filter(s => s.id !== id);
      this._eventLog = [...this._eventLog, `DELETE /api/sessions/${id} → removed "${name}"`];
      return new Response(null, { status: 204 });
    }

    const outputMatch = url.match(/^\/api\/sessions\/([^/]+)\/output/);
    if (outputMatch && method === 'GET') {
      const id = outputMatch[1]!;
      const terminal = MOCK_TERMINALS[id] ?? `Session ${id} — no output available.
`;
      return new Response(terminal, { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }

    const gitMatch = url.match(/^\/api\/sessions\/([^/]+)\/git-status$/);
    if (gitMatch && method === 'GET') {
      const id = gitMatch[1]!;
      const gitStatus = MOCK_GIT_STATUSES[id] ?? { gitRepo: false };
      return new Response(JSON.stringify(gitStatus), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }

    const healthMatch = url.match(/^\/api\/sessions\/([^/]+)\/service-health$/);
    if (healthMatch && method === 'GET') {
      const id = healthMatch[1]!;
      const health = MOCK_HEALTHS[id] ?? [];
      return new Response(JSON.stringify(health), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }

    return fetch(input, init);
  };

  override connectedCallback(): void {
    super.connectedCallback();
    (globalThis as any)._originalFetch = globalThis.fetch;
    globalThis.fetch = this._mockFetch as typeof fetch;
    document.addEventListener('pages-event', this._handleEvent);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    globalThis.fetch = (globalThis as any)._originalFetch;
    document.removeEventListener('pages-event', this._handleEvent);
  }

  private _handleEvent = (e: Event): void => {
    const detail = (e as CustomEvent).detail;
    if (detail.topic.startsWith('session:')) {
      this._eventLog = [...this._eventLog, `${detail.topic}: ${JSON.stringify(detail.payload)}`];
    }
  };

  override render() {
    return html`
      <h2>Session Workbench</h2>
      <p>Claudony worker session management — list, spawn, restart, delete. Detail tabs: Terminal, Git, Health, Events.</p>

      <div class="workbench-container">
        <blocks-session-workbench endpoint="/api/sessions"></blocks-session-workbench>
      </div>

      <div class="event-log">
        ${this._eventLog.length === 0
          ? html`<div class="event-log-empty">Interact with the workbench to see events here...</div>`
          : this._eventLog.map(e => html`<div class="event-log-item">${e}</div>`)}
      </div>
    `;
  }
}
