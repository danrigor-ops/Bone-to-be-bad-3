// Deterministic turn-based combat. All functions operate on plain serializable data.
import { CONTENT } from '../core/content';
import { pickIndex } from '../core/rng';
import type { BattleAction, BattleActor, BattleEventRecord, BattleState, GameState, HeroId } from '../core/types';
import { HERO_IDS } from '../core/types';
import {
  AI_CYCLES, DP_MAX, DP_PER_DAMAGING_ACTION, GUARD_MULT, PROTECT_REDIRECT_MULT, SKILLS, SYNERGIES,
  type EnemyMove,
} from '../data/skills';
import { addItems, claimKey, count, removeItems } from './economy';
import { computeStats, heroEffects, heroStats, levelForXp, member, shortName } from './stats';

const ENEMY_TAUNTS = [
  'adjusts its paperwork menacingly.',
  'rustles with procedural intent.',
  'consults a clause.',
  'clears its throat in triplicate.',
];

export function byId(b: BattleState, id: string): BattleActor {
  const a = b.actors.find((x) => x.id === id);
  if (!a) throw new Error(`No actor ${id}`);
  return a;
}
export const alive = (a: BattleActor) => a.hp > 0;
export const livingHeroes = (b: BattleState) => b.actors.filter((a) => a.side === 'hero' && alive(a));
export const livingEnemies = (b: BattleState) => b.actors.filter((a) => a.side === 'enemy' && alive(a));
const stableCmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function createBattle(s: GameState, encounterId: string, runIndex: number | null): BattleState {
  const enc = CONTENT.encounters.get(encounterId)!;
  const actors: BattleActor[] = [];
  for (const hid of HERO_IDS) {
    const m = member(s, hid);
    const st = heroStats(s, hid);
    const fx = heroEffects(s, hid);
    actors.push({
      id: hid, side: 'hero', defId: hid, name: shortName(hid),
      hp: Math.min(m.hp, st.maxHp), maxHp: st.maxHp, mp: Math.min(m.mp, st.maxMp), maxMp: st.maxMp,
      attack: st.attack, magic: st.magic, defence: st.defence, speed: st.speed,
      effects: fx.effects, fatalInstance: fx.fatalInstance,
      statuses: { curse: 0, weakened: 0, guard: false }, aiStep: 0,
    });
  }
  const totals: Record<string, number> = {};
  for (const e of enc.enemies) totals[e] = (totals[e] ?? 0) + 1;
  const seen: Record<string, number> = {};
  enc.enemies.forEach((eid, i) => {
    const def = CONTENT.enemies.get(eid)!;
    seen[eid] = (seen[eid] ?? 0) + 1;
    const suffix = totals[eid] > 1 ? ` ${String.fromCharCode(64 + seen[eid])}` : '';
    actors.push({
      id: `enemy_${i}`, side: 'enemy', defId: eid, name: def.name + suffix,
      hp: def.hp, maxHp: def.hp, mp: 0, maxMp: 0, attack: def.attack, magic: def.magic,
      defence: def.defence, speed: def.speed, effects: [], fatalInstance: null,
      statuses: { curse: 0, weakened: 0, guard: false }, aiStep: 0,
    });
  });
  const b: BattleState = {
    encounterId, runIndex, phase: 'player', round: 0, queue: [], turnIndex: 0, actors, dp: 0,
    protectLink: null, pilfered: [], fatalUsed: [], log: [], seq: 0, lastAction: null,
    rngState: s.rngState,
    retry: { party: structuredClone(s.party), stacks: structuredClone(s.inventory.stacks), rngState: s.rngState },
    returnTo: { ...s.location }, isBoss: encounterId === 'foreclosure_boss',
  };
  startRound(b);
  return b;
}

function startRound(b: BattleState) {
  b.round += 1;
  b.queue = b.actors
    .filter(alive)
    .sort((x, y) => (y.speed - x.speed) || stableCmp(x.id, y.id))
    .map((a) => a.id);
  b.turnIndex = 0;
  beginTurn(b);
}

