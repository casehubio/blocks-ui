import { LitElement, html, css, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import {
  type WorkIdentity,
  type UserSearchProvider,
  onPagesEvent,
  WorkItemEventTopics,
  KeyboardShortcutMixin,
  type WorkItemSelectedPayload,
} from '@casehubio/blocks-ui-core';
import '@casehubio/blocks-ui-work-item-inbox';
import '@casehubio/blocks-ui-work-item-detail';

const STORAGE_KEY_DIVIDER = 'casehub-workbench-divider';

@customElement('work-item-workbench')
export class WorkItemWorkbench extends KeyboardShortcutMixin(LitElement) {
  @property({ type: Object }) identity!: WorkIdentity;
  @property({ type: String }) endpoint = '';
  @property({ type: Object }) userSearchProvider: UserSearchProvider | null = null;

  @state() private _selectedWorkItemId = '';
  @state() private _dividerRatio = 0.5;
  @state() private _showShortcutOverlay = false;
  @state() private _isDraggingDivider = false;

  private _unsubscribeSelection?: () => void;
  private _unsubscribeDeselection?: () => void;

  static override styles = css`
    :host {
      display: block;
      height: 100%;
      width: 100%;
      font-family: var(--blocks-font-family, system-ui);
      overflow: hidden;
      container-type: inline-size;
    }

    .workbench {
      display: flex;
      flex-direction: column;
      height: 100%;
      width: 100%;
      background: var(--blocks-neutral-1, #fafafa);
    }

    .split-pane {
      display: flex;
      flex: 1;
      overflow: hidden;
    }

    .left-panel {
      display: flex;
      flex-direction: column;
      flex: 0 0 auto;
      width: calc(var(--divider-ratio, 50%) * 100%);
      min-width: 320px;
      max-width: 70%;
      border-right: 1px solid var(--blocks-neutral-4, #d4d4d4);
      background: var(--blocks-neutral-2, #f5f5f5);
    }

    .panel-content {
      flex: 1;
      overflow: hidden;
    }

    .divider {
      width: 4px;
      background: var(--blocks-neutral-3, #e5e5e5);
      cursor: col-resize;
      flex-shrink: 0;
      position: relative;
    }

    .divider:hover,
    .divider.dragging {
      background: var(--blocks-accent-9, #3b82f6);
    }

    .right-panel {
      flex: 1;
      overflow: hidden;
      background: var(--blocks-neutral-1, #fafafa);
    }

    .keyboard-hints {
      display: flex;
      gap: var(--blocks-space-4, 16px);
      padding: var(--blocks-space-2, 8px) var(--blocks-space-4, 16px);
      background: var(--blocks-neutral-2, #f5f5f5);
      border-top: 1px solid var(--blocks-neutral-4, #d4d4d4);
      font-size: var(--blocks-font-size-sm, 12px);
      color: var(--blocks-neutral-7, #525252);
      overflow-x: auto;
    }

    .hint {
      display: flex;
      align-items: center;
      gap: var(--blocks-space-1, 4px);
      white-space: nowrap;
    }

    .key {
      display: inline-block;
      padding: 2px 6px;
      background: var(--blocks-neutral-3, #e5e5e5);
      border: 1px solid var(--blocks-neutral-5, #a3a3a3);
      border-radius: 3px;
      font-family: monospace;
      font-size: 11px;
      font-weight: 600;
    }

    .shortcut-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .shortcut-panel {
      background: var(--blocks-neutral-1, #fafafa);
      border: 1px solid var(--blocks-neutral-4, #d4d4d4);
      border-radius: 8px;
      padding: var(--blocks-space-4, 16px);
      max-width: 600px;
      max-height: 80vh;
      overflow-y: auto;
    }

    .shortcut-title {
      font-size: var(--blocks-font-size-lg, 16px);
      font-weight: 600;
      margin-bottom: var(--blocks-space-3, 12px);
      color: var(--blocks-neutral-11, #0a0a0a);
    }

    .shortcut-list {
      display: flex;
      flex-direction: column;
      gap: var(--blocks-space-2, 8px);
    }

    .shortcut-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--blocks-space-2, 8px);
      background: var(--blocks-neutral-2, #f5f5f5);
      border-radius: 4px;
    }

    .shortcut-desc {
      color: var(--blocks-neutral-9, #262626);
    }

    /* Responsive breakpoints */
    @container (max-width: 1024px) {
      .keyboard-hints {
        display: none;
      }
    }

    @container (max-width: 768px) {
      .split-pane {
        flex-direction: column;
      }

      .left-panel {
        width: 100%;
        max-width: none;
        border-right: none;
        border-bottom: 1px solid var(--blocks-neutral-4, #d4d4d4);
      }

      .divider {
        display: none;
      }

      .right-panel {
        display: none;
      }
    }
  `;

  constructor() {
    super();
    this._restorePreferences();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this._subscribeToEvents();
    this._registerKeyboardShortcuts();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._unsubscribeEvents();
  }

  configure(props: {
    endpoint?: string;
    identity?: WorkIdentity;
    userSearchProvider?: UserSearchProvider;
  }): void {
    if (props.endpoint !== undefined) this.endpoint = props.endpoint;
    if (props.identity !== undefined) this.identity = props.identity;
    if (props.userSearchProvider !== undefined) this.userSearchProvider = props.userSearchProvider;
    this.requestUpdate();
  }

  private _restorePreferences(): void {
    if (typeof localStorage === 'undefined') return;

    const savedDivider = localStorage.getItem(STORAGE_KEY_DIVIDER);
    if (savedDivider) {
      const ratio = parseFloat(savedDivider);
      if (ratio >= 0.3 && ratio <= 0.7) {
        this._dividerRatio = ratio;
      }
    }
  }

  private _subscribeToEvents(): void {
    this._unsubscribeSelection = onPagesEvent<WorkItemSelectedPayload>(
      document,
      WorkItemEventTopics.SELECTED,
      payload => {
        this._selectedWorkItemId = payload.workItemId;
      }
    );

    this._unsubscribeDeselection = onPagesEvent(
      document,
      WorkItemEventTopics.DESELECTED,
      () => {
        this._selectedWorkItemId = '';
      }
    );
  }

  private _unsubscribeEvents(): void {
    this._unsubscribeSelection?.();
    this._unsubscribeDeselection?.();
  }

  private _registerKeyboardShortcuts(): void {
    this.registerShortcut('?', () => this._toggleShortcutOverlay(), {
      description: 'Show keyboard shortcuts',
    });

    this.registerShortcut('Escape', () => {
      if (this._showShortcutOverlay) {
        this._toggleShortcutOverlay();
      }
    }, {
      description: 'Close overlay',
    });
  }

  private _toggleShortcutOverlay(): void {
    this._showShortcutOverlay = !this._showShortcutOverlay;
  }

  private _handleDividerMouseDown = (e: MouseEvent): void => {
    e.preventDefault();
    this._isDraggingDivider = true;
    document.addEventListener('mousemove', this._handleDividerMouseMove);
    document.addEventListener('mouseup', this._handleDividerMouseUp);
  };

  private _handleDividerMouseMove = (e: MouseEvent): void => {
    if (!this._isDraggingDivider) return;
    const container = this.shadowRoot?.querySelector('.split-pane') as HTMLElement;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const clampedRatio = Math.max(0.3, Math.min(0.7, ratio));
    this._dividerRatio = clampedRatio;
    this.style.setProperty('--divider-ratio', clampedRatio.toString());
  };

  private _handleDividerMouseUp = (): void => {
    this._isDraggingDivider = false;
    document.removeEventListener('mousemove', this._handleDividerMouseMove);
    document.removeEventListener('mouseup', this._handleDividerMouseUp);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_DIVIDER, this._dividerRatio.toString());
    }
  };

  override updated(changedProperties: Map<string | number | symbol, unknown>): void {
    if (changedProperties.has('_dividerRatio')) {
      this.style.setProperty('--divider-ratio', this._dividerRatio.toString());
    }
  }

  override render(): TemplateResult {
    return html`
      <div class="workbench">
        <div class="split-pane">
          <div class="left-panel">
            <div class="panel-content">
              ${this._renderInbox()}
            </div>
          </div>

          <div
            class="divider ${this._isDraggingDivider ? 'dragging' : ''}"
            @mousedown=${this._handleDividerMouseDown}
          ></div>

          <div class="right-panel">
            ${this._renderDetail()}
          </div>
        </div>

        ${this._renderKeyboardHints()}
        ${this._showShortcutOverlay ? this._renderShortcutOverlay() : ''}
      </div>
    `;
  }

  private _renderInbox(): TemplateResult {
    return html`
      <work-item-inbox
        .endpoint=${this.endpoint}
        .identity=${this.identity}
      ></work-item-inbox>
    `;
  }

  private _renderDetail(): TemplateResult {
    return html`
      <work-item-detail
        .endpoint=${this.endpoint}
        .identity=${this.identity}
        .userSearchProvider=${this.userSearchProvider}
        .workItemId=${this._selectedWorkItemId}
      ></work-item-detail>
    `;
  }

  private _renderKeyboardHints(): TemplateResult {
    return html`
      <div class="keyboard-hints">
        <div class="hint">
          <span class="key">↑</span>
          <span class="key">↓</span>
          Navigate
        </div>
        <div class="hint">
          <span class="key">Enter</span>
          Select
        </div>
        <div class="hint">
          <span class="key">Esc</span>
          Back
        </div>
        <div class="hint">
          <span class="key">C</span>
          Claim
        </div>
        <div class="hint">
          <span class="key">S</span>
          Start
        </div>
        <div class="hint">
          <span class="key">E</span>
          Complete
        </div>
        <div class="hint">
          <span class="key">?</span>
          Shortcuts
        </div>
      </div>
    `;
  }

  private _renderShortcutOverlay(): TemplateResult {
    const shortcuts = [
      { key: '↑ / ↓', desc: 'Navigate inbox items' },
      { key: 'Enter', desc: 'Open selected item' },
      { key: 'Escape', desc: 'Return to inbox' },
      { key: 'C', desc: 'Claim focused item' },
      { key: 'S', desc: 'Start work on item' },
      { key: 'E', desc: 'Complete item' },
      { key: 'R', desc: 'Reject item' },
      { key: 'Tab', desc: 'Switch between panels' },
      { key: '?', desc: 'Toggle this overlay' },
    ];

    return html`
      <div class="shortcut-overlay" @click=${this._toggleShortcutOverlay}>
        <div class="shortcut-panel" @click=${(e: Event) => e.stopPropagation()}>
          <div class="shortcut-title">Keyboard Shortcuts</div>
          <div class="shortcut-list">
            ${shortcuts.map(
              s => html`
                <div class="shortcut-item">
                  <span class="shortcut-desc">${s.desc}</span>
                  <span class="key">${s.key}</span>
                </div>
              `
            )}
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'work-item-workbench': WorkItemWorkbench;
  }
}
