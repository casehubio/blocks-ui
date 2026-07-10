import type { LitElement, PropertyValues } from "lit";
import { property } from "lit/decorators.js";
import { DataSourceAdapter } from "./data-source-adapter.js";
import { fetchSource } from "./fetch-source.js";
import type { SourceFactory } from "@casehubio/pages-component";

type Constructor<T = {}> = new (...args: any[]) => T;

export function DataSourceMixin<T extends Constructor<LitElement>>(Base: T) {
  class DataSourceHost extends Base {
    createSourceFactory(): SourceFactory {
      return (url, _id) => fetchSource(url);
    }

    readonly dataSource: DataSourceAdapter = new DataSourceAdapter(this, {
      sourceFactory: this.createSourceFactory(),
    });

    @property({ type: String }) endpoint?: string;

    get loading(): boolean { return this.dataSource.loading; }
    set loading(v: boolean) { this.dataSource.loading = v; }
    get error(): string { return this.dataSource.error; }
    set error(v: string) { this.dataSource.error = v; }
    get dataSet(): unknown { return this.dataSource.dataSet; }
    set dataSet(v: unknown) { this.dataSource.dataSet = v; }

    resolveEndpoint(): string | undefined {
      return this.endpoint;
    }

    private _configuring = false;

    syncEndpoint(): void {
      if (this._configuring) return;
      this.dataSource.endpoint = this.resolveEndpoint();
    }

    override willUpdate(changed: PropertyValues): void {
      super.willUpdate(changed);
      if (changed.has("endpoint")) {
        this.syncEndpoint();
      }
    }

    configure(props: Record<string, unknown>): void {
      this._configuring = true;
      if (props.endpoint !== undefined) this.endpoint = props.endpoint as string;
      queueMicrotask(() => {
        this._configuring = false;
        this.syncEndpoint();
        this.dataSource.refresh();
      });
    }
  }

  return DataSourceHost as unknown as Constructor<{
    endpoint?: string;
    loading: boolean;
    error: string;
    dataSet: unknown;
    dataSource: DataSourceAdapter;
    createSourceFactory(): SourceFactory;
    resolveEndpoint(): string | undefined;
    syncEndpoint(): void;
    configure(props: Record<string, unknown>): void;
  }> & T;
}
