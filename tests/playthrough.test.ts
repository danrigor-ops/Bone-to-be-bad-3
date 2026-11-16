import { describe, expect, it } from 'vitest';
import { newGameState } from '../src/core/state';
import type { GameState } from '../src/core/types';
import { finishDialogue, fightToEnd, goTo, interact, play, tryPlay } from './helpers';
import { parseEnvelope, makeEnvelope } from '../src/persistence/serializer';
import { visibleObjects } from '../src/data/maps';
import { price } from '../src/systems/economy';

function reload(s: GameState): GameState {
  const r = parseEnvelope(JSON.stringify(makeEnvelope(s)));
  if (!r.ok) throw new Error(r.reason);
  return r.envelope.payload;
}

function winBattle(s: GameState): GameState {
  expect(s.battle).not.toBeNull();
  s = fightToEnd(s);
  expect(s.battle?.phase).toBe('victory');
  return play(s, { type: 'battleContinue' });
}

export function job001(s: GameState, branch: 'Rest Charter' | 'Village Compact'): GameState {
  s = finishDialogue(s); // intro
  s = finishDialogue(interact(s, 'desk'), ['Accept job 001']);
  expect(s.questState.job001.status).toBe('active');
  s = goTo(s, 'village');
  s = finishDialogue(interact(s, 'pell'));
  s = goTo(s, 'mill_yard');
  s = finishDialogue(interact(s, 'ribbs'));
  s = finishDialogue(interact(s, 'ledger'));
  s = finishDialogue(interact(s, 'enforcers'), ['Fight']);
  s = winBattle(s);
  s = reload(s); // reload right before branch choice: dialogue preserved
  expect(s.dialogue?.nodeId).toBe('job001_choice');
  s = finishDialogue(s, [branch]);
  s = reload(s);
  expect(s.flags.labor_resolution).toBe(branch === 'Rest Charter' ? 'charter' : 'compact');
  s = goTo(s, 'bureau');
  s = finishDialogue(interact(s, 'desk'));
  expect(s.questState.job001.status).toBe('complete');
  return s;
}

function job002(s: GameState, ev: 'Make them public' | 'Trace the sender'): GameState {
  s = finishDialogue(interact(s, 'desk'), ['Accept job 002']);
  s = goTo(s, 'village');
  s = finishDialogue(interact(s, 'noticeboard'));
  s = goTo(s, 'mill_yard');
  s = finishDialogue(interact(s, 'ribbs'));
  s = finishDialogue(interact(s, 'crate'), ['Fight']);
  s = winBattle(s);
  s = finishDialogue(s, [ev]);
  s = goTo(s, 'bureau');
  s = finishDialogue(interact(s, 'desk'));
  expect(s.questState.job002.status).toBe('complete');
  expect(s.flags.cellar_key).toBe(true);
  return s;
}

function job003(s: GameState): GameState {
  s = finishDialogue(interact(s, 'bench'), ['Rest']);
  s = finishDialogue(interact(s, 'desk'), ['Accept job 003']);
  s = goTo(s, 'cellar_entry');
  s = finishDialogue(s);
  expect(s.questState.job003.done).toContain('enter_cellar');
  s = finishDialogue(interact(s, 'cellar_collector'), ['Fight']);
  s = winBattle(s);
  s = goTo(s, 'cellar_archive');
  s = finishDialogue(interact(s, 'archive_desk'));
  expect(s.flags.correspondence).toBe(true);
  s = finishDialogue(interact(s, 'engine'), ['Fight']);
  s = winBattle(s);
  s = finishDialogue(s, [0]);
  s = goTo(s, 'bureau');
  s = finishDialogue(interact(s, 'desk'));
  expect(s.flags.slice_complete).toBe(true);
  return s;
}

