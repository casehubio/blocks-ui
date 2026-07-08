import { type LitElement, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { WorkIdentity } from '../types/identity.js';
import type { SSEManager, SSEEvent } from '@casehubio/pages-data/sse/sse-manager.js';
import { SSEManager as SSEManagerImpl } from '@casehubio/pages-data/sse/sse-manager.js';

type Constructor<T = {}> = new (...args: any[]) => T;

export function DataEndpointMixin<T extends Constructor<LitElement>>(Base: T) {
  abstract class DataEndpointHost extends Base {
    @property({ type: String }) endpoint?: string;
    @property({ type: Object }) identity?: WorkIdentity;
    @state() loading = false;
    @state() error: string | null = null;

    fetchFn: typeof fetch = fetch;
    sseManager: SSEManager = new SSEManagerImpl();

    private _abortController: AbortController | null = null;
    private _configurePending = false;
    private _sseUrl: string | null = null;
    private _sseHandler: ((event: SSEEvent) => void) | null = null;

    abstract fetchData(): Promise<void>;
    sseUrl?(): string;
    handleSSEEvent?(event: SSEEvent): void;

    get abortSignal(): AbortSignal | undefined {
      return this._abortController?.signal;
    }

    configure(props: Record<string, unknown>): void {
      if (props.endpoint !== undefined) this.endpoint = props.endpoint as string;
      if (props.identity !== undefined) this.identity = props.identity as WorkIdentity;
      this._configurePending = true;
      queueMicrotask(() => {
        this._configurePending = false;
        this._doFetch();
        this._resubscribeSSE();
      });
    }

    override willUpdate(changed: PropertyValues): void {
      super.willUpdate(changed);
      if (!this._configurePending && changed.has('endpoint') && this.endpoint != null) {
        this._doFetch();
        this._resubscribeSSE();
      }
    }

    override disconnectedCallback(): void {
      super.disconnectedCallback();
      this._abortController?.abort();
      this._abortController = null;
      this._unsubscribeSSE();
    }

    private async _doFetch(): Promise<void> {
      if (this.endpoint == null) return;
      this._abortController?.abort();
      this._abortController = new AbortController();
      this.loading = true;
      this.error = null;
      try {
        await this.fetchData();
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        this.error = e instanceof Error ? e.message : String(e);
      } finally {
        this.loading = false;
      }
    }

    private _resubscribeSSE(): void {
      this._unsubscribeSSE();
      const url = this.sseUrl?.();
      if (!url || !this.handleSSEEvent) return;
      this._sseUrl = url;
      this._sseHandler = (event: SSEEvent) => this.handleSSEEvent!(event);
      this.sseManager.subscribe(url, this._sseHandler);
    }

    private _unsubscribeSSE(): void {
      if (this._sseUrl && this._sseHandler) {
        this.sseManager.unsubscribe(this._sseUrl, this._sseHandler);
        this._sseUrl = null;
        this._sseHandler = null;
      }
    }
  }

  return DataEndpointHost as unknown as Constructor<{
    endpoint?: string;
    identity?: WorkIdentity;
    loading: boolean;
    error: string | null;
    fetchFn: typeof fetch;
    sseManager: SSEManager;
    abortSignal: AbortSignal | undefined;
    fetchData(): Promise<void>;
    configure(props: Record<string, unknown>): void;
    sseUrl?(): string;
    handleSSEEvent?(event: SSEEvent): void;
  }> & T;
}
