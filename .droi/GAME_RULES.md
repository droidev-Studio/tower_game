# Game Rules — Tower Building

## Objective

Stack as many blocks as possible to build the tallest tower and score points. The run ends after 3 misses.

## Core Loop

1. A block hangs from a hook and swings left/right on a rope at the top.
2. The player performs a single action (tap / click / Space) to drop the block.
3. The block falls under gravity onto the tower top.

## Drop Outcomes

- **Land** — block overlaps the tower top within tolerance; floor +1, score + `SCORING.SUCCESS_SCORE`.
- **Perfect** — block lands within the centered band (`BLOCK.PERFECT_BAND_MIN`–`MAX`); adds a perfect-combo bonus (`SCORING.PERFECT_SCORE` × combo) and resets to perfect art.
- **Rotate & fall** — block overhangs left or right; the overhang rotates around the edge and may topple off, counting as a miss if it leaves the screen.
- **Miss** — block fully misses the tower and falls off screen; `failedCount` +1.

## Failure / Difficulty

- 3 misses (`CORE_RULES.MAX_FAILS`) → game over and settlement.
- Swing angle, swing speed, lateral stack drift, and descent speed scale up with floor count (`DIFFICULTY` tiers).
- "Cheat" far-edge placements flip the run into hard mode (faster swing, randomized rope height).

## Scoring & Save

- Score accumulates per success + perfect combos.
- High score persists in `localStorage` (`towerGame:v1`, versioned, try-catch guarded).

## States

`LOADING → MENU → PLAYING → GAMEOVER` (+ `PAUSED` in debug). MENU/GAMEOVER/PAUSED ignore the drop action; tap on MENU starts, tap on GAMEOVER restarts.

## HUD

Floor count, score, and 3 hearts (dimmed per miss). Decorative: day-night gradient, scrolling clouds/rocks, milestone flights, lightning flashes at milestone floors.
