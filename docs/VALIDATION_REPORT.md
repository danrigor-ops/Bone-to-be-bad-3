# Validation report — 16 November 2026

Environment: Linux container, Node 22.23.4, npm 10.9.9, headless Chromium through Playwright. No real phones.

## Commands that were run

| Command | Result |
| --- | --- |
| `npm ci` / `npm install` (pinned versions) | PASS. `npm audit` reports 0 vulnerabilities |
| `npm run typecheck` (`tsc --noEmit`, strict) | PASS. No errors |
| `npm test` (Vitest) | PASS. 29/29 tests |
| `npm run build` | PASS. 1.37 MB JS (385 KB gzip), with a chunk-size warning for Phaser only |
| `node tests/e2e/full.cjs 360x640 "Rest Charter" "Make them public"` | PASS. Full slice, no console errors |
| `node tests/e2e/full.cjs 430x932 "Village Compact" "Trace the sender"` | PASS |
| `node tests/e2e/full.cjs 1280x800 "Village Compact" "Trace the sender"` | PASS |
| `node tests/e2e/full.cjs 390x844 "Rest Charter" "Trace the sender"` | PASS |
| `node tests/e2e/misc.cjs` | PASS (details below) |

## Automated checks (spec section "Meaningful automated checks")

| # | Check | Status | Where |
| --- | --- | --- | --- |
| 1 | Unique IDs, references resolve, acyclic quests, effect/appearance/AI/skill keys implemented, maps valid, every interactable routes to dialogue | PASS | `tests/systems.test.ts` §1, plus validation at boot in `main.ts` |
| 2 | Turn order and ties, exact damage formulas, curse duration (+1 with coat, refresh), Guard, Stand Behind Me (with hard hat), costs, invalid actions spend nothing, Pilfer once | PASS | §2 |
| 3 | Warranty Ring once, persists across save/load, Weakened ×0.8 then expiry, second hit can KO, synergy blocked by partner KO, DP cost | PASS | §3 |
| 4 | Exact craft/upgrade costs, duplicate transaction rejected, +3 cap, no negatives, single owner, no duplicate accessory, no MP refill, class restriction | PASS | §4 |
| 5 | Job and battle rewards once across reload, salvage once per explicit run | PASS | `tests/playthrough.test.ts` |
| 6 | Mid-battle serialize/load gives identical outcome and RNG state; corrupt newest slot falls back; future/mismatched/malformed import rejected without touching storage; storage failure keeps play going | PASS | §6 |
| 7 | Both branch combinations reach the boss and the end with starter gear under a scripted strategy; guaranteed rewards afford all four signature recipes | PASS | `tests/playthrough.test.ts` |

## Manual user journeys (performed through the browser UI by script)

| Journey | Status |
| --- | --- |
| Fresh game → job 001 → workshop → craft Cleaver → equip → changed weapon visible → job 002 | PASS (360×640) |
| Full chain charter/public, and a separate clean run compact/trace; props, dialogue, services and boss intro differ | PASS (both routes, three sizes) |
| Craft all four special pieces, upgrade one to +3, attempt +4 and an unaffordable craft | PARTIAL: unit-tested; in the browser only the Cleaver craft and equip were clicked |
| Reload during dialogue, after the branch choice, on a player turn | PASS (unit and browser: same battle turn after reload) |
| Defeat/retry | Unit-level only (reducer). Not triggered in the browser, because the scripted strategy never lost |
| Leave boss and return; chest revisits; repeated salvage; free roam at the end | PASS |
| 360×640, 390×844, 430×932, landscape 740×360, 1280×800: controls reachable, no horizontal overflow | PASS in Chromium emulation |
| Taps near walls, exits and NPCs, then after a resize | PASS: taps go through Phaser's camera transform, and the landscape resize kept state and mapping |
| Background a minute mid-fight: no elapsed-time combat | PASS: with the page hidden, no enemy action ran for 3 s; enemies resumed once visible |
| Audio only after a gesture, toggles, motion setting | Wired and gated; not listened to (headless) |
| Storage denied: warning, export works; malformed/oversized import rejected with state intact | PASS |

## Not run
- Real-device testing (iOS or Android), screen-reader testing, performance profiling and timed human playtests.
