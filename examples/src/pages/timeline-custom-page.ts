import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '@casehubio/blocks-ui-blocks-timeline';
import type { TimelineNode, TimelineStrategy, Layout } from '@casehubio/blocks-ui-blocks-timeline';
import type { TemplateResult } from 'lit';

interface DeployStage {
  name: string;
  status: 'passed' | 'running' | 'queued' | 'failed';
  duration?: string;
  agent?: string;
  startedAt?: string;
}

function deployPipelineStrategy(): TimelineStrategy<DeployStage[]> {
  return {
    toNodes(data: DeployStage[]): TimelineNode[] {
      return data.map((stage, i) => ({
        key: `deploy-${i}`,
        label: stage.name,
        status: stage.status === 'passed' ? 'completed'
          : stage.status === 'running' ? 'active'
          : stage.status === 'failed' ? 'failed'
          : 'pending',
        actor: stage.agent,
        timestamp: stage.startedAt,
        detail: stage.duration ? { duration: stage.duration } : undefined,
      }));
    },
    defaultLayout: 'horizontal',
  };
}

const mockPipeline: DeployStage[] = [
  { name: 'Build', status: 'passed', duration: '2m 14s', agent: 'ci-runner-1', startedAt: '2026-07-14T09:00:00Z' },
  { name: 'Unit Tests', status: 'passed', duration: '4m 32s', agent: 'ci-runner-2', startedAt: '2026-07-14T09:03:00Z' },
  { name: 'Integration', status: 'passed', duration: '8m 05s', agent: 'ci-runner-3', startedAt: '2026-07-14T09:08:00Z' },
  { name: 'Security Scan', status: 'running', agent: 'scanner-01', startedAt: '2026-07-14T09:16:00Z' },
  { name: 'Stage Deploy', status: 'queued', startedAt: '2026-07-14T10:30:00Z' },
  { name: 'Prod Deploy', status: 'queued', startedAt: '2026-07-14T14:00:00Z' },
];

@customElement('timeline-custom-page')
export class TimelineCustomPage extends LitElement {
  @state() private _layout: Layout = 'horizontal';

  private _statusColors: Record<string, { bg: string; color: string }> = {
    completed: { bg: '#dcfce7', color: '#166534' },
    active: { bg: '#dbeafe', color: '#1e3a5f' },
    pending: { bg: '#f3f4f6', color: '#9ca3af' },
    failed: { bg: '#fee2e2', color: '#991b1b' },
  };

  private _customRenderNode = (node: TimelineNode): TemplateResult => {
    const icon = node.status === 'completed' ? '✓'
      : node.status === 'active' ? '⟳'
      : node.status === 'failed' ? '✗'
      : '○';
    const colors = this._statusColors[node.status] ?? this._statusColors.pending!;
    return html`
      <div style="width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;background:${colors.bg};color:${colors.color}${node.status === 'active' ? ';animation:pulse 2s infinite' : ''}">
        ${icon}
      </div>
    `;
  };

  private _customRenderDetail = (node: TimelineNode): TemplateResult => {
    const detail = node.detail as { duration?: string } | undefined;
    return html`
      <div style="font-size:13px;color:#374151">
        ${detail?.duration ? html`<div>Duration: <strong>${detail.duration}</strong></div>` : html`<div>Pending</div>`}
        ${node.actor ? html`<div>Runner: ${node.actor}</div>` : ''}
      </div>
    `;
  };

  private _toggleLayout(): void {
    const layouts: Layout[] = ['horizontal', 'vertical', 'compact'];
    const idx = layouts.indexOf(this._layout);
    this._layout = layouts[(idx + 1) % layouts.length]!;
  }

