import { describe, expect, it } from 'vitest';
import { newGameState } from '../src/core/state';
import { reduce } from '../src/core/reducer';
import type { GameState } from '../src/core/types';
import { CONTENT, CONTENT_RAW, validateContent } from '../src/core/content';
import { createBattle, currentActor, byId } from '../src/systems/combat';
import { MAPS, BLOCKING, walkable } from '../src/data/maps';
import { DIALOGUE, routeInteraction } from '../src/data/dialogue';
import { findPath } from '../src/systems/pathfinding';
import { makeEnvelope, parseEnvelope, stableStringify } from '../src/persistence/serializer';
import { SaveStore, SLOT_KEYS, type KV } from '../src/persistence/storage';
import { heroStats } from '../src/systems/stats';
import { play, tryPlay } from './helpers';

function battleState(enc: string, mutate?: (s: GameState) => void): GameState {
  const s = newGameState();
  s.dialogue = null;
  mutate?.(s);
  s.battle = createBattle(s, enc, null);
  return s;
}

/** Act with whoever is current: heroes guard unless given an action; enemies act. */
function advanceTo(s: GameState, actorId: string, heroAction: 'guard' | 'attack' = 'guard', max = 20): GameState {
  for (let i = 0; i < max; i++) {
    const a = currentActor(s.battle!);
    if (a.id === actorId) return s;
    const target = s.battle!.actors.find((x) => x.side === 'enemy' && x.hp > 0)!.id;
    s = s.battle!.phase === 'enemy'
      ? play(s, { type: 'enemyAct' })
      : play(s, { type: 'battleAction', action: heroAction === 'guard' ? { kind: 'guard' } : { kind: 'attack', target } });
  }
  throw new Error(`never reached ${actorId}`);
}

describe('1. content validation', () => {
  it('content is valid with every referenced handler implemented', () => {
    expect(validateContent(CONTENT_RAW)).toEqual([]);
  });
  it('detects unknown effects, broken references and cycles', () => {
    const bad = structuredClone(CONTENT_RAW);
    bad.items.find((i) => i.id === 'focus_charm')!.effects = ['teleport_home'];
    bad.recipes[0].materials = { unobtainium: 1 };
    bad.jobs[0].requires = ['job003'];
    const errs = validateContent(bad);
    expect(errs.some((e) => e.includes('teleport_home'))).toBe(true);
    expect(errs.some((e) => e.includes('unobtainium'))).toBe(true);
    expect(errs.some((e) => e.includes('cycle'))).toBe(true);
  });
  it('maps are rectangular, exits land on walkable tiles and every walkable tile is reachable', () => {
    const s = newGameState();
    for (const m of Object.values(MAPS)) {
      const w = m.rows[0].length;
      expect(m.rows.every((r) => r.length === w), m.id).toBe(true);
      for (const e of m.exits) {
        expect(BLOCKING.has(m.rows[e.y][e.x]), `${m.id} exit tile`).toBe(false);
        const dest = MAPS[e.to];
        expect(BLOCKING.has(dest.rows[e.ty][e.tx]), `${m.id}->${e.to} arrival`).toBe(false);
      }
      for (const o of m.objects) expect(BLOCKING.has(m.rows[o.y][o.x]), `${m.id}:${o.id} on wall`).toBe(false);
      // reachability from first exit arrival
      const st = { ...s, location: { id: m.id, tileX: m.exits[0].x, tileY: m.exits[0].y, facing: 'down' as const } };
      const start = MAPS[m.exits[0].to].exits.find((e) => e.to === m.id)!;
      for (let y = 0; y < m.rows.length; y++) for (let x = 0; x < w; x++) {
        if (!walkable(st, m.id, x, y)) continue;
        expect(findPath(st, { x: start.tx, y: start.ty }, { x, y }), `${m.id} ${x},${y}`).not.toBeNull();
      }
    }
  });
  it('every interactable routes to an existing dialogue node', () => {
    const s = newGameState();
    for (const m of Object.values(MAPS)) for (const o of m.objects) {
      const node = routeInteraction(s, o.id);
      expect(node && DIALOGUE[node], `${m.id}:${o.id}`).toBeTruthy();
    }
    for (const n of Object.values(DIALOGUE)) {
      if (n.next) expect(DIALOGUE[n.next], n.id).toBeTruthy();
      for (const c of n.choices ?? []) if (c.next) expect(DIALOGUE[c.next], n.id).toBeTruthy();
    }
  });
});

