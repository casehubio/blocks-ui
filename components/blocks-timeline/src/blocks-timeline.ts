import { customElement } from 'lit/decorators.js';
import { PagesEventTimeline } from '@casehubio/pages-viz';
import type { WorkIdentity } from '@casehubio/blocks-ui-core';

@customElement('blocks-timeline')
export class BlocksTimeline extends PagesEventTimeline {
  override configure(props: Record<string, unknown>): void {
    if (props.identity !== undefined) {
      const id = props.identity as WorkIdentity;
      this.headers = id?.tenancyId ? { 'X-Tenancy-ID': id.tenancyId } : undefined;
    }
    super.configure(props);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'blocks-timeline': BlocksTimeline;
  }
}
