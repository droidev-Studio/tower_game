# Design Prompt — Tower Building

## Theme

A cute, vertical "build the tower to the sky" timing game. Warm block art on a sky that drifts from bright day to deep night as the tower climbs, with clouds, rocks, and the occasional bird/plane passing by. Mood: cheerful, satisfying, slightly tense at high floors.

## Visual Style

- Bright, saturated key art; soft rounded blocks; thick white text outline with a gold gradient fill (`HUD.GRADIENT_TOP/BOTTOM`).
- Background is a vertical day→night gradient (7 color stops in `spec/game.json`) overlaid with a scrolling backdrop image.
- Perfect drops use a distinct "block-perfect" art to reward precision.

## Feel

- One-tap, instantly readable. The swing telegraphs timing; the drop is committal.
- Juice: rotate SFX on overhang, drop/perfect SFX, lightning flash and screen day-shift at milestone floors.
- Difficulty ramps smoothly via tiered curves rather than hard walls.

## Asset Prompts (if regenerating)

- `block` / `block-perfect`: a single stackable building block, transparent PNG, top-lit, ~ square with 0.71 height ratio.
- `hook` + `rope`: a crane hook with a thin rope, transparent PNG.
- `c1–c3` clouds, `c4–c8` rocks/stones; `f1–f7` small flying silhouettes (birds/planes).
- `background`: tall vertical skyline/backdrop that tiles vertically.
- UI: title, start button, loading, game-over modal, heart, score badge.

All generated art must be transparent PNG with clean edge alpha and registered in `assets/manifest.json` under the four-domain structure.