function beginTurn(b: BattleState) {
  const a = byId(b, b.queue[b.turnIndex]);
  // Guard lasts until the start of that actor's next turn.
  a.statuses.guard = false;
  if (b.protectLink && b.protectLink.guardian === a.id) b.protectLink = null;
  b.phase = a.side === 'hero' ? 'player' : 'enemy';
}

function advance(b: BattleState) {
  b.turnIndex += 1;
  while (b.turnIndex < b.queue.length && !alive(byId(b, b.queue[b.turnIndex]))) b.turnIndex += 1;
  if (b.turnIndex >= b.queue.length) startRound(b);
  else beginTurn(b);
}

export function currentActor(b: BattleState): BattleActor {
  return byId(b, b.queue[b.turnIndex]);
}

/** Upcoming actor ids: rest of this round, then projected next round. */
export function turnPreview(b: BattleState, n = 6): string[] {
  const rest = b.queue.slice(b.turnIndex).filter((id) => alive(byId(b, id)));
  const next = b.actors.filter(alive).sort((x, y) => (y.speed - x.speed) || stableCmp(x.id, y.id)).map((a) => a.id);
  return [...rest, ...next].slice(0, n);
}

export function enemyMove(a: BattleActor, offset = 0): EnemyMove {
  const def = CONTENT.enemies.get(a.defId)!;
  const cyc = AI_CYCLES[def.ai];
  return cyc[(a.aiStep + offset) % cyc.length];
}

function pickTargets(b: BattleState, move: EnemyMove): BattleActor[] {
  const heroes = livingHeroes(b);
  if (!heroes.length) return [];
  if (move.target === 'all') return heroes;
  const sorted = [...heroes].sort((x, y) =>
    move.target === 'lowest_hp' ? (x.hp - y.hp) || stableCmp(x.id, y.id) : (y.defence - x.defence) || stableCmp(x.id, y.id),
  );
  return [sorted[0]];
}

export function intentTarget(b: BattleState, enemy: BattleActor): string {
  const move = enemyMove(enemy);
  if (move.target === 'all') return 'whole party';
  const t = pickTargets(b, move)[0];
  return t ? t.name : '—';
}

interface DamageOpts {
  kind: 'physical' | 'magical';
  power: number;
  single: boolean;
  cursedBonus?: number;
  statFrom?: BattleActor; // for synergies that use a specific hero's stat
}

/** Applies damage, returns the actual target id and amount. */
function dealDamage(b: BattleState, attacker: BattleActor, target: BattleActor, o: DamageOpts) {
  let victim = target;
  let mult = 1;
  // Redirect via Stand Behind Me (single-target direct damage only).
  const link = b.protectLink;
  if (o.single && link && link.ward === target.id && attacker.side === 'enemy') {
    const g = byId(b, link.guardian);
    if (alive(g) && g.id !== target.id) {
      victim = g;
      mult *= PROTECT_REDIRECT_MULT;
    }
  }
  const src = o.statFrom ?? attacker;
  const raw = o.kind === 'physical'
    ? src.attack * o.power - victim.defence * 0.5
    : src.magic * o.power - victim.defence * 0.25;
  const cursed = target.statuses.curse > 0;
  if (o.cursedBonus && cursed) mult *= o.cursedBonus;
  if (attacker.effects.includes('curse_damage_20') && cursed) mult *= 1.2;
  if (attacker.statuses.weakened > 0) mult *= 0.8;
  // Equipment percentage bonuses above, then Guard / protection reductions.
  if (victim.statuses.guard) mult *= GUARD_MULT;
  if (link && link.guardian === victim.id && victim.effects.includes('protect_self_20')) mult *= 0.8;
  const amount = Math.max(1, Math.floor(raw * mult));
  if (amount >= victim.hp && victim.fatalInstance && !b.fatalUsed.includes(victim.fatalInstance) && victim.hp > 0) {
    b.fatalUsed.push(victim.fatalInstance);
    const taken = victim.hp - 1;
    victim.hp = 1;
    victim.statuses.weakened = 2;
    b.log.push(`${victim.name}'s Questionable Warranty Ring honours one claim! (1 HP, Weakened)`);
    return { target: victim.id, amount: taken };
  }
  victim.hp = Math.max(0, victim.hp - amount);
  return { target: victim.id, amount };
}

