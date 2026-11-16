# Asset inventory

Every visual is generated at boot from rectangles in `src/render/sprites.ts` (`allTextureSpecs()`). No image files
are fetched or bundled. Status for **all** entries: **provisional stand-in, original, made for this prototype**. None
of it is final illustration. Audio is original procedural WebAudio (`src/ui/audio.ts`). There is no recorded or
commissioned music.

| Group | Texture keys | Size | Notes |
| --- | --- | --- | --- |
| Hero bases | `{c404,grib,hexa,brugg}_base_{0..3}` | 48×64 (Brugg 64×80), shown at half scale in the world | Shaded high-detail style from `src/render/art32.ts` + `pixel32.ts`. Frames: 0 idle, 1–2 walk, 3 attack pose. Hurt flash is a tint |
| Hero layers | `{hero}_{appearance}_{0..3}` for all 12 appearance keys | same as base | Per-character anchors (head, torso, hand) shared by every layer |
| Appearance keys (from content.json) | `old_blade, shiv, knuckles, wand, old_cap, old_coat, grievance_cleaver, union_hat, funeral_coat, salvage_shiv, riveted_knuckles, clause_wand` | — | Validated at boot (`requiredAppearanceKeys`) and in content validation (`IMPLEMENTED_APPEARANCES`) |
| NPCs | `pell, mott, marn, clerk, relief, crowd, crowd2, ribbs, worker_strike, worker_strike2` | 24×32 | |
| Enemies (map markers) | `wisp, collector, mite` / `engine` | 24×32 / 64×64 | Invoice Harpy, Debt Minotaur, Rust Basilisk, Foreclosure Hydra |
| Enemies (battle) | `wisp_hd, collector_hd, mite_hd` / `engine_hd` | 48×64 / 128×128 | Shaded high-detail mythic monsters |
| Props | `desk, desk_side, anvil, bench, bench_rest, plant, string_board, noticeboard, stall_closed, stall_open, counter, well, winch, ledger, sign, crate_seal, scrap_pile, chest, chest_open, archive_desk, seal, engine_wreck, marker_bang, marker_talk, tap_target` | 16×16 | |
| Tiles | `t_grass, t_path, t_wood, t_stone, t_door, t_doorway, t_water, t_tree, t_house, t_fence, t_crates, t_wall_{indoor,village,yard,cellar}` | 16×16 | |
| Title art | composed in DOM from the hero textures (`titleArt`) | 120×44 at 3× | |

Palette: `src/render/palette.ts` (plum/charcoal outlines, moss/teal, parchment, bone ivory, gold, curse violet).
