import type { GameState, HeroId } from '../core/types';
import { CONTENT } from '../core/content';
import { instance, member } from '../systems/stats';
import type { Gear } from './heroSprite';

export function appearanceOf(s: GameState, instanceId: string | null): string | null {
  if (!instanceId) return null;
  const inst = instance(s, instanceId);
  if (!inst) return null;
  return CONTENT.items.get(inst.definitionId)?.appearance ?? null;
}

export function heroGear(s: GameState, hero: HeroId): Gear {
  const m = member(s, hero);
  return {
    weapon: appearanceOf(s, m.equipment.weapon),
    head: appearanceOf(s, m.equipment.head),
    body: appearanceOf(s, m.equipment.body),
  };
}