export function actionProblem(s: GameState, action: BattleAction): string | null {
  const b = s.battle;
  if (!b) return 'No battle.';
  if (b.phase !== 'player') return 'Not a player turn.';
  const actor = currentActor(b);
  if (actor.side !== 'hero' || !alive(actor)) return 'No hero can act.';
  const isLivingEnemy = (id?: string) => !!id && b.actors.some((a) => a.id === id && a.side === 'enemy' && alive(a));
  const isLivingHero = (id?: string) => !!id && b.actors.some((a) => a.id === id && a.side === 'hero' && alive(a));
  switch (action.kind) {
    case 'attack':
      return isLivingEnemy(action.target) ? null : 'Choose a living enemy.';
    case 'guard':
      return null;
    case 'skill': {
      const sk = SKILLS[action.skillId];
      if (!sk || sk.owner !== actor.id) return 'Unknown skill.';
      if (actor.mp < sk.mp) return `Not enough MP (${sk.mp} needed).`;
      if (sk.target === 'enemy' && !isLivingEnemy(action.target)) return 'Choose a living enemy.';
      if (sk.target === 'ally' && !isLivingHero(action.target)) return 'Choose a living ally.';
      if (sk.target === 'other_ally' && (!isLivingHero(action.target) || action.target === actor.id)) return 'Choose another living ally.';
      return null;
    }
    case 'item': {
      const def = CONTENT.items.get(action.itemId);
      if (!def || def.kind !== 'consumable') return 'Not a usable item.';
      if (count(s, action.itemId) < 1) return 'None left.';
      if (!isLivingHero(action.target)) return 'Choose a living ally.';
      return null;
    }
    case 'synergy': {
      const sy = SYNERGIES[action.synergyId];
      if (!sy || sy.initiator !== actor.id) return 'Unknown synergy.';
      if (!alive(byId(b, sy.partner))) return `${shortName(sy.partner)} is KO.`;
      if (b.dp < sy.dp) return `Needs ${sy.dp} DP.`;
      if (sy.target === 'enemy' && !isLivingEnemy(action.target)) return 'Choose a living enemy.';
      return null;
    }
  }
  return 'Unknown action.';
}

function gainDp(b: BattleState) {
  b.dp = Math.min(DP_MAX, b.dp + DP_PER_DAMAGING_ACTION);
}

function curseDuration(actor: BattleActor, base: number) {
  return base + (actor.effects.includes('curse_duration_plus_1') ? 1 : 0);
}

