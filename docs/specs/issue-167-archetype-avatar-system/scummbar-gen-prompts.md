# Scummbar Collection — Image Generation Prompts

## Workflow (3 phases)

**Phase 1 — Full character reference sprites:** Generate 48 characters as
complete composed portraits. This establishes the visual style and gives us
targets to decompose. 12 prompts × 4 characters each.

**Phase 2 — Part sheets:** Using Phase 1 output as style reference, generate
isolated part category sheets (heads only, hair only, costumes only, etc.)
on transparent backgrounds. These are directly composable.

**Phase 3 — SVG conversion:** Python script reads the part PNGs, extracts
pixel rects, maps colours to `var(--*)` palette, outputs SVG `<symbol>`
elements with canonical IDs.

Start with Phase 1. If quality is right, move to Phase 2.

---

## Style Specification (include with EVERY prompt)

```
PIXEL ART STYLE SPECIFICATION

Create pixel art character portraits in the style of classic LucasArts and
Sierra adventure games — specifically the quality of Thimbleweed Park,
Monkey Island (Special Edition pixel art), and modern indie games like
Celeste and Eastward.

Each character is a HEAD + UPPER TORSO portrait (no legs). Transparent
background.

CANVAS: 80×96 pixels per character. Arrange 4 characters in a 2×2 grid
(160×192 total). Do NOT upscale — output at native pixel resolution.
If you cannot output at exactly this resolution, output at 320×384 (2x)
with each pixel rendered as a 2×2 block.

CRITICAL QUALITY REQUIREMENTS:

SHADING: Every surface has 3+ tones (shadow, base, highlight). Hair has
3-4 shade bands. Skin has blush/shadow. Clothing has fold darkness. NO
flat single-colour fills anywhere.

OUTLINES: 1px tinted outlines (dark brown for skin, dark navy for blue
clothes — NOT pure black). This is "selective outlining."

EYES: 3-5px wide. White sclera, coloured iris, black pupil, white
highlight dot (1px, top-right).

HAIR: Flowing pixel masses with strand separation at edges, highlight
streaks, and volume shading. NOT rectangles.

CLOTHING: Visible collar structure, fold lines as darker pixels, buttons
and details as distinct pixel clusters.

THIS IS NOT: Minecraft blocks. Roblox avatars. Flat coloured rectangles.
Smoothly anti-aliased digital art. 8-bit NES sprites.

THIS IS: 16-bit SNES/GBA quality. Hand-placed pixels. Every pixel matters.
Think Thimbleweed Park character close-ups or Celeste character portraits.
```

---

## Phase 1 Prompts — Full Character Sprites

Each prompt generates 4 characters from classic adventure/pixel art games,
re-imagined in our consistent pixel art style. The game character is the
VISUAL ANCHOR — Gemini knows what these characters look like and should
capture their essence.

### Prompt 1: Sage Family

```
[Include Style Specification above]

Create 4 classic adventure game characters as pixel art portraits (2×2 grid).
Each character should be recognisable as inspired by the named game character
but rendered in a consistent pixel art style. Cool blue palette (#2c3e6b
primary, #4a6fa5 secondary, #e8e4dc accent).

TOP-LEFT — Inspired by SAM from Sam & Max Hit the Road (LucasArts):
The freelance police detective. Tall dog in a grey suit and fedora.
Magnifying glass in hand. Deadpan scrutinising expression.
Render as: human detective with bald sides, round wire glasses, blue
blazer and tie, magnifying glass. The Sam energy = analytical calm.

TOP-RIGHT — Inspired by SALVADOR LIMONES from Grim Fandango (LucasArts):
The revolutionary mentor in the Land of the Dead. Wise, weathered.
Render as: wild white Einstein hair, bushy white beard, tweed jacket
with elbow patches, open book and chalk. The Salvador energy = quiet
profound wisdom.

BOTTOM-LEFT — Inspired by THE VOODOO LADY from Monkey Island (LucasArts):
The mysterious, omnipresent seer. Crystal ball, flowing robes, strange calm.
Render as: long flowing dark hair, pince-nez glasses, dark blue robes
with parchment trim, crystal ball with purple glow, pendant amulet.
The Voodoo Lady energy = otherworldly knowledge.

BOTTOM-RIGHT — Inspired by BOBBIN THREADBARE from Loom (LucasArts):
The quiet weaver who uses musical patterns to manipulate reality.
Render as: short cropped hair with fringe, round wire glasses, blue
blazer, holding unfurled scroll. The Bobbin energy = bridging worlds,
translating the untranslatable.
```

