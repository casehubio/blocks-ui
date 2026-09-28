# Donut Creek Full Cast Expansion — Design Spec

**Issue:** casehubio/blocks-ui#167
**Date:** 2026-09-27
**Scope:** Expand 12 hand-drawn family leads to 48 unique Simpsons characters (4 per family)

## Overview

The Donut Creek Full Cast collection uses hand-drawn SVG characters, each referencing a specific Simpsons character. 12 family leads are drawn (plus Barney). This spec covers drawing the remaining 35 characters to complete all 48 sub-archetypes.

## Character Mapping

See D17 in decisions.md for the complete 48-character table.

### Already drawn (13 characters)

| Character | Family | Sub | File |
|-----------|--------|-----|------|
| Homer | Everyman | Citizen | donutcreek-barney-trial.html |
| Barney | Everyman | Servant | donutcreek-barney-trial.html |
| Frink | Creator | Visionary | donutcreek-barney-trial.html |
| McBain | Hero | Warrior | donutcreek-barney-trial.html |
| Snake | Rebel | Maverick | donutcreek-barney-trial.html |
| Quimby | Sovereign | Ruler | donutcreek-barney-trial.html |
| Skinner | Sage | Mentor | donutcreek-barney-trial.html |
| Hibbert | Caregiver | Healer | donutcreek-barney-trial.html |
| Marge | Lover | Romantic | donutcreek-cast-trial.html |
| Burns | Magician | Alchemist | donutcreek-cast-trial.html |
| Willie | Explorer | Adventurer | donutcreek-cast-trial.html |
| Ralph | Innocent | Child | donutcreek-cast-trial.html |
| Krusty | Jester | Clown | donutcreek-gallery.html (original set) |

### Remaining (35 characters)

Grouped by family for batch execution. Each batch draws 3 new characters alongside the existing lead for visual comparison.

**Batch 1 — Caregiver:** Maude Flanders, Ned Flanders, Lunchlady Doris
**Batch 2 — Creator:** Otto Mann, Lindsey Naegle, Troy McClure
**Batch 3 — Everyman:** Lenny Leonard, Carl Carlson (already have Homer + Barney)
**Batch 4 — Explorer:** Apu, Sea Captain, Milhouse
**Batch 5 — Hero:** Drederick Tatum, Nelson Muntz, Chief Wiggum
**Batch 6 — Innocent:** Todd Flanders, Martin Prince, Maggie Simpson
**Batch 7 — Jester:** Duffman, Bart Simpson, Sideshow Bob
**Batch 8 — Lover:** Smithers, Disco Stu, Selma Bouvier
**Batch 9 — Magician:** Artie Ziff, Hank Scorpio, Comic Book Guy
**Batch 10 — Rebel:** Jimbo Jones, Moe Szyslak, Hans Moleman
**Batch 11 — Sage:** Lisa Simpson, Grandpa Simpson, Kent Brockman
**Batch 12 — Sovereign:** Rev. Lovejoy, Blue-Haired Lawyer, Fat Tony

## Execution Process (per character)

1. Find a reference image (Wikisimpsons PNG or similar)
2. Show reference alongside drawing in the HTML file
3. Start from the closest existing character's SVG (per HANDOFF rules)
4. Draw the SVG — head shape, eyes, hair, mouth, body, clothing, props
5. For non-yellow characters: sample exact skin hex from reference via canvas getImageData
6. Screenshot via Playwright and visually compare to reference
7. Iterate until recognizable

## Output File

`donutcreek-fullcast-gallery.html` — new file containing all 48 characters organized by family, with the same card grid layout as the existing gallery.

## Drawing Rules

All rules from HANDOFF.md "Character Drawing Rules" section apply. Key reminders:
- Start from closest existing character, make small changes
- Beards: angular/tapered, not round blobs
- Hair: leaf shapes, not domes/caps
- Eyes: check reference — not always round
- Mouth: each character has unique structure, don't default to Homer's muzzle
- Sample skin colour from reference for non-yellow characters

## Constraints

- Each SVG uses viewBox="0 0 200 240" (half-body framing)
- Consistent line weight: stroke-width="3" for outlines, "2"/"2.5" for details
- All characters must be recognizable at 200×240px card size

## References

- decisions.md D17 — character mapping table
- HANDOFF.md — character drawing rules (learned through iteration)
- config-table.ts — 48 sub-archetype definitions
- donutcreek-barney-trial.html — 8 lead character SVGs (reference quality)
- donutcreek-cast-trial.html — 4 earlier lead character SVGs
- feedback-beards.md — beard shape guidance
- feedback-character-similarity.md — start from closest character
