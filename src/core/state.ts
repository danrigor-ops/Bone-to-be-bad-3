import { CONTENT } from './content';
import type { GameState, PartyMember, EquipmentInstance, Settings } from './types';
import { HERO_IDS } from './types';
import { initialQuestState } from '../systems/quests';
import { SPAWN } from '../data/maps';

export const SCHEMA_VERSION = 1 as const;

export const DEFAULT_SETTINGS: Settings = {
  music: true, sfx: true, reducedMotion: false, instantText: false, theme: 'classic_bone',
};

export function newGameState(settings: Settings = DEFAULT_SETTINGS): GameState {
  const c = CONTENT.raw;
  const instances: EquipmentInstance[] = [];
  const party: PartyMember[] = HERO_IDS.map((id) => {
    const def = CONTENT.party.get(id)!;
    const w = `${id}_weapon_0001`, h = `${id}_head_0001`, b = `${id}_body_0001`;
    instances.push(
      { instanceId: w, definitionId: def.starterWeapon, rank: 0 },
      { instanceId: h, definitionId: 'old_cap', rank: 0 },
      { instanceId: b, definitionId: 'old_coat', rank: 0 },
    );
    return {
      characterId: id, level: 1, xp: 0, hp: def.baseStats.maxHp, mp: def.baseStats.maxMp,
      equipment: { weapon: w, head: h, body: b, accessory1: null, accessory2: null },
    };
  });
  // Starter cap/coat add defence; hp/mp max is unaffected, so base values are correct.
  return {
    schemaVersion: SCHEMA_VERSION,
    contentVersion: c.contentVersion,
    revision: 0,
    location: { ...SPAWN },
    party,
    inventory: { gold: c.initialGold, stacks: { ...c.initialItems }, equipmentInstances: instances },
    nextInstanceSeq: 0,
    questState: initialQuestState(),
    flags: {},
    claimedRewards: [],
    salvageRunIndex: 0,
    salvageActive: false,
    dialogue: { nodeId: 'intro', cursor: 0 },
    battle: null,
    rngState: 404031,
    settings: { ...settings },
    lastSummary: 'The Bureau has opened. Read the first job at the desk.',
    journal: ['Day one: the Unfinished Business Bureau opens its doors.'],
    pinnedRecipe: null,
    recentTx: [],
    started: true,
  };
}
