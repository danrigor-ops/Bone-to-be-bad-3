import { CONTENT } from './content';
import type { GameState } from './types';
import { SLOTS } from './types';
import { heroStats } from '../systems/stats';
import { MAPS } from '../data/maps';
import { DIALOGUE } from '../data/dialogue';

/** Returns a list of violated invariants (empty = OK). */
export function checkInvariants(s: GameState): string[] {
  const errs: string[] = [];
  if (!Number.isInteger(s.inventory.gold) || s.inventory.gold < 0) errs.push('gold negative or non-integer');
  for (const [k, v] of Object.entries(s.inventory.stacks)) {
    if (!Number.isInteger(v) || v < 0) errs.push(`stack ${k} invalid`);
    if (!CONTENT.items.has(k)) errs.push(`unknown stack item ${k}`);
  }
  const ids = new Set<string>();
  for (const inst of s.inventory.equipmentInstances) {
    if (ids.has(inst.instanceId)) errs.push(`duplicate instance ${inst.instanceId}`);
    ids.add(inst.instanceId);
    if (!CONTENT.items.has(inst.definitionId)) errs.push(`unknown equipment ${inst.definitionId}`);
    if (inst.rank < 0 || inst.rank > 3) errs.push(`rank out of range ${inst.instanceId}`);
  }
  const owners = new Map<string, string>();
  for (const p of s.party) {
    for (const slot of SLOTS) {
      const id = p.equipment[slot];
      if (!id) continue;
      if (!ids.has(id)) errs.push(`${p.characterId} equips missing ${id}`);
      if (owners.has(id)) errs.push(`instance ${id} has two owners`);
      owners.set(id, p.characterId);
    }
    if (!p.equipment.weapon) errs.push(`${p.characterId} has no weapon`);
    const st = heroStats(s, p.characterId);
    if (p.hp < 0 || p.hp > st.maxHp) errs.push(`${p.characterId} hp out of range`);
    if (p.mp < 0 || p.mp > st.maxMp) errs.push(`${p.characterId} mp out of range`);
  }
  if (new Set(s.claimedRewards).size !== s.claimedRewards.length) errs.push('duplicate claimed reward');
  if (!MAPS[s.location.id]) errs.push('unknown location');
  if (s.dialogue && !DIALOGUE[s.dialogue.nodeId]) errs.push('unknown dialogue node');
  if (s.battle) {
    const b = s.battle;
    if (b.dp < 0 || b.dp > 100) errs.push('dp out of range');
    for (const a of b.actors) if (a.hp < 0 || a.mp < 0 || a.hp > a.maxHp) errs.push(`actor ${a.id} out of range`);
  }
  return errs;
}
