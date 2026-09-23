export {
  ARCHETYPE_FAMILIES,
  AVATAR_SIZES,
  DETAIL_TIERS,
  DetailLevel,
} from './types.js';

export type {
  ArchetypeFamily,
  AvatarCollection,
  AvatarModifiers,
  AvatarPayload,
  AvatarSize,
  AxisExpression,
  FamilyPalette,
  PartAssignment,
  PartModifiers,
} from './types.js';

export { FAMILY_PALETTES } from './palettes.js';
export { ARCHETYPE_CONFIGS, ARCHETYPE_INDEX } from './config-table.js';
export { encodePreset, encodeCustom, decodeCode } from './code.js';
export type { DecodedAvatar } from './code.js';
export { buildAvatar } from './builder.js';
export { registerCollection, getCollection } from './collections/registry.js';
export { resolveModifiers } from './modifiers.js';
export type { ModifierInput } from './modifiers.js';
