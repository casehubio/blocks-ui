export interface SSEEvent {
  readonly type: string;
  readonly data: unknown;
  readonly id?: string;
}

type SSEHandler = (event: SSEEvent) => void;

interface PoolEntry {
  source: EventSource;
  handlers: Set<SSEHandler>;
  status: 'connected' | 'reconnecting' | 'disconnected';
  reconnectAttempt: number;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
}

const MAX_BACKOFF_MS = 30_000;
const BACKOFF_BASE_MS = 1_000;

export class SSEManager {
  private readonly _pool = new Map<string, PoolEntry>();
  private readonly _batchQueue = new Map<string, SSEEvent[]>();
  private _rafId: number | null = null;

  subscribe(url: string, handler: SSEHandler): void {
    let entry = this._pool.get(url);
    if (!entry) {
      entry = this._createEntry(url);
      this._pool.set(url, entry);
    }
    entry.handlers.add(handler);
  }

  unsubscribe(url: string, handler: SSEHandler): void {
    const entry = this._pool.get(url);
    if (!entry) return;
    entry.handlers.delete(handler);
    if (entry.handlers.size === 0) {
      this._closeEntry(url, entry);
    }
  }

  status(url: string): 'connected' | 'reconnecting' | 'disconnected' {
    return this._pool.get(url)?.status ?? 'disconnected';
  }

  disconnectAll(): void {
    for (const [url, entry] of this._pool) {
      this._closeEntry(url, entry);
    }
  }

  private _createEntry(url: string): PoolEntry {
    const source = new EventSource(url);
    const entry: PoolEntry = {
      source,
      handlers: new Set(),
      status: 'connected',
      reconnectAttempt: 0,
      reconnectTimer: null,
    };

    source.onmessage = (e: MessageEvent) => {
      entry.reconnectAttempt = 0;
      entry.status = 'connected';
      try {
        const data = JSON.parse(e.data as string) as unknown;
        const event: SSEEvent = e.lastEventId
          ? {
              type: (data as Record<string, unknown>).type as string ?? 'message',
              data,
              id: e.lastEventId,
            }
          : {
              type: (data as Record<string, unknown>).type as string ?? 'message',
              data,
            };
        this._enqueueEvent(url, event);
      } catch {
        // Non-JSON SSE data — skip
      }
    };

    source.onerror = () => {
      entry.status = 'reconnecting';
      source.close();
      this._scheduleReconnect(url, entry);
    };

    return entry;
  }

  private _enqueueEvent(url: string, event: SSEEvent): void {
    let queue = this._batchQueue.get(url);
    if (!queue) {
      queue = [];
      this._batchQueue.set(url, queue);
    }
    queue.push(event);

    if (this._rafId === null) {
      this._rafId = requestAnimationFrame(() => this._flushBatch());
    }
  }

  private _flushBatch(): void {
    this._rafId = null;
    for (const [url, events] of this._batchQueue) {
      const entry = this._pool.get(url);
      if (!entry) continue;
      for (const event of events) {
        for (const handler of entry.handlers) {
          handler(event);
        }
      }
    }
    this._batchQueue.clear();
  }

  private _scheduleReconnect(url: string, entry: PoolEntry): void {
    const delay = Math.min(
      BACKOFF_BASE_MS * Math.pow(2, entry.reconnectAttempt),
      MAX_BACKOFF_MS,
    );
    entry.reconnectAttempt++;
    entry.reconnectTimer = setTimeout(() => {
      if (!this._pool.has(url)) return;
      const newSource = new EventSource(url);
      newSource.onmessage = entry.source.onmessage;
      newSource.onerror = entry.source.onerror;
      entry.source = newSource;
    }, delay);
  }

  private _closeEntry(url: string, entry: PoolEntry): void {
    entry.source.close();
    if (entry.reconnectTimer !== null) clearTimeout(entry.reconnectTimer);
    entry.status = 'disconnected';
    this._pool.delete(url);
  }
}
