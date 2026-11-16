// Authored locations. Tiles are 16px. Objects occupy one tile and block movement.
import type { Facing, GameState } from '../core/types';
import { currentObjective, jobStatus, objectiveDone } from '../systems/quests';

/*
 Tile legend
  #  wall           T  tree          H  house          f  fence
  c  crates/sacks   w  water         ,  grass          _  path
  .  wood floor     :  stone floor   D  door (walkable)
*/
export const BLOCKING = new Set(['#', 'T', 'H', 'f', 'c', 'w']);

export type Cond = (s: GameState) => boolean;

export interface MapObject {
  id: string;
  x: number;
  y: number;
  sprite: string; // texture id from render/sprites.ts
  label: string; // shown on the Interact button
  visible?: Cond;
  /** 'marker' = visible encounter marker (drawn with a warning badge) */
  kind?: 'npc' | 'prop' | 'marker';
  /** Purely decorative objects still block and can be inspected. */
}

export interface ExitDef {
  x: number;
  y: number;
  to: string;
  tx: number;
  ty: number;
  facing: Facing;
  /** Return a reason if the exit is closed. */
  blocked?: (s: GameState) => string | null;
}

export interface MapDef {
  id: string;
  name: string;
  rows: string[];
  exits: ExitDef[];
  objects: MapObject[];
  ambient: 'indoor' | 'village' | 'yard' | 'cellar';
}

const res = (s: GameState) => s.flags.labor_resolution as string | undefined;
const ev = (s: GameState) => s.flags.evidence_handling as string | undefined;

