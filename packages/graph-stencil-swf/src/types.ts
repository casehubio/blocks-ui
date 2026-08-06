import type { GraphModel } from '@casehubio/graph-core';

export interface AdapterResult {
  readonly model: GraphModel;
  readonly yamlPaths: ReadonlyMap<string, readonly (string | number)[]>;
  readonly degraded?: { readonly reason: string };
}

export const SWF_KNOWN_TYPES = new Set([
  'call', 'set', 'switch', 'raise', 'try', 'try-catch', 'catch',
  'start', 'end', 'entry', 'exit',
] as const);

export const SYNTHETIC_TYPES = new Set(['start', 'end', 'entry', 'exit', 'root', 'try', 'catch']);

export const SWF_TYPE_PREFIX = 'swf-';
