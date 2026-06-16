# DROI Template — Tower Building

## Knowledge Summary

A one-tap timing/stacking game ("盖塔/堆塔"). A block swings on a rope from a top hook; the player taps to drop it onto the growing tower. Centered drops land, dead-center drops are "perfect" (combo bonus), partial overhangs rotate and fall off, full misses are lost. Three misses end the run. Difficulty (swing speed/angle, stack lateral drift, descent speed) scales with floor count; the backdrop shifts day→night, clouds/rocks scroll, and milestone birds/planes appear. Build-free vanilla JS Canvas 2D; tunables in `GameSettings.js`, content/flow in `spec/game.json`, assets via `assets/manifest.json`.

## Game Type Label

`stack-tower-timing`

## Routing Keywords

tower, stack, stacking, build, tower-building, one-tap, timing, drop, hook, rope, crane, casual, hyper-casual, perfect-combo

## Chinese Keywords

盖塔, 堆塔, 叠塔, 搭塔, 计时点击, 一键投放, 钩子, 摆动, 完美连击, 休闲小游戏

## Capability Tags

canvas-2d, no-build, no-framework, vanilla-js, object-pool, state-machine, action-input, day-night-gradient, time-movement-tween, localStorage-save, mobile-touch, four-domain-assets, manifest-driven

## Routing Hints

- Choose when intent is stacking/timing/"盖塔/堆塔"/one-tap drop, not shooting or movement.
- Single-action input (tap/click/space). No weapons, bullets, enemies, or bosses.
- Difficulty scales with floor count; no fixed levels (no `levels.json`).
- Scoring = success + perfect-combo; lives = 3 misses.

## Required Runtime Files

- `index.html`
- `game.css`
- `GameSettings.js` (loaded before `game.js`)
- `game.js`
- `spec/game.json`
- `spec/schema.json`
- `assets/manifest.json`

## Asset Architecture

Four-domain `assets/` structure with `manifest.json` as the only registry:

- `Audio & Feel/audio` — bgm, drop, drop-perfect, game-over, rotate.
- `Game Art/weapons` — block, block-perfect, block-rope, hook, rope (the launched/stacked piece).
- `Game Art/map` — clouds (c1–c8), milestone flights (f1–f7).
- `Ui Art/opening` — title, start, logo, loading, modal art.
- `Ui Art/run-entry` — tutorial, tutorial-arrow, heart, score (in-run UI).
- `Visual Style/map` — background backdrop.
- `Visual Style/style-proofs` — favicon and preview art.
- Empty reserved domains (`enemies`, `bosses`, `pickups`, `skills`, `player`, `portal`, `effects`) are kept empty by design.

## Generation Notes

- P0 generation patches `spec/game.json`, `GameSettings.js`, `assets/manifest.json`, and style only — no runtime code patch, no build step, no framework import.
- Difficulty multipliers/thresholds live in `GameSettings.js` (`DIFFICULTY`, `BLOCK`, `ROPE`, `SCORING`); flow data (milestone flights, day-night color stops, cloud positions) lives in `spec/game.json`.
- Asset paths only in `manifest.json`; runtime reads manifest keys, never hardcoded paths.
- Render uses asset-first with geometric fallback when a key is missing.
