// The single command reducer. Pure: takes a state and a command, returns the next complete state.
import { CONTENT } from './content';
import type { Command, GameEvent, GameState, HeroId, ReduceResult } from './types';
import { HERO_IDS } from './types';
import { checkInvariants } from './invariants';
import { DIALOGUE, ENCOUNTER_HOOKS, arrivalDialogue, fillTokens, routeInteraction, type Effect } from '../data/dialogue';
import { MAPS, SPAWN, exitAt, visibleObjects, walkable } from '../data/maps';
import { applyEnemyAction, applyPlayerAction, createBattle, restParty, writeBack } from '../systems/combat';
import { addItems, buyProblem, claimKey, price } from '../systems/economy';
import { craft, upgrade } from '../systems/crafting';
import { acceptJob, claimJob, completeObjective, objectiveText } from '../systems/quests';
import { equipProblem, heroStats, member, ownerOf } from '../systems/stats';

export const DEBUG_ENABLED: boolean = !!(import.meta as { env?: { DEV?: boolean } }).env?.DEV;

const clone = <T>(x: T): T => structuredClone(x);

function reject(s0: GameState, msg: string): ReduceResult {
  return { state: s0, events: [{ type: 'toast', text: msg }], error: msg };
}

function rememberTx(s: GameState, txId: string): boolean {
  if (s.recentTx.includes(txId)) return false;
  s.recentTx.push(txId);
  if (s.recentTx.length > 32) s.recentTx.splice(0, s.recentTx.length - 32);
  return true;
}

function startBattle(s: GameState, encounterId: string, ev: GameEvent[]): boolean {
  const enc = CONTENT.encounters.get(encounterId);
  if (!enc) return false;
  if (enc.rewardPolicy === 'once' && s.claimedRewards.includes(`encounter:${enc.id}`)) {
    ev.push({ type: 'toast', text: 'Already defeated.' });
    return false;
  }
  if (enc.rewardPolicy === 'explicit_run_id' && !s.salvageActive) return false;
  const runIndex = enc.rewardPolicy === 'explicit_run_id' ? s.salvageRunIndex + 1 : null;
  s.dialogue = null;
  s.battle = createBattle(s, encounterId, runIndex);
  ev.push({ type: 'battleStart' });
  return true;
}

function applyEffect(s: GameState, e: Effect, ev: GameEvent[]) {
  if ('objective' in e) {
    const [job, obj] = e.objective.split(':');
    completeObjective(s, job, obj);
  } else if ('accept' in e) {
    acceptJob(s, e.accept);
  } else if ('flag' in e) {
    // Branch flags are durable: never overwrite an already-chosen branch.
    if ((e.flag === 'labor_resolution' || e.flag === 'evidence_handling') && s.flags[e.flag]) return;
    s.flags[e.flag] = e.value;
  } else if ('battle' in e) {
    startBattle(s, e.battle, ev);
  } else if ('claim' in e) {
    const text = claimJob(s, e.claim);
    if (text) {
      ev.push({ type: 'reward', text });
      ev.push({ type: 'sfx', name: 'reward' });
    }
  } else if ('rest' in e) {
    restParty(s);
    ev.push({ type: 'sfx', name: 'heal' });
  } else if ('panel' in e) {
    ev.push({ type: 'openPanel', panel: e.panel });
    if (e.shop) s.flags.open_shop = e.shop;
  } else if ('startSalvage' in e) {
    if (s.flags.salvage_open && !s.salvageActive) {
      s.salvageActive = true;
      ev.push({ type: 'toast', text: 'A Rust Mite crawls out of the pile.' });
    }
  } else if ('chest' in e) {
    if (claimKey(s, `chest:${CONTENT.raw.optionalChest.id}`)) {
      addItems(s, CONTENT.raw.optionalChest.items);
      ev.push({ type: 'reward', text: '3× Scrap Iron, 1× Ghost Thread, 1× Bone Poultice' });
    }
  } else if ('summary' in e) {
    s.lastSummary = fillTokens(e.summary, s, objectiveText(s));
  } else if ('journal' in e) {
    s.journal.push(fillTokens(e.journal, s, objectiveText(s)));
  }
}

