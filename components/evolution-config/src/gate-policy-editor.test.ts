import { describe, it, expect, vi, afterEach } from 'vitest';
import type { StageDescriptor, GatePolicy, ImprovementStreamView } from './types.js';
import './gate-policy-editor.js';
import type { GatePolicyEditor } from './gate-policy-editor.js';

function createElement(
  stages?: readonly StageDescriptor[],
  policy?: GatePolicy,
  readonly = false,
): GatePolicyEditor {
  const el = document.createElement('blocks-gate-policy-editor') as GatePolicyEditor;
  if (stages) el.stages = stages;
  if (policy) el.policy = policy;
  el.readonly = readonly;
  document.body.appendChild(el);
  return el;
}

const CODE_STAGES: StageDescriptor[] = [
  { id: 'introspect', name: 'Introspect', ordinal: 0, gateCheckpoint: false, domainId: 'code-evolution' },
  { id: 'research-scope', name: 'Research Scope', ordinal: 1, gateCheckpoint: true, domainId: 'code-evolution' },
  { id: 'hypothesis-approval', name: 'Hypothesis Approval', ordinal: 4, gateCheckpoint: true, domainId: 'code-evolution' },
  { id: 'pr-review', name: 'PR Review', ordinal: 8, gateCheckpoint: true, domainId: 'code-evolution' },
];

const TRADING_STAGES: StageDescriptor[] = [
  { id: 'backtest', name: 'Backtest', ordinal: 0, gateCheckpoint: false, domainId: 'trading' },
  { id: 'regulatory-check', name: 'Regulatory Check', ordinal: 1, gateCheckpoint: true, domainId: 'trading' },
];

const SAMPLE_POLICY: GatePolicy = {
  modes: { 'pr-review': 'GATED', 'hypothesis-approval': 'NOTIFY' },
  gateTimeoutMinutes: 720,
};