### Prompt 2: Hero Family

```
[Include Style Specification above]

Create 4 classic adventure game characters as pixel art portraits (2×2 grid).
Crimson/red palette (#8b1a1a primary, #c0c0c0 silver secondary,
#ffd700 gold accent).

TOP-LEFT — Inspired by INDIANA JONES from Fate of Atlantis (LucasArts):
The courageous explorer-warrior. Leather jacket, square jaw, determined.
Render as: buzz cut, no facial hair, silver-grey chest armour with gold
emblem, shoulder pauldrons, shield at side. Battle scar on cheek.
The Indy energy = broadest shoulders, most imposing silhouette.

TOP-RIGHT — Inspired by THE HERO from Quest for Glory (Sierra):
The multi-class adventurer. Athletic, disciplined, versatile fighter.
Render as: buzz cut, athletic headband, crimson armour/athletic gear,
medal on chest, taped fists. The Hero energy = lean disciplined focus.

BOTTOM-LEFT — Inspired by ROBERT FOSTER from Beneath a Steel Sky
(Revolution): The reluctant liberator dragged into saving a dystopian city.
Render as: ponytail, heavy stubble, dark crimson suit (leader, not soldier),
aviator glasses, raised torch, broken chain. The Foster energy = fierce
determination against the system.

BOTTOM-RIGHT — Inspired by FROG from Chrono Trigger (Square):
The chivalric knight transformed, duty-bound rescuer.
Render as: buzz cut, rugged stubble, utilitarian crimson armour,
first-aid kit, coiled rope, scar on cheek. The Frog energy = alert,
ready to leap, sweat-drop of effort.
```

### Prompt 3: Magician Family

```
[Include Style Specification above]

Create 4 classic adventure game characters as pixel art portraits (2×2 grid).
Deep purple palette (#2d1b4e primary, #5b3a8c secondary,
#d4a0ff glow accent).

TOP-LEFT — Inspired by SIMON from Simon the Sorcerer (Adventure Soft):
The cynical teen wizard who manipulates magical laws on a whim.
Render as: long flowing dark hair, pointed goatee, deep purple robes
with glowing trim, floating orb in hand, smoke wisps, pendant amulet.
The Simon energy = mysterious arrogance masking real power.

TOP-RIGHT — Inspired by DR. FRED EDISON from Day of the Tentacle
(LucasArts): The brilliant but easily corrupted scientist-engineer.
Render as: buzz cut, light stubble, white lab coat over purple shirt,
goggles pushed up on forehead, wrench in hand, gear mechanism nearby.
The Dr. Fred energy = systematic precision, goggles-on-forehead.

BOTTOM-LEFT — Inspired by BERNARD BERNOULLI from Day of the Tentacle
(LucasArts): The nerdy underdog inventor with accidental genius.
Render as: short pixie cut, no facial hair, purple business jacket,
glowing lightbulb above head (idea-spark), circuit traces on jacket.
The Bernard energy = eyes lit up, eureka moment.

BOTTOM-RIGHT — Inspired by LUCCA from Chrono Trigger (Square):
The engineering genius, empirical and precise.
Render as: balding with grey side patches, pointed goatee, white lab
coat, pince-nez glasses, bubbling flask with green liquid, periodic
table chart. The Lucca energy = peering intently at the experiment.
```

### Prompt 4: Rebel Family

```
[Include Style Specification above]

Create 4 classic adventure game characters as pixel art portraits (2×2 grid).
Black palette (#1a1a1a primary, #333333 secondary, #cc0000 red accent).

TOP-LEFT — Inspired by RAZOR from Maniac Mansion (LucasArts):
The punk rock student who uses intimidation and sharp attitude.
Render as: braids past shoulders, no facial hair, black hoodie,
raised fist, megaphone in other hand, visible neck tattoo.
The Razor energy = mouth open mid-rallying-cry, fierce angular brows.

TOP-RIGHT — Inspired by SETZER from Final Fantasy VI (Square):
The gambling airship owner, cocky and self-assured.
Render as: slicked-back hair, light stubble, black leather jacket with
popped collar, dice tumbling mid-toss, poker chip, ear piercings.
The Setzer energy = cocky smirk, one eyebrow raised, winking.

BOTTOM-LEFT — Inspired by BEN THROTTLE from Full Throttle (LucasArts):
The tough anti-authoritarian biker gang leader. The quintessential maverick.
Render as: tall mohawk (tallest hair of any character), heavy stubble,
black leather jacket with zipper, wrench in hand, motorcycle key dangling,
multiple ear piercings. The Ben energy = defiant chin-up "try me" stance.

BOTTOM-RIGHT — Inspired by MANNY CALAVERA from Grim Fandango (LucasArts):
The travel agent fighting corruption in the Land of the Dead. Reformer.
Render as: undercut (shaved sides, swept top), heavy stubble, black hoodie
with sleeves pushed up, hammer in one hand, torn blueprint in other,
face scar. The Manny energy = constructive fury, tearing down to rebuild.
```