  override render() {
    return html`
      <div class="page-container">
        <div class="header">
          <h1>Timeline — Custom Strategy</h1>
          <p class="description">
            Demonstrates writing a custom TimelineStrategy from scratch. A deployment pipeline
            with custom renderNode and renderDetail callbacks. Shows the strategy pattern,
            render resolution order, and layout flexibility.
          </p>
          <div class="controls">
            <button @click=${this._toggleLayout}>Layout: ${this._layout} (click to cycle)</button>
          </div>
        </div>

        <h2>With Custom Render Callbacks</h2>
        <p class="subtitle">Component-level renderNode and renderDetail override the built-in default</p>
        <div class="viewer-container">
          <blocks-timeline
            .strategy=${deployPipelineStrategy()}
            .data=${mockPipeline}
            layout=${this._layout}
            .renderNode=${this._customRenderNode}
            .renderDetail=${this._customRenderDetail}
          ></blocks-timeline>
        </div>

        <h2>Same Strategy, Built-in Rendering</h2>
        <p class="subtitle">No render callbacks — uses the built-in numbered circles / vertical nodes</p>
        <div class="viewer-container">
          <blocks-timeline
            .strategy=${deployPipelineStrategy()}
            .data=${mockPipeline}
            layout=${this._layout}
          ></blocks-timeline>
        </div>

        <div class="info-panel">
          <h2>How to Write a Custom Strategy</h2>
          <ul>
            <li><strong>1. Define your data shape:</strong> The strategy is generic over your domain type (DeployStage[] here)</li>
            <li><strong>2. Implement toNodes():</strong> Map each domain item to a TimelineNode with key, label, status, and optional actor/detail/timestamp</li>
            <li><strong>3. Set defaultLayout:</strong> The strategy declares its preferred layout — consumers can override</li>
            <li><strong>4. Optional renderNode/renderDetail:</strong> Strategy can provide default renderers — component callbacks override them</li>
            <li><strong>5. Optional transformData:</strong> Bridge between raw backend response and your typed input</li>
            <li><strong>6. Optional filterCategories:</strong> Declare filter dimensions — the component renders filter chips automatically</li>
          </ul>

          <h3>Render Resolution Order</h3>
          <ol>
            <li>Component callback (<code>.renderNode=...</code>) — wins if provided</li>
            <li>Strategy renderer (<code>strategy.renderNode</code>) — used if component has none</li>
            <li>Built-in default — baseline rendering per layout</li>
          </ol>

          <h3>Try It</h3>
          <ul>
            <li>Compare the two instances — same strategy, different rendering (custom icons vs numbered circles)</li>
            <li>Cycle through layouts — the custom strategy works in all three modes</li>
            <li>In vertical mode, click "Details" to see the custom renderDetail output</li>
          </ul>
        </div>
      </div>
    `;
  }

  static override styles = css`
    :host { display: block; padding: 24px; font-family: var(--pages-font-family, system-ui); }
    .page-container { max-width: 1200px; margin: 0 auto; }
    .header { margin-bottom: 32px; }
    h1 { margin: 0 0 8px 0; font-size: 28px; font-weight: 600; color: var(--pages-gray-12, #111827); }
    h2 { margin: 32px 0 8px 0; font-size: 20px; font-weight: 600; color: var(--pages-gray-12, #111827); }
    .description { margin: 0 0 16px 0; font-size: 16px; color: var(--pages-gray-11, #1f2937); line-height: 1.5; }
    .subtitle { margin: 0 0 12px 0; font-size: 14px; color: var(--pages-gray-9, #6b7280); }
    .controls { display: flex; gap: 8px; }
    .controls button { padding: 8px 16px; border: 1px solid var(--pages-gray-6, #d1d5db); border-radius: 6px; background: white; cursor: pointer; font-size: 14px; }
    .controls button:hover { background: var(--pages-gray-2, #f9fafb); }
    .viewer-container { margin-bottom: 16px; border: 1px solid var(--pages-gray-6, #d1d5db); border-radius: 8px; background: white; }
    .info-panel { padding: 24px; background: var(--pages-gray-1, #fafbfc); border-radius: 8px; margin-top: 32px; }
    .info-panel h2 { margin: 0 0 16px 0; }
    .info-panel h3 { margin: 24px 0 12px 0; font-size: 16px; font-weight: 600; }
    .info-panel ul, .info-panel ol { margin: 0; padding-left: 24px; }
    .info-panel li { margin-bottom: 8px; line-height: 1.5; }
    .info-panel code { background: var(--pages-gray-3, #f3f4f6); padding: 2px 6px; border-radius: 3px; font-size: 13px; }

    .custom-node { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px; }
    .custom-node--completed { background: var(--pages-success-3, #dcfce7); color: var(--pages-success-11, #166534); }
    .custom-node--active { background: var(--pages-accent-3, #dbeafe); color: var(--pages-accent-11, #1e3a5f); animation: pulse 2s infinite; }
    .custom-node--pending { background: var(--pages-neutral-3, #f3f4f6); color: var(--pages-neutral-8, #9ca3af); }
    .custom-node--failed { background: var(--pages-error-3, #fee2e2); color: var(--pages-error-11, #991b1b); }
    .custom-detail { font-size: 13px; color: var(--pages-neutral-11, #374151); }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
  `;
}
