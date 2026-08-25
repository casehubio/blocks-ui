import { describe, it, expect, afterEach, vi } from 'vitest';
import { columnId, ColumnType, fromRows } from '@casehubio/pages-data';
import type { TypedDataSet, ColumnId, TypedRow } from '@casehubio/pages-data';
import type { TableColumnConfig } from '@casehubio/pages-table';
import type { TemplateResult } from 'lit';
import { html } from 'lit';
import './index.js';
import type { BlocksEventTrail } from './event-trail.js';

const TYPE_COL = columnId('type');
const ACTOR_COL = columnId('actor');
const MSG_COL = columnId('message');
const ID_COL = columnId('id');

const TEST_COL_DEFS = [
  { id: ID_COL, type: ColumnType.TEXT, getValue: (r: any) => r.id },
  { id: TYPE_COL, name: 'Type', type: ColumnType.TEXT, getValue: (r: any) => r.type },
  { id: ACTOR_COL, name: 'Actor', type: ColumnType.TEXT, getValue: (r: any) => r.actor },
  { id: MSG_COL, name: 'Message', type: ColumnType.TEXT, getValue: (r: any) => r.message },
] as const;

const TEST_COL_CONFIG: TableColumnConfig[] = [
  { id: ID_COL, visible: false },
  { id: TYPE_COL, sortable: true },
  { id: ACTOR_COL, sortable: true },
  { id: MSG_COL, sortable: false },
];

const TEST_DATA = [
  { id: '1', type: 'COMMAND', actor: 'alice', message: 'Created case' },
  { id: '2', type: 'EVENT', actor: 'bob', message: 'Status changed' },
  { id: '3', type: 'COMMAND', actor: 'alice', message: 'Updated field' },
];

