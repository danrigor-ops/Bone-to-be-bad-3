import { CONTENT, item } from '../core/content';
import type { GameState, HeroId, ItemDef, PartyMember, Slot, Stats, EquipmentInstance } from '../core/types';
import { SLOTS } from '../core/types';
import { LEVEL_GAINS, XP_THRESHOLDS, LEVEL_CAP } from '../data/skills';

export function member(s: GameState, id: HeroId): PartyMember {
  const m = s.party.find((p) => p.characterId === id);
  if (!m) throw new Error(`No party member ${id}`);
  return m;
}

export function instance(s: GameState, instanceId: string): EquipmentInstance | undefined {
  return s.inventory.equipmentInstances.find((i) => i.instanceId === instanceId);
}

export function ownerOf(s: GameState, instanceId: string): { hero: HeroId; slot: Slot } | null {
  for (const p of s.party) {
    for (const slot of SLOTS) if (p.equipment[slot] === instanceId) return { hero: p.characterId, slot };
  }
  return null;
}

export function equippedDefs(s: GameState, hero: HeroId): { inst: EquipmentInstance; def: ItemDef; slot: Slot }[] {
  const m = member(s, hero);
  const out: { inst: EquipmentInstance; def: ItemDef; slot: Slot }[] = [];
  for (const slot of SLOTS) {
    const id = m.equipment[slot];
    if (!id) continue;
    const inst = instance(s, id);
    if (!inst) continue;
    out.push({ inst, def: item(inst.definitionId), slot });
  }
  return out;
}

/** Base level stats + equipped flat stats + rank primary bonuses; defence min 0. */
export function computeStats(level: number, hero: HeroId, gear: { def: ItemDef; rank: number }[]): Stats {
  const base = CONTENT.party.get(hero)!.baseStats;
  const lv = level - 1;
  const st: Stats = {
    maxHp: base.maxHp + LEVEL_GAINS.maxHp * lv,
    maxMp: base.maxMp + LEVEL_GAINS.maxMp * lv,
    attack: base.attack + LEVEL_GAINS.attack * lv,
    magic: base.magic + LEVEL_GAINS.magic * lv,
    defence: base.defence + LEVEL_GAINS.defence * lv,
    speed: base.speed,
  };
  for (const g of gear) {
    for (const [k, v] of Object.entries(g.def.stats ?? {})) st[k as 'attack'] += v ?? 0;
    if (g.def.primaryStat && g.rank > 0) st[g.def.primaryStat] += g.rank;
    if (g.def.effects?.includes('mp_plus_4')) st.maxMp += 4;
  }
  st.defence = Math.max(0, st.defence);
  return st;
}

export function heroStats(s: GameState, hero: HeroId): Stats {
  const m = member(s, hero);
  return computeStats(m.level, hero, equippedDefs(s, hero).map((g) => ({ def: g.def, rank: g.inst.rank })));
}

export function heroEffects(s: GameState, hero: HeroId): { effects: string[]; fatalInstance: string | null } {
  const effects: string[] = [];
  let fatalInstance: string | null = null;
  for (const g of equippedDefs(s, hero)) {
    for (const e of g.def.effects ?? []) {
      effects.push(e);
      if (e === 'fatal_once' && !fatalInstance) fatalInstance = g.inst.instanceId;
    }
  }
  return { effects, fatalInstance };
}

export function heroName(id: string): string {
  return CONTENT.party.get(id)?.name ?? id;
}

export function shortName(id: string): string {
  return id === 'c404' ? '#404' : heroName(id);
}

export function levelForXp(xp: number): number {
  let lv = 1;
  for (let i = 0; i < XP_THRESHOLDS.length; i++) if (xp >= XP_THRESHOLDS[i]) lv = i + 1;
  return Math.min(LEVEL_CAP, lv);
}

export function slotAccepts(slot: Slot, def: ItemDef): boolean {
  if (def.kind !== 'equipment') return false;
  if (slot === 'accessory1' || slot === 'accessory2') return def.slot === 'accessory';
  return def.slot === slot;
}

export function eligible(def: ItemDef, hero: HeroId): boolean {
  const e = def.eligible ?? [];
  return e.includes('all') || e.includes(hero);
}

/** Returns a reason string if the equip is invalid, else null. Does not mutate. */
export function equipProblem(s: GameState, hero: HeroId, slot: Slot, instanceId: string | null): string | null {
  if (s.battle) return 'Equipment can only be changed outside battle.';
  if (instanceId === null) {
    if (slot === 'weapon') return 'Every hero needs a weapon equipped.';
    return null;
  }
  const inst = instance(s, instanceId);
  if (!inst) return 'That item does not exist.';
  const def = item(inst.definitionId);
  if (!slotAccepts(slot, def)) return `${def.name} does not fit the ${slot} slot.`;
  if (!eligible(def, hero)) return `${heroName(hero)} cannot use ${def.name}.`;
  if (slot === 'accessory1' || slot === 'accessory2') {
    const other = slot === 'accessory1' ? 'accessory2' : 'accessory1';
    const otherId = member(s, hero).equipment[other];
    const otherInst = otherId ? instance(s, otherId) : undefined;
    if (otherInst && otherInst.definitionId === def.id && otherInst.instanceId !== instanceId) {
      return `${heroName(hero)} already wears a ${def.name}.`;
    }
  }
  return null;
}
