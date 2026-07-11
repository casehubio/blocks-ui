import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { WorkIdentity } from '@casehubio/blocks-ui-core';
import { BlocksConfirmDialog } from '@casehubio/blocks-ui-core';
import '@casehubio/pages-data-table';
import type { ColumnDef } from '@casehubio/pages-data-table';
import type { Subscription, SubscriptionPage } from './types.js';
import { NotificationApi } from './api.js';
import { emitNotificationEvent, NotificationEventTopics } from './events.js';

// --- Column definitions ---

const subscriptionColumns: ColumnDef<Subscription>[] = [
  {
    id: 'name',
    label: 'Name',
    sortable: true,
    width: '1fr',
    getValue: (s: Subscription) => s.name,
  },
  {
    id: 'eventType',
    label: 'Event Type',
    sortable: true,
    width: '200px',
    getValue: (s: Subscription) => s.eventType,
    render: (val: unknown) => html`<span class="event-type-pill">${val as string}</span>`,
  },
  {
    id: 'constraints',
    label: 'Filters',
    sortable: false,
    width: '100px',
    getValue: (s: Subscription) => s.constraints.length,
    render: (val: unknown) => {
      const count = val as number;
      return count > 0
        ? html`<span class="constraint-count">${count} filter${count === 1 ? '' : 's'}</span>`
        : html`<span class="constraint-count">—</span>`;
    },
  },
  {
    id: 'enabled',
    label: 'Enabled',
    sortable: true,
    width: '80px',
    getValue: (s: Subscription) => s.enabled,
    render: (_val: unknown, s: Subscription) => html`
      <input
        type="checkbox"
        class="enabled-toggle"
        .checked=${s.enabled}
        @change=${(e: Event) => {
          const target = e.target as HTMLInputElement;
          const row = target.closest('tr');
          const id = row?.dataset.id;
          if (id) {
            const list = target.closest('subscription-list') as SubscriptionList | null;
            list?.toggleEnabled(id);
          }
        }}
      />
    `,
  },
  {
    id: 'actions',
    label: '',
    sortable: false,
    width: '120px',
    getValue: () => '',
    render: (_val: unknown, s: Subscription) => html`
      <div class="actions">
        <button
          class="btn-edit"
          @click=${(e: Event) => {
            e.stopPropagation();
            const list = (e.target as HTMLElement).closest('subscription-list') as SubscriptionList | null;
            list?.handleEdit(s.id);
          }}
        >
          Edit
        </button>
        <button
          class="btn-delete"
          @click=${(e: Event) => {
            e.stopPropagation();
            const list = (e.target as HTMLElement).closest('subscription-list') as SubscriptionList | null;
            list?.handleDelete(s.id);
          }}
        >
          Delete
        </button>
      </div>
    `,
  },
];

// --- Component ---

@customElement('subscription-list')
export class SubscriptionList extends LitElement {
  @property({ type: String }) endpoint?: string;
  @property({ type: Object }) identity?: WorkIdentity;

  /** Injectable API for testing */
  api?: NotificationApi;

  // Internal state
  @state() subscriptions: Subscription[] = [];
  @state() editing: string | null = null; // subscription ID or 'new'
  @state() loading = false;
  @state() error: string | null = null;

  // Delete confirmation state
  @state() private _showDeleteDialog = false;
  @state() private _pendingDeleteId: string | null = null;

  // Table columns
  private _tableColumns = subscriptionColumns as unknown as ColumnDef[];

  static override readonly styles = css`
    :host {
      display: block;
      container-type: inline-size;
      background: var(--pages-neutral-1, #ffffff);
      border-radius: 8px;
      overflow: hidden;
    }

    .container {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px;
      border-bottom: 1px solid var(--pages-neutral-6, #e0e0e0);
      background: var(--pages-neutral-2, #fafafa);
    }

    .header h2 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: var(--pages-neutral-12, #111);
    }

    .btn-new {
      padding: 8px 16px;
      background: var(--pages-accent-9, #0080ff);
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s;
    }

    .btn-new:hover {
      background: var(--pages-accent-10, #0066cc);
    }

    /* List area */
    .list-area {
      flex: 1;
      overflow: hidden;
    }

    pages-data-table {
      height: 100%;
    }

    /* Event type pill */
    .event-type-pill {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
      background: var(--pages-accent-3, #cce5ff);
      color: var(--pages-accent-11, #0066cc);
    }

    /* Constraint count */
    .constraint-count {
      font-size: 13px;
      color: var(--pages-neutral-9, #737373);
    }

    /* Enabled toggle */
    .enabled-toggle {
      cursor: pointer;
    }

    /* Actions */
    .actions {
      display: flex;
      gap: 8px;
    }

    .btn-edit,
    .btn-delete {
      padding: 4px 12px;
      border: none;
      border-radius: 4px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s;
    }

    .btn-edit {
      background: var(--pages-neutral-3, #f5f5f5);
      color: var(--pages-neutral-11, #555555);
    }

    .btn-edit:hover {
      background: var(--pages-neutral-4, #eeeeee);
    }

    .btn-delete {
      background: var(--pages-danger-3, #fee);
      color: var(--pages-danger-11, #c00);
    }

    .btn-delete:hover {
      background: var(--pages-danger-4, #fdd);
    }

    /* Empty state */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px 24px;
      color: var(--pages-neutral-11, #555555);
      font-size: 14px;
      text-align: center;
    }

    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 48px 24px;
      color: var(--pages-neutral-11, #555555);
    }

    .error {
      padding: 16px;
      background: var(--pages-danger-3, #fee);
      color: var(--pages-danger-11, #c00);
      border-radius: 4px;
      margin: 16px;
    }

    /* Editor */
    .editor-section {
      border-top: 1px solid var(--pages-neutral-6, #e0e0e0);
      padding: 16px;
      background: var(--pages-neutral-2, #fafafa);
    }

    /* Responsive: Medium */
    @container (max-width: 768px) {
      .header { padding: 12px; }
      .actions { flex-direction: column; gap: 4px; }
    }

    /* Responsive: Compact */
    @container (max-width: 480px) {
      .header { flex-direction: column; align-items: stretch; gap: 12px; }
      .btn-new { width: 100%; }
    }
  `;