### Prompt 5: Explorer Family

```
[Include Style Specification above]

Create 4 classic adventure game characters as pixel art portraits (2×2 grid).
Earth brown palette (#5a4a35 primary, #6a5a45 secondary,
#c0392b red-scarf accent).

TOP-LEFT — Inspired by GUYBRUSH THREEPWOOD from Monkey Island (LucasArts):
THE adventure game protagonist. Naive but resourceful, windswept, eager.
Render as: windswept blond hair blowing to one side, rugged stubble,
wide-brim explorer hat, brown utility vest with many pockets, goggles
on hat, compass in hand, red bandana. The Guybrush energy = squinting
into the wind, joy despite danger.

TOP-RIGHT — Inspired by ZAK McKRACKEN from Zak McKracken (LucasArts):
The tabloid journalist who stumbles into alien conspiracies. Jack of all trades.
Render as: shoulder-length wavy hair, light stubble, brown explorer jacket
with many pockets and rolled sleeves, Swiss army knife in hand, backpack
strap, scarf at neck. The Zak energy = casual competence, ready for anything.

BOTTOM-LEFT — Inspired by BOSTON LOW from The Dig (LucasArts):
The survival-driven military commander on an uncharted alien world.
Render as: braided hair, rugged stubble, brown utility vest, headband,
aviator glasses, planted flag in one hand, machete at hip.
The Boston Low energy = forward-leaning pioneer, trailblazer.

BOTTOM-RIGHT — Inspired by GEORGE STOBBART from Broken Sword (Revolution):
The American tourist turned reluctant investigator. Seeking truth, persistent.
Render as: ponytail pulled back, clean-shaven, brown explorer jacket
(more thoughtful than rugged), glowing lantern, journal/notebook.
The George energy = introspective searching gaze, walking inward.
```

### Prompt 6: Creator Family

```
[Include Style Specification above]

Create 4 classic adventure game characters as pixel art portraits (2×2 grid).
Bold red palette (#c0392b primary, #e67e22 orange secondary,
#f1c40f yellow accent).

TOP-LEFT — Inspired by GREEN TENTACLE from Maniac Mansion (LucasArts):
The harmless minion who just wants to play rock music. Creative soul.
Render as: messy bun with pencil stuck in it, no facial hair, red
paint-splattered smock, cat-eye glasses, beret on head, paintbrush
in hand, palette with colour dabs. The Green Tentacle energy = colourful
chaos, creative sparkle in the eyes.

TOP-RIGHT — Inspired by STAN from Monkey Island (LucasArts):
The fast-talking used boat/coffin/insurance salesman. Entrepreneurial energy.
Render as: short pixie cut, no facial hair, crisp red business jacket,
thick rectangular glasses, rolled-up blueprint/pitch in hand, laptop nearby.
The Stan energy = idea-spark above head, gesticulating hands, pitch-ready.

BOTTOM-LEFT — Inspired by BOBBIN THREADBARE from Loom (LucasArts):
The weaver of stories, narrative gestures, dramatic expression.
Render as: shoulder-length wavy hair, small goatee, red smock/tunic,
quill pen in hand, open book nearby, scarf at neck.
The Bobbin energy = narrative gesture, dramatic raised brow.

BOTTOM-RIGHT — Inspired by LUCCA from Chrono Trigger (Square):
The visionary engineer gazing beyond the horizon. Sees what others can't.
Render as: wild Einstein-like hair, no facial hair, red business jacket,
thick rectangular glasses, telescope in hand, star chart nearby.
The Lucca energy = eyes looking up and beyond, starry wonder.
```

### Prompt 7: Jester Family

