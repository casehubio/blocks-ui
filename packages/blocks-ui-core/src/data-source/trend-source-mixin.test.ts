import { describe, it, expect, vi, afterEach } from 'vitest';
import { LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { TrendSourceMixin } from './trend-source-mixin.js';
import type { TrendPoint } from './trend-types.js';
import type { DataSource, DataSink } from '@casehubio/pages-data/dist/datasource/types.js';
import { ColumnType, columnId } from '@casehubio/pages-data/dist/dataset/types.js';
import { createTypedRow } from '@casehubio/pages-data/dist/dataset/conversion.js';
import type { TypedDataSet, Column, CellValue } from '@casehubio/pages-data/dist/dataset/types.js';

const TS_COL: Column = { id: columnId('timestamp'), name: 'timestamp', type: ColumnType.NUMBER };
const SCORE_COL: Column = { id: columnId('score'), name: 'score', type: ColumnType.NUMBER };
const ID_COL: Column = { id: columnId('id'), name: 'id', type: ColumnType.TEXT };
const COLUMNS = [ID_COL, TS_COL, SCORE_COL];

function makeRow(id: string, ts: number, score: number) {
  const cells: CellValue[] = [
    { type: ColumnType.TEXT, value: id },
    { type: ColumnType.NUMBER, value: ts },
    { type: ColumnType.NUMBER, value: score },
  ];
  return createTypedRow(cells, COLUMNS);
}

function makeDataSet(rows: Array<[string, number, number]>): TypedDataSet {
  return {
    columns: COLUMNS,
    rows: rows.map(([id, ts, score]) => makeRow(id, ts, score)),
  };
}

function capturingSource(): { source: DataSource; sink: () => DataSink } {
  let captured: DataSink | null = null;
  return {
    source: {
      connect(s: DataSink) { captured = s; },
      disconnect() { captured = null; },
    },
    sink: () => {
      if (!captured) throw new Error('Source not connected');
      return captured;
    },
  };
}

@customElement('test-trend-host')
class TestTrendHost extends TrendSourceMixin(LitElement) {}

async function flush(): Promise<void> {
  await new Promise(r => setTimeout(r, 20));
}

describe('TrendSourceMixin', () => {
  afterEach(() => {
    document.querySelectorAll('test-trend-host').forEach(e => e.remove());
  });

  function createElement(): TestTrendHost {
    const el = document.createElement('test-trend-host') as TestTrendHost;
    document.body.appendChild(el);
    return el;
  }

  describe('trendData (direct import)', () => {
    it('trendPoints returns trendData capped to maxTrendPoints', async () => {
      const el = createElement();
      await el.updateComplete;
      const data: TrendPoint[] = Array.from({ length: 50 }, (_, i) => ({
        timestamp: i * 1000,
        score: 0.5 + i * 0.01,
      }));
      el.trendData = data;
      await el.updateComplete;
      expect(el.trendPoints).toHaveLength(30);
      expect(el.trendPoints[0]!.timestamp).toBe(20000);
      expect(el.trendPoints[29]!.timestamp).toBe(49000);
    });

    it('trendPoints sorts by timestamp ascending', async () => {
      const el = createElement();
      await el.updateComplete;
      el.trendData = [
        { timestamp: 3000, score: 0.9 },
        { timestamp: 1000, score: 0.7 },
        { timestamp: 2000, score: 0.8 },
      ];
      await el.updateComplete;
      expect(el.trendPoints.map(p => p.timestamp)).toEqual([1000, 2000, 3000]);
    });

    it('trendLoading is false when using trendData', async () => {
      const el = createElement();
      await el.updateComplete;
      el.trendData = [{ timestamp: 1000, score: 0.8 }];
      await el.updateComplete;
      expect(el.trendLoading).toBe(false);
    });

    it('trendError is empty when using trendData', async () => {
      const el = createElement();
      await el.updateComplete;
      el.trendData = [{ timestamp: 1000, score: 0.8 }];
      await el.updateComplete;
      expect(el.trendError).toBe('');
    });
  });

  describe('trendSource (DataSource)', () => {
    it('populates trendPoints from snapshot event', async () => {
      const el = createElement();
      await el.updateComplete;
      const { source, sink } = capturingSource();
      el.trendSource = source;
      await el.updateComplete;
      sink().apply({ type: 'snapshot', dataset: makeDataSet([['1', 1000, 0.8], ['2', 2000, 0.85]]) });
      await flush();
      await el.updateComplete;
      expect(el.trendPoints).toEqual([
        { timestamp: 1000, score: 0.8 },
        { timestamp: 2000, score: 0.85 },
      ]);
    });

    it('accumulates from append events', async () => {
      const el = createElement();
      await el.updateComplete;
      const { source, sink } = capturingSource();
      el.trendSource = source;
      await el.updateComplete;
      sink().apply({ type: 'snapshot', dataset: makeDataSet([['1', 1000, 0.8]]) });
      await flush();
      await el.updateComplete;
      expect(el.trendPoints).toHaveLength(1);
      sink().apply({ type: 'append', rows: [makeRow('2', 2000, 0.85)] });
      await flush();
      await el.updateComplete;
      expect(el.trendPoints).toHaveLength(2);
    });

    it('respects maxTrendPoints with adapter data', async () => {
      const el = createElement();
      el.maxTrendPoints = 2;
      await el.updateComplete;
      const { source, sink } = capturingSource();
      el.trendSource = source;
      await el.updateComplete;
      sink().apply({ type: 'snapshot', dataset: makeDataSet([
        ['1', 1000, 0.8], ['2', 2000, 0.85], ['3', 3000, 0.9],
      ]) });
      await flush();
      await el.updateComplete;
      expect(el.trendPoints).toHaveLength(2);
      expect(el.trendPoints[0]!.timestamp).toBe(2000);
    });

    it('trendLoading is true before data arrives', async () => {
      const el = createElement();
      await el.updateComplete;
      const { source } = capturingSource();
      el.trendSource = source;
      await el.updateComplete;
      expect(el.trendLoading).toBe(true);
    });

    it('trendError reflects source error', async () => {
      const el = createElement();
      await el.updateComplete;
      const { source, sink } = capturingSource();
      el.trendSource = source;
      await el.updateComplete;
      sink().error({ message: 'Network error', permanent: true });
      await flush();
      await el.updateComplete;
      expect(el.trendError).toBe('Network error');
    });

    it('disconnects previous source when new source set', async () => {
      const el = createElement();
      await el.updateComplete;
      const s1 = capturingSource();
      const s2 = capturingSource();
      const disconnect1 = vi.spyOn(s1.source, 'disconnect');
      el.trendSource = s1.source;
      await el.updateComplete;
      el.trendSource = s2.source;
      await el.updateComplete;
      expect(disconnect1).toHaveBeenCalled();
    });
  });

  describe('precedence', () => {
    it('trendData wins over trendSource', async () => {
      const el = createElement();
      await el.updateComplete;
      const { source, sink } = capturingSource();
      el.trendSource = source;
      await el.updateComplete;
      sink().apply({ type: 'snapshot', dataset: makeDataSet([['1', 1000, 0.8]]) });
      await flush();
      await el.updateComplete;
      el.trendData = [{ timestamp: 5000, score: 0.99 }];
      await el.updateComplete;
      expect(el.trendPoints).toEqual([{ timestamp: 5000, score: 0.99 }]);
    });

    it('clearing trendData falls back to adapter data', async () => {
      const el = createElement();
      await el.updateComplete;
      const { source, sink } = capturingSource();
      el.trendSource = source;
      await el.updateComplete;
      sink().apply({ type: 'snapshot', dataset: makeDataSet([['1', 1000, 0.8]]) });
      await flush();
      await el.updateComplete;
      el.trendData = [{ timestamp: 5000, score: 0.99 }];
      await el.updateComplete;
      expect(el.trendPoints[0]!.timestamp).toBe(5000);
      el.trendData = undefined;
      await el.updateComplete;
      expect(el.trendPoints[0]!.timestamp).toBe(1000);
    });

    it('adapter stays connected when trendData is set', async () => {
      const el = createElement();
      await el.updateComplete;
      const { source, sink } = capturingSource();
      const disconnectSpy = vi.spyOn(source, 'disconnect');
      el.trendSource = source;
      await el.updateComplete;
      el.trendData = [{ timestamp: 5000, score: 0.99 }];
      await el.updateComplete;
      expect(disconnectSpy).not.toHaveBeenCalled();
      sink().apply({ type: 'snapshot', dataset: makeDataSet([['1', 1000, 0.8]]) });
      await flush();
      await el.updateComplete;
      expect(el.trendPoints[0]!.timestamp).toBe(5000);
    });
  });

  describe('maxTrendPoints runtime change', () => {
    it('trendPoints reflects new maxTrendPoints without data change', async () => {
      const el = createElement();
      await el.updateComplete;
      el.trendData = Array.from({ length: 10 }, (_, i) => ({
        timestamp: i * 1000,
        score: 0.5,
      }));
      el.maxTrendPoints = 5;
      await el.updateComplete;
      expect(el.trendPoints).toHaveLength(5);
      el.maxTrendPoints = 3;
      await el.updateComplete;
      expect(el.trendPoints).toHaveLength(3);
    });
  });
});
