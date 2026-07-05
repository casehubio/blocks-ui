import { LitElement, html, css, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import {
  type WorkIdentity,
  type UserSearchProvider,
  onPagesEvent,
  WorkItemEventTopics,
  KeyboardShortcutMixin,
  type WorkItemSelectedPayload,
  type QueueSelectedPayload,
} from '@casehubio/blocks-ui-core';
import '@casehubio/blocks-ui-work-item-inbox';
import '@casehubio/blocks-ui-work-item-detail';
import '@casehubio/blocks-ui-queue-board';

type ThemeMode = 'light' | 'dark';
type DensityMode = 'comfortable' | 'compact';
type LeftPanelView = 'inbox' | 'queues';

const STORAGE_KEY_THEME = 'casehub-workbench-theme';
const STORAGE_KEY_DENSITY = 'casehub-workbench-density';
const STORAGE_KEY_DIVIDER = 'casehub-workbench-divider';

@customElement('work-item-workbench')
export class WorkItemWorkbench extends KeyboardShortcutMixin(LitElement) {
  @property({ type: Object }) identity!: WorkIdentity;
  @property({ type: String }) endpoint = '';
  @property({ type: Object }) userSearchProvider: UserSearchProvider | null = null;
  @property({ type: String }) theme: ThemeMode = 'light';
  @property({ type: String }) density: DensityMode = 'comfortable';

  @state() private _leftPanel: LeftPanelView = 'inbox';
  @state() private _selectedWorkItemId = '';
  @state() private _dividerRatio = 0.5;
  @state() private _showShortcutOverlay = false;
  @state() private _isDraggingDivider = false;

  private _unsubscribeSelection?: () => void;
  private _unsubscribeDeselection?: () => void;
  private _unsubscribeQueueSelection?: () => void;
  private _unsubscribeQueueDeselection?: () => void;

  static override styles = css`
    :host {
      display: block;
      height: 100%;
      width: 100%;
      font-family: var(--blocks-font-family, system-ui);
      overflow: hidden;
    }

    .workbench {
      display: flex;
      flex-direction: column;
      height: 100%;
      width: 100%;
      background: var(--blocks-neutral-1, #fafafa);
    }

    .theme-light {
      --blocks-neutral-1: #fafafa;
      --blocks-neutral-2: #f5f5f5;
      --blocks-neutral-3: #e5e5e5;
      --blocks-neutral-4: #d4d4d4;
      --blocks-neutral-5: #a3a3a3;
      --blocks-neutral-6: #737373;
      --blocks-neutral-7: #525252;
      --blocks-neutral-8: #404040;
      --blocks-neutral-9: #262626;
      --blocks-neutral-10: #171717;
      --blocks-neutral-11: #0a0a0a;
      --blocks-neutral-12: #000000;
      --blocks-accent-9: #3b82f6;
    }

    .theme-dark {
      --blocks-neutral-1: #0a0a0a;
      --blocks-neutral-2: #171717;
      --blocks-neutral-3: #262626;
      --blocks-neutral-4: #404040;
      --blocks-neutral-5: #525252;
      --blocks-neutral-6: #737373;
      --blocks-neutral-7: #a3a3a3;
      --blocks-neutral-8: #d4d4d4;
      --blocks-neutral-9: #e5e5e5;
      --blocks-neutral-10: #f5f5f5;
      --blocks-neutral-11: #fafafa;
      --blocks-neutral-12: #ffffff;
      --blocks-accent-9: #60a5fa;
    }

    .density-comfortable {
      --blocks-space-1: 4px;
      --blocks-space-2: 8px;
      --blocks-space-3: 12px;
      --blocks-space-4: 16px;
      --blocks-font-size-sm: 12px;
      --blocks-font-size-base: 14px;
      --blocks-font-size-lg: 16px;
    }

    .density-compact {
      --blocks-space-1: 2px;
      --blocks-space-2: 4px;
      --blocks-space-3: 8px;
      --blocks-space-4: 12px;
      --blocks-font-size-sm: 11px;
      --blocks-font-size-base: 12px;
      --blocks-font-size-lg: 14px;
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

    .tabs {
      display: flex;
      gap: 0;
      border-bottom: 1px solid var(--blocks-neutral-4, #d4d4d4);
      padding: 0 var(--blocks-space-3, 12px);
      background: var(--blocks-neutral-2, #f5f5f5);
    }

    .tab {
      padding: var(--blocks-space-3, 12px) var(--blocks-space-4, 16px);
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      font-size: var(--blocks-font-size-base, 14px);
      font-weight: 500;
      color: var(--blocks-neutral-7, #525252);
      cursor: pointer;
      transition: all 0.2s;
    }

    @media (prefers-reduced-motion) {
      .tab {
        transition-duration: 0s;
      }
    }

    .tab:hover {
      color: var(--blocks-neutral-9, #262626);
      background: var(--blocks-neutral-3, #e5e5e5);
    }

    .tab.active {
      color: var(--blocks-accent-9, #3b82f6);
      border-bottom-color: var(--blocks-accent-9, #3b82f6);
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
    theme?: ThemeMode;
    density?: DensityMode;
  }): void {
    if (props.endpoint !== undefined) this.endpoint = props.endpoint;
    if (props.identity !== undefined) this.identity = props.identity;
    if (props.userSearchProvider !== undefined) this.userSearchProvider = props.userSearchProvider;
    if (props.theme !== undefined) this.theme = props.theme;
    if (props.density !== undefined) this.density = props.density;
    this.requestUpdate();
  }

  private _restorePreferences(): void {
    if (typeof localStorage === 'undefined') return;

    const savedTheme = localStorage.getItem(STORAGE_KEY_THEME);
    if (savedTheme === 'light' || savedTheme === 'dark') {
      this.theme = savedTheme;
    }

    const savedDensity = localStorage.getItem(STORAGE_KEY_DENSITY);
    if (savedDensity === 'comfortable' || savedDensity === 'compact') {
      this.density = savedDensity;
    }

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

    this._unsubscribeQueueSelection = onPagesEvent<QueueSelectedPayload>(
      document,
      WorkItemEventTopics.QUEUE_SELECTED,
      () => {
        this._leftPanel = 'queues';
      }
    );

    this._unsubscribeQueueDeselection = onPagesEvent(
      document,
      WorkItemEventTopics.QUEUE_DESELECTED,
      () => {
        this._leftPanel = 'queues';
      }
    );
  }

  private _unsubscribeEvents(): void {
    this._unsubscribeSelection?.();
    this._unsubscribeDeselection?.();
    this._unsubscribeQueueSelection?.();
    this._unsubscribeQueueDeselection?.();
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

  private _handleTabClick(panel: LeftPanelView): void {
    this._leftPanel = panel;
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
    if (typeof localStorage !== 'undefined') {
      if (changedProperties.has('theme')) {
        localStorage.setItem(STORAGE_KEY_THEME, this.theme);
      }
      if (changedProperties.has('density')) {
        localStorage.setItem(STORAGE_KEY_DENSITY, this.density);
      }
    }
    if (changedProperties.has('_dividerRatio')) {
      this.style.setProperty('--divider-ratio', this._dividerRatio.toString());
    }
  }

  override render(): TemplateResult {
    const workbenchClass = `workbench theme-${this.theme} density-${this.density}`;

    return html`
      <div class="${workbenchClass}">
        <div class="split-pane">
          <div class="left-panel">
            <div class="tabs">
              <button
                class="tab ${this._leftPanel === 'inbox' ? 'active' : ''}"
                @click=${() => this._handleTabClick('inbox')}
              >
                Inbox
              </button>
              <button
                class="tab ${this._leftPanel === 'queues' ? 'active' : ''}"
                @click=${() => this._handleTabClick('queues')}
              >
                Queues
              </button>
            </div>
            <div class="panel-content">
              ${this._leftPanel === 'inbox' ? this._renderInbox() : this._renderQueues()}
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

  private _renderQueues(): TemplateResult {
    return html`
      <queue-board
        .endpoint=${this.endpoint}
        .identity=${this.identity}
      ></queue-board>
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
