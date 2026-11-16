# Handoff status — Bone to Be Bad III vertical slice

Last updated: 16 November 2026. Branch: `slice-build`.

**Summary:** Milestones 1–3 are implemented and playable end to end, and most of Milestone 4 is done. The whole
slice (jobs 001 → 003, boss, ending, free roam) was played through the real browser UI on both branch combinations.
It is **not** described as complete, because a few acceptance items were never measured or tested on real hardware.
They are listed below.

## Done

### Milestone 1: foundation
- Title screen with original code-drawn art, New Game (asks before replacing progress), Resume with a one-line last
  action and the current objective.
- Bureau, Dregswell and Mill Yard, plus the three cellar rooms, all walkable with tile pathfinding (tap) and
  keyboard/D-pad stepping under the same grid rules. Exits work from every approach. Doors show gold markers.
- Four distinct party sprites (24×32, Brugg 32×40) with weapon, head and body layers that follow the party around.
- NPC and prop interaction through an explicit Interact prompt, so walking past never re-opens dialogue.
- Dialogue with speaker names, typewriter or instant text, and choices with previews and confirmation.
- Journal (objective, job checklists, decisions, key items, recap log), Settings, Menu, keyboard and touch.
- Saves after every committed command into two alternating localStorage slots with checksums. Falls back to the
  older slot if the newest is damaged. Export and import support a size cap, validation and confirmation.

### Milestone 2: job 001
- The full objective chain, with the ledger inspection required before the fight.
- Four-hero turn-based battle: speed order with stable ID ties, visible turn order and enemy intents, all eight
  skills, Guard, items, free Inspect, shared DP, both synergies (Fine Print, Safe Hands) and banter.
- Victory, defeat (Retry restores the pre-battle snapshot; Return to Bureau loses nothing earned), Flee (no
  rewards), boss Withdraw (back to the Bureau, boss still there).
- Rest Charter / Village Compact choice with previewed costs. Each branch sets different visible props (strikers,
  benches, relief worker, stall), dialogue and services (worker salvage counter at −20% on materials, or the
  mayor's stall at −20% on healing items).
- Rewards are claimed once through `claimedRewards` keys (`job001:completion`, `encounter:<id>`,
  `salvage:<run>`, `chest:cellar_chest`).
- Mid-battle reload resumes the same turn, HP/MP, statuses, DP and RNG state. Enemies only act while the page is
  visible.

### Milestone 3: complete slice
- Job 002 (noticeboard → Ribbs → crate → Invoice Swarm → public/trace) with the angry crowd in the village or the
  string board at the Bureau. The Cellar Key is a flag, not a consumable.
- Job 003: the cellar door is gated by the key and job acceptance, a mandatory Debt Collector, an optional Rust Mite
  plus a one-time chest, the correspondence (a key item granted before the boss), the Foreclosure Engine with its
  visible Audit → Red Stamp → Repossession cycle (step 3 highlighted a turn ahead), a different boss introduction
  per evidence choice, a flavour-only closing line, the recap and an "End of prototype" notice. Free roam continues.
- Marn's workshop: all 8 recipes (locked ones show which job unlocks them), owned/needed counts, honest source hints,
  eligibility, comparison against equipped gear, previews of the new look, craft/upgrade confirmation, a pinned
  recipe tracker, +0 to +3 upgrades on the same instance, and +4 refused with a reason.
- Equipment: five slots, class-restricted weapons, no duplicate accessory on one hero, one owner per instance,
  equip only outside battle, no free MP refill from the Focus Charm. Appearance changes show immediately in the
  world, in battle and in the previews.
- Repeat Salvage after job 001: an explicit "Repeat salvage" spawns one Rust Mite, giving 2 Scrap Iron and 1 Bone Chip
  once per run index, with no gold or XP.
- Mott's Barrow (full price, always open) plus the branch counter or stall. No selling.
- XP and levels (30/70 thresholds, cap 3, +5 HP / +2 MP / +1 ATK/MAG/DEF per level).

### Milestone 4: polish (partial; see "Not done")
- Layouts checked in Chromium at 360×640, 390×844, 430×932, 740×360 landscape and 1280×800 desktop, with no
  horizontal overflow and every battle command reachable.
- Reduced motion (no shake or flashes), instant text, separate music and SFX toggles, original procedural WebAudio
  that starts only after a gesture and pauses when hidden, and Classic Bone / Bureau Brass themes.
- If storage is denied or full, a persistent "Progress is not saving" bar appears with Export, and the game keeps
  running in memory.
- A dev-only debug panel (grant materials, jump to job, start the boss, heal, teleport, inspect state, simulate a
  save failure). It is excluded from production because the reducer refuses debug commands when
  `import.meta.env.DEV` is false and the panel isn't rendered.

## Not done / not verified (open acceptance items)
- **Playtime and balance are not measured.** The 30–45 minute figure is the spec's target, not a result. The
  scripted strategy beats every fight with starter gear (unit test plus browser run), but no human playtest happened.
- **No real-device testing.** All browser checks ran in headless Chromium with emulated viewports. iOS Safari,
  Android Chrome, real touch latency, safe-area insets on notched phones and real rotation weren't tested.
- **Audio was never listened to.** It is wired and gated correctly, but headless runs can't confirm how it sounds
  or its volume balance.
- **Performance is not measured.** No FPS or memory figures. Production JS is about 1.37 MB (385 KB gzip), mostly
  Phaser.
- The manual journey "craft all four special pieces, upgrade one to +3, attempt +4 and an unaffordable craft" is
  covered by unit tests and partly by the browser (the Cleaver was crafted and equipped through the UI). It hasn't
  been clicked through in full by hand.
- Screen readers: labels, live regions and focus restoration are in place, but no assistive-technology testing has
  been done.

## Known issues and prototype interpretations
- On short landscape screens the battle stage drops to 1× sprites, and actor labels can overlap slightly.
- On entering a map the three followers start stacked on #404 and spread out as you walk.
- There are no back-facing sprites: walking up uses the front sprite, and left/right is a mirror.
- Hexa's pointed hat stays visible, but caps and hard hats sit on its brim. This was a deliberate stand-in choice.
- **Spec interpretations** (all prototype defaults, easy to change):
  - DP: every damaging hero action (Attack and damaging skills) gains 5 DP. Guard, heals, items and synergies gain
    none.
  - Redirected Stand Behind Me damage uses Brugg's defence and Guard state.
  - Flee keeps current HP/MP (a KO'd hero returns at 1 HP). Defeat with Retry or Return to Bureau restores the
    pre-battle inventory, so consumables used in a lost fight come back.
  - The general shop (Mott's Barrow) always sells all five items at full price. The branch discounts apply only at
    the worker salvage counter (Charter) or the mayor's stall (Compact).
  - The cellar also requires job 003 to be accepted, not only the key.
  - Enemy tells and AI cycles live in `src/data/skills.ts`, and dialogue and maps in TypeScript data modules.
    Items, recipes, rewards, encounters and economy come from `src/data/content.json`.
- All art is provisional stand-in art generated in code (see `docs/ASSET_INVENTORY.md`). There is no commissioned
  music.

## Commands
```
npm ci && npm run dev        # play at http://localhost:5173
npm run build && npm run preview
npm test                     # 29 tests
node tests/e2e/full.cjs 360x640 "Rest Charter" "Make them public"   # with dev server running
```

## Suggested next steps
1. A human playtest on a real phone, timing each job and noting balance.
2. Commissioned or hand-drawn sprites to replace the stand-ins, keeping the manifest keys.
3. A short accessibility pass with VoiceOver or TalkBack.
