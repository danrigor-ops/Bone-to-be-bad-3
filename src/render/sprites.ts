// Programmatic pixel art. Every texture is generated at boot from rectangles: no external images.
// Status: ALL ART IN THIS FILE IS PROVISIONAL STAND-IN ART (see docs/ASSET_INVENTORY.md).
import { C } from './palette';
import { IMPLEMENTED_APPEARANCES } from '../core/registry';
import { heroSpecs32, monsterSpecs32 } from './art32';

export type Rect = [number, number, number, number, string];

export interface Canvasish {
  fillStyle: string | CanvasGradient | CanvasPattern;
  fillRect(x: number, y: number, w: number, h: number): void;
  clearRect(x: number, y: number, w: number, h: number): void;
}

/** Draw rects with a 1px plum outline behind all of them (two passes keep the silhouette clean). */
export function paint(ctx: Canvasish, rects: Rect[], outline = true) {
  if (outline) {
    ctx.fillStyle = C.outline;
    for (const [x, y, w, h] of rects) ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  }
  for (const [x, y, w, h, c] of rects) {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
  }
}
export function detail(ctx: Canvasish, rects: Rect[]) {
  paint(ctx, rects, false);
}

export interface TexSpec {
  key: string;
  w: number;
  h: number;
  draw: (ctx: Canvasish) => void;
}

// ---------------- Heroes ----------------

export type Frame = 0 | 1 | 2 | 3; // idle, walkA, walkB, attack
export const FRAMES: Frame[] = [0, 1, 2, 3];

import { ANCHORS, RES, LAYER_KIND, heroTexKey } from './art32';
export { ANCHORS, RES, LAYER_KIND, heroTexKey };

const bob = (f: Frame) => (f === 1 || f === 2 ? 1 : 0);
const legLift = (f: Frame, side: 0 | 1) => ((f === 1 && side === 0) || (f === 2 && side === 1) ? 1 : 0);

function skeletonBase(ctx: Canvasish, f: Frame, opts: { worker?: boolean } = {}) {
  const u = bob(f);
  const raised = f === 3;
  paint(ctx, [
    [9, 22, 2, 8 - legLift(f, 0), C.bone],
    [14, 22, 2, 8 - legLift(f, 1), C.bone],
    [8, 30 - legLift(f, 0), 3, 1, C.boneShade],
    [14, 30 - legLift(f, 1), 3, 1, C.boneShade],
    [9, 20 + u, 7, 2, C.boneShade],
    [6, 12 + u, 2, 8, C.bone],
    raised ? [17, 7 + u, 2, 7, C.bone] : [17, 12 + u, 2, 8, C.bone],
    [8, 12 + u, 9, 8, C.bone],
    [11, 11 + u, 3, 1, C.boneShade],
    [8, 2 + u, 9, 8, C.bone],
    [9, 9 + u, 7, 2, C.boneShade],
  ]);
  detail(ctx, [
    [9, 13 + u, 7, 1, C.boneDark], [9, 15 + u, 7, 1, C.boneDark], [9, 17 + u, 7, 1, C.boneDark],
    [12, 12 + u, 1, 8, C.boneShade],
    [10, 5 + u, 2, 2, C.black], [14, 5 + u, 2, 2, C.black],
    [12, 7 + u, 1, 1, C.boneDark],
    [10, 10 + u, 5, 1, C.boneDark], [11, 10 + u, 1, 1, C.bone], [13, 10 + u, 1, 1, C.bone],
    [8, 2 + u, 9, 1, C.white],
  ]);
  if (!opts.worker) {
    // dry expression: one heavy brow
    detail(ctx, [[9, 4 + u, 3, 1, C.boneDark], [14, 4 + u, 3, 1, C.boneDark]]);
  }
}

const heroSpecs = () => heroSpecs32(IMPLEMENTED_APPEARANCES);

// ---------------- NPCs & enemies ----------------