function finishNode(s: GameState, effects: Effect[] | undefined, next: string | undefined, ev: GameEvent[]) {
  for (const e of effects ?? []) applyEffect(s, e, ev);
  if (s.battle) {
    s.dialogue = null;
    return;
  }
  s.dialogue = next ? { nodeId: next, cursor: 0 } : null;
}

function travel(s: GameState, to: string, x: number, y: number, facing: GameState['location']['facing'], ev: GameEvent[]) {
  s.location = { id: to, tileX: x, tileY: y, facing };
  ev.push({ type: 'travel', to });
  const d = arrivalDialogue(s, to);
  if (d) s.dialogue = { nodeId: d, cursor: 0 };
}

function healthClamp(s: GameState, hero: HeroId) {
  const m = member(s, hero);
  const st = heroStats(s, hero);
  m.hp = Math.min(m.hp, st.maxHp);
  m.mp = Math.min(m.mp, st.maxMp);
}

export function reduce(s0: GameState, cmd: Command): ReduceResult {
  const s = clone(s0);
  const ev: GameEvent[] = [];
  const inBattle = !!s.battle;
  const inDialogue = !!s.dialogue;

  switch (cmd.type) {
    case 'move': {
      if (inBattle || inDialogue) return reject(s0, 'Busy.');
      const { tileX, tileY } = s.location;
      const dx = cmd.x - tileX, dy = cmd.y - tileY;
      if (Math.abs(dx) + Math.abs(dy) !== 1) return reject(s0, 'Can only move one tile.');
      s.location.facing = dx > 0 ? 'right' : dx < 0 ? 'left' : dy > 0 ? 'down' : 'up';
      const ex = exitAt(s.location.id, cmd.x, cmd.y);
      if (ex?.blocked) {
        const why = ex.blocked(s);
        if (why) {
          // Facing change still commits; report the blocked exit.
          ev.push({ type: 'toast', text: why });
          break;
        }
      }
      if (!walkable(s, s.location.id, cmd.x, cmd.y)) return reject(s0, 'Blocked.');
      if (ex) travel(s, ex.to, ex.tx, ex.ty, ex.facing, ev);
      else {
        s.location.tileX = cmd.x;
        s.location.tileY = cmd.y;
      }
      break;
    }
    case 'interact': {
      if (inBattle || inDialogue) return reject(s0, 'Busy.');
      const obj = visibleObjects(s, s.location.id).find((o) => o.id === cmd.objectId);
      if (!obj) return reject(s0, 'Nothing there.');
      const dx = obj.x - s.location.tileX, dy = obj.y - s.location.tileY;
      if (Math.abs(dx) + Math.abs(dy) !== 1) return reject(s0, 'Too far away.');
      s.location.facing = dx > 0 ? 'right' : dx < 0 ? 'left' : dy > 0 ? 'down' : 'up';
      const node = routeInteraction(s, obj.id);
      if (!node || !DIALOGUE[node]) return reject(s0, 'Nothing happens.');
      s.dialogue = { nodeId: node, cursor: 0 };
      break;
    }
    case 'dialogueAdvance': {
      if (!s.dialogue) return reject(s0, 'No dialogue.');
      const node = DIALOGUE[s.dialogue.nodeId];
      if (s.dialogue.cursor < node.lines.length - 1) {
        s.dialogue.cursor += 1;
        break;
      }
      if (node.choices?.length) return reject(s0, 'Choose an option.');
      finishNode(s, node.effects, node.next, ev);
      break;
    }
    case 'dialogueChoose': {
      if (!s.dialogue) return reject(s0, 'No dialogue.');
      const node = DIALOGUE[s.dialogue.nodeId];
      if (!node.choices || s.dialogue.cursor !== node.lines.length - 1) return reject(s0, 'No choice here.');
      const ch = node.choices[cmd.index];
      if (!ch) return reject(s0, 'Invalid choice.');
      for (const e of node.effects ?? []) applyEffect(s, e, ev);
      finishNode(s, ch.effects, ch.next, ev);
      break;
    }
    case 'battleAction': {
      if (!s.battle) return reject(s0, 'No battle.');
      const err = applyPlayerAction(s, cmd.action);
      if (err) return reject(s0, err);
      break;
    }
    case 'enemyAct': {
      const err = applyEnemyAction(s);
      if (err) return reject(s0, err);
      break;
    }
    case 'battleContinue': {
      const b = s.battle;
      if (!b || b.phase !== 'victory') return reject(s0, 'Battle not won.');
      s.rngState = b.rngState;
      s.battle = null;
      ev.push({ type: 'battleEnd' });
      const hook = ENCOUNTER_HOOKS[b.encounterId] ?? {};
      if (hook.objective) {
        const [job, obj] = hook.objective.split(':');
        completeObjective(s, job, obj);
      }
      if (hook.dialogue) s.dialogue = { nodeId: hook.dialogue, cursor: 0 };
      if (b.encounterId === 'yard_enforcers') s.lastSummary = 'You drove off the enforcers. Decide how the dispute is settled.';
      if (b.encounterId === 'cellar_entry') s.lastSummary = 'The cellar entry is clear. The archive lies south.';
      break;
    }
    case 'battleRetry': {
      const b = s.battle;
      if (!b || b.phase !== 'defeat') return reject(s0, 'Retry is only available after defeat.');
      s.party = clone(b.retry.party);
      s.inventory.stacks = clone(b.retry.stacks);
      s.rngState = b.retry.rngState;
      const enc = b.encounterId, run = b.runIndex;
      s.battle = createBattle(s, enc, run);
      s.battle.returnTo = b.returnTo;
      ev.push({ type: 'battleStart' });
      break;
    }
    case 'battleReturnBureau': {
      const b = s.battle;
      if (!b || b.phase !== 'defeat') return reject(s0, 'Only after defeat.');
      s.party = clone(b.retry.party);
      s.inventory.stacks = clone(b.retry.stacks);
      s.rngState = b.retry.rngState;
      s.battle = null;
      restParty(s);
      s.location = { ...SPAWN };
      s.lastSummary = 'You regrouped at the Bureau after a defeat. Nothing earned was lost.';
      ev.push({ type: 'battleEnd' }, { type: 'travel', to: 'bureau' });
      break;
    }
    case 'battleEscape': {
      const b = s.battle;
      if (!b || b.phase !== 'player') return reject(s0, 'You can only leave on a hero’s turn.');
      s.rngState = b.rngState;
      if (b.isBoss) {
        writeBack(s);
        s.battle = null;
        restParty(s);
        s.location = { ...SPAWN };
        s.lastSummary = 'You withdrew from the Foreclosure Engine. It is still waiting in the archive.';
        ev.push({ type: 'battleEnd' }, { type: 'travel', to: 'bureau' });
      } else {
        writeBack(s);
        s.battle = null;
        s.location = { ...b.returnTo };
        ev.push({ type: 'battleEnd' }, { type: 'toast', text: 'You withdrew. No rewards.' });
      }
      break;
    }
    case 'buy': {
      if (inBattle) return reject(s0, 'Not during battle.');
      const shop = String(s.flags.open_shop ?? 'mott');
      const p = buyProblem(s, shop, cmd.itemId, cmd.qty);
      if (p) return reject(s0, p);
      if (!rememberTx(s, cmd.txId)) return reject(s0, 'Already processed.');
      s.inventory.gold -= price(s, shop, cmd.itemId) * cmd.qty;
      addItems(s, { [cmd.itemId]: cmd.qty });
      ev.push({ type: 'sfx', name: 'coin' });
      break;
    }
    case 'craft': {
      if (!rememberTx(s, cmd.txId)) return reject(s0, 'Already processed.');
      const r = craft(s, cmd.recipeId);
      if (!r.ok) return reject(s0, r.reason);
      ev.push({ type: 'sfx', name: 'craft' }, { type: 'toast', text: `Crafted ${CONTENT.items.get(CONTENT.recipes.get(cmd.recipeId)!.outputItem)!.name} +0.` });
      break;
    }
    case 'upgrade': {
      if (!rememberTx(s, cmd.txId)) return reject(s0, 'Already processed.');
      const r = upgrade(s, cmd.instanceId);
      if (!r.ok) return reject(s0, r.reason);
      for (const p of s.party) healthClamp(s, p.characterId);
      ev.push({ type: 'sfx', name: 'craft' }, { type: 'toast', text: `Upgraded to +${r.rank}.` });
      break;
    }
    case 'equip': {
      if (!HERO_IDS.includes(cmd.heroId)) return reject(s0, 'Unknown hero.');
      const p = equipProblem(s, cmd.heroId, cmd.slot, cmd.instanceId);
      if (p) return reject(s0, p);
      const m = member(s, cmd.heroId);
      if (cmd.instanceId) {
        const owner = ownerOf(s, cmd.instanceId);
        if (owner && owner.hero !== cmd.heroId) {
          return reject(s0, `Unequip it from ${owner.hero === 'c404' ? '#404' : CONTENT.party.get(owner.hero)!.name} first.`);
        }
        if (owner && owner.hero === cmd.heroId) m.equipment[owner.slot] = null;
      }
      m.equipment[cmd.slot] = cmd.instanceId;
      healthClamp(s, cmd.heroId);
      break;
    }
    case 'settings': {
      const allowed = ['music', 'sfx', 'reducedMotion', 'instantText', 'theme'] as const;
      for (const k of Object.keys(cmd.patch)) if (!allowed.includes(k as never)) return reject(s0, 'Bad setting.');
      if (cmd.patch.theme && !['classic_bone', 'bureau_brass'].includes(cmd.patch.theme)) return reject(s0, 'Bad theme.');
      s.settings = { ...s.settings, ...cmd.patch };
      break;
    }
    case 'pinRecipe': {
      if (cmd.recipeId && !CONTENT.recipes.has(cmd.recipeId)) return reject(s0, 'Unknown recipe.');
      s.pinnedRecipe = cmd.recipeId;
      break;
    }
    case 'rest': {
      if (inBattle) return reject(s0, 'Not during battle.');
      if (s.location.id !== 'bureau') return reject(s0, 'Rest at the Bureau bench.');
      restParty(s);
      break;
    }
    case 'debug': {
      if (!DEBUG_ENABLED) return reject(s0, 'Debug tools are not available in production builds.');
      const err = debugOp(s, cmd.op, cmd.arg, ev);
      if (err) return reject(s0, err);
      break;
    }
    default:
      return reject(s0, 'Unknown command.');
  }

  const problems = checkInvariants(s);
  if (problems.length) return reject(s0, `Rejected (invariant): ${problems[0]}`);
  s.revision = s0.revision + 1;
  return { state: s, events: ev };
}

