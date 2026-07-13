import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import type { WorkIdentity } from '@casehubio/blocks-ui-core';
import '@casehubio/blocks-ui-audit-trail-viewer';
import mockEntries from '../../mock-data/ledger-entries.json';

interface Attestation {
  id: string;
  ledgerEntryId: string;
  subjectId: string;
  attestorId: string;
  attestorType: string;
  verdict: 'SOUND' | 'FLAGGED' | 'ENDORSED' | 'CHALLENGED';
  evidence: unknown;
  confidence: number;
  capabilityTag: string | null;
  occurredAt: string;
}

interface VerificationResult {
  subjectId: string;
  treeRoot: string;
  verified: boolean;
  redactedCount?: number;
}

@customElement('audit-trail-page')
export class AuditTrailPage extends LitElement {
  private _originalFetch: typeof globalThis.fetch | null = null;

  private _mockFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const urlObj = new URL(url, window.location.href);

    if (urlObj.pathname.includes('/ledger/entries/') && urlObj.pathname.endsWith('/attestations')) {
      const entryId = urlObj.pathname.split('/').slice(-2)[0] ?? '';
      const attestations: Attestation[] = [
        {
          id: `att-${entryId}-1`,
          ledgerEntryId: entryId,
          subjectId: 'case-123',
          attestorId: 'attestor-001',
          attestorType: 'PEER',
          verdict: 'SOUND',
          evidence: { score: 0.95 },
          confidence: 0.9,
          capabilityTag: 'FRAUD_ANALYSIS',
          occurredAt: '2026-07-07T11:30:00Z',
        },
        {
          id: `att-${entryId}-2`,
          ledgerEntryId: entryId,
          subjectId: 'case-123',
          attestorId: 'attestor-002',
          attestorType: 'PEER',
          verdict: 'ENDORSED',
          evidence: { score: 0.88 },
          confidence: 0.85,
          capabilityTag: 'RISK_ASSESSMENT',
          occurredAt: '2026-07-07T12:00:00Z',
        },
      ];
      return new Response(JSON.stringify(attestations), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (urlObj.pathname.includes('/ledger/entries')) {
      return new Response(JSON.stringify(mockEntries), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (urlObj.pathname.includes('/ledger/verify')) {
      const verification: VerificationResult = {
        subjectId: 'case-123',
        treeRoot: 'f7a8b9c0d1e2f3g4h5i6j7k8l9m0n1o2',
        verified: true,
        redactedCount: 1,
      };
      return new Response(JSON.stringify(verification), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return this._originalFetch!.call(globalThis, input, init);
  };

  override connectedCallback(): void {
    super.connectedCallback();
    this._originalFetch = globalThis.fetch;
    globalThis.fetch = this._mockFetch as typeof globalThis.fetch;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._originalFetch) {
      globalThis.fetch = this._originalFetch;
      this._originalFetch = null;
    }
  }

  protected override firstUpdated(): void {
    const viewer = this.shadowRoot?.querySelector('audit-trail-viewer') as any;
    if (viewer) {
      viewer.configure({
        endpoint: '/api/mock',
        identity: {
          userId: 'demo-user',
          tenancyId: 'tenant-1',
          roles: ['CASE_VIEWER'],
        } as WorkIdentity,
      });
    }
  }

  override render() {
    return html`
      <div class="page-container">
        <div class="header">
          <h1>Audit Trail Viewer</h1>
          <p class="description">
            Displays chronological ledger entries with Merkle chain verification, attestations, and GDPR-compliant
            redaction handling. Demonstrates filterable entry list, expandable detail, and verification banner.
          </p>
        </div>

        <div class="viewer-container">
          <audit-trail-viewer subject-id="case-123"></audit-trail-viewer>
        </div>

        <div class="info-panel">
          <h2>Component Features</h2>
          <ul>
            <li><strong>Row Detail Expansion:</strong> Click any row to expand inline detail via pages-table's getRowDetail callback — shows full digest, trace ID, causal chain, payload, and attestations</li>
            <li><strong>Verification Banner:</strong> Shows chain integrity status with redaction count</li>
            <li><strong>Filter Controls:</strong> Actor dropdown, entry type chips, date range inputs</li>
            <li><strong>Entry List:</strong> Timestamp, actor with type badge, entry type, truncated digest</li>
            <li><strong>GDPR Compliance:</strong> Null payloads show "Content redacted" placeholder</li>
            <li><strong>Accessibility:</strong> ARIA roles, keyboard navigation, live region announcements</li>
          </ul>

          <h3>Mock Data</h3>
          <p>
            This example uses ${mockEntries.length} mock ledger entries with various entry types (COMMAND, EVENT,
            ATTESTATION) and actors (USER, SYSTEM, AGENT, PEER). Entry #5 has a redacted payload to demonstrate GDPR
            handling. Each expanded row shows mock attestations with SOUND and ENDORSED verdicts.
          </p>

          <h3>Try It</h3>
          <ul>
            <li>Click any row to expand — the detail panel renders inline via getRowDetail, showing full digest, trace ID, causal chain, and payload</li>
            <li>Expand entry #4 (ATTESTATION type) to see attestation verdicts and confidence scores</li>
            <li>Expand entry #5 to see the "Content redacted" GDPR placeholder</li>
            <li>Click an expanded row again to collapse it (single-expand mode — only one row open at a time)</li>
            <li>Filter by actor using the dropdown</li>
            <li>Toggle entry type chips to filter by COMMAND/EVENT/ATTESTATION</li>
            <li>Note the verification banner showing 1 redacted entry</li>
          </ul>
        </div>
      </div>
    `;
  }

  static override styles = css`
    :host {
      display: block;
      padding: 24px;
      font-family: var(--pages-font-family, system-ui);
    }

    .page-container {
      max-width: 1200px;
      margin: 0 auto;
    }

    .header {
      margin-bottom: 32px;
    }

    h1 {
      margin: 0 0 8px 0;
      font-size: 28px;
      font-weight: 600;
      color: var(--pages-gray-12, #111827);
    }

    .description {
      margin: 0;
      font-size: 16px;
      color: var(--pages-gray-11, #1f2937);
      line-height: 1.5;
    }

    .viewer-container {
      margin-bottom: 32px;
      border: 1px solid var(--pages-gray-6, #d1d5db);
      border-radius: 8px;
      padding: 16px;
      background: white;
    }

    .info-panel {
      padding: 24px;
      background: var(--pages-gray-1, #fafbfc);
      border-radius: 8px;
    }

    .info-panel h2 {
      margin: 0 0 16px 0;
      font-size: 20px;
      font-weight: 600;
      color: var(--pages-gray-12, #111827);
    }

    .info-panel h3 {
      margin: 24px 0 12px 0;
      font-size: 16px;
      font-weight: 600;
      color: var(--pages-gray-11, #1f2937);
    }

    .info-panel h3:first-of-type {
      margin-top: 0;
    }

    .info-panel ul {
      margin: 0;
      padding-left: 24px;
    }

    .info-panel li {
      margin-bottom: 8px;
      line-height: 1.5;
      color: var(--pages-gray-11, #1f2937);
    }

    .info-panel p {
      margin: 0 0 12px 0;
      line-height: 1.5;
      color: var(--pages-gray-11, #1f2937);
    }

    .info-panel strong {
      color: var(--pages-gray-12, #111827);
    }
  `;
}
