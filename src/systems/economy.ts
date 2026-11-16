import { CONTENT, item } from '../core/content';
import type { GameState } from '../core/types';

export function addItems(s: GameState, items: Record<string, number>) {
  for (const [k, v] of Object.entries(items)) s.inventory.stacks[k] = (s.inventory.stacks[k] ?? 0) + v;
}

export function count(s: GameState, id: string): number {
  return s.inventory.stacks[id] ?? 0;
}

export function removeItems(s: GameState, items: Record<string, number>): boolean {
  for (const [k, v] of Object.entries(items)) if (count(s, k) < v) return false;
  for (const [k, v] of Object.entries(items)) {
    s.inventory.stacks[k] = count(s, k) - v;
    if (s.inventory.stacks[k] === 0) delete s.inventory.stacks[k];
  }
  return true;
}

export function claimKey(s: GameState, key: string): boolean {
  if (s.claimedRewards.includes(key)) return false;
  s.claimedRewards.push(key);
  return true;
}

export interface ShopDef {
  id: string;
  name: string;
  stock: string[];
  discount: 'materials' | 'consumables' | null;
  blurb: string;
}

export const SHOPS: Record<string, ShopDef> = {
  mott: {
    id: 'mott', name: 'Mott’s Barrow', stock: ['poultice', 'ether', 'scrap_iron', 'ghost_thread', 'slime_resin'],
    discount: null, blurb: 'Full price, full honesty. Branch discounts apply only at the counter or stall that offers them.',
  },
  counter: {
    id: 'counter', name: 'Worker Salvage Counter', stock: ['scrap_iron', 'ghost_thread', 'slime_resin'],
    discount: 'materials', blurb: 'Rest Charter: crafting materials 20% off. Run by the mill workers.',
  },
  stall: {
    id: 'stall', name: 'Mayor’s Supply Stall', stock: ['poultice', 'ether'],
    discount: 'consumables', blurb: 'Village Compact: healing consumables 20% off.',
  },
};

export function shopOpen(s: GameState, shopId: string): boolean {
  if (shopId === 'mott') return true;
  if (shopId === 'counter') return s.flags.labor_resolution === 'charter';
  if (shopId === 'stall') return s.flags.labor_resolution === 'compact';
  return false;
}

/** Floor discounted integer prices, minimum 1. */
export function price(s: GameState, shopId: string, itemId: string): number {
  const base = CONTENT.raw.shopBasePrices[itemId];
  const shop = SHOPS[shopId];
  const def = item(itemId);
  let p = base;
  if (shop.discount === 'materials' && def.kind === 'material' && s.flags.labor_resolution === 'charter') p = Math.floor(base * 0.8);
  if (shop.discount === 'consumables' && def.kind === 'consumable' && s.flags.labor_resolution === 'compact') p = Math.floor(base * 0.8);
  return Math.max(1, p);
}

export function buyProblem(s: GameState, shopId: string, itemId: string, qty: number): string | null {
  const shop = SHOPS[shopId];
  if (!shop || !shopOpen(s, shopId)) return 'That shop is closed.';
  if (!shop.stock.includes(itemId)) return 'Not sold here.';
  if (!Number.isInteger(qty) || qty < 1 || qty > 99) return 'Invalid quantity.';
  if (s.inventory.gold < price(s, shopId, itemId) * qty) return 'Not enough gold.';
  return null;
}