describe('full slice with starter gear', () => {
  it('charter + public route reaches the end with starter gear only', () => {
    let s = newGameState();
    s = job001(s, 'Rest Charter');
    // Branch services: charter counter open, stall closed
    expect(visibleObjects(s, 'village').some((o) => o.id === 'counter')).toBe(true);
    expect(visibleObjects(s, 'village').some((o) => o.id === 'stall_open')).toBe(false);
    expect(price(s, 'counter', 'scrap_iron')).toBe(4);
    expect(price(s, 'mott', 'scrap_iron')).toBe(5);
    s = job002(s, 'Make them public');
    expect(visibleObjects(s, 'village').some((o) => o.id === 'crowd')).toBe(true);
    s = job003(s);
    expect(s.questState.job003.status).toBe('complete');
    // Starter gear only.
    expect(s.inventory.equipmentInstances.length).toBe(12);
  });

  it('compact + trace route reaches the end and differs visibly', () => {
    let s = newGameState();
    s = job001(s, 'Village Compact');
    expect(visibleObjects(s, 'village').some((o) => o.id === 'stall_open')).toBe(true);
    expect(visibleObjects(s, 'village').some((o) => o.id === 'counter')).toBe(false);
    expect(price(s, 'stall', 'poultice')).toBe(8);
    expect(price(s, 'stall', 'ether')).toBe(12);
    s = job002(s, 'Trace the sender');
    expect(visibleObjects(s, 'bureau').some((o) => o.id === 'sealed_letters')).toBe(true);
    expect(visibleObjects(s, 'village').some((o) => o.id === 'crowd')).toBe(false);
    s = job003(s);
    expect(s.flags.slice_complete).toBe(true);
  });

  it('guaranteed rewards afford all four signature recipes without optional loot', () => {
    let s = newGameState();
    s = job001(s, 'Rest Charter');
    s = job002(s, 'Trace the sender');
    s = job003(s);
    for (const r of ['recipe_grievance_cleaver', 'recipe_union_hat', 'recipe_funeral_coat', 'recipe_warranty_ring']) {
      s = play(s, { type: 'craft', recipeId: r, txId: `tx-${r}` });
    }
    expect(s.inventory.equipmentInstances.length).toBe(16);
  });

  it('job reward cannot be claimed twice, including after reload', () => {
    let s = newGameState();
    s = job001(s, 'Rest Charter');
    const gold = s.inventory.gold;
    s = reload(s);
    s = finishDialogue(interact(s, 'desk'), [1]); // now offers job002; decline
    expect(s.inventory.gold).toBe(gold);
    expect(s.claimedRewards.filter((k) => k === 'job001:completion').length).toBe(1);
  });

  it('branch choice cannot be changed after it is made', () => {
    let s = newGameState();
    s = job001(s, 'Rest Charter');
    // Force the choice node again through state tampering: effect must not overwrite.
    s = { ...s, dialogue: { nodeId: 'job001_choice', cursor: 1 } };
    s = play(s, { type: 'dialogueChoose', index: 1 });
    expect(s.flags.labor_resolution).toBe('charter');
  });

  it('cellar door is locked without the key', () => {
    let s = newGameState();
    s = finishDialogue(s);
    s = goTo(s, 'mill_yard');
    s = { ...s, location: { id: 'mill_yard', tileX: 12, tileY: 9, facing: 'down' } };
    const r = tryPlay(s, { type: 'move', x: 12, y: 10 });
    expect(r.state.location.id).toBe('mill_yard');
  });
});

describe('salvage and chest', () => {
  it('repeat salvage rewards exactly once per explicit run', () => {
    let s = job001(newGameState(), 'Village Compact');
    s = goTo(s, 'mill_yard');
    const before = s.inventory.stacks.scrap_iron ?? 0;
    s = finishDialogue(interact(s, 'salvage_pile'), ['Repeat salvage']);
    expect(s.salvageActive).toBe(true);
    s = finishDialogue(interact(s, 'salvage_mite'), ['Fight']);
    s = fightToEnd(s, () => ({ kind: 'attack', target: 'enemy_0' }));
    expect(s.battle?.phase).toBe('victory');
    const after1 = s.inventory.stacks.scrap_iron ?? 0;
    expect(after1 - before).toBe(2);
    const reloaded = reload(s);
    s = play(reloaded, { type: 'battleContinue' });
    expect(s.salvageRunIndex).toBe(1);
    expect(s.inventory.stacks.scrap_iron).toBe(after1);
    expect(s.party[0].xp).toBe(5); // salvage gives no XP (only job001's 5)
    // Second run works
    s = finishDialogue(interact(s, 'salvage_pile'), ['Repeat salvage']);
    s = finishDialogue(interact(s, 'salvage_mite'), ['Fight']);
    s = fightToEnd(s, () => ({ kind: 'attack', target: 'enemy_0' }));
    s = play(s, { type: 'battleContinue' });
    expect(s.salvageRunIndex).toBe(2);
    expect(s.inventory.stacks.scrap_iron).toBe(after1 + 2);
  });
});