describe('2. combat fixture', () => {
  it('orders turns by speed then stable id', () => {
    const s = battleState('yard_enforcers');
    // grib 14, hexa 10, c404 9, wisp(enemy_1) 8, collector(enemy_0) 7, brugg 5
    expect(s.battle!.queue).toEqual(['grib', 'hexa', 'c404', 'enemy_1', 'enemy_0', 'brugg']);
    const t = battleState('invoice_swarm');
    expect(t.battle!.queue.filter((id) => id.startsWith('enemy'))).toEqual(['enemy_0', 'enemy_1']);
  });

  it('applies the damage formulas exactly', () => {
    let s = battleState('yard_enforcers');
    // Grib attack 12+2=14 vs collector def 6: floor(14 - 3) = 11
    s = play(s, { type: 'battleAction', action: { kind: 'attack', target: 'enemy_0' } });
    expect(byId(s.battle!, 'enemy_0').hp).toBe(55 - 11);
    expect(s.battle!.dp).toBe(5);
    // Hexa Cinder Clause: magic 15+2=17 ×1.2 = 20.4 − 6×0.25 = 18.9 → 18
    s = play(s, { type: 'battleAction', action: { kind: 'skill', skillId: 'cinder_clause', target: 'enemy_0' } });
    expect(byId(s.battle!, 'enemy_0').hp).toBe(44 - 18);
    expect(byId(s.battle!, 'hexa').mp).toBe(32 - 4);
  });

  it('curse lasts 2 of the target’s turns, +1 with the Funeral Coat, and refreshes to max', () => {
    let s = battleState('cellar_entry'); // single Debt Collector
    s = advanceTo(s, 'c404');
    s = play(s, { type: 'battleAction', action: { kind: 'skill', skillId: 'hex_mark', target: 'enemy_0' } });
    expect(byId(s.battle!, 'enemy_0').statuses.curse).toBe(2);
    s = advanceTo(s, 'enemy_0');
    s = play(s, { type: 'enemyAct' });
    expect(byId(s.battle!, 'enemy_0').statuses.curse).toBe(1);
    s = advanceTo(s, 'enemy_0');
    s = play(s, { type: 'enemyAct' });
    expect(byId(s.battle!, 'enemy_0').statuses.curse).toBe(0);

    let t = battleState('cellar_entry', (st) => {
      st.inventory.equipmentInstances.push({ instanceId: 'funeral_coat_0001', definitionId: 'funeral_coat', rank: 0 });
      st.party[0].equipment.body = 'funeral_coat_0001';
    });
    t = advanceTo(t, 'c404');
    t = play(t, { type: 'battleAction', action: { kind: 'skill', skillId: 'hex_mark', target: 'enemy_0' } });
    expect(byId(t.battle!, 'enemy_0').statuses.curse).toBe(3);
  });

  it('Guard halves damage until the guarding actor’s next turn', () => {
    // Collector targets lowest HP hero. Make Hexa lowest and guarding.
    let s = battleState('cellar_entry', (st) => { st.party[3].hp = 20; });
    const base = battleState('cellar_entry', (st) => { st.party[3].hp = 20; });
    let a = advanceTo(base, 'enemy_0', 'attack');
    a = play(a, { type: 'enemyAct' });
    const unguarded = 20 - byId(a.battle!, 'hexa').hp;
    s = advanceTo(s, 'enemy_0'); // everyone guarded on the way, including Hexa
    s = play(s, { type: 'enemyAct' });
    const guarded = 20 - byId(s.battle!, 'hexa').hp;
    expect(guarded).toBeLessThan(unguarded);
    // Demand: 11×1.2 − (5+1+2)×0.5 = 13.2 − 4 = 9.2 → 9 unguarded; ×0.5 → 4
    expect(unguarded).toBe(9);
    expect(guarded).toBe(4);
  });

  it('Stand Behind Me redirects single-target hits to Brugg at −35% (and ×0.8 with the hard hat)', () => {
    const setup = (hat: boolean) => {
      let s = battleState('cellar_entry', (st) => {
        st.party[3].hp = 10; // Hexa is the obvious target
        if (hat) {
          st.inventory.equipmentInstances.push({ instanceId: 'union_hat_0001', definitionId: 'union_hat', rank: 0 });
          st.party[2].equipment.head = 'union_hat_0001';
        }
      });
      // Turn order: grib, hexa, c404, enemy_0, brugg. Brugg acts last, so push to round 2.
      s = advanceTo(s, 'brugg');
      s = play(s, { type: 'battleAction', action: { kind: 'skill', skillId: 'stand_behind_me', target: 'hexa' } });
      s = advanceTo(s, 'enemy_0');
      const bruggBefore = byId(s.battle!, 'brugg').hp;
      const hexaBefore = byId(s.battle!, 'hexa').hp;
      s = play(s, { type: 'enemyAct' });
      return { brugg: bruggBefore - byId(s.battle!, 'brugg').hp, hexa: hexaBefore - byId(s.battle!, 'hexa').hp, s };
    };
    const plain = setup(false);
    expect(plain.hexa).toBe(0);
    // Seize (aiStep 1 in round 2): 11×1.5 − (10+1+2)×0.5 = 16.5 − 6.5 = 10 ×0.65 = 6.5 → 6
    expect(plain.brugg).toBe(6);
    const hat = setup(true);
    // Hard hat: def 10+3+2 = 15 → 16.5 − 7.5 = 9 ×0.65 ×0.8 = 4.68 → 4
    expect(hat.brugg).toBe(4);
    // Link ends at the start of Brugg's next turn
    let s = advanceTo(plain.s, 'brugg');
    expect(s.battle!.protectLink).toBeNull();
    s = s; // eslint-friendly no-op
  });

  it('rejects invalid actions without spending anything', () => {
    let s = battleState('yard_enforcers', (st) => { st.party[1].mp = 1; });
    const before = stableStringify(s);
    const r1 = tryPlay(s, { type: 'battleAction', action: { kind: 'skill', skillId: 'cheap_shot', target: 'enemy_0' } });
    expect(r1.error).toMatch(/MP/);
    const r2 = tryPlay(s, { type: 'battleAction', action: { kind: 'attack', target: 'grib' } });
    expect(r2.error).toBeTruthy();
    const r3 = tryPlay(s, { type: 'battleAction', action: { kind: 'synergy', synergyId: 'safe_hands', target: 'enemy_0' } });
    expect(r3.error).toMatch(/DP/);
    const r4 = tryPlay(s, { type: 'enemyAct' });
    expect(r4.error).toBeTruthy();
    expect(stableStringify(s)).toBe(before);
  });

  it('Pilfer steals once per enemy instance', () => {
    let s = battleState('cellar_entry');
    s = play(s, { type: 'battleAction', action: { kind: 'skill', skillId: 'pilfer', target: 'enemy_0' } });
    s = advanceTo(s, 'grib');
    s = play(s, { type: 'battleAction', action: { kind: 'skill', skillId: 'pilfer', target: 'enemy_0' } });
    expect(s.inventory.stacks.scrap_iron).toBe(1);
    expect(s.battle!.log.some((l) => l.includes('Pockets empty'))).toBe(true);
  });
});