function humanoid(ctx: Canvasish, f: Frame, c: { skin: string; top: string; bottom: string; hat?: string; trim?: string }) {
  const u = bob(f);
  paint(ctx, [
    [9, 23, 2, 7 - legLift(f, 0), c.bottom], [13, 23, 2, 7 - legLift(f, 1), c.bottom],
    [8, 30, 3, 1, C.black], [13, 30, 3, 1, C.black],
    [6, 14 + u, 2, 8, c.top], [16, 14 + u, 2, 8, c.top],
    [8, 13 + u, 8, 10, c.top],
    [9, 6 + u, 6, 7, c.skin],
  ]);
  detail(ctx, [
    [10, 9 + u, 1, 1, C.black], [13, 9 + u, 1, 1, C.black], [11, 11 + u, 2, 1, C.skinDark],
    [6, 22 + u, 2, 1, c.skin], [16, 22 + u, 2, 1, c.skin],
  ]);
  if (c.trim) detail(ctx, [[11, 13 + u, 2, 10, c.trim]]);
  if (c.hat) paint(ctx, [[9, 3 + u, 6, 3, c.hat], [7, 6 + u, 10, 1, c.hat]]);
}

function npcSpecs(): TexSpec[] {
  const H = (key: string, draw: (ctx: Canvasish) => void, w = 24, h = 32): TexSpec => ({ key, w, h, draw });
  return [
    H('pell', (ctx) => { humanoid(ctx, 0, { skin: C.skin, top: C.plum, bottom: C.charcoal, hat: C.black, trim: C.plumLight }); detail(ctx, [[9, 15, 6, 1, C.gold], [11, 16, 2, 2, C.gold]]); }),
    H('mott', (ctx) => { humanoid(ctx, 0, { skin: C.skinDark, top: C.teal, bottom: C.brownDark }); paint(ctx, [[9, 16, 6, 7, C.parchment]]); }),
    H('marn', (ctx) => { humanoid(ctx, 0, { skin: C.skin, top: C.brown, bottom: C.charcoal }); paint(ctx, [[9, 15, 6, 8, C.brownDark]]); detail(ctx, [[9, 8, 6, 2, C.ironDark], [10, 8, 1, 1, C.gold], [13, 8, 1, 1, C.gold], [12, 18, 1, 1, C.iron]]); }),
    H('clerk', (ctx) => humanoid(ctx, 0, { skin: C.skin, top: C.gold, bottom: C.charcoal, trim: C.parchment })),
    H('relief', (ctx) => { humanoid(ctx, 0, { skin: C.skinDark, top: C.teal, bottom: C.tealDark, hat: C.yellow }); detail(ctx, [[17, 10, 2, 12, C.wood]]); }),
    H('crowd', (ctx) => { humanoid(ctx, 0, { skin: C.skin, top: C.red, bottom: C.brownDark }); paint(ctx, [[17, 4, 2, 10, C.skin]]); }),
    H('crowd2', (ctx) => { humanoid(ctx, 0, { skin: C.skinDark, top: C.moss, bottom: C.charcoal }); paint(ctx, [[18, 2, 1, 12, C.wood], [15, 0, 7, 4, C.parchment]]); detail(ctx, [[16, 1, 5, 1, C.red]]); }),
    H('ribbs', (ctx) => { skeletonBase(ctx, 0, { worker: true }); paint(ctx, [[8, 0, 9, 3, C.yellow], [6, 3, 13, 1, C.goldDark]]); detail(ctx, [[11, 12, 3, 2, C.gold]]); }),
    H('worker_strike', (ctx) => { skeletonBase(ctx, 0, { worker: true }); paint(ctx, [[18, 4, 1, 14, C.wood], [14, 0, 9, 5, C.parchment]]); detail(ctx, [[15, 2, 7, 1, C.red]]); }),
    H('worker_strike2', (ctx) => { skeletonBase(ctx, 0, { worker: true }); paint(ctx, [[5, 1, 1, 12, C.wood], [1, 0, 9, 4, C.parchment]]); detail(ctx, [[2, 1, 7, 1, C.black]]); }),
    // Mythic enemies (Dennis's playtest note): same ids and stats, redrawn as monsters.
    H('collector', (ctx) => { // Debt Minotaur
      paint(ctx, [
        [2, 2, 4, 2, C.bone], [1, 0, 2, 3, C.bone], [18, 2, 4, 2, C.bone], [21, 0, 2, 3, C.bone],
        [1, 13, 3, 9, C.brown], [20, 13, 3, 9, C.brown], [4, 12, 16, 10, C.brown], [7, 12, 10, 10, C.stoneDark],
        [6, 2, 12, 9, C.brownDark], [8, 8, 8, 4, C.brown],
        [6, 22, 5, 8, C.charcoal], [13, 22, 5, 8, C.charcoal], [6, 29, 5, 2, C.black], [13, 29, 5, 2, C.black],
        [19, 18, 5, 6, C.parchmentDark],
      ]);
      detail(ctx, [[8, 5, 2, 1, C.red], [14, 5, 2, 1, C.red], [9, 10, 1, 1, C.black], [14, 10, 1, 1, C.black], [11, 11, 2, 2, C.gold], [11, 13, 2, 6, C.red], [20, 20, 3, 1, C.brownDark], [20, 22, 3, 1, C.brownDark]]);
    }),
    H('wisp', (ctx) => { // Invoice Harpy
      paint(ctx, [
        [0, 8, 7, 10, C.parchment], [1, 18, 5, 3, C.parchment], [17, 8, 7, 10, C.parchment], [18, 18, 5, 3, C.parchment],
        [8, 10, 8, 12, C.plum], [8, 3, 8, 7, C.boneShade], [7, 2, 10, 3, C.robe],
        [9, 22, 2, 5, C.gold], [13, 22, 2, 5, C.gold], [8, 27, 4, 1, C.goldDark], [12, 27, 4, 1, C.goldDark],
      ]);
      detail(ctx, [[1, 11, 5, 1, C.parchmentDark], [1, 14, 5, 1, C.parchmentDark], [18, 11, 5, 1, C.parchmentDark], [18, 14, 5, 1, C.parchmentDark], [2, 15, 2, 2, C.red], [19, 15, 2, 2, C.red], [9, 6, 2, 1, C.red], [13, 6, 2, 1, C.red], [11, 8, 2, 1, C.gold], [10, 13, 4, 1, C.plumLight]]);
    }),
    H('mite', (ctx) => { // Rust Basilisk
      const rust = '#9a5a2e', rustLight = '#c07a3e';
      paint(ctx, [
        [0, 24, 4, 3, rust], [2, 20, 16, 6, rust], [14, 17, 5, 5, rust], [14, 12, 8, 7, rust],
        [15, 9, 2, 3, C.red], [18, 8, 2, 4, C.red], [21, 10, 1, 3, C.red],
        [5, 26, 2, 3, C.brownDark], [12, 26, 2, 3, C.brownDark],
      ]);
      detail(ctx, [[4, 21, 3, 2, rustLight], [9, 22, 3, 2, rustLight], [15, 14, 2, 2, rustLight], [18, 14, 2, 2, C.yellow], [19, 14, 1, 2, C.black], [22, 17, 2, 1, C.red], [7, 24, 2, 1, C.ironDark], [13, 24, 2, 1, C.ironDark]]);
    }),
    H('engine', (ctx) => { // Foreclosure Hydra: Audit, Red Stamp and Repossession heads
      paint(ctx, [
        [54, 46, 8, 6, C.tealDark], [58, 40, 4, 8, C.tealDark],
        [12, 20, 6, 18, C.teal], [29, 14, 6, 24, C.teal], [46, 20, 6, 18, C.teal],
        [10, 36, 44, 22, C.tealDark], [18, 42, 28, 14, C.parchment],
        [10, 56, 10, 6, C.tealDark], [44, 56, 10, 6, C.tealDark], [10, 61, 10, 2, C.black], [44, 61, 10, 2, C.black],
        [6, 12, 14, 10, C.teal], [24, 4, 16, 12, C.teal], [44, 12, 14, 10, C.teal],
        [26, 1, 3, 4, C.gold], [35, 1, 3, 4, C.gold],
      ]);
      detail(ctx, [
        [9, 14, 3, 2, C.gold], [27, 7, 3, 2, C.red], [34, 7, 3, 2, C.red], [51, 14, 3, 2, C.violetLight],
        [6, 19, 8, 2, C.black], [28, 14, 8, 4, C.red], [50, 19, 8, 2, C.black],
        [20, 45, 24, 1, C.parchmentDark], [20, 48, 22, 1, C.parchmentDark], [20, 51, 24, 1, C.parchmentDark],
        [30, 52, 4, 4, C.gold], [24, 38, 4, 2, C.violet], [36, 38, 4, 2, C.violet],
      ]);
    }, 64, 64),
  ];
}