```
[Include Style Specification above]

Create 4 classic adventure game characters as pixel art portraits (2×2 grid).
Orange/purple palette (#e67e22 orange primary, #9b59b6 purple secondary,
#2ecc71 green accent).

TOP-LEFT — Inspired by MAX from Sam & Max Hit the Road (LucasArts):
The chaotic hyperactive lagomorph who lives for comedy and violence.
Render as: wild frizzy red/orange hair exploding outward, jester hat
with bells (orange + purple halves), bright performer outfit with sequin
sparkle pixels, BIG RED NOSE (the instant-read feature), juggling balls.
The Max energy = unhinged squint-joy grin, pure manic energy.

TOP-RIGHT — Inspired by LARRY LAFFER from Leisure Suit Larry (Sierra):
The eternal optimist entertainer in his iconic white leisure suit.
Render as: short cropped hair with fringe, orange performer outfit with
purple accents and sequins, microphone in hand, spotlight glow from above.
The Larry energy = winking showman, stage presence, relentless confidence.

BOTTOM-LEFT — Inspired by LECHUCK from Monkey Island (LucasArts):
The undead pirate captain in his provocateur aspect — subversive, menacing.
Render as: tall mohawk, light stubble, purple hoodie, half-mask covering
lower face, mirror/mask prop in hand, nose ring.
The LeChuck energy = subversive knowing eyes above the mask, menacing smirk.

BOTTOM-RIGHT — Inspired by PURPLE TENTACLE from Day of the Tentacle
(LucasArts): The mutant who tricks his creator. Shapeshifter, unpredictable.
Render as: long flowing hair, no facial hair, orange performer outfit,
cat-eye glasses, playing cards fanned in hand, faded duplicate silhouette
behind them. The Purple Tentacle energy = dazed spiral-eyes, uncanny.
```

### Prompt 8: Lover Family

```
[Include Style Specification above]

Create 4 classic adventure game characters as pixel art portraits (2×2 grid).
Deep rose palette (#8b2252 primary, #c0546a secondary,
#ffd700 gold accent).

TOP-LEFT — Inspired by ELAINE MARLEY from Monkey Island (LucasArts):
Fiercely independent, protective of those she loves. The romantic lead.
Render as: long flowing dark hair (most flowing of any character), flower
crown on head, deep rose flowing garment, rose in hand, poetry book nearby.
The Elaine energy = heart-eyes, dreamiest expression, most hair volume.

TOP-RIGHT — Inspired by SOPHIA HAPGOOD from Indiana Jones FoA (LucasArts):
The psychic medium. Warm, steady, walking alongside.
Render as: shoulder-length wavy hair, deep rose romantic blouse, warm
comfortable styling, gift box in hand, shared scarf.
The Sophia energy = rosy cheeks, warm steady smile, companion presence.

BOTTOM-LEFT — Inspired by LARRY LAFFER from Leisure Suit Larry (Sierra):
The hedonist aspect — sensual, indulgent, pleasure-seeking.
Render as: slicked-back hair, light stubble, deep rose luxurious outfit
with rich textures, wine glass in hand, grapes nearby.
The Larry energy = winking, thin-arched sensual brows, gold chain hint.

BOTTOM-RIGHT — Inspired by GRACE NAKIMURA from Gabriel Knight (Sierra):
The intellectual research partner. Connecting people, knowing smile.
Render as: messy bun, deep rose outfit, approachable styling, ribbon
in hand, address book/contacts. The Grace energy = squint-joy knowing
smile, connecting gesture, matchmaker warmth.
```

### Prompt 9: Caregiver Family

```
[Include Style Specification above]

Create 4 classic adventure game characters as pixel art portraits (2×2 grid).
Forest green palette (#2e5940 primary, #3d7a55 secondary,
#e8e4dc cream accent).

TOP-LEFT — Inspired by ROSELLA from King's Quest IV (Sierra):
The princess who subverts the damsel trope. Angelic, flowing, luminous.
Render as: shoulder-length wavy hair, flower crown, cream/green soft
flowing wrap garment, halo glow above head (cream pixels), dove nearby.
The Rosella energy = rosy cheeks, serene radiance, angelic light behind head.

TOP-RIGHT — Inspired by GLOTTIS from Grim Fandango (LucasArts):
The massive fiercely loyal mechanic and driver. Guardian protector.
Render as: short afro, full round beard, green sturdy vest with red
cross emblem, umbrella in one hand, small shield. Broadest build.
The Glottis energy = furrowed protective brows, solid immovable stance.

BOTTOM-LEFT — Inspired by THE VOODOO LADY healing aspect from Monkey Island:
The mystical healer with herbs and potions. Gentle, caring hands.
Render as: long flowing hair, no facial hair, green soft wrap, herbs
visible, stethoscope around neck, herb bundle in hand.
The Voodoo Lady energy = rosy cheeks, gentle concerned brows, green herbs.

BOTTOM-RIGHT — Inspired by SYBIL PANDEMIK from Sam & Max (Telltale):
The therapist-who-actually-helps. Practical, ready, sleeves rolled.
Render as: short cropped hair with fringe, light stubble, green vest
with cross emblem, headband, bandage roll in hand, toolkit nearby.
The Sybil energy = sweat-drop of effort, soft determined brows.
```

