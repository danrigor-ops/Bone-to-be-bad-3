# Bone to Be Bad III — Claude coding handoff v0.1

Prepared for Dennis Yong, 15 November 2026. Working subtitle: No Rest for the Wicked.

## What this package is
A specification and starter content dataset for a new mobile-first, single-player browser RPG. It is not a playable game or existing source repository. Claude should implement a playable vertical slice from these files. No previous game files or sprites are included or required to begin. Do not overwrite another Bone to Be Bad project.

## How to use
Upload this ZIP to Claude, then paste the text in `01_CLAUDE_START_PROMPT.md`. If ZIP reading is unavailable, extract it and upload the Markdown and JSON files. Start with Milestone 1, then continue through Milestone 4. Each milestone should end in a runnable build, not only a plan.

## Read order
1. `01_CLAUDE_START_PROMPT.md`
2. `02_DESIGN_AND_CANON.md`
3. `03_VERTICAL_SLICE.md`
4. `04_COMBAT_AND_CRAFTING.md`
5. `05_MOBILE_AND_ART.md`
6. `06_ARCHITECTURE_AND_SAVES.md`
7. `07_MILESTONES_AND_ACCEPTANCE.md`
8. `data/content.json` and `data/save_example.json`

## Decision status
- Established series context supplied by Dennis's earlier planning: Grimwald; sarcastic Skeleton #404; comedy villain-side RPG; turn-based combat; shared Dark Power; recurring companions. “The World Without Labels” is the established true-ending concept. It frees beings from imposed labels. Do not invent a different ending for earlier games.
- Current task authorization: prepare III for coding using the mobile RPG direction and include craftable weapons and armour.
- Prototype defaults, editable after playtesting: subtitle, Bureau premise, aftermath chronology, four-character initial roster, portrait layout, all numerical balance, exact equipment slots, +3 cap, jobs and NPCs in this package. These implement the conversation's proposed direction; they are not declarations that Dennis separately approved every detail.
- No claim is made about the exact final scene, date, or full implemented content of II. III assumes the labels have been removed; avoid detailed recaps that contradict later supplied canon.
- III has no locked monochrome palette. The four-green rule and mandatory GBA shell belong to earlier projects and are not automatically imposed here.

## Deliverable scope
One 30–45 minute authored slice, designed around 5–10 minute tasks. Playtime is a design target, not a tested claim. Include full source, local run/build instructions, lockfile, and honest validation notes. Shipping a native app, App Store submission, payments, cloud accounts, and the full campaign are outside v0.1.

## Package validation
JSON/reference and progression checks validate this handoff's internal content only. They do not establish that a game has been implemented or playtested. See `PACKAGE_VALIDATION.txt` for actual results.