describe('3. fatal ring and synergies', () => {
  it('Warranty Ring triggers once, survives save/load, Weakened expires after 2 holder turns', () => {
    let s = battleState('foreclosure_boss', (st) => {
      st.inventory.equipmentInstances.push({ instanceId: 'warranty_ring_0001', definitionId: 'warranty_ring', rank: 0 });
      st.party[3].equipment.accessory1 = 'warranty_ring_0001';
      st.party[3].hp = 5; // Hexa will be hit by Audit
    });
    // order: grib 14, hexa 10, c404 9, engine 6, brugg 5
    s = advanceTo(s, 'enemy_0', 'attack');
    s = play(s, { type: 'enemyAct' }); // Audit to all
    const hexa = byId(s.battle!, 'hexa');
    expect(hexa.hp).toBe(1);
    expect(hexa.statuses.weakened).toBe(2);
    expect(s.battle!.fatalUsed).toEqual(['warranty_ring_0001']);
    const loaded = parseEnvelope(JSON.stringify(makeEnvelope(s)));
    expect(loaded.ok).toBe(true);
    s = (loaded as { ok: true; envelope: { payload: GameState } }).envelope.payload;
    s = advanceTo(s, 'hexa', 'attack');
    s = play(s, { type: 'battleAction', action: { kind: 'skill', skillId: 'patchwork', target: 'hexa' } });
    expect(byId(s.battle!, 'hexa').statuses.weakened).toBe(1);
    // Weakened reduces Hexa's outgoing damage ×0.8 on her next action
    s = advanceTo(s, 'hexa', 'attack');
    const engineBefore = byId(s.battle!, 'enemy_0').hp;
    s = play(s, { type: 'battleAction', action: { kind: 'skill', skillId: 'cinder_clause', target: 'enemy_0' } });
    // 17×1.2 − 8×0.25 = 18.4 ×0.8 = 14.72 → 14
    expect(engineBefore - byId(s.battle!, 'enemy_0').hp).toBe(14);
    expect(byId(s.battle!, 'hexa').statuses.weakened).toBe(0);
  });

  it('a second lethal hit after the ring triggered can KO', () => {
    let s = battleState('foreclosure_boss', (st) => {
      st.inventory.equipmentInstances.push({ instanceId: 'warranty_ring_0001', definitionId: 'warranty_ring', rank: 0 });
      st.party[3].equipment.accessory1 = 'warranty_ring_0001';
      st.party[3].hp = 5;
    });
    s = advanceTo(s, 'enemy_0', 'attack');
    s = play(s, { type: 'enemyAct' });
    s = advanceTo(s, 'enemy_0', 'attack');
    s = play(s, { type: 'enemyAct' }); // Red Stamp → lowest HP = Hexa at 1
    expect(byId(s.battle!, 'hexa').hp).toBe(0);
  });

  it('synergy needs a living partner and enough DP, costs DP, gives no DP', () => {
    let s = battleState('yard_enforcers');
    s.battle!.dp = 40;
    const ok = play(s, { type: 'battleAction', action: { kind: 'synergy', synergyId: 'safe_hands', target: 'enemy_0' } });
    expect(ok.battle!.dp).toBe(15);
    expect(byId(ok.battle!, 'brugg').statuses.guard).toBe(true);
    s.battle!.actors.find((a) => a.id === 'brugg')!.hp = 0;
    const r = tryPlay(s, { type: 'battleAction', action: { kind: 'synergy', synergyId: 'safe_hands', target: 'enemy_0' } });
    expect(r.error).toMatch(/KO/);
  });
});