  override connectedCallback(): void {
    super.connectedCallback();

    if (this.endpoint != null && this.api == null) {
      this.api = new NotificationApi(this.endpoint);
    }

    if (this.api) {
      this.fetchSubscriptions();
    }
  }

  // --- Data fetching ---

  private async fetchSubscriptions(): Promise<void> {
    if (this.api == null) return;

    this.loading = true;
    this.error = null;

    try {
      const page: SubscriptionPage = await this.api.listSubscriptions();

      if (!Array.isArray(page.subscriptions)) {
        throw new Error('Invalid response: subscriptions must be an array');
      }

      this.subscriptions = page.subscriptions as Subscription[];
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to fetch subscriptions';
    } finally {
      this.loading = false;
    }
  }

  // --- Actions ---

  async toggleEnabled(subscriptionId: string): Promise<void> {
    if (this.api == null) return;

    const subscription = this.subscriptions.find(s => s.id === subscriptionId);
    if (!subscription) return;

    // Snapshot for rollback
    const snapshot = [...this.subscriptions];

    // Optimistic update
    this.subscriptions = this.subscriptions.map(s =>
      s.id === subscriptionId ? { ...s, enabled: !s.enabled } : s,
    );

    try {
      const result = subscription.enabled
        ? await this.api.disableSubscription(subscriptionId)
        : await this.api.enableSubscription(subscriptionId);

      // Replace with server response
      this.subscriptions = this.subscriptions.map(s =>
        s.id === subscriptionId ? result : s,
      );
    } catch (e) {
      // Rollback
      this.subscriptions = snapshot;
      this.error = 'Failed to update subscription';
      setTimeout(() => {
        this.error = null;
        this.requestUpdate();
      }, 5000);
    }
  }

  handleEdit(subscriptionId: string): void {
    this.editing = subscriptionId;
  }

  handleDelete(subscriptionId: string): void {
    this._pendingDeleteId = subscriptionId;
    this._showDeleteDialog = true;
  }

  async confirmDelete(): Promise<void> {
    if (this.api == null || this._pendingDeleteId == null) return;

    const id = this._pendingDeleteId;
    this._showDeleteDialog = false;
    this._pendingDeleteId = null;

    try {
      await this.api.deleteSubscription(id);

      // Remove from list
      this.subscriptions = this.subscriptions.filter(s => s.id !== id);

      // Emit event
      emitNotificationEvent(this, NotificationEventTopics.SUBSCRIPTION_DELETED, {
        subscriptionId: id,
      });
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to delete subscription';
      setTimeout(() => {
        this.error = null;
        this.requestUpdate();
      }, 5000);
    }
  }

  private handleNew(): void {
    this.editing = 'new';
  }

  private handleEditorClose(): void {
    this.editing = null;
  }

  private handleEditorSave(): void {
    this.editing = null;
    // Refresh list after save
    this.fetchSubscriptions();
  }

  // --- Render ---

  private renderList() {
    if (this.loading) {
      return html`<div class="loading">Loading subscriptions...</div>`;
    }

    if (this.error) {
      return html`<div class="error">${this.error}</div>`;
    }

    if (this.subscriptions.length === 0) {
      return html`
        <div class="empty-state">
          <p>No subscriptions yet.</p>
          <p>Create a subscription to get notified about events.</p>
        </div>
      `;
    }

    return html`
      <div class="list-area">
        <pages-data-table
          .rows=${this.subscriptions}
          .columns=${this._tableColumns}
          .getRowKey=${(row: Subscription) => row.id}
          .getRowData=${(row: Subscription) => ({ id: row.id })}
          mode="scroll"
          selection="none"
        ></pages-data-table>
      </div>
    `;
  }

  private renderEditor() {
    if (this.editing == null) return nothing;

    const subscription = this.editing === 'new'
      ? undefined
      : this.subscriptions.find(s => s.id === this.editing);

    return html`
      <div class="editor-section">
        <subscription-editor
          .subscription=${subscription}
          .endpoint=${this.endpoint}
          .identity=${this.identity}
          @save=${this.handleEditorSave}
          @cancel=${this.handleEditorClose}
        ></subscription-editor>
      </div>
    `;
  }

  override render() {
    return html`
      <div class="container">
        <div class="header">
          <h2>My Subscriptions</h2>
          <button class="btn-new" @click=${this.handleNew}>New Subscription</button>
        </div>
        ${this.renderList()}
        ${this.renderEditor()}
        <blocks-confirm-dialog
          .open=${this._showDeleteDialog}
          heading="Delete subscription?"
          message="This will permanently delete this subscription. You will no longer receive notifications for this event."
          confirmLabel="Delete"
          cancelLabel="Keep"
          confirmVariant="danger"
          @confirm=${this.confirmDelete}
          @cancel=${() => {
            this._showDeleteDialog = false;
            this._pendingDeleteId = null;
          }}
        ></blocks-confirm-dialog>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'subscription-list': SubscriptionList;
  }
}