// ---------------- Props (16×16) ----------------

function propSpecs(): TexSpec[] {
  const P = (key: string, rects: Rect[], details: Rect[] = [], w = 16, h = 16): TexSpec => ({
    key, w, h, draw: (ctx) => { paint(ctx, rects); detail(ctx, details); },
  });
  return [
    P('desk', [[1, 6, 14, 8, C.wood]], [[1, 6, 14, 1, C.woodLight], [3, 3, 6, 4, C.parchment], [4, 4, 4, 1, C.red], [10, 2, 3, 5, C.parchmentDark]]),
    P('desk_side', [[1, 6, 14, 8, C.wood]], [[1, 6, 14, 1, C.woodLight], [4, 3, 8, 4, C.parchment], [5, 4, 6, 1, C.red], [5, 5, 3, 1, C.red]]),
    P('anvil', [[3, 6, 10, 4, C.ironDark], [6, 10, 4, 4, C.ironDark], [4, 14, 8, 1, C.ironDark]], [[3, 6, 10, 1, C.iron]]),
    P('bench', [[1, 8, 14, 3, C.wood], [2, 11, 2, 4, C.brownDark], [12, 11, 2, 4, C.brownDark]], [[1, 8, 14, 1, C.woodLight]]),
    P('bench_rest', [[1, 10, 14, 3, C.wood], [2, 13, 2, 2, C.brownDark], [12, 13, 2, 2, C.brownDark], [5, 1, 6, 5, C.bone], [5, 6, 6, 4, C.bone]], [[6, 3, 1, 1, C.black], [9, 3, 1, 1, C.black], [6, 7, 4, 1, C.boneDark], [12, 0, 3, 2, C.white]]),
    P('plant', [[5, 10, 6, 5, C.red], [4, 3, 8, 7, C.moss]], [[6, 4, 2, 2, C.mossLight], [9, 6, 2, 2, C.mossDark]]),
    P('string_board', [[1, 1, 14, 13, C.brownLight]], [[3, 3, 3, 3, C.parchment], [10, 3, 3, 3, C.parchment], [6, 9, 3, 3, C.parchment], [5, 4, 5, 1, C.red], [7, 6, 1, 3, C.red], [11, 6, 1, 4, C.red], [7, 7, 2, 2, C.violet]]),
    P('noticeboard', [[1, 1, 14, 10, C.wood], [3, 11, 2, 4, C.brownDark], [11, 11, 2, 4, C.brownDark]], [[3, 3, 4, 5, C.parchment], [8, 2, 5, 4, C.parchment], [9, 7, 4, 3, C.white], [4, 4, 2, 1, C.red]]),
    P('stall_closed', [[1, 3, 14, 12, C.wood], [0, 1, 16, 3, C.redDark]], [[2, 5, 12, 1, C.brownDark], [2, 8, 12, 1, C.brownDark], [2, 11, 12, 1, C.brownDark], [4, 6, 8, 2, C.parchment]]),
    P('stall_open', [[1, 8, 14, 7, C.wood], [0, 1, 16, 3, C.red], [1, 4, 1, 4, C.brownDark], [14, 4, 1, 4, C.brownDark]], [[0, 1, 2, 3, C.white], [4, 1, 2, 3, C.white], [8, 1, 2, 3, C.white], [12, 1, 2, 3, C.white], [3, 6, 3, 2, C.red], [8, 6, 3, 2, C.teal], [6, 9, 4, 3, C.skin], [7, 10, 1, 1, C.black]]),
    P('counter', [[1, 8, 14, 7, C.wood], [5, 1, 6, 5, C.bone], [6, 6, 4, 3, C.bone]], [[6, 3, 1, 1, C.black], [9, 3, 1, 1, C.black], [2, 9, 4, 2, C.iron], [8, 10, 3, 2, C.violet], [12, 9, 2, 3, C.parchment]]),
    P('well', [[2, 7, 12, 8, C.stone], [3, 2, 1, 6, C.wood], [12, 2, 1, 6, C.wood], [2, 1, 12, 2, C.redDark]], [[4, 8, 8, 2, C.water], [2, 7, 12, 1, C.stoneLight]]),
    P('winch', [[2, 4, 12, 10, C.wood], [5, 1, 6, 6, C.ironDark]], [[7, 3, 2, 2, C.iron], [3, 10, 10, 1, C.brownDark], [10, 2, 2, 1, C.red]]),
    P('ledger', [[3, 7, 10, 8, C.wood], [2, 4, 12, 4, C.parchment]], [[3, 5, 4, 1, C.red], [9, 5, 4, 1, C.black], [8, 4, 1, 4, C.parchmentDark]]),
    P('sign', [[2, 2, 12, 7, C.parchment], [7, 9, 2, 6, C.wood]], [[3, 4, 10, 1, C.red], [3, 6, 8, 1, C.black]]),
    P('crate_seal', [[1, 3, 14, 12, C.woodLight]], [[1, 3, 14, 1, C.parchmentDark], [1, 8, 14, 1, C.wood], [6, 6, 4, 4, C.red], [7, 7, 2, 2, C.gold]]),
    P('scrap_pile', [[1, 8, 14, 7, C.ironDark], [4, 4, 8, 5, C.ironDark]], [[3, 9, 3, 2, C.iron], [8, 6, 3, 2, '#9a5a2e'], [10, 11, 3, 2, C.iron], [5, 12, 2, 2, '#9a5a2e']]),
    P('chest', [[2, 6, 12, 9, C.brown], [2, 4, 12, 3, C.brownLight]], [[2, 9, 12, 1, C.gold], [7, 8, 2, 3, C.gold]]),
    P('chest_open', [[2, 8, 12, 7, C.brown], [2, 2, 12, 3, C.brownLight]], [[3, 9, 10, 2, C.black], [2, 11, 12, 1, C.gold]]),
    P('archive_desk', [[1, 6, 14, 8, C.brownDark]], [[2, 2, 5, 5, C.parchment], [8, 3, 6, 4, C.parchment], [9, 4, 2, 2, C.red], [3, 4, 3, 1, C.black]]),
    P('seal', [[3, 3, 10, 10, C.redDark]], [[5, 5, 6, 6, C.red], [7, 4, 1, 8, C.redDark], [6, 6, 4, 4, C.gold], [7, 6, 1, 4, C.redDark]]),
    P('engine_wreck', [[1, 8, 14, 6, C.tealDark], [2, 4, 5, 5, C.teal], [9, 5, 5, 4, C.teal]], [[3, 6, 2, 1, C.black], [10, 6, 2, 1, C.black], [5, 11, 6, 2, C.parchment], [12, 12, 2, 2, C.red]]),
    P('marker_bang', [[6, 1, 4, 9, C.red], [6, 11, 4, 3, C.red]], [[7, 1, 1, 8, C.white]]),
    P('marker_talk', [[2, 2, 12, 9, C.parchment], [4, 11, 3, 3, C.parchment]], [[4, 6, 2, 2, C.charcoal], [7, 6, 2, 2, C.charcoal], [10, 6, 2, 2, C.charcoal]]),
    P('tap_target', [[3, 3, 10, 1, C.gold], [3, 12, 10, 1, C.gold], [3, 3, 1, 10, C.gold], [12, 3, 1, 10, C.gold]], [], 16, 16),
  ];
}