### Prompt 10: Innocent Family

```
[Include Style Specification above]

Create 4 classic adventure game characters as pixel art portraits (2×2 grid).
Cream/white palette (#f0e6d8 primary, #ddd4c4 secondary,
#f4d03f golden accent). Light, airy, hopeful.

TOP-LEFT — Inspired by WILLY BEAMISH from Adventures of Willy Beamish (Sierra):
The creative mischievous kid outsmarting adult authority.
Render as: short cropped hair with fringe, simple light cream outfit,
butterfly near hand, dandelion in other, freckles across cheeks.
The Willy energy = wide wonder-struck eyes, rosy cheeks, youngest-looking.

TOP-RIGHT — Inspired by SHAY from Broken Age (Double Fine):
The sheltered boy dreaming of true purpose beyond his safe spaceship.
Render as: long flowing golden hair, simple cream dress, floating quality,
cloud and stars nearby (dream elements).
The Shay energy = starry golden sparkle in pupils, upward dreaming gaze.

BOTTOM-LEFT — Inspired by ALEXANDER from King's Quest VI (Sierra):
The refined idealist prince with a pure heart navigating mystical islands.
Render as: shoulder-length wavy hair, simple cream outfit, clean hopeful
styling, candle with steady flame in hand, small banner.
The Alexander energy = sparkle-eyes, hopeful steady expression.

BOTTOM-RIGHT — Inspired by LAVERNE from Day of the Tentacle (LucasArts):
The eccentric wild medical student. Ethereal, luminous, strange charm.
Render as: messy bun, flower crown, simple cream dress with ethereal
quality, musical spark/notes floating from hand.
The Laverne energy = sparkle-eyes, luminous aura, thin arched brows.
```

### Prompt 11: Everyman Family

```
[Include Style Specification above]

Create 4 classic adventure game characters as pixel art portraits (2×2 grid).
Neutral grey palette (#5a5a5a primary, #7a7a7a secondary,
#d4c4a8 khaki accent). Deliberately unremarkable — the ordinary people.

TOP-LEFT — Inspired by JOEY from Beneath a Steel Sky (Revolution):
The robot companion who advocates for justice. Speaking up for others.
Render as: short cropped hair with fringe, no facial hair, grey polo
shirt, half-rim glasses, small megaphone in hand, leaflet in other.
The Joey energy = raised brow, leaning forward, passionate speaker.

TOP-RIGHT — Inspired by WALLY B. FEED from Monkey Island 2 (LucasArts):
The cartographer who knows everyone. Connected, warm, approachable.
Render as: slicked-back hair, no facial hair, grey polo shirt, warm
styling, phone in hand, business cards.
The Wally energy = squint-joy smile, soft friendly brows.

BOTTOM-LEFT — Inspired by ROGER WILCO from Space Quest (Sierra):
The low-ranking space janitor. Humble, unassuming, dutiful.
Render as: buzz cut, no facial hair, plain grey shirt with rolled
sleeves, broom in hand, cleaning cloth.
The Roger energy = flat humble brows, dutiful, most unremarkable.

BOTTOM-RIGHT — Inspired by ZAK McKRACKEN's everyday aspect (LucasArts):
The ordinary journalist before the alien conspiracy hits. Generic citizen.
Render as: short afro, light stubble, plain grey shirt, baseball cap,
clipboard in hand, pen, freckles.
The Zak energy = neutral soft brows — deliberately THE most average person.
```

### Prompt 12: Sovereign Family