function debugOp(s: GameState, op: string, arg: string | undefined, ev: GameEvent[]): string | null {
  switch (op) {
    case 'grant': {
      addItems(s, { scrap_iron: 20, bone_chip: 10, ghost_thread: 10, slime_resin: 10, haunted_paperwork: 4, rusted_blade: 1, foreman_badge: 1, worn_cloth: 1, cracked_charm: 1 });
      s.inventory.gold += 300;
      return null;
    }
    case 'jump': {
      // Mark all jobs before `arg` complete via their real claim path.
      const order = ['job001', 'job002', 'job003'];
      const target = order.indexOf(arg ?? '');
      if (target < 0) return 'Unknown job.';
      for (let i = 0; i < target; i++) {
        const j = order[i];
        const def = CONTENT.jobs.get(j)!;
        if (s.questState[j].status === 'complete') continue;
        s.questState[j].status = 'active';
        s.questState[j].done = def.objectives.filter((o) => o !== 'report_bureau');
        if (def.choiceFlag && !s.flags[def.choiceFlag]) s.flags[def.choiceFlag] = def.choices[0];
        for (const e of def.encounters) claimKey(s, `encounter:${e}`);
        claimJob(s, j);
      }
      s.dialogue = null;
      ev.push({ type: 'toast', text: `Debug: jumped to ${arg}.` });
      return null;
    }
    case 'boss': {
      s.dialogue = null;
      s.battle = createBattle(s, 'foreclosure_boss', null);
      ev.push({ type: 'battleStart' });
      return null;
    }
    case 'heal':
      restParty(s);
      return null;
    case 'teleport': {
      if (!arg || !MAPS[arg]) return 'Unknown map.';
      const ex = MAPS[arg].exits[0];
      const back = MAPS[ex.to].exits.find((e) => e.to === arg)!;
      s.location = { id: arg, tileX: back.tx, tileY: back.ty, facing: 'down' };
      ev.push({ type: 'travel', to: arg });
      return null;
    }
  }
  return 'Unknown debug op.';
}
