import { CONTENT, itemName } from '../core/content';
import type { GameState, HeroId, ItemDef, Stats } from '../core/types';
import { computeStats, equippedDefs, member, shortName } from '../systems/stats';
import { ANCHORS, FRAMES, paint, heroTexKey, allTextureSpecs, type Canvasish } from '../render/sprites';
import { heroGear } from '../render/gear';

export const EFFECT_TEXT: Record<string, string> = {
  curse_damage_20: 'Damaging actions deal ×1.2 to cursed targets.',
  protect_self_20: 'Brugg only: takes ×0.8 damage while his Stand Behind Me link is active (including redirected hits). Other wearers get no benefit from this effect.',
  curse_duration_plus_1: 'Curses applied by the wearer last 1 extra target turn.',
  fatal_once: 'Once per battle, a blow that would KO leaves the wearer at 1 HP, then Weakened (×0.8 damage) for 2 of their turns.',
  mp_plus_4: '+4 max MP. Equipping does not refill MP.',
};

export function statText(def: ItemDef, rank = 0): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(def.stats ?? {})) {
    const bonus = def.primaryStat === k ? rank : 0;
    const total = (v ?? 0) + bonus;
    parts.push(`${k === 'attack' ? 'ATK' : k === 'magic' ? 'MAG' : 'DEF'} ${total >= 0 ? '+' : ''}${total}`);
  }
  if (def.effects?.includes('mp_plus_4')) parts.push('MP +4');
  return parts.join(', ') || 'No stats';
}

export function eligibleText(def: ItemDef): string {
  const e = def.eligible ?? [];
  if (e.includes('all')) return 'Any hero';
  return e.map(shortName).join(', ');
}

export function itemLabel(defId: string, rank: number): string {
  const def = CONTENT.items.get(defId);
  const up = def?.upgradable ? ` +${rank}` : '';
  return `${itemName(defId)}${up}`;
}

/** Stats if `hero` swapped `slot` to `defId` at `rank`. */
export function statsWith(s: GameState, hero: HeroId, slot: string, defId: string | null, rank: number): Stats {
  const gear = equippedDefs(s, hero).filter((g) => g.slot !== slot).map((g) => ({ def: g.def, rank: g.inst.rank }));
  if (defId) gear.push({ def: CONTENT.items.get(defId)!, rank });
  return computeStats(member(s, hero).level, hero, gear);
}

export function diffText(a: Stats, b: Stats): string {
  const keys: [keyof Stats, string][] = [['attack', 'ATK'], ['magic', 'MAG'], ['defence', 'DEF'], ['maxMp', 'MP']];
  const parts: string[] = [];
  for (const [k, l] of keys) {
    const d = b[k] - a[k];
    if (d) parts.push(`${l} ${d > 0 ? '+' : ''}${d}`);
  }
  return parts.length ? parts.join(', ') : 'no stat change';
}

// ---- DOM canvas previews using the same painter as the game textures ----
const specByKey = new Map(allTextureSpecs().map((t) => [t.key, t]));

export function drawTexture(ctx: Canvasish, key: string, dx = 0, dy = 0) {
  const spec = specByKey.get(key);
  if (!spec) return;
  const off = document.createElement('canvas');
  off.width = spec.w; off.height = spec.h;
  spec.draw(off.getContext('2d')!);
  (ctx as CanvasRenderingContext2D).drawImage(off, dx, dy);
}

export function heroPreview(s: GameState, hero: HeroId, scale = 4, override?: { slot: 'weapon' | 'head' | 'body'; app: string | null }): HTMLCanvasElement {
  const a = ANCHORS[hero];
  const c = document.createElement('canvas');
  c.width = a.w * scale; c.height = a.h * scale;
  c.style.width = `${a.w * scale}px`; c.style.height = `${a.h * scale}px`;
  c.style.imageRendering = 'pixelated';
  const small = document.createElement('canvas');
  small.width = a.w; small.height = a.h;
  const ctx = small.getContext('2d')!;
  const g = heroGear(s, hero);
  if (override) g[override.slot] = override.app;
  drawTexture(ctx, heroTexKey(hero, 'base', FRAMES[0]));
  for (const app of [g.body, g.head, g.weapon]) if (app) drawTexture(ctx, heroTexKey(hero, app, 0));
  const big = c.getContext('2d')!;
  big.imageSmoothingEnabled = false;
  big.drawImage(small, 0, 0, a.w * scale, a.h * scale);
  c.setAttribute('role', 'img');
  c.setAttribute('aria-label', `${shortName(hero)} wearing ${[g.weapon, g.head, g.body].filter(Boolean).join(', ')}`);
  return c;
}

export function titleArt(scale = 3): HTMLCanvasElement {
  const w = 120, hgt = 44;
  const small = document.createElement('canvas');
  small.width = w; small.height = hgt;
  const ctx = small.getContext('2d')!;
  paint(ctx, [[0, 40, 120, 4, '#3d5233']], false);
  const place: [HeroId, number, number][] = [['grib', 4, 10], ['c404', 30, 10], ['hexa', 56, 10], ['brugg', 82, 2]];
  const gear: Record<string, string[]> = {
    c404: ['old_coat', 'old_cap', 'old_blade'], grib: ['old_coat', 'old_cap', 'shiv'],
    hexa: ['old_coat', 'old_cap', 'wand'], brugg: ['old_coat', 'old_cap', 'knuckles'],
  };
  for (const [hero, x, y] of place) {
    drawTexture(ctx, heroTexKey(hero, 'base', 0), x, y);
    for (const app of gear[hero]) drawTexture(ctx, heroTexKey(hero, app, 0), x, y);
  }
  const c = document.createElement('canvas');
  c.width = w * scale; c.height = hgt * scale;
  c.style.width = `${w * scale}px`; c.style.maxWidth = '90vw'; c.style.height = 'auto';
  const big = c.getContext('2d')!;
  big.imageSmoothingEnabled = false;
  big.drawImage(small, 0, 0, w * scale, hgt * scale);
  c.setAttribute('role', 'img');
  c.setAttribute('aria-label', 'Grib, Skeleton #404, Hexa and Brugg standing together');
  return c;
}