```
[Include Style Specification above]

Create 4 classic adventure game characters as pixel art portraits (2×2 grid).
Navy/gold palette (#1a2744 navy primary, #c9a227 gold secondary,
#8b0000 sash-red accent). Regal, commanding, most decorated characters.

TOP-LEFT — Inspired by KING GRAHAM from King's Quest (Sierra):
THE adventure game king. Crown, sceptre, full regal authority.
Render as: slicked-back dark hair, handlebar moustache, navy formal
jacket with gold diagonal sash, gold epaulettes, jewelled crown on head,
orb of state in hand, monocle with chain on right eye.
The Graham energy = most gold/decorated character in the entire set.

TOP-RIGHT — Inspired by DON COPAL from Grim Fandango (LucasArts):
The corrupt corporate department head. Stern, judging, weighing evidence.
Render as: slicked-back hair, clean-shaven, navy diplomatic suit, thick
rectangular glasses, gavel in hand, balanced scales nearby.
The Don Copal energy = furrowed stern brows, measuring, impartial weight.

BOTTOM-LEFT — Inspired by LECHUCK as PIRATE KING from Monkey Island
(LucasArts): The undead captain commanding legions. Patriarch, imposing.
Render as: slicked-back hair, handlebar moustache (larger than Ruler's),
navy formal jacket with gold sash, gold epaulettes, scepter in hand,
family crest emblem. The LeChuck energy = most imposing shoulders, legacy.

BOTTOM-RIGHT — Inspired by ALEXANDER's diplomatic side from KQ VI (Sierra):
The prince navigating royal courts. Bridge-builder, approachable authority.
Render as: slicked-back hair, clean-shaven, navy diplomatic suit, pocket
square (red accent), olive branch in hand, treaty document.
The Alexander energy = open diplomatic smile, soft rounded brows.
```

---

## Phase 2 — Composable Part Sheets

After Phase 1 establishes the visual style, generate these part sheets.
Each sheet is ONE CATEGORY on transparent background.

### Part Sheet Prompts

Use the same Style Specification, plus:

```
COMPOSABLE PARTS — IMPORTANT:
These are INDIVIDUAL PARTS, not complete characters. Each part must work
as an overlay on a transparent background, designed to be layered on top
of other parts to build a full character.

Render each part CENTERED in its own 80×96 pixel cell. Parts must NOT
include elements from other categories (e.g., a hair part must not
include a head or face — just the hair).
```

**Sheet 1 — Heads (12 cells, 4×3 grid = 320×288):**
12 head shapes (round, standard, soft-oval, oval, square-jaw, diamond,
heart, angular, strong-sym, weathered, round-wide, fallback). Each is
a face with eyes/nose/mouth but NO hair, NO costume — just the head
on transparent background. Skin-coloured with shading.

**Sheet 2 — Hair (16 cells, 4×4 grid = 320×384):**
16 hairstyles designed to overlay on the heads. Positioned so they sit
on top of/around a head. Hair colour with shading. No face visible.
(bald-sides, buzz, afro-short, long-flowing, messy-bun, mohawk,
wild-einstein, slicked, braids, shoulder-wavy, cropped-fringe,
undercut, windswept, pixie, ponytail, headwrap)

**Sheet 3 — Costumes (20 cells, 5×4 grid = 400×384):**
20 costume torsos. Positioned to sit below a head. Include collar/neckline
at top, extend to bottom of frame. No head or face.

**Sheet 4 — Props (24 cells, 6×4 grid = 480×384):**
24 most distinctive props. Small items positioned to the right side of
the frame (hand-held). On transparent background.

**Sheet 5 — Beards, Glasses, Brows, Hats (32 cells, 8×4 grid = 640×384):**
8 beards + 8 glasses + 8 brows + 8 hats. Each positioned to overlay on
a head at the correct location.

---

## Colour-to-Variable Mapping

The conversion script maps generated pixel colours to CSS variables:

| Colour range | Maps to |
|---|---|
| Skin tones (warm browns/peach) | `var(--skin)` + shade variants |
| Dominant costume colour | `var(--primary)` + shade variants |
| Secondary costume colour | `var(--secondary)` |
| Small accent details | `var(--accent)` |
| Hair colours | `var(--hair-color)` + shade variants |
| Near-black outlines | `#111` (kept as-is) |
| Pure white (eye highlights) | `#fff` (kept as-is) |

The script clusters similar colours and maps each cluster to the nearest
CSS variable. Shade variants are stored as opacity modifiers:
`var(--skin)` at `opacity="0.7"` for shadows, full opacity for base.