async function createElement(attrs: Record<string, unknown> = {}): Promise<BlocksEventTrail> {
  const el = document.createElement('blocks-event-trail') as BlocksEventTrail;
  Object.entries(attrs).forEach(([key, value]) => {
    (el as any)[key] = value;
  });
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

describe('BlocksEventTrail', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('registers as a custom element', () => {
    expect(customElements.get('blocks-event-trail')).toBeDefined();
  });

  describe('dual data mode', () => {
    it('renders table from data property', async () => {
      const el = await createElement({
        data: TEST_DATA,
        columnDefs: TEST_COL_DEFS,
        columnConfig: TEST_COL_CONFIG,
      });
      const table = el.shadowRoot!.querySelector('pages-table');
      expect(table).not.toBeNull();
      expect((table as any).dataSet).toBeDefined();
      expect((table as any).dataSet.rows.length).toBe(3);
    });

    it('fires data-loaded event with raw entries', async () => {
      const handler = vi.fn();
      const el = document.createElement('blocks-event-trail') as BlocksEventTrail;
      el.addEventListener('data-loaded', handler);
      (el as any).columnDefs = TEST_COL_DEFS;
      (el as any).columnConfig = TEST_COL_CONFIG;
      document.body.appendChild(el);
      await el.updateComplete;

      (el as any).data = TEST_DATA;
      await el.updateComplete;

      expect(handler).toHaveBeenCalled();
      const detail = handler.mock.calls[0][0].detail;
      expect(detail.entries).toEqual(TEST_DATA);
    });
  });

  describe('filter integration', () => {
    it('renders pages-filter-bar when chipField is set', async () => {
      const el = await createElement({
        data: TEST_DATA,
        columnDefs: TEST_COL_DEFS,
        columnConfig: TEST_COL_CONFIG,
        chipField: TYPE_COL,
      });
      const filterBar = el.shadowRoot!.querySelector('pages-filter-bar');
      expect(filterBar).not.toBeNull();
    });

    it('applies chip filter to table data', async () => {
      const el = await createElement({
        data: TEST_DATA,
        columnDefs: TEST_COL_DEFS,
        columnConfig: TEST_COL_CONFIG,
        chipField: TYPE_COL,
      });
      const filterBar = el.shadowRoot!.querySelector('pages-filter-bar') as HTMLElement;
      filterBar.dispatchEvent(new CustomEvent('filter-bar-change', {
        bubbles: true,
        composed: true,
        detail: {
          selectedChips: ['EVENT'],
          selectedEntity: null,
          dateFrom: '',
          dateTo: '',
        },
      }));
      await el.updateComplete;

      const table = el.shadowRoot!.querySelector('pages-table') as any;
      expect(table.dataSet.rows.length).toBe(1);
    });

    it('applies entity filter to table data', async () => {
      const el = await createElement({
        data: TEST_DATA,
        columnDefs: TEST_COL_DEFS,
        columnConfig: TEST_COL_CONFIG,
        entityField: ACTOR_COL,
      });
      const filterBar = el.shadowRoot!.querySelector('pages-filter-bar') as HTMLElement;
      filterBar.dispatchEvent(new CustomEvent('filter-bar-change', {
        bubbles: true,
        composed: true,
        detail: {
          selectedChips: [],
          selectedEntity: 'alice',
          dateFrom: '',
          dateTo: '',
        },
      }));
      await el.updateComplete;

      const table = el.shadowRoot!.querySelector('pages-table') as any;
      expect(table.dataSet.rows.length).toBe(2);
    });
  });

  describe('detail expansion', () => {
    it('forwards getRowDetail to pages-table', async () => {
      const getRowDetail = (row: TypedRow): TemplateResult | undefined => {
        return html`<div class="test-detail">${row.text(MSG_COL)}</div>`;
      };
      const el = await createElement({
        data: TEST_DATA,
        columnDefs: TEST_COL_DEFS,
        columnConfig: TEST_COL_CONFIG,
        getRowDetail,
        getRowKey: (row: TypedRow) => row.text(ID_COL),
      });
      const table = el.shadowRoot!.querySelector('pages-table') as any;
      expect(table.getRowDetail).toBe(getRowDetail);
      expect(table.getRowKey).toBeDefined();
    });
  });

  describe('configure()', () => {
    it('sets properties via configure', async () => {
      const el = await createElement({
        columnDefs: TEST_COL_DEFS,
        columnConfig: TEST_COL_CONFIG,
      });
      el.configure({
        data: TEST_DATA,
      });
      await el.updateComplete;
      await new Promise(r => setTimeout(r, 0));
      await el.updateComplete;

      const table = el.shadowRoot!.querySelector('pages-table') as any;
      expect(table.dataSet).toBeDefined();
    });
  });

  describe('ARIA', () => {
    it('has role="region" on host', async () => {
      const el = await createElement({
        data: TEST_DATA,
        columnDefs: TEST_COL_DEFS,
        columnConfig: TEST_COL_CONFIG,
      });
      expect(el.getAttribute('role')).toBe('region');
    });

    it('has aria-label="Event trail"', async () => {
      const el = await createElement({
        data: TEST_DATA,
        columnDefs: TEST_COL_DEFS,
        columnConfig: TEST_COL_CONFIG,
      });
      expect(el.getAttribute('aria-label')).toBe('Event trail');
    });
  });

  describe('error state', () => {
    it('shows error with retry button', async () => {
      const el = await createElement({
        columnDefs: TEST_COL_DEFS,
        columnConfig: TEST_COL_CONFIG,
      });
      (el as any).error = 'Connection failed';
      await el.updateComplete;

      const errorDiv = el.shadowRoot!.querySelector('[role="alert"]');
      expect(errorDiv).not.toBeNull();
      expect(errorDiv?.textContent).toContain('Connection failed');

      const retryBtn = el.shadowRoot!.querySelector('[role="alert"] button');
      expect(retryBtn).not.toBeNull();
      expect(retryBtn?.textContent?.trim()).toBe('Retry');
    });
  });
});
