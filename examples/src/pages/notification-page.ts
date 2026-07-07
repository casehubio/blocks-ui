import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { WorkIdentity } from '@casehubio/blocks-ui-core';
import '@casehubio/blocks-ui-notification-inbox';
import type { MockNotificationState } from '../mock/mock-notification-state.js';
import type { Notification } from '@casehubio/blocks-ui-notification-inbox';

const IDENTITY: WorkIdentity = {
  userId: 'demo-user',
  displayName: 'Demo User',
  groups: ['compliance', 'clinical-safety'],
};

let notificationCounter = 100;

@customElement('notification-page')
export class NotificationPage extends LitElement {
  @state() private mockState: MockNotificationState | null = null;
  @state() private showSubscriptions = false;
  @state() private initError: string | null = null;

  static override styles = css`
    :host { display: block; height: 100%; }

    .page-layout {
      display: flex;
      flex-direction: column;
      height: 100%;
      gap: 0;
    }

    /* Mock toolbar header */
    .toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 24px;
      background: var(--pages-neutral-2, #f5f5f5);
      border-bottom: 1px solid var(--pages-neutral-5, #e0e0e0);
    }

    .toolbar-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .toolbar-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--pages-neutral-12, #111);
    }

    .toolbar-right {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    /* Description */
    .description {
      padding: 16px 24px;
      color: var(--pages-neutral-11, #555);
      font-size: 14px;
      line-height: 1.5;
      border-bottom: 1px solid var(--pages-neutral-5, #e0e0e0);
    }

    /* Demo controls */
    .controls {
      display: flex;
      gap: 8px;
      padding: 12px 24px;
      border-bottom: 1px solid var(--pages-neutral-5, #e0e0e0);
      background: var(--pages-neutral-2, #f5f5f5);
      flex-wrap: wrap;
    }

    .controls-label {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--pages-neutral-9, #888);
      display: flex;
      align-items: center;
      margin-right: 8px;
    }

    .demo-btn {
      padding: 6px 14px;
      border: 1px solid var(--pages-neutral-6, #d4d4d4);
      border-radius: 4px;
      background: var(--pages-neutral-1, #fff);
      color: var(--pages-neutral-12, #111);
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s;
    }

    .demo-btn:hover {
      background: var(--pages-neutral-3, #eee);
    }

    .demo-btn.urgent {
      border-color: var(--pages-danger-7, #fca5a5);
      color: var(--pages-danger-11, #c00);
    }

    .demo-btn.urgent:hover {
      background: var(--pages-danger-3, #fee);
    }

    .demo-btn.reset {
      border-color: var(--pages-accent-7, #80bfff);
      color: var(--pages-accent-11, #0066cc);
    }

    .demo-btn.reset:hover {
      background: var(--pages-accent-3, #cce5ff);
    }

    .controls-divider {
      width: 1px;
      height: 24px;
      background: var(--pages-neutral-6, #d4d4d4);
      margin: 0 4px;
    }

    .demo-btn.subscriptions {
      border-color: var(--pages-neutral-7, #a3a3a3);
      font-weight: 600;
    }

    /* Main content */
    .main-content {
      flex: 1;
      overflow: hidden;
      min-height: 0;
    }

    notification-inbox {
      display: block;
      height: 100%;
      container-type: inline-size;
    }

    /* Subscription dialog */
    .dialog-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
      z-index: 100;
    }

    .dialog-panel {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: min(600px, 90vw);
      max-height: 80vh;
      background: var(--pages-neutral-1, #fff);
      border-radius: 8px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
      z-index: 101;
      display: flex;
      flex-direction: column;
    }

    .dialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid var(--pages-neutral-4, #e5e5e5);
    }

    .dialog-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--pages-neutral-12, #111);
    }

    .dialog-close {
      padding: 4px 8px;
      border: none;
      background: transparent;
      cursor: pointer;
      font-size: 16px;
      color: var(--pages-neutral-9, #888);
      border-radius: 4px;
    }

    .dialog-close:hover {
      background: var(--pages-neutral-3, #f0f0f0);
    }

    .dialog-body {
      flex: 1;
      overflow: auto;
      padding: 0;
    }

    subscription-list {
      display: block;
      min-height: 300px;
    }
  `;

  override connectedCallback(): void {
    super.connectedCallback();
    this.initMockState();
  }