/** Apply a validated player action and advance. Mutates s (a draft). */
export function applyPlayerAction(s: GameState, action: BattleAction): string | null {
  const problem = actionProblem(s, action);
  if (problem) return problem;
  const b = s.battle!;
  const actor = currentActor(b);
  const rec: BattleEventRecord = { seq: b.seq + 1, actor: actor.id, label: '', hits: [] };
  switch (action.kind) {
    case 'attack': {
      const t = byId(b, action.target);
      rec.label = 'Attack';
      rec.hits.push({ ...dealDamage(b, actor, t, { kind: 'physical', power: 1, single: true }), kind: 'damage' });
      gainDp(b);
      break;
    }
    case 'guard':
      actor.statuses.guard = true;
      rec.label = 'Guard';
      break;
    case 'skill': {
      const sk = SKILLS[action.skillId];
      actor.mp -= sk.mp;
      rec.label = sk.name;
      if (sk.kind === 'physical' || sk.kind === 'magical') {
        const t = byId(b, action.target!);
        rec.hits.push({ ...dealDamage(b, actor, t, { kind: sk.kind, power: sk.power, single: true, cursedBonus: sk.cursedBonus }), kind: 'damage' });
        gainDp(b);
        if (sk.appliesCurse && alive(t)) {
          t.statuses.curse = Math.max(t.statuses.curse, curseDuration(actor, sk.appliesCurse));
          b.log.push(`${t.name} is cursed (${t.statuses.curse} turns).`);
        }
        if (sk.steal) {
          if (!b.pilfered.includes(t.id)) {
            b.pilfered.push(t.id);
            addItems(s, { [sk.steal.item]: sk.steal.qty });
            b.log.push(`Grib pilfers 1 Scrap Iron from ${t.name}.`);
          } else {
            b.log.push('Pockets empty.');
          }
        }
      } else if (sk.kind === 'heal') {
        const t = byId(b, action.target!);
        const before = t.hp;
        t.hp = Math.min(t.maxHp, t.hp + (sk.heal ?? 0));
        rec.hits.push({ target: t.id, amount: t.hp - before, kind: 'heal' });
      } else if (sk.kind === 'protect') {
        b.protectLink = { guardian: actor.id, ward: action.target! };
        b.log.push(`Brugg stands in front of ${byId(b, action.target!).name}.`);
      }
      break;
    }
    case 'item': {
      const def = CONTENT.items.get(action.itemId)!;
      const rule = CONTENT.raw.consumableRules[def.effect!];
      removeItems(s, { [action.itemId]: 1 });
      const t = byId(b, action.target);
      rec.label = def.name;
      if (rule.restoreHp) {
        const before = t.hp;
        t.hp = Math.min(t.maxHp, t.hp + rule.restoreHp);
        rec.hits.push({ target: t.id, amount: t.hp - before, kind: 'heal' });
      }
      if (rule.restoreMp) {
        const before = t.mp;
        t.mp = Math.min(t.maxMp, t.mp + rule.restoreMp);
        rec.hits.push({ target: t.id, amount: t.mp - before, kind: 'mp' });
      }
      break;
    }
    case 'synergy': {
      const sy = SYNERGIES[action.synergyId];
      b.dp -= sy.dp;
      rec.label = sy.name;
      b.log.push(sy.banter);
      const src = actor; // initiator's stat (Fine Print: #404 magic, Safe Hands: Grib attack)
      const targets = sy.target === 'all_enemies' ? livingEnemies(b) : [byId(b, action.target!)];
      for (const t of targets) {
        rec.hits.push({ ...dealDamage(b, actor, t, { kind: sy.kind, power: sy.power, single: sy.target === 'enemy', cursedBonus: sy.cursedBonus, statFrom: src }), kind: 'damage' });
      }
      if (sy.partnerGuard) {
        byId(b, sy.partner).statuses.guard = true;
        b.log.push('Brugg braces (Guard).');
      }
      break;
    }
  }
  finishAction(s, actor, rec);
  return null;
}

function describe(rec: BattleEventRecord, b: BattleState): string {
  const who = byId(b, rec.actor).name;
  if (!rec.hits.length) return `${who}: ${rec.label}.`;
  const parts = rec.hits.map((h) => {
    const t = byId(b, h.target).name;
    if (h.kind === 'damage') return `${t} −${h.amount}${byId(b, h.target).hp === 0 ? ' (KO)' : ''}`;
    if (h.kind === 'heal') return `${t} +${h.amount} HP`;
    return `${t} +${h.amount} MP`;
  });
  return `${who}: ${rec.label} — ${parts.join(', ')}`;
}

