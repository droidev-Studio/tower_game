# Tower Building (盖塔 / 堆塔) — H5 Mini-Game

A one-tap stacking/timing game, refactored from [iamkun/tower_game](https://github.com/iamkun/tower_game) into a **build-free, framework-free, statically-servable** HTML5 Canvas 2D mini-game that follows the *HTML5 Canvas 2D Game Template Base* and *Game Build SOP* standards.

A block swings on a rope from a hook; tap (or click / Space) to drop it onto the tower. Centered = land, dead-center = **perfect** (combo bonus), partial = the overhang rotates and falls, full miss = lost. Three misses end the run. Difficulty scales with floor count; the sky shifts day→night, clouds/rocks scroll, and milestone birds/planes fly by.

## Run it

No build step. Serve the folder over any static server and open `index.html`:

```bash
npx serve -l 8080
# or
python -m http.server 8080
```

Then open http://localhost:8080. (Opening `index.html` via `file://` will fail because the game `fetch`es `spec/game.json` and `assets/manifest.json`.)

## Validate assets

```bash
node tools/validate-assets.js
```

Checks that every `manifest.json` `src` exists, the four-domain folders are present, and no legacy/forbidden paths are referenced.

## Architecture

| Layer | File | Role |
|---|---|---|
| Tunables | `GameSettings.js` | Difficulty, gravity, perfect band, scores, lives, feel, audio, perf caps. Loaded **before** `game.js`. |
| Content/flow | `spec/game.json` (+ `schema.json`) | Milestone flights, day-night color stops, cloud positions, canvas ratio, module toggles. |
| Assets | `assets/manifest.json` | Only asset registry; four-domain structure. |
| Runtime | `game.js` | Inline engine (loop / instances / time-movement tween / asset / audio / input) + state machine + object pools + ported gameplay (collision, swing/rotate physics, day-night, clouds, flights, tutorial, HUD). |

Config priority: `GameSettings.js` → `spec/*.json` → `assets/manifest.json` → `game.js` (systems only).

## Assets (four-domain)

```
assets/
  Audio & Feel/audio/        bgm, drop, drop-perfect, game-over, rotate (.mp3 + .ogg)
  Game Art/weapons/          block, block-perfect, block-rope, hook, rope
  Game Art/map/              c1..c8 (clouds/rocks), f1..f7 (flights)
  Ui Art/opening/            title / start / logo / loading / modal art
  Ui Art/run-entry/          tutorial, tutorial-arrow, heart, score
  Visual Style/map/          background
  Visual Style/style-proofs/ favicon
  fonts/                     wenxue (via CSS @font-face)
  manifest.json
```

Reserved empty domains (`enemies`, `bosses`, `pickups`, `skills`, `player`, `portal`, `effects`) are intentionally empty.

## Controls

- **Tap / Click / Space** — drop the block (start on menu, retry on game over).
- **Enter** — pause (debug only).

## Credits

Gameplay design and original art/audio © [iamkun/tower_game](https://github.com/iamkun/tower_game). This is an architectural refactor (engine, config layering, asset structure) of that game.
