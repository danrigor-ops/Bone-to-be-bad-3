# Combat, equipment and economy

All numbers are initial prototype tuning. Keep in data, not scattered in UI handlers.

## Battle rules
Side-view staged battles: party LEFT, enemies RIGHT (III prototype default). Four active heroes. HP/MP, no stamina. Dark Power (DP) shared, 0–100, starts at 0 each battle; no farming by guarding. Each round sorts living actors by descending speed, ties by stable entity ID. All actions are turn-based and await user input; no active-time meters. Show next actors and enemy intents. One command per actor. No criticals, misses or random damage in the first slice.

Physical damage = max(1, floor(attack × power − target.defence × 0.5)). Magical damage = max(1, floor(magic × power − target.defence × 0.25)). Apply equipment percentage bonuses then Guard reductions, flooring only at final damage. No elemental resistance system in v0.1. Healing clamps to max HP; MP and DP cannot be negative.

Normal Attack: physical power 1, gain 5 DP on a successful damaging action, once per action not per target. Guard: reduce incoming damage by 50% until the start of that actor's next turn. Items cost the user's turn. Inspect enemy is free. Preview cost/target; cancel before confirmation consumes nothing. Disable commands for KO members and invalid targets.

### Party skills
| Actor | Skill | Cost | Effect |
| --- | --- | --- | --- |
| #404 | Hex Mark | 4 MP | Magic 0.8 to one enemy, apply curse for 2 of target's turns |
| #404 | Bone Verdict | 6 MP | Magic 1.5; ×1.25 damage if target cursed |
| Grib | Cheap Shot | 3 MP | Physical 1.3; ×1.25 if target cursed |
| Grib | Pilfer | 2 MP | Physical 0.6 and once per enemy instance steal 1 scrap_iron; on repeat use display “Pockets empty” with no stolen item |
| Brugg | Stand Behind Me | 4 MP | Redirect all direct single-target damage aimed at one chosen other ally to Brugg, reduce redirected damage 35%; lasts until Brugg's next turn. Does not redirect area attacks or self damage |
| Brugg | Heavy Hand | 3 MP | Physical 1.4 |
| Hexa | Cinder Clause | 4 MP | Magic 1.2 to one enemy |
| Hexa | Patchwork | 4 MP | Heal one ally 24 HP; no revival |

Curse itself does no periodic damage. On application remainingTurns=2; decrement after the afflicted actor completes an action, not at round start. Reapply refreshes to max(current, new). Equipment extends application duration where specified. Intent-revealing is default; no special inspection grind.

### Synergies
All available in slice so the system is testable, with short banter rather than a bond grind. Two heroes must be alive, initiator currently taking their turn; partner need not have an unused turn and does not spend another action. No extra turn refunds.
- Fine Print (#404 + Hexa), 30 DP: magic power 1.6 using #404 magic against all enemies. Cursed targets receive ×1.25. Uses #404 turn, no MP cost or DP gain.
- Safe Hands (Brugg + Grib), 25 DP: physical power 2 using Grib attack to one enemy; Brugg gains Guard until his next turn. Uses Grib turn, no DP gain.
Relationship progression/other pairs are expansion features, not v0.1 requirements.

### Enemy behaviour
- Paper Wisp: cycles Paper Cut (physical 1) / Stamp (magic 1.2). Single target: living hero with lowest current HP, stable ID tie.
- Debt Collector: cycles Demand (physical 1.2 lowest-HP hero) / Seize (physical 1.5 same target rule).
- Rust Mite: physical 0.9 against highest-defence living hero each turn.
- Foreclosure Engine: round-independent per-own-turn cycle: (1) Audit: magic 0.8 to all; (2) Red Stamp: physical 1.4 to lowest-HP hero; (3) Repossession: magic 1.8 to all. Show next attack and highlight step 3 one full player decision ahead. No unavoidable opening burst, adds or hidden phase in slice. Curse and synergy work on boss.

All-enemy attacks hit each living enemy once, all-party attacks each living hero once. Dead targets are excluded. Finish all effects of one action, resolve deaths, check victory/defeat, then advance. At simultaneous wipe, party defeat. Award main encounter XP once, 5 per hero for normal encounters and 15 for boss. Shared XP threshold 30 for level 2, 70 for level 3; cap 3 in slice. Each level grants +5 max HP, +2 max MP, +1 attack/magic/defence; no speed increase. Increase current HP/MP by max increase without auto-reviving. Each hero receives full party encounter XP, not divided. These are III stats, not imported II levels.

## Crafting and loadouts
Five slots: weapon, head, body, accessory1, accessory2. NOT the monster-hunting game's five armour-part system. Only weapon/head/body affect visible art. Each item instance has unique ID, base definition ID, upgrade rank 0–3. Starter gear is +0. Accessories have no upgrades in v0.1. Duplicate accessories of same definition cannot be equipped simultaneously on one hero. Cannot equip one instance on two heroes. Equip only outside battle. Class restrictions on weapons; armour/accessories shared.

Craft creates one +0 instance and subtracts materials/gold in one atomic state transaction. Upgrade modifies the same instance and consumes costs; never creates a second item or resets its owner. Reject insufficient funds, missing recipe and +3 requests with a clear reason. Repeated clicks must not double-execute a transaction. No dismantling/selling in v0.1.

Upgrade cost per step: +0→+1 = 2 scrap_iron + 10 gold; +1→+2 = 4 scrap_iron + 20 gold; +2→+3 = 6 scrap_iron + 30 gold. Each rank adds +1 to the item's declared primary stat only (weapon attack or magic, head/body defence). Secondary stats/effects do not scale. Replacement items offer different tactics, not mandatory linear tiers.

Special effects in data:
- `curse_damage_20`: holder's damaging actions deal ×1.2 to cursed targets (stacks multiplicatively with skill bonus).
- `protect_self_20`: Brugg takes ×0.8 damage while his Stand Behind Me protection link is active, including redirected damage. A generic wearer without that skill receives no benefit; show this clearly.
- `curse_duration_plus_1`: curses applied by holder last one additional target turn.
- `fatal_once`: once per battle if incoming damage would KO a living holder, leave at 1 HP; apply Weakened for 2 of holder's turns, multiplying outgoing damage ×0.8. Per-instance trigger recorded in battle state. Revivals do not reset it. Multiple hits can still kill after the trigger.
- `mp_plus_4`: +4 max MP, clamp current on unequip (do not grant free refill on repeated equips).

Fatal ring is an optional recipe after job 003, not required to beat boss. It is the Questionable Warranty Ring, not a revive consumable. Body coat's -2 defence is intentional. Stat calculation: base level stats + equipped flat stats + rank primary bonuses, defence min 0. Protection multipliers and Guard multiply, minimum damage 1. Equipment appearance updates immediately in exploration, battle and equipment preview; portrait art can remain unchanged.

## Economy and sources
Data holds actual recipes, guaranteed rewards and consumables. Main jobs collectively provide enough materials for the thematic cleaver, helmet, coat and ring at +0 (if funds have not been spent elsewhere). Additional crafted starter alternatives use ordinary supplies. The player can finish with starter gear; workshop is introduced with a suggested upgrade, never a hard quest gate. All essential recipes unlock by jobs, not luck. Optional chest supplies extras. No ingredient expires.

Workshop displays owned/needed counts, owner eligibility, stat/effect comparison, preview, craft/upgrade confirmation and a pinned-recipe tracker. Source hints refer to jobs, shops or salvage that actually exist. If a unique ingredient has been consumed, show its source as “Earned from job; no repeat source in this prototype”, rather than directing the player to repeat a completed story job.
