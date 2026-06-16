# Manifest Notes — Tower Building

`assets/manifest.json` is the single source of truth for asset paths. Runtime (`game.js`) loads it at boot and looks up assets by key — it never scans folders or hardcodes paths.

## Structure

- `basePath`: `assets/`
- `assetArchitecture`: four-domain metadata for backend validation.
- `images`: keyed map → `{ src }` (path relative to `basePath`).
- `audio`: keyed map → `{ src, alt?, loop? }`; `alt` is the `.ogg` fallback source.
- `fonts`: `wenxue` loaded via CSS `@font-face`, listed here for registry completeness.

## Key → domain mapping

| Keys | Domain path |
|---|---|
| `block`, `blockPerfect`, `blockRope`, `hook`, `rope` | `Game Art/weapons` |
| `c1`–`c8`, `f1`–`f7` | `Game Art/map` |
| `tutorial`, `tutorialArrow`, `heart`, `score` | `Ui Art/run-entry` |
| `uiTitle`, `uiStart`, `uiLogo`, `uiMainBg`, `uiModalBg`, `uiModalOver`, `uiAgain` | `Ui Art/opening` |
| `background` | `Visual Style/map` |
| audio (`bgm`, `drop`, `dropPerfect`, `gameOver`, `rotate`) | `Audio & Feel/audio` |

## Rules

- Every `src`/`alt` must point to a real file (validated by `tools/validate-assets.js`).
- No references to `_archive`, `node_modules`, `.git`, or download residue.
- Spaces and `&` in domain folder names are URL-encoded per path segment at load time.
- Missing/failed assets fall back to geometric rendering — the game never white-screens.
