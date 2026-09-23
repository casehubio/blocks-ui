import type { PartAssignment } from './types.js';

function pa(
  head: string, hair: string, facialHair: string, costume: string,
  eyebrows: string, glasses: string | null, hat: string | null,
  expression: string | null, props: readonly string[], accessories: readonly string[],
): PartAssignment {
  return { head, hair, facialHair, costume, eyebrows, glasses, hat, expression, props, accessories };
}

export const ARCHETYPE_CONFIGS: Record<string, PartAssignment> = {
  // --- Caregiver (head: round) ---
  'Caregiver/Angel':     pa('round', 'shoulder-wavy', 'none', 'soft-wrap', 'soft-rounded', null, 'flower-crown', 'rosy-cheeks', ['halo', 'dove'], []),
  'Caregiver/Guardian':  pa('round', 'afro-short', 'full-round', 'vest-cross', 'thick-straight', null, null, 'furrowed-brows', ['umbrella', 'shield-small'], []),
  'Caregiver/Healer':    pa('round', 'long-flowing', 'none', 'soft-wrap', 'concerned', null, null, 'rosy-cheeks', ['stethoscope', 'herb-bundle'], []),
  'Caregiver/Samaritan': pa('round', 'cropped-fringe', 'stubble', 'vest-cross', 'soft-rounded', null, null, 'sweat-drop', ['bandage', 'toolkit'], ['headband']),

  // --- Creator (head: soft-oval) ---
  'Creator/Artist':       pa('soft-oval', 'messy-bun', 'none', 'smock', 'raised', 'cat-eye', 'beret', 'sparkle-eyes', ['paintbrush', 'palette'], ['paint-splatters']),
  'Creator/Entrepreneur': pa('soft-oval', 'pixie', 'none', 'business', 'thick-straight', 'thick-rect', null, 'idea-spark', ['blueprint', 'laptop'], []),
  'Creator/Storyteller':  pa('soft-oval', 'shoulder-wavy', 'goatee', 'smock', 'raised', null, null, 'raised-brow', ['quill', 'open-book'], ['scarf-bandana']),
  'Creator/Visionary':    pa('soft-oval', 'wild-einstein', 'none', 'business', 'raised', 'thick-rect', null, 'starry-eyes', ['telescope', 'star-chart'], []),

  // --- Everyman (head: standard) ---
  'Everyman/Advocate':  pa('standard', 'cropped-fringe', 'none', 'polo', 'raised', 'half-rim', null, 'raised-brow', ['megaphone-small', 'leaflet'], []),
  'Everyman/Citizen':   pa('standard', 'afro-short', 'stubble', 'plain-shirt', 'soft-rounded', null, 'baseball-cap', null, ['clipboard', 'pen'], ['freckles']),
  'Everyman/Networker': pa('standard', 'slicked', 'none', 'polo', 'soft-rounded', null, null, 'squint-joy', ['phone', 'business-cards'], []),
  'Everyman/Servant':   pa('standard', 'buzz', 'none', 'plain-shirt', 'concerned', null, null, 'flat-brows', ['broom', 'cloth'], []),

  // --- Explorer (head: weathered) ---
  'Explorer/Adventurer':  pa('weathered', 'windswept', 'rugged', 'utility-vest', 'thick-straight', 'goggles', 'explorer', 'squint-joy', ['compass', 'rope'], []),
  'Explorer/Generalist':  pa('weathered', 'shoulder-wavy', 'stubble', 'explorer-jacket', 'soft-rounded', null, null, null, ['swiss-army', 'backpack'], ['scarf-bandana']),
  'Explorer/Pioneer':     pa('weathered', 'braids', 'rugged', 'utility-vest', 'thick-straight', 'aviator', null, 'furrowed-brows', ['flag', 'machete'], ['headband']),
  'Explorer/Seeker':      pa('weathered', 'ponytail', 'none', 'explorer-jacket', 'concerned', null, null, null, ['lantern', 'journal'], []),

  // --- Hero (head: square-jaw) ---
  'Hero/Athlete':   pa('square-jaw', 'buzz', 'none', 'armour', 'thick-straight', null, null, 'furrowed-brows', ['medal', 'wristbands'], ['headband']),
  'Hero/Liberator': pa('square-jaw', 'ponytail', 'heavy', 'business', 'angular', 'aviator', null, 'angry-vein', ['torch', 'broken-chain'], []),
  'Hero/Rescuer':   pa('square-jaw', 'buzz', 'rugged', 'armour', 'angular', null, null, 'sweat-drop', ['first-aid', 'rope'], ['scar']),
  'Hero/Warrior':   pa('square-jaw', 'buzz', 'none', 'armour', 'angular', null, null, 'furrowed-brows', ['shield', 'sword-hilt'], ['scar']),

  // --- Innocent (head: round) ---
  'Innocent/Child':   pa('round', 'cropped-fringe', 'none', 'simple-dress', 'raised', null, null, 'rosy-cheeks', ['butterfly', 'dandelion'], ['freckles']),
  'Innocent/Dreamer': pa('round', 'long-flowing', 'none', 'simple-dress', 'soft-rounded', null, null, 'starry-eyes', ['cloud', 'stars'], []),
  'Innocent/Idealist':pa('round', 'shoulder-wavy', 'none', 'simple-dress', 'raised', null, null, 'sparkle-eyes', ['candle', 'banner'], []),
  'Innocent/Muse':    pa('round', 'messy-bun', 'none', 'simple-dress', 'thin-arched', null, 'flower-crown', 'sparkle-eyes', ['spark', 'music-notes'], []),

  // --- Jester (head: round-wide) ---
  'Jester/Clown':       pa('round-wide', 'wild-einstein', 'none', 'performer', 'raised', null, 'jester', 'squint-joy', ['juggling-balls', 'red-nose'], []),
  'Jester/Entertainer': pa('round-wide', 'cropped-fringe', 'none', 'performer', 'raised', null, null, 'wink', ['microphone', 'spotlight'], []),
  'Jester/Provocateur': pa('round-wide', 'mohawk', 'stubble', 'hoodie', 'asymmetric', null, null, 'raised-brow', ['mirror-mask', 'speech-bubble'], ['nose-ring']),
  'Jester/Shapeshifter':pa('round-wide', 'long-flowing', 'none', 'performer', 'thin-arched', 'cat-eye', null, 'dazed-spirals', ['playing-cards', 'shadow-self'], []),

  // --- Lover (head: heart) ---
  'Lover/Companion':  pa('heart', 'shoulder-wavy', 'none', 'romantic', 'soft-rounded', null, null, 'rosy-cheeks', ['gift-box', 'scarf-shared'], []),
  'Lover/Hedonist':   pa('heart', 'slicked', 'stubble', 'romantic', 'thin-arched', null, null, 'wink', ['wine-glass', 'grapes'], []),
  'Lover/Matchmaker': pa('heart', 'messy-bun', 'none', 'romantic', 'raised', null, null, 'squint-joy', ['ribbon', 'address-book'], []),
  'Lover/Romantic':   pa('heart', 'long-flowing', 'none', 'romantic', 'soft-rounded', null, 'flower-crown', 'heart-eyes', ['rose', 'poetry-book'], []),

  // --- Magician (head: diamond) ---
  'Magician/Alchemist':  pa('diamond', 'long-flowing', 'goatee', 'robes', 'thin-arched', null, null, 'sparkle-eyes', ['glowing-orb', 'smoke-wisps'], ['pendant-amulet']),
  'Magician/Engineer':   pa('diamond', 'buzz', 'stubble', 'lab-coat', 'thick-straight', 'goggles', null, null, ['wrench-gear', 'schematic'], []),
  'Magician/Innovator':  pa('diamond', 'pixie', 'none', 'business', 'raised', null, null, 'idea-spark', ['lightbulb', 'circuit-traces'], []),
  'Magician/Scientist':  pa('diamond', 'bald-sides', 'goatee', 'lab-coat', 'thick-straight', 'pince-nez', null, 'raised-brow', ['flask', 'periodic-table'], []),

  // --- Rebel (head: angular) ---
  'Rebel/Activist':  pa('angular', 'braids', 'none', 'hoodie', 'angular', null, null, 'angry-vein', ['megaphone', 'raised-fist'], ['tattoo']),
  'Rebel/Gambler':   pa('angular', 'slicked', 'stubble', 'leather-jacket', 'asymmetric', null, null, 'wink', ['dice', 'poker-chip'], ['ear-piercings']),
  'Rebel/Maverick':  pa('angular', 'mohawk', 'heavy', 'leather-jacket', 'asymmetric', null, null, 'raised-brow', ['wrench', 'motorcycle-key'], ['ear-piercings']),
  'Rebel/Reformer':  pa('angular', 'undercut', 'heavy', 'hoodie', 'angular', null, null, 'furrowed-brows', ['hammer', 'blueprint-torn'], ['scar']),

  // --- Sage (head: oval) ---
  'Sage/Detective':   pa('oval', 'bald-sides', 'none', 'blazer-tie', 'thin-arched', 'round-wire', null, 'squint-joy', ['magnifying-glass', 'notebook'], []),
  'Sage/Mentor':      pa('oval', 'wild-einstein', 'bushy-white', 'tweed-patches', 'bushy-wild', 'half-rim', null, null, ['book-open', 'chalk'], []),
  'Sage/Shaman':      pa('oval', 'long-flowing', 'none', 'robes', 'thin-arched', 'pince-nez', null, 'dazed-spirals', ['crystal-ball', 'feathers'], ['pendant-amulet']),
  'Sage/Translator':  pa('oval', 'cropped-fringe', 'none', 'blazer-tie', 'soft-rounded', 'round-wire', null, null, ['scroll', 'rosetta-stone'], []),

  // --- Sovereign (head: strong-sym) ---
  'Sovereign/Ambassador': pa('strong-sym', 'slicked', 'none', 'diplomatic', 'soft-rounded', null, null, null, ['olive-branch', 'treaty'], []),
  'Sovereign/Judge':      pa('strong-sym', 'slicked', 'none', 'diplomatic', 'thick-straight', 'thick-rect', null, 'furrowed-brows', ['gavel', 'scales'], []),
  'Sovereign/Patriarch':  pa('strong-sym', 'slicked', 'handlebar', 'formal-sash', 'thick-straight', null, null, 'furrowed-brows', ['scepter', 'family-crest'], ['epaulettes']),
  'Sovereign/Ruler':      pa('strong-sym', 'slicked', 'handlebar', 'formal-sash', 'angular', 'monocle', 'crown', null, ['crown', 'orb-of-state'], ['epaulettes']),
};

export const ARCHETYPE_INDEX: readonly string[] = Object.keys(ARCHETYPE_CONFIGS).sort();
