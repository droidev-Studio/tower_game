# Tower Building

A cheerful **one-tap Stack-the-Tower** timing mini-game with a bright, sunny storybook style.

Players swing a block on a crane hook and tap at just the right moment to drop it onto a growing tower — chasing perfect landings, climbing through day into starry night, and pushing for a new high score before they run out of lives.

中文说明：`Tower Building`（盖楼 / 盖塔）是一个“点击计时 + 堆叠”的网页小游戏。钩子吊着方块来回摆动，你在对准的瞬间点一下把它叠上去。叠得越准越高，画面从白天渐变到夜晚，目标是刷新最高分。轻松、明快、童话风。

---

## 🚀 Built in 5 Minutes with Droi AI

**From concept to full game — in minutes, not weeks.**

[Droi AI GitHub](https://github.com/droidev-studio)

This entire cozy stacking game was assembled end-to-end with **Droi AI** — a build-free HTML5 Canvas runtime, a clean config-layered architecture, four-domain asset packaging, swing-and-drop timing physics, perfect-combo scoring, a day→night sky, and milestone flyovers.

Experience the future of game development: [droidev-studio.github.io](https://droidev-studio.github.io)

Project repository: [Droi-AI-landing](https://github.com/droidev-studio/Droi-AI-landing)

---

## Game Overview

**Tower Building** combines three simple ideas:

- **One-tap timing** — a block swings on a rope; tap to drop it. Timing is everything.
- **Stacking strategy** — land each block on the one below; the tighter you stack, the longer you survive.
- **Cozy storybook style** — warm blocks, scrolling clouds, a sky that drifts from day to night, and friendly flyovers.

The result is an easy-to-pick-up, hard-to-master browser game:

> A bright, one-tap stacking game anyone can play in seconds.

---

## Features

- One-tap / click / Space to drop — instantly readable controls.
- Swing-and-drop timing with real gravity and a satisfying rotate-and-topple physics on bad landings.
- **Perfect** landings reward a combo bonus and a distinct golden block.
- Difficulty ramps with floor count: faster swing, wider angle, drifting stacks.
- Day → night sky gradient that shifts as the tower climbs.
- Scrolling clouds and rocks, plus milestone flyovers (birds, planes, hot-air balloon).
- Lightning flashes at milestone floors.
- 3 lives — three misses and the run ends.
- High score saved locally (`localStorage`, versioned and crash-safe).
- Floor / Score / Hearts HUD.
- Mobile-ready: touch input, safe-area aware, responsive canvas.
- Static HTML5 Canvas game — **no build step, no framework, no external requests.**

---

## How to Play

Tap **START**, then watch the block swing on the hook.

On each drop, time it carefully:

- Tap when the block lines up over the tower top.
- Land it centered to keep your stack wide and safe.
- Hit dead-center for a **Perfect** — chain perfects for bonus points.
- Overhang too far and the edge rotates off; miss entirely and you lose a life.
- Climb high enough to trigger flyovers and the night sky.

The core question is always:

> Drop now for a safe landing, or wait one more swing for the perfect?

---

## Controls

| Action | Input |
| --- | --- |
| Drop block | Tap / Click / `Space` |
| Start run | Tap / Click on the menu |
| Retry | Tap / Click on Game Over |
| Pause (debug) | `Enter` |

Works with mouse, keyboard, and touch.

---

## Game Feel

Tower Building is designed to feel:

- cheerful
- bright
- snappy and responsive
- easy to understand
- non-violent
- relaxing but still tense at high floors

Instead of fast action, the fun comes from reading the swing and committing to the perfect moment — one more block, one more floor.

---

## Screens / Content Highlights

- **Menu** — sunny title screen with the swinging crane behind it.
- **Play** — the tower grows, the sky shifts, clouds and flyovers drift past.
- **Milestones** — birds, planes, and a hot-air balloon appear as you climb.
- **Game Over** — final score, your best score, and one tap to play again.

---

## Run It Locally

No build step. Serve the folder over any static server and open `index.html`:

```bash
npx serve -l 8080
# or
python -m http.server 8080
```

Then open http://localhost:8080. (Opening via `file://` won't work — the game `fetch`es `spec/game.json` and `assets/manifest.json`.)

Validate the asset structure anytime:

```bash
node tools/validate-assets.js
```

---

## Architecture

| Layer | File | Role |
| --- | --- | --- |
| Tunables | `GameSettings.js` | Difficulty, gravity, perfect band, scores, lives, feel, audio. Loaded **before** `game.js`. |
| Content / flow | `spec/game.json` | Milestone flyovers, day-night color stops, cloud positions, canvas ratio. |
| Assets | `assets/manifest.json` | The only asset registry; four-domain structure. |
| Runtime | `game.js` | Inline engine + state machine + object pools + all gameplay. |

---

## Credits

Built with **Droi AI**.

- [Droi AI GitHub](https://github.com/droidev-studio)
- [Droi-AI-landing](https://github.com/droidev-studio/Droi-AI-landing)

Original *Tower Building* gameplay concept and art/audio are based on the open-source [iamkun/tower_game](https://github.com/iamkun/tower_game); this version is an architectural refactor into a build-free, standards-compliant H5 template.
