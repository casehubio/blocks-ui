export interface InferenceDefaults {
  temperature?: number;
  topP?: number;
  maxTokens?: number;
}

export interface InferenceRange {
  min: number;
  max: number;
  default: number;
}

export interface ProviderInferenceRanges {
  temperature: InferenceRange;
  topP: InferenceRange;
  maxTokens: InferenceRange;
}

export const PROVIDER_DEFAULTS: Record<string, ProviderInferenceRanges> = {
  anthropic: {
    temperature: { min: 0, max: 1, default: 1 },
    topP: { min: 0, max: 1, default: 1 },
    maxTokens: { min: 1, max: 8192, default: 4096 },
  },
  'vertex-ai': {
    temperature: { min: 0, max: 1, default: 1 },
    topP: { min: 0, max: 1, default: 1 },
    maxTokens: { min: 1, max: 8192, default: 4096 },
  },
  openai: {
    temperature: { min: 0, max: 2, default: 1 },
    topP: { min: 0, max: 1, default: 1 },
    maxTokens: { min: 1, max: 16384, default: 4096 },
  },
  google: {
    temperature: { min: 0, max: 2, default: 1 },
    topP: { min: 0, max: 1, default: 1 },
    maxTokens: { min: 1, max: 8192, default: 4096 },
  },
  ollama: {
    temperature: { min: 0, max: 2, default: 0.8 },
    topP: { min: 0, max: 1, default: 0.9 },
    maxTokens: { min: 1, max: 4096, default: 2048 },
  },
};

export const OTHER_PROVIDER_DEFAULTS: ProviderInferenceRanges = {
  temperature: { min: 0, max: 2, default: 1 },
  topP: { min: 0, max: 1, default: 1 },
  maxTokens: { min: 1, max: 4096, default: 4096 },
};

export function getInferenceRanges(
  vendor: string,
  model?: { properties?: Record<string, string>; contextWindow?: number },
): ProviderInferenceRanges {
  const base = PROVIDER_DEFAULTS[vendor.toLowerCase()] ?? OTHER_PROVIDER_DEFAULTS;
  if (!model?.properties) {
    const result = { ...base };
    if (model?.contextWindow) {
      result.maxTokens = { ...result.maxTokens, max: model.contextWindow };
    }
    return result;
  }
  const p = model.properties;
  return {
    temperature: {
      min: p.temperature_min ? Number(p.temperature_min) : base.temperature.min,
      max: p.temperature_max ? Number(p.temperature_max) : base.temperature.max,
      default: p.temperature_default ? Number(p.temperature_default) : base.temperature.default,
    },
    topP: {
      min: p.topP_min ? Number(p.topP_min) : base.topP.min,
      max: p.topP_max ? Number(p.topP_max) : base.topP.max,
      default: p.topP_default ? Number(p.topP_default) : base.topP.default,
    },
    maxTokens: {
      min: p.maxTokens_min ? Number(p.maxTokens_min) : base.maxTokens.min,
      max: p.maxTokens_max ? Number(p.maxTokens_max) : (model.contextWindow ?? base.maxTokens.max),
      default: p.maxTokens_default ? Number(p.maxTokens_default) : base.maxTokens.default,
    },
  };
}

export function parseInferenceFromProperties(properties?: Record<string, string>): InferenceDefaults {
  if (!properties) return {};
  const result: InferenceDefaults = {};
  if (properties.temperature) result.temperature = Number(properties.temperature);
  if (properties.topP) result.topP = Number(properties.topP);
  if (properties.maxTokens) result.maxTokens = Number(properties.maxTokens);
  return result;
}

export function writeInferenceToProperties(
  inference: InferenceDefaults,
  existing?: Record<string, string>,
): Record<string, string> {
  const result = { ...(existing ?? {}) };
  if (inference.temperature !== undefined) result.temperature = String(inference.temperature);
  if (inference.topP !== undefined) result.topP = String(inference.topP);
  if (inference.maxTokens !== undefined) result.maxTokens = String(inference.maxTokens);
  return result;
}
