# Vertical slice: The Dead Refuse to Work

## Spaces and NPCs
- Bureau: desk/job board, rest bench, workshop run by rivet-smith Marn. One screen-sized interior; workshop opens after job 001.
- Dregswell: short walkable village with mayor Pell, skeleton foreman Ribbs and a shuttered stall that changes after job 001.
- Mill Yard: sacks, labour signs, a damaged winch and visible enforcer patrol. Accessible from village; no random battles.
- Ledger Cellar: three small connected rooms (entry/store/archive) under the mill. One optional chest, two encounters and a boss. No procedural generation.

Use original low-resolution tile art, blocking obstacles, exits that work from all approach directions, and unobstructed return routes. NPCs have explicit interaction targets. A contextual tap or keyboard confirm starts interactions; merely passing nearby does not open dialogue repeatedly.

## Opening: 2–3 minutes
Cold open in the Bureau, rent notice on desk. Hexa explains the first job. Show controls through a single movement hint and one interaction prompt. Player may inspect the workshop before it opens.

Hexa: “Our first client has described this as a minor labour disagreement.”
#404: “Excellent. Nothing terrible has ever followed those words.”
Grib: “Did they pay the consultation fee?”
Brugg: “Maybe we should hear them first.”

## Job 001 — The Dead Refuse to Work (5–10 minute target)
1. Accept at Bureau; visit mayor Pell in village.
2. Talk to Ribbs in Mill Yard. Learn workers have had no scheduled rest for decades.
3. Inspect wage ledger beside winch. Forged debt deductions suggest the shortage is engineered. Inspection is mandatory before choosing; avoid uninformed irreversible choices.
4. Fight one Debt Collector plus one Paper Wisp. They enforce a forged order; combat does not require attacking the workers.
5. Choose resolution in a clearly labelled two-option dialogue, with benefits/costs previewed:
   - Rest Charter: shorter shifts and a worker-run salvage counter. Set `labor_resolution=charter`; village salvage material prices 20% lower. Mayor's supply stall remains closed. Show benches and workers resting.
   - Village Compact: village pays a settlement and hires relief workers. Set `labor_resolution=compact`; village healing consumables cost 20% less. Salvage counter stays closed. Show relief worker and reopened supply stall. Workers still gain scheduled rest.
6. Return to Bureau; receive guaranteed reward once, unlock workshop and next job, play short party exchange. No branch awards exclusive mandatory materials.

Both branches support workers' rest; the meaningful tradeoff is local service and funding, not an obviously malicious joke choice. The village shop interface must reflect the real stock/discount for the selected branch.

## Job 002 — A Receipt for Disaster (5–10 minutes)
1. Accept after job 001. Follow duplicate invoices: inspect village noticeboard, talk to Ribbs, inspect mill delivery crate.
2. Fight the Invoice Swarm (two Paper Wisps). Obtain a guaranteed cellar key, reward and recipe unlocks at Bureau.
3. Branch: disclose forged invoices publicly (`evidence_handling=public`) or retain copies to trace the sender (`evidence_handling=trace`). Preview outcomes. Public adds an angry crowd conversation in village; trace adds a sealed correspondence prop at Bureau. Both lead to the cellar, with different boss-introduction dialogue. No invisible stat bonus.

## Job 003 — Terms and Conditions Apply (10–15 minutes)
1. Accept after job 002; cellar opens with key flag (not a consumable that can be lost).
2. Entry: clear a mandatory Debt Collector encounter; store: optional Rust Mite with a chest; archive: boss.
3. Find correspondence showing someone paid to manufacture the dispute. Quest item is granted before boss trigger and cannot be sold.
4. Boss Foreclosure Engine cycles a visible three-step pattern described in combat spec. Win, choose a short closing response (flavour only, labelled no mechanical effect), return to Bureau, claim reward.
5. Recap shows resolution, evidence choice, new equipment recipes and an unresolved seal. The village retains changes. Rest/free exploration and repeatable salvage remain available.

## Support loops
- Rest at Bureau restores HP/MP without cost. Battle victory revives KO members to 1 HP; no unattended time-based recovery.
- Defeat: Retry battle restores its starting snapshot; Return to Bureau clears current battle and restores party. No loss of quest items, materials or previously claimed rewards.
- Leave job: return to village/Bureau, retain completed objective flags. Escaping normal battles returns to last safe tile without rewards; boss exit via pause returns to Bureau with boss still undefeated.
- Repeatable Salvage Run unlocks after job 001: fight one Rust Mite in Mill Yard, gain 2 scrap_iron + 1 bone_chip; no gold/XP. Explicit “Repeat salvage” interaction respawns it; walking through the area does not. Supports crafting experimentation without unlimited economy/XP exploits.
- Shop: full-price poultice 10 gold, ether 15; scrap_iron 5, ghost_thread 8, slime_resin 8. Charter discount applies to materials, compact to consumables; floor discounted integer prices, minimum 1. No selling in v0.1. No real currency.

## Reward safety
Each main job uses `job_id:completion` as unique claim key. Victory rewards use stable encounter IDs and a claim record. Optional chest opens once. Repeat salvage uses an explicit increasing run index, committed with its reward. Reloading at any stage must not duplicate gold/items or erase the chosen branch.
