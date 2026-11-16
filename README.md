# Bone to Be Bad III: No Rest for the Wicked

A mobile-first, single-player browser RPG vertical slice (about 30–45 minutes as a design target; not measured).
#404, Grib, Brugg and Hexa open the Unfinished Business Bureau and take three linked jobs in Dregswell,
ending with the Foreclosure Engine in the Ledger Cellar.

Built with **Phaser 3.90.0 + TypeScript 5.9.3 + Vite 7.3.8**. Tests use **Vitest 5.1.0**. Exact versions are pinned in
`package.json` and `package-lock.json`. No backend, accounts, network calls, ads or purchases.

## Run it

Requirements: Node.js 20.19+ or 22.12+ (developed on Node 22.23).

```bash
npm ci            # install the locked dependencies
npm run dev       # dev server at http://localhost:5173 (includes the debug panel under Menu)
```

Production build and local preview (no debug tools):

```bash
npm run build     # type-checks, then bundles to dist/
npm run preview   # serves dist/ at http://localhost:4173
```

`dist/` is a static site; any static host works (it uses relative paths).

On a phone on the same Wi-Fi: `npm run dev` prints a Network URL (the server listens on all interfaces).

## Controls

| Action | Touch | Keyboard |
| --- | --- | --- |
| Walk | Tap a ground tile (grid pathfinding) or the optional on-screen arrows (Settings) | Arrow keys / WASD |
| Approach someone | Tap them; the party walks to an adjacent tile | — |
| Interact / advance dialogue | Interact button, tap the dialogue box | Enter, Space or E |
| Journal / Menu | Buttons at the bottom | J / M, Escape opens Menu |
| Close a panel, cancel targeting | Close / Cancel buttons | Escape |

Battle: choose a command, then a target (tap the actor on the stage or its button). Skills, items and synergies ask
for confirmation and show the expected result first.

## Checks

```bash
npm run typecheck        # tsc --noEmit
npm test                 # all Vitest suites (content validation, combat, crafting, saves, full scripted playthroughs)
npm run validate:content # content/reference validation only
```

Browser journeys (optional; need Playwright with Chromium installed, and `npm run dev` running):

```bash
node tests/e2e/full.cjs 360x640 "Rest Charter" "Make them public"
node tests/e2e/full.cjs 1280x800 "Village Compact" "Trace the sender"
node tests/e2e/misc.cjs   # storage denied, backgrounding mid-fight, boss withdraw, bad imports, landscape
```

They drive the real UI (taps on canvas tiles, buttons) and read state through a dev-only `window.btbb3` hook that
production builds do not include. Screenshots go to `e2e-shots/`.

## Layout

```
src/core/         types, content loading + validation, reducer (single state owner), invariants, seeded RNG
src/systems/      combat, crafting, economy/shops, quests, stats/equipment, pathfinding
src/data/         content.json (authoritative prototype data), maps, dialogue + routing, skills/AI tuning
src/persistence/  deterministic serializer + checksum, two-slot localStorage store, import/export
src/render/       Phaser scenes (boot/world/battle), layered hero sprites, programmatic pixel art
src/ui/           DOM HUD, dialogue, battle commands, panels (workshop, shop, gear, journal, settings), audio
tests/            Vitest suites; tests/e2e has the Playwright browser journeys
docs/spec/        the original design handoff (unchanged)
```

See `HANDOFF_STATUS.md` for what is finished, what is not and known issues, and `docs/VALIDATION_REPORT.md` for
what was actually run.
