import { CONTENT, item, itemName } from '../core/content';
import type { GameState, RecipeDef } from '../core/types';
import { count, removeItems } from './economy';
import { instance, ownerOf } from './stats';

export function recipeUnlocked(s: GameState, r: RecipeDef): boolean {
  return s.questState[r.unlockAfter]?.status === 'complete';
}

export function craftProblem(s: GameState, recipeId: string): string | null {
  const r = CONTENT.recipes.get(recipeId);
  if (!r) return 'Unknown recipe.';
  if (!s.flags.workshop_open) return 'The workshop is not open yet.';
  if (!recipeUnlocked(s, r)) return `Recipe unlocks after ${CONTENT.jobs.get(r.unlockAfter)?.name ?? r.unlockAfter}.`;
  if (s.battle) return 'Not during battle.';
  if (s.inventory.gold < r.gold) return `Not enough gold (need ${r.gold}, have ${s.inventory.gold}).`;
  for (const [k, v] of Object.entries(r.materials)) {
    if (count(s, k) < v) return `Not enough ${itemName(k)} (need ${v}, have ${count(s, k)}).`;
  }
  return null;
}

export function newInstanceId(s: GameState, defId: string): string {
  s.nextInstanceSeq += 1;
  return `${defId}_${String(s.nextInstanceSeq).padStart(4, '0')}`;
}

/** Atomic: validates, then subtracts all costs and creates one +0 instance. Mutates s. */
export function craft(s: GameState, recipeId: string): { ok: true; instanceId: string } | { ok: false; reason: string } {
  const problem = craftProblem(s, recipeId);
  if (problem) return { ok: false, reason: problem };
  const r = CONTENT.recipes.get(recipeId)!;
  s.inventory.gold -= r.gold;
  removeItems(s, r.materials);
  const instanceId = newInstanceId(s, r.outputItem);
  s.inventory.equipmentInstances.push({ instanceId, definitionId: r.outputItem, rank: 0 });
  return { ok: true, instanceId };
}

export function upgradeCost(rank: number) {
  return CONTENT.raw.upgradeCosts.find((u) => u.toRank === rank + 1) ?? null;
}

export function upgradeProblem(s: GameState, instanceId: string): string | null {
  const inst = instance(s, instanceId);
  if (!inst) return 'That item does not exist.';
  const def = item(inst.definitionId);
  if (!s.flags.workshop_open) return 'The workshop is not open yet.';
  if (s.battle) return 'Not during battle.';
  if (!def.upgradable) return `${def.name} cannot be upgraded in this prototype.`;
  if (inst.rank >= 3) return `${def.name} is already +3, the maximum.`;
  const cost = upgradeCost(inst.rank)!;
  if (s.inventory.gold < cost.gold) return `Not enough gold (need ${cost.gold}, have ${s.inventory.gold}).`;
  for (const [k, v] of Object.entries(cost.items)) {
    if (count(s, k) < v) return `Not enough ${itemName(k)} (need ${v}, have ${count(s, k)}).`;
  }
  return null;
}

/** Atomic: modifies the same instance (owner unchanged). */
export function upgrade(s: GameState, instanceId: string): { ok: true; rank: number } | { ok: false; reason: string } {
  const problem = upgradeProblem(s, instanceId);
  if (problem) return { ok: false, reason: problem };
  const inst = instance(s, instanceId)!;
  const cost = upgradeCost(inst.rank)!;
  s.inventory.gold -= cost.gold;
  removeItems(s, cost.items);
  inst.rank += 1;
  return { ok: true, rank: inst.rank };
}

/** Source hint for a material, honest about finite unique rewards. */
export function sourceHint(s: GameState, itemId: string): string {
  const def = item(itemId);
  const unique: Record<string, string> = {
    rusted_blade: 'job001', foreman_badge: 'job001', worn_cloth: 'job002', cracked_charm: 'job003',
  };
  if (unique[itemId]) {
    const job = unique[itemId];
    if (s.questState[job]?.status === 'complete') return 'Earned from job; no repeat source in this prototype.';
    return `Guaranteed reward from ${CONTENT.jobs.get(job)!.name}.`;
  }
  if (itemId === 'haunted_paperwork') {
    return s.questState.job002?.status === 'complete'
      ? 'Earned from jobs; no repeat source in this prototype.'
      : 'Guaranteed reward from jobs 001 and 002.';
  }
  if (itemId === 'bone_chip') return 'Repeat Salvage Run in the Mill Yard; job 001 reward.';
  if (itemId === 'scrap_iron') return 'Repeat Salvage Run, Mott’s Barrow, Grib’s Pilfer, job rewards.';
  return def.source ?? 'Unknown source.';
}

export function describeOwner(s: GameState, instanceId: string): string {
  const o = ownerOf(s, instanceId);
  return o ? `Equipped by ${o.hero === 'c404' ? '#404' : CONTENT.party.get(o.hero)!.name}` : 'Unequipped';
}