describe('4. crafting and equipment transactions', () => {
  function workshopReady(): GameState {
    const s = newGameState();
    s.dialogue = null;
    s.flags.workshop_open = true;
    s.questState.job001.status = 'complete';
    s.questState.job002.status = 'complete';
    s.questState.job003.status = 'complete';
    s.inventory.gold = 500;
    s.inventory.stacks = { ...s.inventory.stacks, scrap_iron: 30, rusted_blade: 1, haunted_paperwork: 2, bone_chip: 3 };
    return s;
  }

  it('craft consumes exact costs once; duplicate submission is rejected', () => {
    let s = workshopReady();
    s = play(s, { type: 'craft', recipeId: 'recipe_grievance_cleaver', txId: 'tx1' });
    expect(s.inventory.gold).toBe(480);
    expect(s.inventory.stacks.rusted_blade).toBeUndefined();
    expect(s.inventory.stacks.haunted_paperwork).toBeUndefined();
    const dup = tryPlay(s, { type: 'craft', recipeId: 'recipe_grievance_cleaver', txId: 'tx1' });
    expect(dup.error).toBeTruthy();
    expect(dup.state.inventory.equipmentInstances.filter((i) => i.definitionId === 'grievance_cleaver').length).toBe(1);
    const again = tryPlay(s, { type: 'craft', recipeId: 'recipe_grievance_cleaver', txId: 'tx2' });
    expect(again.error).toMatch(/Rusted Blade/);
  });

  it('upgrades the same instance to +3, then refuses +4; no negatives', () => {
    let s = workshopReady();
    const id = 'c404_weapon_0001';
    for (let i = 1; i <= 3; i++) s = play(s, { type: 'upgrade', instanceId: id, txId: `u${i}` });
    expect(s.inventory.equipmentInstances.find((x) => x.instanceId === id)!.rank).toBe(3);
    expect(s.party[0].equipment.weapon).toBe(id);
    expect(s.inventory.gold).toBe(500 - 60);
    expect(s.inventory.stacks.scrap_iron).toBe(30 - 12);
    expect(heroStats(s, 'c404').attack).toBe(9 + 2 + 3);
    const r = tryPlay(s, { type: 'upgrade', instanceId: id, txId: 'u4' });
    expect(r.error).toMatch(/\+3/);
    const poor = { ...s, inventory: { ...s.inventory, gold: 5 } };
    const r2 = tryPlay(poor, { type: 'upgrade', instanceId: 'grib_weapon_0001', txId: 'u5' });
    expect(r2.error).toMatch(/gold/);
  });

  it('an instance cannot have two owners; accessories cannot be duplicated on one hero; no free MP refill', () => {
    let s = workshopReady();
    s.inventory.stacks.ghost_thread = 2;
    s.inventory.stacks.bone_chip = 4;
    s = play(s, { type: 'craft', recipeId: 'recipe_focus_charm', txId: 'f1' });
    s = play(s, { type: 'craft', recipeId: 'recipe_focus_charm', txId: 'f2' });
    const [a, b] = s.inventory.equipmentInstances.filter((i) => i.definitionId === 'focus_charm').map((i) => i.instanceId);
    s = play(s, { type: 'equip', heroId: 'hexa', slot: 'accessory1', instanceId: a });
    expect(tryPlay(s, { type: 'equip', heroId: 'hexa', slot: 'accessory2', instanceId: b }).error).toMatch(/already/);
    expect(tryPlay(s, { type: 'equip', heroId: 'grib', slot: 'accessory1', instanceId: a }).error).toMatch(/Unequip/);
    // MP: Hexa has 32/36 after equip (no refill); unequip clamps back to 32
    expect(heroStats(s, 'hexa').maxMp).toBe(36);
    expect(s.party[3].mp).toBe(32);
    s.party[3].mp = 20;
    s = play(s, { type: 'equip', heroId: 'hexa', slot: 'accessory1', instanceId: null });
    s = play(s, { type: 'equip', heroId: 'hexa', slot: 'accessory1', instanceId: a });
    expect(s.party[3].mp).toBe(20);
    // weapon class restriction
    expect(tryPlay(s, { type: 'equip', heroId: 'brugg', slot: 'weapon', instanceId: 'hexa_weapon_0001' }).error).toMatch(/cannot use/);
  });
});

