# Implementation architecture and persistence

## Target
Single-player web app usable on phone and desktop. Default project: Phaser, TypeScript, Vite; DOM HUD/menu layer. Browser preview is first delivery, native wrappers later. No backend, account, network AI or runtime API key. Bundle assets/dependencies for production; after page load core play must not require network calls. Cold-start offline installation/PWA caching is a later feature, not implied by local saves.

Select compatible dependency versions at implementation, install and lock them, state exact commands. Do not copy a guessed latest version from this spec. Alternative artifact implementation is allowed only for environment constraints described in start prompt.

## Module boundaries
- `core/`: types, immutable commands/reducer, content validation, seeded RNG.
- `systems/`: movement/pathfinding, interaction, dialogue, quests, combat, crafting, equipment, economy, progression.
- `data/`: authored JSON and validated lookup indexes.
- `persistence/`: versioned serializer, two-slot storage adapter, import/export, recovery.
- `render/`: Phaser scenes, camera, sprites/layers, FX and audio; disposable view objects only.
- `ui/`: DOM panels, focus/input mapping and layout.
- `tests/`: meaningful state-system tests independent of canvas.

Use one serializable state owner. Scenes render state and emit commands. DOM must not mutate inventory behind the reducer. Each accepted command computes the next complete state, validates invariants, increments revision and enqueues save. Input locked while a command is committing, not while harmless animations play. Fixed grid movement resolves tile-by-tile; save each reached tile. Desktop and touch actions share commands.

## Persistence contract
Save at every committed logical change: accepted dialogue advance/choice, grid tile arrival, battle command including enemy response, inventory/equipment transaction, reward claim, settings change and job transition. Do not rely only on page close. Listen for visibility/page lifecycle as best-effort final flush; browsers can terminate without notice.

Persist stable dialogue node and cursor; don't advance text due to render side effects. Battles persist phase, round, turn queue/index, living/KO HP/MP, statuses and remaining durations, protection links, used steals/ring triggers, shared DP, enemies/AI cycle, RNG state, encounter/reward ID and prebattle retry snapshot. Rebuild actors from saved state. No serialization of tweens, DOM nodes or Phaser objects.

Process a whole logical action in memory, including damage, triggered effects, reward claim and turn advancement, then store a complete state. Save post-action/pre-animation so animation replay cannot duplicate damage. At enemy turn, resolve one complete action and persist before beginning another. On reload skip already-resolved animation. If the active action had not committed, restore prior action boundary. This is the exact-resume promise: committed decisions are retained, cosmetic frames need not be.

Storage adapter: two alternating localStorage envelopes `{schemaVersion, contentVersion, revision, checksum, payload}` with monotonic revisions. On boot validate both and choose highest valid revision; if newest invalid fall back and notify. Keep serializer/checksum deterministic; checksum is corruption detection, not anti-cheat security. Catch quota/security errors; keep game playable in memory with persistent “Progress is not saving” notice and JSON export. Local storage may be cleared/evicted. Explicit save export/import is required for backup and device transfer, with file-size cap, schema validation and confirmation before replacing current progress.

Version 1: accept matching schema/content. For unsupported future versions reject import safely; preserve existing save. If content version mismatches, do not silently reset; show export plus explicit New Game option until migration exists. New Game asks before replacing existing progress. Destructive reset belongs in settings, not near Resume. All user facing claims must match implemented storage behaviour.

Quest rewards, shop purchase, crafting, equip and upgrade are atomic within a complete state snapshot. `claimedRewards` keys are part of the snapshot, so double clicks/reload cannot duplicate rewards. Quest dependencies must be acyclic. Optional loot should not be required by main progression. No offline elapsed-time computation.

`data/save_example.json` is an illustrative initial logical payload, not a ready-to-import envelope. Runtime adds dialogue/battle fields only when active and creates real item-instance IDs. Use it to guide schema, not as a hardcoded live save. Content keys beginning `effect`, `appearance`, skill IDs and AI IDs must have implemented handlers, validated explicitly at boot.

## Debugging and performance
Development-only panel: jump to job, grant crafting materials, start boss, inspect state and simulate save failure. Exclude cheats from production. Stop idle render/animation work in background. Reuse texture assets; avoid recreating menus/sprites every update. Aim for responsive input and stable performance on a mid-range phone; report measurements only when actually measured.