// ---------------- Tiles (16×16) ----------------

type Ambient = 'indoor' | 'village' | 'yard' | 'cellar';

function noise(seed: number) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

function tileSpecs(): TexSpec[] {
  const out: TexSpec[] = [];
  const T = (key: string, draw: (ctx: Canvasish) => void) => out.push({ key, w: 16, h: 16, draw });
  const speckle = (ctx: Canvasish, base: string, spots: string[], seed: number, n = 10) => {
    ctx.fillStyle = base; ctx.fillRect(0, 0, 16, 16);
    const r = noise(seed);
    for (let i = 0; i < n; i++) { ctx.fillStyle = spots[i % spots.length]; ctx.fillRect(Math.floor(r() * 16), Math.floor(r() * 16), 1 + (i % 2), 1); }
  };
  T('t_grass', (ctx) => speckle(ctx, C.moss, [C.mossLight, C.mossDark], 3, 14));
  T('t_path', (ctx) => { speckle(ctx, '#8d7a5b', ['#a08c69', '#6f5f45'], 9, 12); });
  T('t_wood', (ctx) => {
    ctx.fillStyle = C.wood; ctx.fillRect(0, 0, 16, 16);
    detail(ctx, [[0, 0, 16, 1, C.woodLight], [0, 5, 16, 1, C.brownDark], [0, 10, 16, 1, C.brownDark], [0, 15, 16, 1, C.brownDark], [6, 1, 1, 4, C.brownDark], [12, 6, 1, 4, C.brownDark], [3, 11, 1, 4, C.brownDark]]);
  });
  T('t_stone', (ctx) => { speckle(ctx, C.stoneDark, [C.stone, C.charcoal], 21, 10); detail(ctx, [[0, 7, 16, 1, C.charcoal], [7, 0, 1, 7, C.charcoal], [3, 8, 1, 8, C.charcoal]]); });
  T('t_door', (ctx) => { ctx.fillStyle = C.brownDark; ctx.fillRect(0, 0, 16, 16); detail(ctx, [[2, 0, 12, 16, C.wood], [7, 0, 2, 16, C.brownDark], [11, 8, 2, 2, C.gold]]); });
  T('t_doorway', (ctx) => { ctx.fillStyle = C.black; ctx.fillRect(0, 0, 16, 16); detail(ctx, [[0, 14, 16, 2, C.stoneDark]]); });
  T('t_water', (ctx) => { ctx.fillStyle = C.water; ctx.fillRect(0, 0, 16, 16); detail(ctx, [[2, 4, 5, 1, C.waterLight], [9, 10, 5, 1, C.waterLight]]); });
  T('t_tree', (ctx) => {
    speckle(ctx, C.moss, [C.mossLight, C.mossDark], 5, 6);
    paint(ctx, [[6, 11, 4, 4, C.brownDark], [2, 2, 12, 10, C.tealDark]]);
    detail(ctx, [[4, 3, 4, 3, C.teal], [9, 6, 3, 2, C.teal]]);
  });
  T('t_house', (ctx) => {
    ctx.fillStyle = C.plum; ctx.fillRect(0, 0, 16, 16);
    detail(ctx, [[0, 0, 16, 6, C.redDark], [0, 5, 16, 1, C.outline], [3, 8, 4, 4, C.gold], [9, 8, 4, 4, C.gold], [4, 9, 2, 2, C.goldDark], [10, 9, 2, 2, C.goldDark], [0, 15, 16, 1, C.outline]]);
  });
  T('t_fence', (ctx) => { speckle(ctx, C.moss, [C.mossLight], 7, 6); paint(ctx, [[0, 6, 16, 2, C.wood], [0, 11, 16, 2, C.wood], [2, 4, 2, 11, C.woodLight], [12, 4, 2, 11, C.woodLight]]); });
  T('t_crates', (ctx) => { speckle(ctx, '#8d7a5b', ['#6f5f45'], 11, 6); paint(ctx, [[1, 4, 14, 11, C.woodLight]]); detail(ctx, [[1, 9, 14, 1, C.wood], [7, 4, 1, 11, C.wood], [2, 1, 6, 3, C.parchment]]); });
  const wall = (key: string, base: string, line: string, top: string) =>
    T(key, (ctx) => {
      ctx.fillStyle = base; ctx.fillRect(0, 0, 16, 16);
      detail(ctx, [[0, 0, 16, 2, top], [0, 7, 16, 1, line], [0, 14, 16, 2, line], [5, 2, 1, 5, line], [11, 8, 1, 6, line]]);
    });
  wall('t_wall_indoor', C.plum, C.outline, C.plumLight);
  wall('t_wall_village', C.stoneDark, C.charcoal, C.stone);
  wall('t_wall_yard', C.stone, C.stoneDark, C.stoneLight);
  wall('t_wall_cellar', C.charcoal, C.black, C.stoneDark);
  return out;
}

export function tileTexture(ch: string, ambient: Ambient): string {
  switch (ch) {
    case '#': return `t_wall_${ambient}`;
    case 'T': return 't_tree';
    case 'H': return 't_house';
    case 'f': return 't_fence';
    case 'c': return 't_crates';
    case 'w': return 't_water';
    case ',': return 't_grass';
    case '_': return 't_path';
    case '.': return 't_wood';
    case ':': return 't_stone';
    case 'D': return ambient === 'village' ? 't_door' : 't_doorway';
  }
  return 't_grass';
}

export function allTextureSpecs(): TexSpec[] {
  return [...heroSpecs(), ...monsterSpecs32(), ...npcSpecs(), ...propSpecs(), ...tileSpecs()];
}

/** Appearance keys that must exist as textures, validated at boot. */
export function requiredAppearanceKeys(): string[] {
  const keys: string[] = [];
  for (const hero of Object.keys(ANCHORS)) for (const app of IMPLEMENTED_APPEARANCES) keys.push(heroTexKey(hero, app, 0));
  return keys;
}
