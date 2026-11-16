// Shared types for content data and the single serializable game state.

export type StatKey = 'maxHp' | 'maxMp' | 'attack' | 'magic' | 'defence' | 'speed';
export type Stats = Record<StatKey, number>;
export type Slot = 'weapon' | 'head' | 'body' | 'accessory1' | 'accessory2';
export const SLOTS: Slot[] = ['weapon', 'head', 'body', 'accessory1', 'accessory2'];
export type HeroId = 'c404' | 'grib' | 'brugg' | 'hexa';
export const HERO_IDS: HeroId[] = ['c404', 'grib', 'brugg', 'hexa'];

export interface ItemDef {
  id: string;
  name: string;
  kind: 'material' | 'consumable' | 'equipment';
  source?: string;
  effect?: string;
  target?: string;
  slot?: 'weapon' | 'head' | 'body' | 'accessory';
  eligible?: string[];
  stats?: Partial<Record<'attack' | 'magic' | 'defence', number>>;
  primaryStat?: 'attack' | 'magic' | 'defence' | null;
  upgradable?: boolean;
  appearance?: string | null;
  effects?: string[];
}

export interface PartyDef {
  id: HeroId;
  name: string;
  baseStats: Stats;
  starterWeapon: string;
  skills: string[];
}

export interface RecipeDef {
  id: string;
  outputItem: string;
  quantity: number;
  gold: number;
  materials: Record<string, number>;
  unlockAfter: string;
}

export interface Reward {
  gold: number;
  items: Record<string, number>;
}

export interface JobDef {
  id: string;
  name: string;
  requires: string[];
  objectives: string[];
  encounters: string[];
  choiceFlag: string | null;
  choices: string[];
  reward: Reward;
  unlocks: string[];
}

export interface EnemyDef {
  id: string;
  name: string;
  hp: number;
  attack: number;
  magic: number;
  defence: number;
  speed: number;
  ai: string;
}

export interface EncounterDef {
  id: string;
  location: string;
  enemies: string[];
  xpPerHero: number;
  rewardPolicy: 'once' | 'explicit_run_id';
}

export interface Content {
  contentVersion: string;
  status: string;
  items: ItemDef[];
  party: PartyDef[];
  recipes: RecipeDef[];
  jobs: JobDef[];
  enemies: EnemyDef[];
  encounters: EncounterDef[];
  locations: string[];
  initialGold: number;
  initialItems: Record<string, number>;
  upgradeCosts: { toRank: number; gold: number; items: Record<string, number> }[];
  salvageReward: Reward;
  optionalChest: { id: string; items: Record<string, number> };
  shopBasePrices: Record<string, number>;
  consumableRules: Record<string, { restoreHp?: number; restoreMp?: number; revive?: boolean }>;
  encounterLootNote?: string;
}

// ---------- Game state ----------

export type Facing = 'up' | 'down' | 'left' | 'right';

export interface PartyMember {
  characterId: HeroId;
  level: number;
  xp: number;
  hp: number;
  mp: number;
  equipment: Record<Slot, string | null>;
}

export interface EquipmentInstance {
  instanceId: string;
  definitionId: string;
  rank: number;
}

export interface Inventory {
  gold: number;
  stacks: Record<string, number>;
  equipmentInstances: EquipmentInstance[];
}

export type JobStatus = 'locked' | 'available' | 'active' | 'complete';
export interface JobProgress {
  status: JobStatus;
  done: string[];
}

export interface DialogueState {
  nodeId: string;
  cursor: number;
}

export interface Settings {
  music: boolean;
  sfx: boolean;
  reducedMotion: boolean;
  instantText: boolean;
  theme: 'classic_bone' | 'bureau_brass';
}

export interface Statuses {
  curse: number; // remaining afflicted-actor turns
  weakened: number;
  guard: boolean;
}

export interface BattleActor {
  id: string; // hero id or enemy_N
  side: 'hero' | 'enemy';
  defId: string;
  name: string;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  attack: number;
  magic: number;
  defence: number;
  speed: number;
  effects: string[]; // equipment special effects held
  fatalInstance: string | null; // equipment instance holding fatal_once
  statuses: Statuses;
  aiStep: number;
}

export type BattlePhase = 'player' | 'enemy' | 'victory' | 'defeat';

export interface BattleState {
  encounterId: string;
  runIndex: number | null; // salvage run index for explicit_run_id rewards
  phase: BattlePhase;
  round: number;
  queue: string[];
  turnIndex: number;
  actors: BattleActor[];
  dp: number;
  protectLink: { guardian: string; ward: string } | null;
  pilfered: string[];
  fatalUsed: string[];
  log: string[];
  seq: number; // committed action counter, used to sequence animations
  lastAction: BattleEventRecord | null;
  rngState: number;
  retry: RetrySnapshot;
  returnTo: { id: string; tileX: number; tileY: number; facing: Facing };
  isBoss: boolean;
}

export interface BattleEventRecord {
  seq: number;
  actor: string;
  label: string;
  hits: { target: string; amount: number; kind: 'damage' | 'heal' | 'mp' }[];
}

export interface RetrySnapshot {
  party: PartyMember[];
  stacks: Record<string, number>;
  rngState: number;
}

export interface GameState {
  schemaVersion: 1;
  contentVersion: string;
  revision: number;
  location: { id: string; tileX: number; tileY: number; facing: Facing };
  party: PartyMember[];
  inventory: Inventory;
  nextInstanceSeq: number;
  questState: Record<string, JobProgress>;
  flags: Record<string, string | boolean | number>;
  claimedRewards: string[];
  salvageRunIndex: number;
  salvageActive: boolean;
  dialogue: DialogueState | null;
  battle: BattleState | null;
  rngState: number;
  settings: Settings;
  lastSummary: string;
  journal: string[];
  pinnedRecipe: string | null;
  recentTx: string[];
  started: boolean;
}

export type Command =
  | { type: 'move'; x: number; y: number }
  | { type: 'interact'; objectId: string }
  | { type: 'dialogueAdvance' }
  | { type: 'dialogueChoose'; index: number }
  | { type: 'battleAction'; action: BattleAction }
  | { type: 'enemyAct' }
  | { type: 'battleContinue' }
  | { type: 'battleRetry' }
  | { type: 'battleReturnBureau' }
  | { type: 'battleEscape' }
  | { type: 'buy'; itemId: string; qty: number; txId: string }
  | { type: 'craft'; recipeId: string; txId: string }
  | { type: 'upgrade'; instanceId: string; txId: string }
  | { type: 'equip'; heroId: HeroId; slot: Slot; instanceId: string | null }
  | { type: 'settings'; patch: Partial<Settings> }
  | { type: 'pinRecipe'; recipeId: string | null }
  | { type: 'rest' }
  | { type: 'debug'; op: string; arg?: string };

export type BattleAction =
  | { kind: 'attack'; target: string }
  | { kind: 'guard' }
  | { kind: 'skill'; skillId: string; target?: string }
  | { kind: 'item'; itemId: string; target: string }
  | { kind: 'synergy'; synergyId: string; target?: string };

// Events are transient notifications to the view (not persisted).
export type GameEvent =
  | { type: 'toast'; text: string }
  | { type: 'openPanel'; panel: 'shop' | 'workshop' | 'equipment' | 'journal' }
  | { type: 'battleStart' }
  | { type: 'battleEnd' }
  | { type: 'travel'; to: string }
  | { type: 'sfx'; name: string }
  | { type: 'reward'; text: string };

export interface ReduceResult {
  state: GameState;
  events: GameEvent[];
  error?: string;
}
