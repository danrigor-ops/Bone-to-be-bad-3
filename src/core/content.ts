import raw from '../data/content.json';
import type { Content, ItemDef, JobDef, EncounterDef, EnemyDef, RecipeDef, PartyDef } from './types';
import {
  IMPLEMENTED_AI, IMPLEMENTED_APPEARANCES, IMPLEMENTED_CONSUMABLE_EFFECTS,
  IMPLEMENTED_EFFECTS, IMPLEMENTED_UNLOCKS,
} from './registry';
import { SKILLS, AI_CYCLES } from '../data/skills';

export interface ContentIndex {
  raw: Content;
  items: Map<string, ItemDef>;
  jobs: Map<string, JobDef>;
  encounters: Map<string, EncounterDef>;
  enemies: Map<string, EnemyDef>;
  recipes: Map<string, RecipeDef>;
  party: Map<string, PartyDef>;
}

function indexBy<T extends { id: string }>(list: T[], label: string, errors: string[]): Map<string, T> {
  const m = new Map<string, T>();
  for (const x of list) {
    if (m.has(x.id)) errors.push(`Duplicate ${label} id: ${x.id}`);
    m.set(x.id, x);
  }
  return m;
}

/** Validate structure, references and handler coverage. Returns a list of problems (empty = valid). */
export function validateContent(c: Content): string[] {
  const errors: string[] = [];
  const items = indexBy(c.items, 'item', errors);
  const jobs = indexBy(c.jobs, 'job', errors);
  const encounters = indexBy(c.encounters, 'encounter', errors);
  const enemies = indexBy(c.enemies, 'enemy', errors);
  indexBy(c.recipes, 'recipe', errors);
  indexBy(c.party, 'party', errors);
  const effects = new Set<string>(IMPLEMENTED_EFFECTS);
  const consumable = new Set<string>(IMPLEMENTED_CONSUMABLE_EFFECTS);
  const appearances = new Set<string>(IMPLEMENTED_APPEARANCES);
  const ais = new Set<string>(IMPLEMENTED_AI);
  const unlocks = new Set<string>(IMPLEMENTED_UNLOCKS);
  const itemRef = (id: string, where: string) => { if (!items.has(id)) errors.push(`${where}: unknown item ${id}`); };
  const qtyOk = (rec: Record<string, number>, where: string) => {
    for (const [k, v] of Object.entries(rec)) {
      itemRef(k, where);
      if (!Number.isInteger(v) || v <= 0) errors.push(`${where}: bad quantity for ${k}`);
    }
  };

  for (const it of c.items) {
    if (it.kind === 'consumable') {
      if (!it.effect || !consumable.has(it.effect)) errors.push(`item ${it.id}: unimplemented consumable effect ${it.effect}`);
      else if (!c.consumableRules[it.effect]) errors.push(`item ${it.id}: no consumableRules for ${it.effect}`);
    }
    if (it.kind === 'equipment') {
      if (!it.slot) errors.push(`item ${it.id}: missing slot`);
      for (const e of it.effects ?? []) if (!effects.has(e)) errors.push(`item ${it.id}: unimplemented effect ${e}`);
      if (it.appearance != null && !appearances.has(it.appearance)) errors.push(`item ${it.id}: unimplemented appearance ${it.appearance}`);
      if ((it.slot === 'weapon' || it.slot === 'head' || it.slot === 'body') && !it.appearance) errors.push(`item ${it.id}: visible slot needs appearance`);
      if (it.upgradable && !it.primaryStat) errors.push(`item ${it.id}: upgradable without primaryStat`);
      for (const who of it.eligible ?? []) if (who !== 'all' && !c.party.some((p) => p.id === who)) errors.push(`item ${it.id}: unknown eligible ${who}`);
    }
  }
  for (const p of c.party) {
    itemRef(p.starterWeapon, `party ${p.id}`);
    for (const s of p.skills) {
      const sk = SKILLS[s];
      if (!sk) errors.push(`party ${p.id}: unimplemented skill ${s}`);
      else if (sk.owner !== p.id) errors.push(`skill ${s}: owner mismatch`);
    }
  }
  for (const r of c.recipes) {
    itemRef(r.outputItem, `recipe ${r.id}`);
    qtyOk(r.materials, `recipe ${r.id}`);
    if (!jobs.has(r.unlockAfter)) errors.push(`recipe ${r.id}: unknown unlockAfter ${r.unlockAfter}`);
    if (r.quantity !== 1) errors.push(`recipe ${r.id}: quantity must be 1 in v0.1`);
  }
  for (const j of c.jobs) {
    for (const r of j.requires) if (!jobs.has(r)) errors.push(`job ${j.id}: unknown requirement ${r}`);
    for (const e of j.encounters) if (!encounters.has(e)) errors.push(`job ${j.id}: unknown encounter ${e}`);
    for (const u of j.unlocks) if (!unlocks.has(u)) errors.push(`job ${j.id}: unimplemented unlock ${u}`);
    qtyOk(j.reward.items, `job ${j.id} reward`);
    if (j.choiceFlag && j.choices.length !== 2) errors.push(`job ${j.id}: expected two choices`);
  }
  // acyclic job graph
  const visiting = new Set<string>();
  const done = new Set<string>();
  const visit = (id: string): boolean => {
    if (done.has(id)) return true;
    if (visiting.has(id)) return false;
    visiting.add(id);
    for (const r of jobs.get(id)?.requires ?? []) if (!visit(r)) return false;
    visiting.delete(id);
    done.add(id);
    return true;
  };
  for (const j of c.jobs) if (!visit(j.id)) errors.push(`job graph has a cycle at ${j.id}`);

  for (const e of c.enemies) {
    if (!ais.has(e.ai) || !AI_CYCLES[e.ai]) errors.push(`enemy ${e.id}: unimplemented ai ${e.ai}`);
  }
  for (const en of c.encounters) {
    for (const e of en.enemies) if (!enemies.has(e)) errors.push(`encounter ${en.id}: unknown enemy ${e}`);
    if (!c.locations.includes(en.location)) errors.push(`encounter ${en.id}: unknown location ${en.location}`);
  }
  qtyOk(c.initialItems, 'initialItems');
  qtyOk(c.salvageReward.items, 'salvageReward');
  qtyOk(c.optionalChest.items, 'optionalChest');
  for (const k of Object.keys(c.shopBasePrices)) itemRef(k, 'shopBasePrices');
  const ranks = c.upgradeCosts.map((u) => u.toRank).join(',');
  if (ranks !== '1,2,3') errors.push(`upgradeCosts must cover ranks 1,2,3 (got ${ranks})`);
  for (const u of c.upgradeCosts) qtyOk(u.items, `upgradeCost ${u.toRank}`);
  return errors;
}

export function buildIndex(c: Content): ContentIndex {
  const errs: string[] = [];
  return {
    raw: c,
    items: indexBy(c.items, 'item', errs),
    jobs: indexBy(c.jobs, 'job', errs),
    encounters: indexBy(c.encounters, 'encounter', errs),
    enemies: indexBy(c.enemies, 'enemy', errs),
    recipes: indexBy(c.recipes, 'recipe', errs),
    party: indexBy(c.party, 'party', errs),
  };
}

export const CONTENT_RAW = raw as unknown as Content;
export const CONTENT: ContentIndex = buildIndex(CONTENT_RAW);

export function item(id: string): ItemDef {
  const it = CONTENT.items.get(id);
  if (!it) throw new Error(`Unknown item ${id}`);
  return it;
}
export function itemName(id: string): string {
  return CONTENT.items.get(id)?.name ?? KEY_ITEM_NAMES[id] ?? id;
}
export const KEY_ITEM_NAMES: Record<string, string> = {
  cellar_key: 'Cellar Key',
  correspondence: 'Brokered Correspondence',
};