describe('blocks-gate-policy-editor', () => {
  afterEach(() => {
    document.body.querySelectorAll('blocks-gate-policy-editor').forEach(el => el.remove());
  });

  it('has correct ARIA attributes', async () => {
    const el = createElement(CODE_STAGES, SAMPLE_POLICY);
    await el.updateComplete;
    expect(el.getAttribute('role')).toBe('form');
    expect(el.getAttribute('aria-label')).toBe('Gate policy editor');
  });

  it('renders stages grouped by domain', async () => {
    const el = createElement([...CODE_STAGES, ...TRADING_STAGES], SAMPLE_POLICY);
    await el.updateComplete;
    const groups = el.shadowRoot!.querySelectorAll('[role="group"]');
    expect(groups.length).toBe(2);
    expect(groups[0]!.getAttribute('aria-label')).toContain('code-evolution');
    expect(groups[1]!.getAttribute('aria-label')).toContain('trading');
  });

  it('renders stages sorted by ordinal within domain', async () => {
    const el = createElement(CODE_STAGES, SAMPLE_POLICY);
    await el.updateComplete;
    const rows = el.shadowRoot!.querySelectorAll('tbody tr');
    expect(rows.length).toBe(4);
    expect(rows[0]!.querySelector('td')!.textContent).toContain('Introspect');
    expect(rows[1]!.querySelector('td')!.textContent).toContain('Research Scope');
  });

  it('GATED option only available for gate checkpoints', async () => {
    const el = createElement(CODE_STAGES, SAMPLE_POLICY);
    await el.updateComplete;
    const selects = el.shadowRoot!.querySelectorAll('select');
    const introspectSelect = selects[0]!;
    const researchScopeSelect = selects[1]!;
    const introspectOptions = Array.from(introspectSelect.querySelectorAll('option')).map(o => o.value);
    const researchOptions = Array.from(researchScopeSelect.querySelectorAll('option')).map(o => o.value);
    expect(introspectOptions).not.toContain('GATED');
    expect(introspectOptions).toContain('AUTO');
    expect(introspectOptions).toContain('NOTIFY');
    expect(researchOptions).toContain('GATED');
    expect(researchOptions).toContain('AUTO');
    expect(researchOptions).toContain('NOTIFY');
  });

  it('save button disabled when no changes', async () => {
    const el = createElement(CODE_STAGES, SAMPLE_POLICY);
    await el.updateComplete;
    const saveBtn = el.shadowRoot!.querySelector('.btn-save') as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);
  });

  it('save button enabled after mode change', async () => {
    const el = createElement(CODE_STAGES, SAMPLE_POLICY);
    await el.updateComplete;
    (el as any)._handleModeChange('introspect', 'NOTIFY');
    await el.updateComplete;
    const saveBtn = el.shadowRoot!.querySelector('.btn-save') as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(false);
  });

  it('emits gate-policy-changed on save', async () => {
    const el = createElement(CODE_STAGES, SAMPLE_POLICY);
    await el.updateComplete;
    const handler = vi.fn();
    el.addEventListener('pages-event', handler);
    (el as any)._handleModeChange('introspect', 'NOTIFY');
    await el._handleSave();
    expect(handler).toHaveBeenCalledOnce();
    const detail = handler.mock.calls[0]![0].detail;
    expect(detail.topic).toBe('evolution:gate-policy-changed');
    expect(detail.payload.modes.introspect).toBe('NOTIFY');
    expect(detail.payload.modes['pr-review']).toBe('GATED');
  });

  it('reset clears pending changes', async () => {
    const el = createElement(CODE_STAGES, SAMPLE_POLICY);
    await el.updateComplete;
    (el as any)._handleModeChange('introspect', 'NOTIFY');
    await el.updateComplete;
    expect((el as any)._isDirty).toBe(true);
    (el as any)._resetChanges();
    await el.updateComplete;
    expect((el as any)._isDirty).toBe(false);
  });

  it('hides controls in readonly mode', async () => {
    const el = createElement(CODE_STAGES, SAMPLE_POLICY, true);
    await el.updateComplete;
    const selects = el.shadowRoot!.querySelectorAll('select');
    expect(selects.length).toBe(0);
    const saveBtn = el.shadowRoot!.querySelector('.btn-save');
    expect(saveBtn).toBeNull();
  });

  it('shows gate timeout value', async () => {
    const el = createElement(CODE_STAGES, SAMPLE_POLICY);
    await el.updateComplete;
    const timeoutInput = el.shadowRoot!.querySelector('.timeout-row input') as HTMLInputElement;
    expect(timeoutInput.value).toBe('720');
  });

  it('shows empty message when no stages', async () => {
    const el = createElement([]);
    await el.updateComplete;
    const empty = el.shadowRoot!.querySelector('.empty');
    expect(empty).not.toBeNull();
    expect(empty!.textContent).toContain('No stages available');
  });

  it('configure() updates properties', async () => {
    const el = createElement();
    el.configure({ caseId: 'case-1', readonly: true });
    expect(el.caseId).toBe('case-1');
    expect(el.readonly).toBe(true);
  });

  describe('impact preview', () => {
    const SAMPLE_STREAMS: ImprovementStreamView[] = [
      { improvementCaseId: '001', category: 'lint-fix', target: 'auth-module', currentStage: 'pr-review', blockedBy: null, conflictBlocked: false, startedAt: '2026-09-26T06:00:00Z' },
      { improvementCaseId: '002', category: 'dep-update', target: 'quarkus', currentStage: 'pr-review', blockedBy: null, conflictBlocked: false, startedAt: '2026-09-26T07:00:00Z' },
      { improvementCaseId: '003', category: 'coverage', target: 'payment', currentStage: 'implement', blockedBy: null, conflictBlocked: false, startedAt: '2026-09-26T08:00:00Z' },
    ];

    it('shows impact preview when streams provided', async () => {
      const el = createElement(CODE_STAGES, SAMPLE_POLICY);
      el.streams = SAMPLE_STREAMS;
      await el.updateComplete;

      const preview = el.shadowRoot!.querySelector('.impact-preview');
      expect(preview).not.toBeNull();
      expect(preview!.textContent).toContain('pr-review');
      expect(preview!.textContent).toContain('2');
    });

    it('hides impact preview when no streams', async () => {
      const el = createElement(CODE_STAGES, SAMPLE_POLICY);
      await el.updateComplete;

      const preview = el.shadowRoot!.querySelector('.impact-preview');
      expect(preview).toBeNull();
    });
  });
});
