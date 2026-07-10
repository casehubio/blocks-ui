import type { DataSource, DataSink } from "@casehubio/pages-data";

export interface FetchSourceOptions {
  readonly method?: string;
  readonly headers?: Record<string, string> | (() => Record<string, string>);
  readonly body?: string;
  readonly fetchFn?: typeof globalThis.fetch;
}

export function fetchSource(url: string, options?: FetchSourceOptions): DataSource {
  let abort: AbortController | undefined;
  return {
    connect(sink: DataSink) {
      abort = new AbortController();
      const signal = abort.signal;
      const doFetch = options?.fetchFn ?? globalThis.fetch.bind(globalThis);
      const headers = typeof options?.headers === "function"
        ? options.headers()
        : options?.headers;
      const init: RequestInit = { signal };
      if (options?.method) init.method = options.method;
      if (headers) init.headers = headers;
      if (options?.body) init.body = options.body;
      doFetch(url, init)
        .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
        .then(data => {
          if (!signal.aborted) sink.apply({ type: "snapshot", dataset: data as never });
        })
        .catch(err => {
          if (!signal.aborted && err.name !== "AbortError") {
            sink.error({ message: err.message, permanent: true });
          }
        });
    },
    disconnect() {
      abort?.abort();
      abort = undefined;
    },
  };
}
