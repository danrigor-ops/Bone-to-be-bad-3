// Every content key that needs code must be listed here AND have a handler.
// Content validation fails at boot if JSON references something not listed.

export const IMPLEMENTED_EFFECTS = [
  'curse_damage_20',
  'protect_self_20',
  'curse_duration_plus_1',
  'fatal_once',
  'mp_plus_4',
] as const;

export const IMPLEMENTED_CONSUMABLE_EFFECTS = ['heal_30', 'restore_mp_10'] as const;

export const IMPLEMENTED_AI = ['wisp_cycle', 'collector_cycle', 'mite_cycle', 'engine_cycle'] as const;

// Appearance layers drawn by render/sprites.ts (validated again against textures at boot).
export const IMPLEMENTED_APPEARANCES = [
  'old_blade', 'shiv', 'knuckles', 'wand', 'old_cap', 'old_coat',
  'grievance_cleaver', 'union_hat', 'funeral_coat', 'salvage_shiv',
  'riveted_knuckles', 'clause_wand',
] as const;

export const IMPLEMENTED_UNLOCKS = ['workshop', 'salvage', 'job002', 'job003', 'cellar_key_flag', 'slice_complete'] as const;
