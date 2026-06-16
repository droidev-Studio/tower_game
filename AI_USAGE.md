# AI Usage — Tower Building

## What AI may patch (P0, safe)

- `GameSettings.js` — difficulty curves, gravity, perfect band, scores, lives, rope/swing feel, audio, performance caps.
- `spec/game.json` — milestone flight events, day-night color stops, cloud positions, canvas ratio, module toggles.
- `assets/manifest.json` — asset registry (image/audio/font src under the four domains).

## What AI must NOT do

- No runtime code patch as the generation mechanism (`requiresRuntimeCodePatch = false`).
- No build step, no bundler, no framework import (React/Vue/Three/webpack/jQuery/zepto).
- No hardcoded asset paths in `game.js`; go through `manifest.json`.
- No naked magic numbers in `game.js`; read via `getGameSetting(path, default)`.
- No external CDN; all assets local.

## Tuning recipes

- **Easier / harder**: edit `DIFFICULTY.ANGLE_TIERS`, `SWING_TIERS`, `LAND_DRIFT_TIERS`, `MOVEDOWN_*`.
- **More forgiving perfect**: widen `BLOCK.PERFECT_BAND_MIN`/`MAX`.
- **More/less lives**: `CORE_RULES.MAX_FAILS`.
- **Scoring**: `SCORING.SUCCESS_SCORE`, `PERFECT_SCORE`.
- **Add a milestone flyover**: append `{ floor, flightId, type }` to `spec/game.json.milestones` and register `fN` art in the manifest.
- **Debug**: flip `DEBUG.ENABLED` / `INVINCIBLE` / `SHOW_COLLISION` / `SHOW_FPS` / `SKIP_TUTORIAL`.

## Config priority (GAME_BUILD_SOP §3)

`GameSettings.js` (mechanics/multipliers/switches) > `spec/*.json` (flow/content) > `assets/manifest.json` (paths) > `game.js` (systems only). The same real parameter is never duplicated across `GameSettings.js` and `spec/game.json`.
