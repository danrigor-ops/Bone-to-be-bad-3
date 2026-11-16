import type { GameState } from '../core/types';
import { MAPS, exitAt, walkable } from '../data/maps';

export interface P { x: number; y: number }
const DIRS: P[] = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }];

/**
 * BFS on the grid. Exit tiles can only be the final step (so a path never
 * accidentally travels through a doorway). Returns steps excluding the start.
 */
export function findPath(s: GameState, from: P, to: P): P[] | null {
  const mapId = s.location.id;
  const m = MAPS[mapId];
  const w = m.rows[0].length, h = m.rows.length;
  if (from.x === to.x && from.y === to.y) return [];
  if (!walkable(s, mapId, to.x, to.y)) return null;
  const prev = new Map<number, number>();
  const key = (x: number, y: number) => y * w + x;
  const q: P[] = [from];
  prev.set(key(from.x, from.y), -1);
  while (q.length) {
    const cur = q.shift()!;
    if (cur.x === to.x && cur.y === to.y) break;
    if ((cur.x !== from.x || cur.y !== from.y) && exitAt(mapId, cur.x, cur.y)) continue;
    for (const d of DIRS) {
      const nx = cur.x + d.x, ny = cur.y + d.y;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const k = key(nx, ny);
      if (prev.has(k)) continue;
      if (!walkable(s, mapId, nx, ny)) continue;
      prev.set(k, key(cur.x, cur.y));
      q.push({ x: nx, y: ny });
    }
  }
  if (!prev.has(key(to.x, to.y))) return null;
  const path: P[] = [];
  let k = key(to.x, to.y);
  while (k !== key(from.x, from.y)) {
    path.push({ x: k % w, y: Math.floor(k / w) });
    k = prev.get(k)!;
  }
  return path.reverse();
}

/** Nearest reachable tile adjacent to (tx,ty), for approaching NPCs/props. */
export function pathToAdjacent(s: GameState, from: P, target: P): P[] | null {
  let best: P[] | null = null;
  for (const d of DIRS) {
    const a = { x: target.x + d.x, y: target.y + d.y };
    if (a.x === from.x && a.y === from.y) return [];
    if (exitAt(s.location.id, a.x, a.y)) continue;
    const p = findPath(s, from, a);
    if (p && (!best || p.length < best.length)) best = p;
  }
  return best;
}
