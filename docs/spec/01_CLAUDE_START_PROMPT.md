# Paste this into Claude after uploading the package

You are implementing BONE TO BE BAD III, working subtitle NO REST FOR THE WICKED, for Dennis Yong. Read all supplied Markdown and JSON files before implementing. This is a new project, separate from I, II, Dungeon Shift, and other spin-offs. Preserve existing work if any is present; do not overwrite unrelated projects.

Build the actual playable mobile-first vertical slice described here. Do not respond only with a design document or a list of suggestions. Use Phaser + TypeScript + Vite, with readable DOM menus and deterministic gameplay logic outside the renderer. Select compatible stable dependencies available in your environment, record exact versions in the lockfile, and avoid unverified version claims.

First inspect the available execution environment. Prefer a normal multi-file source project with a runnable browser preview. If this environment only supports an artifact, implement the same slice in the supported artifact format with Canvas/DOM and plain JS or supported React, keeping the pure systems separate within the file. State the adaptation once and retain all gameplay requirements. Do not claim a build or test ran if tools were unavailable. Do not stop to ask routine architecture questions.

Read `00_START_HERE.md` for canon status. Treat unconfirmed III details as prototype defaults, not immutable series canon. Keep #404 sarcastic and vulnerable, Brugg gentle, Grib opportunistic but loyal, and Hexa strict. Do not add gacha, energy, crafting waits, daily chores, ads, paid power, or live-service dependencies.

Implement in this order:
1. Milestone 1: original pixel-styled title, New Game/Continue, playable Bureau/village, touch exploration, dialogue, stable saves, desktop controls.
2. Milestone 2: complete job 001 with the four-character tactical battle, branch consequences and once-only rewards.
3. Milestone 3: connected jobs 002/003, dungeon/boss, workshop, equipment layers and +0 to +3 upgrades.
4. Milestone 4: resume correctness, responsive polish, audio settings, accessibility, balance and acceptance checks.

Continue as far as the execution budget permits. If interrupted, leave a runnable build and `HANDOFF_STATUS.md` listing completed features, remaining acceptance criteria, commands and known bugs. Do not replace unfinished systems with fake buttons or report them complete. Prioritize a complete playable loop over extra content.

Use `data/content.json` as initial authoritative prototype data. Implement its referenced effects using the formulas in `04_COMBAT_AND_CRAFTING.md`; don't silently ignore metadata. Add runtime schema/reference validation. Keep starter gear, recipes, rewards, enemy tells, branches and locations data-driven. Make source/production debugging visibly separate.

Art: draw original low-resolution pixel sprites/tile assets programmatically if source artwork is absent. Give the four characters distinct silhouettes; visibly implement helmet/body/weapon overlays. Placeholder assets must be identified honestly, not described as final illustration. No external image hotlinks or missing-asset blockers. Avoid generic dashboard styling. Use a readable normal text font for dialogue; pixel display type only where legible. No need to ask Dennis to supply sprites before implementing.

Treat persistence as a core mechanic: save committed commands, exact battle turn/RNG state and dialogue cursor, and make reward claims idempotent. Backgrounding must not advance enemies. Storage failure must remain playable and visible with an export fallback. Never promise local browser storage can never be evicted.

Run available build/type/content checks and meaningful system tests; manually verify the listed user journeys on small portrait and desktop sizes. Report what actually ran, known limitations and where the runnable preview/source can be opened. Supply the complete source project, not screenshots alone. Start work now with Milestone 1.
