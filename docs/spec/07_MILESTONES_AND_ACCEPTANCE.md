# Delivery plan and acceptance

## Milestone 1 — Playable foundation
Title/New Game/Continue, Bureau/village/Yard traversal, four recognizable party sprites, NPC interaction, one sample dialogue, journal, settings, save/export/import, keyboard and touch. Run/build instructions and source included. Continue restores world position and dialogue. First run reaches gameplay without setup screens, downloads or login.

## Milestone 2 — First complete job
Job 001 from acceptance to reward, all four heroes, visible turn order/intents, skills, DP/synergies, victory/defeat/retry/leave, branch and actual changed village service. Rewards claimed once. Mid-battle resume restores the same turn and resources. Starter gear makes the mandatory fight winnable.

## Milestone 3 — Complete slice
Jobs 002/003, cellar and boss, ending/recap/free roam, workshop, all supplied recipes, equipment layers and +3 cap, shops, optional chest, repeatable salvage. Every choice has the supplied implemented consequence. No empty menu routes or unimplemented mechanics presented as available.

## Milestone 4 — Verification and polish
Legible phone layouts, touch/focus/rotation, original stand-in art labelled honestly, appropriate audio, reduced motion, save recovery and balance. Produce a short validation report with pass/fail/not-run, actual commands and limitations. Balance/playtime estimates must remain estimates until measured.

## Meaningful automated checks
1. Content IDs unique; all item/recipe/quest/encounter references resolve; quest graph acyclic; appearance/effect/AI/skill keys implemented.
2. Fixed combat fixture verifies turn order/ties, curse duration, Guard/protection and costs; invalid/cancelled actions don't spend resources.
3. Fatal ring triggers once, persists across save/load, Weakness expires correctly; synergy partner KO prevents use.
4. One craft/upgrade transaction consumes exact costs; double submission cannot duplicate output; no negative quantities; +3 rejects further upgrades; equipment instance cannot have two owners.
5. Claim each job/battle reward, reload and re-submit: no duplicate rewards. Repeat salvage gives its reward exactly once per explicit run.
6. Serialize a mid-battle fixture, load it, apply same next action: equal logical outcomes/RNG state. Corrupt newest save falls back; unsupported import preserves old save.
7. Both branch combinations retain a valid route to boss and all essential materials. Main quest can finish with starter gear under a scripted sensible strategy; no required optional drop.

## Manual user journeys
- Fresh game → job 001 → workshop → craft cleaver → equip it → see changed weapon → continue job 002.
- Full chain on charter/public branch, then separate clean run on compact/trace. Confirm village props/dialogue/services and boss introduction differ as specified.
- Craft all four special pieces, upgrade one to +3, attempt +4 and unaffordable craft. Compare counts before/after. Swap gear repeatedly; no free MP refill.
- Reload during dialogue, immediately after branch choice, after craft, on a player turn, after enemy action and after victory reward. No lost committed choice or extra loot.
- Defeat/retry, leave boss/return, optional chest repeated visits, repeated salvage, end free roam. No softlocks or duplicate unique rewards.
- 360×640, 390×844, 430×932, landscape and 1280×800 desktop: all controls reachable, names readable, no horizontal page overflow, stage not hidden by commands.
- Tap close to walls/exits/NPCs, resize/rotate then tap: correct target mapping; doors on all sides work.
- Background for a minute mid-fight then resume: no elapsed-time combat. Audio only after gesture; toggles work; motion setting respected.
- Simulate storage denied/full; see warning and export working backup; malformed/oversized import rejected with current state intact.

## Definition of done
A playable source build implementing the above with honest exceptions. If any criterion remains open, mark it in `HANDOFF_STATUS.md` and don't describe the slice as complete. Screenshots alone, static menus, a generated design document or TODO-only combat are not a playable delivery.

## Later backlog
Full chapters/regions, the other companions, bond progression, extra synergy pairs, PWA install/offline cold start, cloud transfer, native app, controller support and larger equipment catalogue. These must not delay the first functioning loop.