function finishAction(s: GameState, actor: BattleActor, rec: BattleEventRecord) {
  const b = s.battle!;
  // Statuses tick after the afflicted actor completes an action.
  if (actor.statuses.curse > 0) actor.statuses.curse -= 1;
  if (actor.statuses.weakened > 0) actor.statuses.weakened -= 1;
  b.seq += 1;
  b.lastAction = rec;
  b.log.push(describe(rec, b));
  if (b.log.length > 30) b.log.splice(0, b.log.length - 30);
  // Resolve outcome: party wipe takes precedence (simultaneous wipe = defeat).
  if (!livingHeroes(b).length) {
    b.phase = 'defeat';
    return;
  }
  if (!livingEnemies(b).length) {
    victory(s);
    return;
  }
  advance(b);
}

export function applyEnemyAction(s: GameState): string | null {
  const b = s.battle;
  if (!b || b.phase !== 'enemy') return 'Not an enemy turn.';
  const actor = currentActor(b);
  const move = enemyMove(actor);
  const rec: BattleEventRecord = { seq: b.seq + 1, actor: actor.id, label: move.name, hits: [] };
  const targets = pickTargets(b, move);
  for (const t of targets) {
    rec.hits.push({ ...dealDamage(b, actor, t, { kind: move.kind, power: move.power, single: move.target !== 'all' }), kind: 'damage' });
  }
  actor.aiStep += 1;
  const r = pickIndex(b.rngState, ENEMY_TAUNTS.length);
  b.rngState = r.state;
  if (move.target === 'all') b.log.push(`${actor.name} ${ENEMY_TAUNTS[r.index]}`);
  finishAction(s, actor, rec);
  return null;
}

export interface VictorySummary {
  xp: number;
  levelUps: string[];
  loot: string;
}

function victory(s: GameState) {
  const b = s.battle!;
  b.phase = 'victory';
  const enc = CONTENT.encounters.get(b.encounterId)!;
  // KO members revive to 1 HP.
  for (const a of b.actors) if (a.side === 'hero' && a.hp <= 0) a.hp = 1;
  const levelUps: string[] = [];
  let xp = 0;
  let loot = '';
  const key = enc.rewardPolicy === 'once' ? `encounter:${enc.id}` : `salvage:${b.runIndex}`;
  const firstClaim = claimKey(s, key);
  if (firstClaim) {
    xp = enc.xpPerHero;
    if (enc.rewardPolicy === 'explicit_run_id') {
      addItems(s, CONTENT.raw.salvageReward.items);
      s.inventory.gold += CONTENT.raw.salvageReward.gold;
      s.salvageRunIndex = b.runIndex ?? s.salvageRunIndex;
      s.salvageActive = false;
      loot = '2× Scrap Iron, 1× Bone Chip';
    }
  }
  for (const a of b.actors) {
    if (a.side !== 'hero') continue;
    const m = member(s, a.id as HeroId);
    m.hp = a.hp;
    m.mp = a.mp;
    if (xp > 0) {
      const oldLevel = m.level;
      m.xp += xp;
      const newLevel = levelForXp(m.xp);
      if (newLevel > oldLevel) {
        const before = computeStats(oldLevel, m.characterId, []);
        const after = computeStats(newLevel, m.characterId, []);
        m.level = newLevel;
        m.hp += after.maxHp - before.maxHp;
        m.mp += after.maxMp - before.maxMp;
        levelUps.push(`${a.name} reached level ${newLevel}!`);
      }
    }
  }
  b.log.push(`Victory!${xp ? ` +${xp} XP each.` : ''}${loot ? ` Salvage: ${loot}.` : ''}`);
  for (const l of levelUps) b.log.push(l);
}

/** Write back battle HP/MP to the party (KO → 1 HP). Used by escape. */
export function writeBack(s: GameState) {
  const b = s.battle!;
  for (const a of b.actors) {
    if (a.side !== 'hero') continue;
    const m = member(s, a.id as HeroId);
    m.hp = Math.max(1, a.hp);
    m.mp = a.mp;
  }
}

export function restParty(s: GameState) {
  for (const m of s.party) {
    const st = heroStats(s, m.characterId);
    m.hp = st.maxHp;
    m.mp = st.maxMp;
  }
}