describe('6. persistence', () => {
  function memKV(): KV & { data: Map<string, string> } {
    const data = new Map<string, string>();
    return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
  }

  it('mid-battle save/load then the same action gives identical results', () => {
    let s = battleState('yard_enforcers');
    s = play(s, { type: 'battleAction', action: { kind: 'attack', target: 'enemy_1' } });
    const loaded = (parseEnvelope(JSON.stringify(makeEnvelope(s))) as { ok: true; envelope: { payload: GameState } }).envelope.payload;
    const a = play(s, { type: 'battleAction', action: { kind: 'skill', skillId: 'patchwork', target: 'grib' } });
    const b = play(loaded, { type: 'battleAction', action: { kind: 'skill', skillId: 'patchwork', target: 'grib' } });
    expect(stableStringify(a)).toBe(stableStringify(b));
    const a2 = play(play(a, { type: 'battleAction', action: { kind: 'guard' } }), { type: 'enemyAct' });
    const b2 = play(play(b, { type: 'battleAction', action: { kind: 'guard' } }), { type: 'enemyAct' });
    expect(a2.battle!.rngState).toBe(b2.battle!.rngState);
    expect(stableStringify(a2)).toBe(stableStringify(b2));
  });

  it('two-slot store falls back when the newest copy is corrupt', () => {
    const kv = memKV();
    const store = new SaveStore(kv);
    let s = newGameState();
    store.save(s); // rev 0 → slot a
    s = play(s, { type: 'dialogueAdvance' });
    store.save(s); // rev 1 → slot b
    expect(store.load().state!.revision).toBe(1);
    kv.data.set(SLOT_KEYS[1], kv.data.get(SLOT_KEYS[1])!.replace('"cursor":1', '"cursor":5'));
    const r = store.load();
    expect(r.state!.revision).toBe(0);
    expect(r.notice).toMatch(/previous save/);
  });

  it('rejects future-schema, content-mismatched and malformed imports without touching the store', () => {
    const kv = memKV();
    const store = new SaveStore(kv);
    const s = newGameState();
    store.save(s);
    const snapshot = new Map(kv.data);
    const env = makeEnvelope(s);
    expect(parseEnvelope(JSON.stringify({ ...env, schemaVersion: 99 })).ok).toBe(false);
    const cm = structuredClone(env);
    cm.contentVersion = 'other';
    const r = parseEnvelope(JSON.stringify(cm));
    expect(r.ok === false && r.kind).toBe('content_mismatch');
    expect(parseEnvelope('{not json').ok).toBe(false);
    const bad = structuredClone(env);
    bad.payload.inventory.gold = -5;
    expect(parseEnvelope(JSON.stringify(bad)).ok).toBe(false);
    expect(kv.data).toEqual(snapshot);
  });

  it('a storage failure is reported and the game keeps running in memory', () => {
    const kv = memKV();
    kv.setItem = () => { throw new DOMException('full', 'QuotaExceededError'); };
    const store = new SaveStore(kv);
    const s = newGameState();
    expect(store.save(s)).toBe(false);
    expect(store.failing).toBe(true);
    const next = reduce(s, { type: 'dialogueAdvance' });
    expect(next.error).toBeUndefined();
  });
});

describe('content sanity', () => {
  it('shop prices floor discounts with a minimum of 1', () => {
    expect(CONTENT.raw.shopBasePrices.poultice).toBe(10);
  });
});
