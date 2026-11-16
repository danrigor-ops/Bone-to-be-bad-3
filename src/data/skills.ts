// Skill and synergy tuning (prototype defaults from 04_COMBAT_AND_CRAFTING.md).

export type SkillTarget = 'enemy' | 'ally' | 'other_ally' | 'all_enemies' | 'none';

export interface SkillDef {
  id: string;
  name: string;
  owner: string;
  mp: number;
  kind: 'physical' | 'magical' | 'heal' | 'protect';
  power: number;
  target: SkillTarget;
  cursedBonus?: number;
  appliesCurse?: number;
  heal?: number;
  steal?: { item: string; qty: number };
  description: string;
}

export const SKILLS: Record<string, SkillDef> = {
  hex_mark: {
    id: 'hex_mark', name: 'Hex Mark', owner: 'c404', mp: 4, kind: 'magical', power: 0.8,
    target: 'enemy', appliesCurse: 2,
    description: 'Magic 0.8 to one enemy and curse it for 2 of its turns.',
  },
  bone_verdict: {
    id: 'bone_verdict', name: 'Bone Verdict', owner: 'c404', mp: 6, kind: 'magical', power: 1.5,
    target: 'enemy', cursedBonus: 1.25,
    description: 'Magic 1.5 to one enemy. ×1.25 if the target is cursed.',
  },
  cheap_shot: {
    id: 'cheap_shot', name: 'Cheap Shot', owner: 'grib', mp: 3, kind: 'physical', power: 1.3,
    target: 'enemy', cursedBonus: 1.25,
    description: 'Physical 1.3 to one enemy. ×1.25 if the target is cursed.',
  },
  pilfer: {
    id: 'pilfer', name: 'Pilfer', owner: 'grib', mp: 2, kind: 'physical', power: 0.6,
    target: 'enemy', steal: { item: 'scrap_iron', qty: 1 },
    description: 'Physical 0.6 and steal 1 Scrap Iron (once per enemy).',
  },
  stand_behind_me: {
    id: 'stand_behind_me', name: 'Stand Behind Me', owner: 'brugg', mp: 4, kind: 'protect', power: 0,
    target: 'other_ally',
    description: 'Until Brugg’s next turn, single-target hits on one ally go to Brugg at −35%.',
  },
  heavy_hand: {
    id: 'heavy_hand', name: 'Heavy Hand', owner: 'brugg', mp: 3, kind: 'physical', power: 1.4,
    target: 'enemy',
    description: 'Physical 1.4 to one enemy.',
  },
  cinder_clause: {
    id: 'cinder_clause', name: 'Cinder Clause', owner: 'hexa', mp: 4, kind: 'magical', power: 1.2,
    target: 'enemy',
    description: 'Magic 1.2 to one enemy.',
  },
  patchwork: {
    id: 'patchwork', name: 'Patchwork', owner: 'hexa', mp: 4, kind: 'heal', power: 0,
    target: 'ally', heal: 24,
    description: 'Heal one living ally 24 HP. Cannot revive.',
  },
};

export interface SynergyDef {
  id: string;
  name: string;
  initiator: string;
  partner: string;
  dp: number;
  kind: 'physical' | 'magical';
  power: number;
  target: 'enemy' | 'all_enemies';
  cursedBonus?: number;
  partnerGuard?: boolean;
  description: string;
  banter: string;
}

export const SYNERGIES: Record<string, SynergyDef> = {
  fine_print: {
    id: 'fine_print', name: 'Fine Print', initiator: 'c404', partner: 'hexa', dp: 30,
    kind: 'magical', power: 1.6, target: 'all_enemies', cursedBonus: 1.25,
    description: 'Magic 1.6 (using #404’s magic) to all enemies. Cursed targets ×1.25.',
    banter: 'Hexa: “Subsection nine.” #404: “Nobody reads subsection nine.”',
  },
  safe_hands: {
    id: 'safe_hands', name: 'Safe Hands', initiator: 'grib', partner: 'brugg', dp: 25,
    kind: 'physical', power: 2, target: 'enemy', partnerGuard: true,
    description: 'Physical 2 (using Grib’s attack) to one enemy. Brugg guards until his next turn.',
    banter: 'Brugg: “Up you go.” Grib: “Mind the merchandise!”',
  },
};

export const DP_PER_DAMAGING_ACTION = 5;
export const DP_MAX = 100;
export const PROTECT_REDIRECT_MULT = 0.65;
export const GUARD_MULT = 0.5;
export const XP_THRESHOLDS = [0, 30, 70]; // level 1, 2, 3
export const LEVEL_CAP = 3;
export const LEVEL_GAINS = { maxHp: 5, maxMp: 2, attack: 1, magic: 1, defence: 1 };

export interface EnemyMove {
  name: string;
  kind: 'physical' | 'magical';
  power: number;
  target: 'lowest_hp' | 'highest_def' | 'all';
  tell: string;
}

export const AI_CYCLES: Record<string, EnemyMove[]> = {
  wisp_cycle: [
    { name: 'Paper Cut', kind: 'physical', power: 1, target: 'lowest_hp', tell: 'Paper Cut → weakest hero' },
    { name: 'Stamp', kind: 'magical', power: 1.2, target: 'lowest_hp', tell: 'Stamp (magic) → weakest hero' },
  ],
  collector_cycle: [
    { name: 'Demand', kind: 'physical', power: 1.2, target: 'lowest_hp', tell: 'Demand → weakest hero' },
    { name: 'Seize', kind: 'physical', power: 1.5, target: 'lowest_hp', tell: 'Seize (heavy) → weakest hero' },
  ],
  mite_cycle: [
    { name: 'Corrode', kind: 'physical', power: 0.9, target: 'highest_def', tell: 'Corrode → sturdiest hero' },
  ],
  engine_cycle: [
    { name: 'Audit', kind: 'magical', power: 0.8, target: 'all', tell: 'Audit (magic) → whole party' },
    { name: 'Red Stamp', kind: 'physical', power: 1.4, target: 'lowest_hp', tell: 'Red Stamp → weakest hero' },
    { name: 'Repossession', kind: 'magical', power: 1.8, target: 'all', tell: 'REPOSSESSION (big magic) → whole party' },
  ],
};
