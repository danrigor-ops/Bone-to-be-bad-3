import { reduce } from '../src/core/reducer';
import type { BattleAction, Command, GameState } from '../src/core/types';
import { MAPS, visibleObjects } from '../src/data/maps';
import { findPath, pathToAdjacent } from '../src/systems/pathfinding';
import { currentActor, enemyMove, livingEnemies, livingHeroes, byId } from '../src/systems/combat';
import { SKILLS, SYNERGIES } from '../src/data/skills';
import { DIALOGUE } from '../src/data/dialogue';

export function play(s: GameState, cmd: Command): GameState {
  const r = reduce(s, cmd);
  if (r.error) throw new Error(`Command ${JSON.stringify(cmd)} rejected: ${r.error}`);
  return r.state;
}

export function tryPlay(s: GameState, cmd: Command) {
  return reduce(s, cmd);
}

export function walkPath(s: GameState, path: { x: number; y: number }[]): GameState {
  for (const p of path) s = play(s, { type: 'move', x: p.x, y: p.y });
  return s;
}

/** Travel to a map by walking through exits (BFS over map graph). */
export function goTo(s: GameState, mapId: string): GameState {
  let guard = 0;
  while (s.location.id !== mapId) {
    if (guard++ > 10) throw new Error(`Cannot reach ${mapId}`);
    // map graph BFS
    const prev = new Map<string, string>();
    const q = [s.location.id];
    prev.set(s.location.id, '');
    while (q.length) {
      const m = q.shift()!;
      for (const e of MAPS[m].exits) if (!prev.has(e.to)) { prev.set(e.to, m); q.push(e.to); }
    }
    let step = mapId;
    while (prev.get(step) !== s.location.id) step = prev.get(step)!;
    const exits = MAPS[s.location.id].exits.filter((e) => e.to === step);
    let moved = false;
    for (const ex of exits) {
      const path = findPath(s, { x: s.location.tileX, y: s.location.tileY }, { x: ex.x, y: ex.y });
      if (path) { s = walkPath(s, path); moved = true; break; }
    }
    if (!moved) throw new Error(`No path to exit toward ${step} from ${s.location.id}`);
    s = finishDialogue(s);
  }
  return s;
}

export function interact(s: GameState, objectId: string): GameState {
  const obj = visibleObjects(s, s.location.id).find((o) => o.id === objectId);
  if (!obj) throw new Error(`Object ${objectId} not visible on ${s.location.id}`);
  const path = pathToAdjacent(s, { x: s.location.tileX, y: s.location.tileY }, obj);
  if (!path) throw new Error(`No path to ${objectId}`);
  s = walkPath(s, path);
  return play(s, { type: 'interact', objectId });
}

/** Advance dialogue; choose option `choice` at each choice node (by label substring or index 0). */
export function finishDialogue(s: GameState, choices: (string | number)[] = []): GameState {
  let n = 0;
  while (s.dialogue && n++ < 200) {
    const node = DIALOGUE[s.dialogue.nodeId];
    if (s.dialogue.cursor < node.lines.length - 1 || !node.choices) {
      s = play(s, { type: 'dialogueAdvance' });
    } else {
      const want = choices.length ? choices.shift()! : 0;
      const idx = typeof want === 'number' ? want : node.choices.findIndex((c) => c.label.includes(want));
      if (idx < 0) throw new Error(`No choice ${want} in ${node.id}`);
      s = play(s, { type: 'dialogueChoose', index: idx });
    }
  }
  return s;
}

/** A sensible scripted strategy using only starter mechanics. */
export function chooseAction(s: GameState): BattleAction {
  const b = s.battle!;
  const a = currentActor(b);
  const enemies = livingEnemies(b).sort((x, y) => x.hp - y.hp || (x.id < y.id ? -1 : 1));
  const heroes = livingHeroes(b);
  const weakest = [...heroes].sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp)[0];
  const bigHitComing = livingEnemies(b).some((e) => enemyMove(e).name === 'Repossession');
  const target = enemies[0].id;
  if (a.id === 'hexa' && weakest.hp / weakest.maxHp < 0.5 && a.mp >= 4) return { kind: 'skill', skillId: 'patchwork', target: weakest.id };
  if (weakest.hp / weakest.maxHp < 0.3 && (s.inventory.stacks.poultice ?? 0) > 0) return { kind: 'item', itemId: 'poultice', target: weakest.id };
  if (bigHitComing && a.id !== 'c404' && a.hp < 40) return { kind: 'guard' };
  for (const sy of Object.values(SYNERGIES)) {
    if (sy.initiator === a.id && b.dp >= sy.dp && byId(b, sy.partner).hp > 0) return { kind: 'synergy', synergyId: sy.id, target };
  }
  const pref: Record<string, string> = { c404: enemies[0].statuses.curse > 0 ? 'bone_verdict' : 'hex_mark', grib: 'cheap_shot', brugg: 'heavy_hand', hexa: 'cinder_clause' };
  const sk = SKILLS[pref[a.id]];
  if (sk && a.mp >= sk.mp) return { kind: 'skill', skillId: sk.id, target };
  return { kind: 'attack', target };
}

export function fightToEnd(s: GameState, strategy = chooseAction, maxSteps = 400): GameState {
  let n = 0;
  while (s.battle && (s.battle.phase === 'player' || s.battle.phase === 'enemy') && n++ < maxSteps) {
    s = s.battle.phase === 'enemy' ? play(s, { type: 'enemyAct' }) : play(s, { type: 'battleAction', action: strategy(s) });
  }
  return s;
}
