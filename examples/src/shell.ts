import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { generateThemeCSS, type ThemeConfig } from '@casehubio/blocks-ui-core';

interface NavItem {
  id: string;
  label: string;
  hash: string;
}

interface NavCategory {
  label: string;
  items: NavItem[];
}

const NAV: NavCategory[] = [
  {
    label: 'Components',
    items: [
      { id: 'row', label: 'Work Item Row', hash: '#components/row' },
      { id: 'inbox', label: 'Work Item Inbox', hash: '#components/inbox' },
      { id: 'detail', label: 'Work Item Detail', hash: '#components/detail' },
      { id: 'queue', label: 'Queue + Inbox', hash: '#components/queue' },
      { id: 'schema-form', label: 'Schema Form', hash: '#components/schema-form' },
      { id: 'sla-indicator', label: 'SLA Indicator', hash: '#components/sla-indicator' },
      { id: 'kpi-metric-row', label: 'KPI Metric Row', hash: '#components/kpi-metric-row' },
      { id: 'approval-gate', label: 'Approval Gate', hash: '#components/approval-gate' },
      { id: 'confirm-dialog', label: 'Confirm Dialog', hash: '#components/confirm-dialog' },
      { id: 'data-table', label: 'Data Table', hash: '#components/data-table' },
      { id: 'notifications', label: 'Notifications', hash: '#components/notifications' },
      { id: 'audit-trail', label: 'Audit Trail Viewer', hash: '#components/audit-trail' },
      { id: 'case-timeline', label: 'Case Timeline', hash: '#components/case-timeline' },
      { id: 'trust-score', label: 'Trust Score Panel', hash: '#components/trust-score' },
    ],
  },
  {
    label: 'Composed',
    items: [
      { id: 'workbench', label: 'Full Workbench', hash: '#composed/workbench' },
    ],
  },
];

const THEME_CONFIG: ThemeConfig = {
  baseHue: 220,
  accentHue: 250,
  chroma: 0.12,
  contrast: 0.5,
};

@customElement('example-shell')
export class ExampleShell extends LitElement {
  @state() private currentPage = '';
  @state() private theme: 'light' | 'dark' = 'light';
  @state() private density: 'comfortable' | 'compact' = 'comfortable';

  static override styles = css`
    :host { display: flex; height: 100vh; font-family: var(--pages-font-family, system-ui); }

    .sidebar {
      width: 240px;
      background: var(--pages-neutral-2, #f5f5f5);
      border-right: 1px solid var(--pages-neutral-5, #e0e0e0);
      overflow-y: auto;
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
    }

    .sidebar-header {
      padding: 16px;
      font-size: 16px;
      font-weight: 600;
      color: var(--pages-neutral-12, #111);
      border-bottom: 1px solid var(--pages-neutral-5, #e0e0e0);
    }

    .category { padding: 12px 0 4px 16px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--pages-neutral-9, #888); }

    .nav-item {
      display: block;
      padding: 8px 16px 8px 24px;
      font-size: 14px;
      color: var(--pages-neutral-11, #555);
      text-decoration: none;
      cursor: pointer;
      border: none;
      background: none;
      width: 100%;
      text-align: left;
    }
    .nav-item:hover { background: var(--pages-neutral-3, #eee); color: var(--pages-neutral-12, #111); }
    .nav-item.active { background: var(--pages-accent-3, #e0e7ff); color: var(--pages-accent-11, #1e40af); font-weight: 500; }

    .controls { margin-top: auto; padding: 12px 16px; border-top: 1px solid var(--pages-neutral-5, #e0e0e0); display: flex; gap: 8px; }
    .toggle { padding: 4px 10px; border-radius: 4px; border: 1px solid var(--pages-neutral-6, #ccc); background: var(--pages-neutral-1, #fff); cursor: pointer; font-size: 12px; color: var(--pages-neutral-11, #555); }
    .toggle.active { background: var(--pages-accent-9, #2563eb); color: white; border-color: var(--pages-accent-9, #2563eb); }

    .content { flex: 1; overflow: auto; background: var(--pages-neutral-1, #fafafa); }
  `;

  override connectedCallback(): void {
    super.connectedCallback();
    this.applyTheme();
    this.currentPage = location.hash || '#composed/workbench';
    window.addEventListener('hashchange', this.onHashChange);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('hashchange', this.onHashChange);
  }

  private onHashChange = (): void => {
    this.currentPage = location.hash;
  };

  private applyTheme(): void {
    const css = generateThemeCSS(THEME_CONFIG);
    let style = document.querySelector('style[data-pages-theme]') as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.setAttribute('data-pages-theme', '');
      document.head.appendChild(style);
    }
    style.textContent = css;
    document.documentElement.className = `pages-theme-${this.theme}${this.density === 'compact' ? ' pages-density-compact' : ''}`;
  }

  private toggleTheme(): void {
    this.theme = this.theme === 'light' ? 'dark' : 'light';
    this.applyTheme();
  }

  private toggleDensity(): void {
    this.density = this.density === 'comfortable' ? 'compact' : 'comfortable';
    this.applyTheme();
  }

  override render() {
    return html`
      <nav class="sidebar">
        <div class="sidebar-header">blocks-ui Examples</div>
        ${NAV.map(cat => html`
          <div class="category">${cat.label}</div>
          ${cat.items.map(item => html`
            <button class="nav-item ${this.currentPage === item.hash ? 'active' : ''}"
              @click=${() => { location.hash = item.hash; }}>
              ${item.label}
            </button>
          `)}
        `)}
        <div class="controls">
          <button class="toggle ${this.theme === 'dark' ? 'active' : ''}" @click=${() => this.toggleTheme()}>
            ${this.theme === 'dark' ? 'Dark' : 'Light'}
          </button>
          <button class="toggle ${this.density === 'compact' ? 'active' : ''}" @click=${() => this.toggleDensity()}>
            ${this.density === 'compact' ? 'Compact' : 'Comfortable'}
          </button>
        </div>
      </nav>
      <main class="content">
        <slot name="${this.currentPage}"></slot>
        ${this.renderPage()}
      </main>
    `;
  }

  private renderPage() {
    switch (this.currentPage) {
      case '#components/row': return html`<row-page></row-page>`;
      case '#components/inbox': return html`<inbox-page></inbox-page>`;
      case '#components/detail': return html`<detail-page></detail-page>`;
      case '#components/queue': return html`<queue-inbox-page></queue-inbox-page>`;
      case '#components/schema-form': return html`<schema-form-page></schema-form-page>`;
      case '#components/sla-indicator': return html`<sla-indicator-page></sla-indicator-page>`;
      case '#components/kpi-metric-row': return html`<kpi-metric-row-page></kpi-metric-row-page>`;
      case '#components/approval-gate': return html`<approval-gate-page></approval-gate-page>`;
      case '#components/confirm-dialog': return html`<confirm-dialog-page></confirm-dialog-page>`;
      case '#components/data-table': return html`<data-table-page></data-table-page>`;
      case '#components/notifications': return html`<notification-page></notification-page>`;
      case '#components/audit-trail': return html`<audit-trail-page></audit-trail-page>`;
      case '#components/case-timeline': return html`<case-timeline-page></case-timeline-page>`;
      case '#components/trust-score': return html`<trust-score-page></trust-score-page>`;
      case '#composed/workbench': return html`<workbench-page></workbench-page>`;
      default: return html`<workbench-page></workbench-page>`;
    }
  }
}
