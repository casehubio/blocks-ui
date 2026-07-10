import type { ReactiveController, ReactiveControllerHost } from "lit";
import {
  DataSourceController,
  type DataSourceControllerOptions,
} from "@casehubio/pages-component";

export class DataSourceAdapter implements ReactiveController {
  readonly controller: DataSourceController;

  constructor(
    private readonly host: ReactiveControllerHost,
    options?: DataSourceControllerOptions,
  ) {
    this.controller = new DataSourceController({
      ...options,
      onChange: () => {
        options?.onChange?.();
        host.requestUpdate();
      },
    });
    host.addController(this);
  }

  get endpoint(): string | undefined { return this.controller.endpoint; }
  set endpoint(v: string | undefined) { this.controller.endpoint = v; }

  get loading(): boolean { return this.controller.loading; }
  set loading(v: boolean) { this.controller.loading = v; }
  get error(): string { return this.controller.error; }
  set error(v: string) { this.controller.error = v; }
  get dataSet(): unknown { return this.controller.dataSet; }
  set dataSet(v: unknown) { this.controller.dataSet = v; }

  get source() { return this.controller.source; }
  set source(s) { this.controller.source = s; }

  hostConnected(): void { this.controller.connect(); }
  hostDisconnected(): void { this.controller.disconnect(); }

  refresh(): void { this.controller.refresh(); }
  dispose(): void { this.controller.dispose(); }
}