  private async initMockState(): Promise<void> {
    try {
      const { MockNotificationState } = await import('../mock/mock-notification-state.js');

      const [notifications, subscriptions, eventTypes, script] = await Promise.all([
        fetch('/mock-data/notifications.json').then(r => r.json()),
        fetch('/mock-data/subscriptions.json').then(r => r.json()),
        fetch('/mock-data/event-types.json').then(r => r.json()),
        fetch('/mock-data/notification-sse-script.json').then(r => r.json()),
      ]);

      this.mockState = new MockNotificationState(notifications, subscriptions, eventTypes, script);
      this.mockState.start();
    } catch (e) {
      this.initError = e instanceof Error ? e.message : String(e);
      console.error('Failed to initialize mock state:', e);
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.mockState?.stop();
  }

  private simulateNotification(): void {
    if (this.mockState == null) return;

    notificationCounter++;
    const notif: Notification = {
      id: `notif-sim-${notificationCounter}`,
      userId: 'demo-user',
      tenancyId: 'tenant-001',
      title: `Comment on WI-${3000 + notificationCounter}: status update`,
      body: 'New information added to the investigation file',
      category: 'comment.added',
      severity: 'INFO',
      actionUrl: `/workitems/WI-${3000 + notificationCounter}`,
      source: {
        eventId: `evt-sim-${notificationCounter}`,
        entityType: 'work-item',
        entityId: `WI-${3000 + notificationCounter}`,
        actorId: 'analyst-sarah-chen',
      },
      status: 'UNREAD',
      createdAt: new Date().toISOString(),
      readAt: null,
      dismissedAt: null,
    };

    this.mockState.pushSSEEvent('notification', notif);
  }

  private simulateSLABreach(): void {
    if (this.mockState == null) return;

    notificationCounter++;
    const notif: Notification = {
      id: `notif-sla-${notificationCounter}`,
      userId: 'demo-user',
      tenancyId: 'tenant-001',
      title: `Critical SLA breach on CS-${4000 + notificationCounter}`,
      body: 'Response deadline exceeded. Immediate escalation required.',
      category: 'sla.breached',
      severity: 'URGENT',
      actionUrl: `/workitems/CS-${4000 + notificationCounter}`,
      source: {
        eventId: `evt-sla-${notificationCounter}`,
        entityType: 'work-item',
        entityId: `CS-${4000 + notificationCounter}`,
        actorId: 'system',
      },
      status: 'UNREAD',
      createdAt: new Date().toISOString(),
      readAt: null,
      dismissedAt: null,
    };

    this.mockState.pushSSEEvent('notification', notif);
  }

  private resetData(): void {
    this.mockState?.reset();
    const inbox = this.shadowRoot?.querySelector('notification-inbox') as any;
    inbox?.refresh?.();
  }

  override render() {
    if (this.initError != null) {
      return html`<div class="page-layout"><div class="description" style="color:red">Error: ${this.initError}</div></div>`;
    }
    if (this.mockState == null) {
      return html`<div class="page-layout"><div class="description">Loading mock data...</div></div>`;
    }

    return html`
      <div class="page-layout">
        <div class="toolbar">
          <div class="toolbar-left">
            <span class="toolbar-title">CaseHub Workspace</span>
          </div>
          <div class="toolbar-right">
            <notification-bell
              endpoint=""
              .identity=${IDENTITY}
            ></notification-bell>
          </div>
        </div>

        <div class="description">
          Notification inbox with real-time SSE updates, subscription management, and batch operations.
          Use the controls below to trigger events manually, or start the auto script for a timed drip-feed.
        </div>

        <div class="controls">
          <span class="controls-label">Demo controls</span>
          <button class="demo-btn" @click=${this.simulateNotification}>
            Simulate notification
          </button>
          <button class="demo-btn urgent" @click=${this.simulateSLABreach}>
            Simulate SLA breach
          </button>
          <button class="demo-btn" @click=${() => { this.mockState?.startAutoScript(); }}>
            Start auto events
          </button>
          <button class="demo-btn reset" @click=${this.resetData}>
            Reset data
          </button>
          <span class="controls-divider"></span>
          <button class="demo-btn subscriptions" @click=${() => { this.showSubscriptions = true; }}>
            Subscriptions
          </button>
        </div>

        <div class="main-content">
          <notification-inbox
            endpoint=""
            .identity=${IDENTITY}
          ></notification-inbox>
        </div>

        ${this.showSubscriptions ? html`
          <div class="dialog-backdrop" @click=${() => { this.showSubscriptions = false; }}></div>
          <div class="dialog-panel">
            <div class="dialog-header">
              <span class="dialog-title">Subscriptions</span>
              <button class="dialog-close" @click=${() => { this.showSubscriptions = false; }} aria-label="Close">✕</button>
            </div>
            <div class="dialog-body">
              <subscription-list
                endpoint=""
                .identity=${IDENTITY}
              ></subscription-list>
            </div>
          </div>
        ` : nothing}
      </div>
    `;
  }
}