export const MAPS: Record<string, MapDef> = {
  bureau: {
    id: 'bureau', name: 'Unfinished Business Bureau', ambient: 'indoor',
    rows: [
      '##########',
      '#........#',
      '#........#',
      '#........#',
      '#........#',
      '#........#',
      '#........#',
      '#........#',
      '####DD####',
    ],
    exits: [
      { x: 4, y: 8, to: 'village', tx: 8, ty: 1, facing: 'down' },
      { x: 5, y: 8, to: 'village', tx: 8, ty: 1, facing: 'down' },
    ],
    objects: [
      { id: 'desk', x: 4, y: 2, sprite: 'desk', label: 'Desk & job board', kind: 'prop' },
      { id: 'desk_side', x: 5, y: 2, sprite: 'desk_side', label: 'Rent notice', kind: 'prop' },
      { id: 'marn', x: 7, y: 1, sprite: 'marn', label: 'Marn (workshop)', kind: 'npc' },
      { id: 'anvil', x: 8, y: 1, sprite: 'anvil', label: 'Workshop anvil', kind: 'prop' },
      { id: 'bench', x: 1, y: 5, sprite: 'bench', label: 'Rest bench', kind: 'prop' },
      { id: 'plant', x: 1, y: 1, sprite: 'plant', label: 'Office plant', kind: 'prop' },
      { id: 'sealed_letters', x: 8, y: 5, sprite: 'string_board', label: 'Sealed correspondence', kind: 'prop', visible: (s) => ev(s) === 'trace' },
    ],
  },

  village: {
    id: 'village', name: 'Dregswell', ambient: 'village',
    rows: [
      'TTTTTT##D###TTTT',
      'T,,,,,,,_,,,,,,T',
      'T,HHH,,,_,,,HHHT',
      'T,HHH,,,_,,,HHHT',
      'T,,_,,,,_,,,,_,T',
      'T,,_____________',
      'T,,_,,,,,,,,,,__',
      'T,,_,,ff,,,,,,,T',
      'T,,_,,,,,,,,,,,T',
      'T,,_,,,,ww,,,,,T',
      'T,,,,,,,ww,,,,,T',
      'TTTTTTTTTTTTTTTT',
    ],
    exits: [
      { x: 8, y: 0, to: 'bureau', tx: 4, ty: 7, facing: 'up' },
      { x: 15, y: 5, to: 'mill_yard', tx: 1, ty: 4, facing: 'right' },
      { x: 15, y: 6, to: 'mill_yard', tx: 1, ty: 5, facing: 'right' },
    ],
    objects: [
      { id: 'pell', x: 6, y: 4, sprite: 'pell', label: 'Mayor Pell', kind: 'npc' },
      { id: 'noticeboard', x: 10, y: 1, sprite: 'noticeboard', label: 'Noticeboard', kind: 'prop' },
      { id: 'stall', x: 11, y: 4, sprite: 'stall_closed', label: 'Supply stall', kind: 'prop', visible: (s) => res(s) !== 'compact' },
      { id: 'stall_open', x: 11, y: 4, sprite: 'stall_open', label: 'Supply stall (open)', kind: 'npc', visible: (s) => res(s) === 'compact' },
      { id: 'mott', x: 11, y: 8, sprite: 'mott', label: 'Mott’s Barrow (shop)', kind: 'npc' },
      { id: 'counter', x: 5, y: 8, sprite: 'counter', label: 'Worker salvage counter', kind: 'npc', visible: (s) => res(s) === 'charter' },
      { id: 'relief', x: 12, y: 6, sprite: 'relief', label: 'Relief worker', kind: 'npc', visible: (s) => res(s) === 'compact' },
      { id: 'village_bench', x: 2, y: 9, sprite: 'bench_rest', label: 'Resting workers', kind: 'npc', visible: (s) => res(s) === 'charter' },
      { id: 'crowd', x: 6, y: 6, sprite: 'crowd', label: 'Angry crowd', kind: 'npc', visible: (s) => ev(s) === 'public' },
      { id: 'crowd2', x: 7, y: 6, sprite: 'crowd2', label: 'Angry crowd', kind: 'npc', visible: (s) => ev(s) === 'public' },
      { id: 'well', x: 12, y: 9, sprite: 'well', label: 'Village well', kind: 'prop' },
    ],
  },

  mill_yard: {
    id: 'mill_yard', name: 'Mill Yard', ambient: 'yard',
    rows: [
      '##############',
      '#cc,,,,,,,,cc#',
      '#c,,,,,,,,,,c#',
      '#,,,,,,,,,,,,#',
      '_,,,,,,,,,,,,#',
      '_,,,,,,,,,,,,#',
      '#,,,,,,,,,,,,#',
      '#,,cc,,,,,,,,#',
      '#,,,,,,,,,,,,#',
      '#c,,,,,,,,,,,#',
      '############D#',
    ],
    exits: [
      { x: 0, y: 4, to: 'village', tx: 14, ty: 5, facing: 'left' },
      { x: 0, y: 5, to: 'village', tx: 14, ty: 6, facing: 'left' },
      {
        x: 12, y: 10, to: 'cellar_entry', tx: 4, ty: 1, facing: 'down',
        blocked: (s) => {
          if (!s.flags.cellar_key) return 'Locked. A heavy door with a keyhole shaped like bad news.';
          if (jobStatus(s, 'job003') === 'available') return 'Hexa: “We haven’t formally accepted job 003. Procedure.” (Accept it at the Bureau desk.)';
          return null;
        },
      },
    ],
    objects: [
      { id: 'ribbs', x: 6, y: 2, sprite: 'ribbs', label: 'Foreman Ribbs', kind: 'npc' },
      { id: 'winch', x: 9, y: 2, sprite: 'winch', label: 'Damaged winch', kind: 'prop' },
      { id: 'ledger', x: 10, y: 2, sprite: 'ledger', label: 'Wage ledger', kind: 'prop' },
      { id: 'signs', x: 4, y: 1, sprite: 'sign', label: 'Labour signs', kind: 'prop' },
      {
        id: 'enforcers', x: 7, y: 6, sprite: 'collector', label: 'Debt Collector patrol', kind: 'marker',
        visible: (s) => !objectiveDone(s, 'job001', 'win_enforcers') && jobStatus(s, 'job001') !== 'complete',
      },
      {
        id: 'strikers', x: 3, y: 3, sprite: 'worker_strike', label: 'Striking workers', kind: 'npc',
        visible: (s) => !res(s),
      },
      {
        id: 'strikers2', x: 4, y: 3, sprite: 'worker_strike2', label: 'Striking workers', kind: 'npc',
        visible: (s) => !res(s),
      },
      { id: 'yard_bench', x: 3, y: 3, sprite: 'bench_rest', label: 'Resting workers', kind: 'npc', visible: (s) => res(s) === 'charter' },
      { id: 'yard_bench2', x: 4, y: 3, sprite: 'bench_rest', label: 'Resting workers', kind: 'npc', visible: (s) => res(s) === 'charter' },
      { id: 'yard_relief', x: 3, y: 3, sprite: 'relief', label: 'Relief worker', kind: 'npc', visible: (s) => res(s) === 'compact' },
      { id: 'yard_resting', x: 4, y: 3, sprite: 'bench_rest', label: 'Worker on scheduled break', kind: 'npc', visible: (s) => res(s) === 'compact' },
      { id: 'crate', x: 12, y: 7, sprite: 'crate_seal', label: 'Delivery crate', kind: 'prop' },
      {
        id: 'invoice_marker', x: 11, y: 7, sprite: 'wisp', label: 'Invoice Swarm', kind: 'marker',
        visible: (s) => currentObjective(s, 'job002') === 'win_invoices',
      },
      { id: 'salvage_pile', x: 1, y: 8, sprite: 'scrap_pile', label: 'Salvage pile', kind: 'prop' },
      { id: 'salvage_mite', x: 2, y: 8, sprite: 'mite', label: 'Rust Mite (salvage)', kind: 'marker', visible: (s) => s.salvageActive },
    ],
  },

  cellar_entry: {
    id: 'cellar_entry', name: 'Ledger Cellar — Entry', ambient: 'cellar',
    rows: [
      '####::####',
      '#::::::::#',
      '#:c::::c:#',
      '#:::::::::',
      '#:::::::::',
      '#::::::::#',
      '####::####',
    ],
    exits: [
      { x: 4, y: 0, to: 'mill_yard', tx: 12, ty: 9, facing: 'up' },
      { x: 5, y: 0, to: 'mill_yard', tx: 12, ty: 9, facing: 'up' },
      { x: 9, y: 3, to: 'cellar_store', tx: 1, ty: 3, facing: 'right', blocked: (s) => (s.claimedRewards.includes('encounter:cellar_entry') ? null : 'The Debt Collector blocks the way.') },
      { x: 9, y: 4, to: 'cellar_store', tx: 1, ty: 4, facing: 'right', blocked: (s) => (s.claimedRewards.includes('encounter:cellar_entry') ? null : 'The Debt Collector blocks the way.') },
      { x: 4, y: 6, to: 'cellar_archive', tx: 4, ty: 1, facing: 'down', blocked: (s) => (s.claimedRewards.includes('encounter:cellar_entry') ? null : 'The Debt Collector blocks the way.') },
      { x: 5, y: 6, to: 'cellar_archive', tx: 5, ty: 1, facing: 'down', blocked: (s) => (s.claimedRewards.includes('encounter:cellar_entry') ? null : 'The Debt Collector blocks the way.') },
    ],
    objects: [
      { id: 'cellar_collector', x: 4, y: 4, sprite: 'collector', label: 'Debt Collector', kind: 'marker', visible: (s) => !s.claimedRewards.includes('encounter:cellar_entry') },
      { id: 'cellar_sign', x: 7, y: 1, sprite: 'sign', label: 'Signpost', kind: 'prop' },
    ],
  },

  cellar_store: {
    id: 'cellar_store', name: 'Ledger Cellar — Store', ambient: 'cellar',
    rows: [
      '########',
      '#::::::#',
      '#::::c:#',
      '::::::c#',
      ':::::::#',
      '#::::::#',
      '########',
    ],
    exits: [
      { x: 0, y: 3, to: 'cellar_entry', tx: 8, ty: 3, facing: 'left' },
      { x: 0, y: 4, to: 'cellar_entry', tx: 8, ty: 4, facing: 'left' },
    ],
    objects: [
      { id: 'store_mite', x: 5, y: 4, sprite: 'mite', label: 'Rust Mite (optional)', kind: 'marker', visible: (s) => !s.claimedRewards.includes('encounter:cellar_optional') },
      { id: 'chest', x: 6, y: 4, sprite: 'chest', label: 'Old chest', kind: 'prop', visible: (s) => !s.claimedRewards.includes('chest:cellar_chest') },
      { id: 'chest_open', x: 6, y: 4, sprite: 'chest_open', label: 'Open chest', kind: 'prop', visible: (s) => s.claimedRewards.includes('chest:cellar_chest') },
    ],
  },

  cellar_archive: {
    id: 'cellar_archive', name: 'Ledger Cellar — Archive', ambient: 'cellar',
    rows: [
      '####::####',
      '#::::::::#',
      '#::::::::#',
      '#::::::::#',
      '#::::::::#',
      '#::::::::#',
      '##########',
    ],
    exits: [
      { x: 4, y: 0, to: 'cellar_entry', tx: 4, ty: 5, facing: 'up' },
      { x: 5, y: 0, to: 'cellar_entry', tx: 5, ty: 5, facing: 'up' },
    ],
    objects: [
      { id: 'archive_desk', x: 2, y: 2, sprite: 'archive_desk', label: 'Archive desk', kind: 'prop' },
      { id: 'seal_mark', x: 8, y: 1, sprite: 'seal', label: 'Cracked-ring seal', kind: 'prop' },
      { id: 'engine', x: 6, y: 4, sprite: 'engine', label: 'Foreclosure Engine', kind: 'marker', visible: (s) => !s.claimedRewards.includes('encounter:foreclosure_boss') },
      { id: 'engine_wreck', x: 6, y: 4, sprite: 'engine_wreck', label: 'Silent engine', kind: 'prop', visible: (s) => s.claimedRewards.includes('encounter:foreclosure_boss') },
    ],
  },
};

export function visibleObjects(s: GameState, mapId: string): MapObject[] {
  return MAPS[mapId].objects.filter((o) => !o.visible || o.visible(s));
}

export function tileAt(mapId: string, x: number, y: number): string | null {
  const m = MAPS[mapId];
  if (y < 0 || y >= m.rows.length || x < 0 || x >= m.rows[0].length) return null;
  return m.rows[y][x];
}

export function exitAt(mapId: string, x: number, y: number): ExitDef | undefined {
  return MAPS[mapId].exits.find((e) => e.x === x && e.y === y);
}

/** Walkable for movement: in-bounds, non-blocking tile, no visible object, exit open. */
export function walkable(s: GameState, mapId: string, x: number, y: number): boolean {
  const t = tileAt(mapId, x, y);
  if (t === null || BLOCKING.has(t)) return false;
  if (visibleObjects(s, mapId).some((o) => o.x === x && o.y === y)) return false;
  const ex = exitAt(mapId, x, y);
  if (ex?.blocked && ex.blocked(s)) return false;
  return true;
}

export const SPAWN = { id: 'bureau', tileX: 4, tileY: 5, facing: 'down' as Facing };
