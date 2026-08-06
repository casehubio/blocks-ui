import type { StencilGrammar } from '@casehubio/graph-core';

export const callGrammar: StencilGrammar = {
  type: 'swf-call',
  connections: {
    inbound: { min: 0, max: Infinity, allowedFrom: ['swf-call', 'swf-switch', 'swf-entry'] },
    outbound: { min: 0, max: 1, allowedTo: ['swf-call', 'swf-switch', 'swf-raise', 'swf-exit'] },
  },
};

export const switchGrammar: StencilGrammar = {
  type: 'swf-switch',
  connections: {
    inbound: { min: 0, max: Infinity, allowedFrom: ['swf-call', 'swf-switch', 'swf-entry'] },
    outbound: { min: 1, max: Infinity, allowedTo: ['swf-call', 'swf-switch', 'swf-raise', 'swf-exit'] },
  },
};

export const swfGrammars: StencilGrammar[] = [callGrammar, switchGrammar];
