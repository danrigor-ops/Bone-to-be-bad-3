// Shaded high-detail party and monster art (twice the pixel density of the tiles).
// World sprites are shown at half scale so they keep a 24×32 (Brugg 32×40) footprint; battle
// shows them at full detail. Provisional stand-in art, generated in code.
import { C } from './palette';
import { Grid, M, flat, type Mat } from './pixel32';
import { HERO_ART } from './heroArt';
import type { Canvasish, Frame, TexSpec } from './sprites';

/** Texture pixels per world pixel for the party and battle monsters. */
export const RES = 2;

export interface Anchor {
  w: number;
  h: number;
  head: { x: number; y: number; w: number };
  torso: { x: number; y: number; w: number; h: number };
  hand: { x: number; y: number };
  raised: { x: number; y: number };
  big?: boolean;
}

/** Walk frames hop up one pixel; the attack frame lunges forward. */
const bob = (f: Frame) => (f === 1 || f === 2 ? -1 : 0);
const LUNGE = 2;

// Canvas size per hero; the art is centred and stands on the bottom row.
const CANVAS: Record<string, { w: number; h: number }> = {
  c404: { w: 48, h: 64 }, grib: { w: 48, h: 64 }, hexa: { w: 48, h: 64 }, brugg: { w: 64, h: 80 },
};
// Where the head (or Hexa's hat brim), torso and right hand sit in each piece of art, as fractions
// of the art's own width and height. Gear layers are placed from these.
const FIT: Record<string, { head: [number, number, number]; torso: [number, number, number, number]; hand: [number, number] }> = {
  c404: { head: [0.22, 0.0, 0.56], torso: [0.1, 0.2, 0.8, 0.27], hand: [0.86, 0.6] },
  grib: { head: [0.28, 0.02, 0.44], torso: [0.3, 0.43, 0.4, 0.26], hand: [0.78, 0.7] },
  hexa: { head: [0.3, 0.12, 0.4], torso: [0.28, 0.38, 0.44, 0.36], hand: [0.76, 0.64] },
  brugg: { head: [0.33, 0.0, 0.34], torso: [0.16, 0.24, 0.68, 0.4], hand: [0.9, 0.7] },
};

function artOrigin(hero: string) {
  const art = HERO_ART[hero], c = CANVAS[hero];
  return { ox: Math.floor((c.w - art.w) / 2), oy: c.h - art.h };
}

export const ANCHORS: Record<string, Anchor> = Object.fromEntries(Object.keys(CANVAS).map((hero) => {
  const art = HERO_ART[hero], c = CANVAS[hero], f = FIT[hero];
  const { ox, oy } = artOrigin(hero);
  const X = (fx: number) => Math.round(ox + fx * art.w), Y = (fy: number) => Math.round(oy + fy * art.h);
  const hand = { x: X(f.hand[0]), y: Y(f.hand[1]) };
  return [hero, {
    w: c.w, h: c.h,
    head: { x: X(f.head[0]), y: Y(f.head[1]), w: Math.max(10, Math.round(f.head[2] * art.w)) },
    torso: { x: X(f.torso[0]), y: Y(f.torso[1]), w: Math.round(f.torso[2] * art.w), h: Math.round(f.torso[3] * art.h) },
    hand,
    raised: { x: hand.x + LUNGE, y: hand.y - 2 },
    big: hero === 'brugg',
  } satisfies Anchor];
}));

function drawArt(ctx: Canvasish, hero: string, f: Frame) {
  const art = HERO_ART[hero];
  const { ox, oy } = artOrigin(hero);
  const dx = ox + (f === 3 ? LUNGE : 0), dy = oy + bob(f);
  const A = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  art.rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      ctx.fillStyle = art.pal[A.indexOf(ch)];
      ctx.fillRect(dx + x, dy + y, 1, 1);
    }
  });
}

function hand(hero: string, f: Frame) {
  const a = ANCHORS[hero];
  return f === 3 ? { x: a.raised.x, y: a.raised.y + bob(f) } : { x: a.hand.x, y: a.hand.y + bob(f) };
}

function head(g: Grid, hero: string, f: Frame, app: string) {
  const a = ANCHORS[hero], u = bob(f);
  const { x, w } = a.head, y = a.head.y + u;
  if (app === 'old_cap') {
    g.rect(x + 2, y - 2, w - 4, 2, M.brownLight).rect(x, y, w, 4, M.brownLight).rect(x - 2, y + 4, w + 6, 2, M.brownDark);
    g.dots([[x + 3, y - 1, 3, 1, C.parchmentDark], [x + w - 5, y + 1, 2, 2, C.brown]]);
  } else if (app === 'union_hat') {
    g.rect(x + 3, y - 4, w - 6, 2, M.yellow).rect(x + 1, y - 2, w - 2, 7, M.yellow).rect(x - 4, y + 5, w + 8, 2, M.gold);
    g.dots([[x + 1, y + 2, w - 2, 1, C.red], [x + Math.floor(w / 2) - 1, y - 2, 3, 3, C.white]]);
  }
}

function body(g: Grid, hero: string, f: Frame, app: string) {
  const a = ANCHORS[hero], u = bob(f);
  const t = { ...a.torso, y: a.torso.y + u };
  // Open coats: narrow side panels so the character art underneath stays visible.
  const panel = Math.max(3, Math.round(t.w * 0.22));
  if (app === 'old_coat') {
    const col: Mat = hero === 'c404' ? M.coat : M.brownDark;
    const len = t.h + 4;
    g.rect(t.x - 2, t.y, panel, len, col).rect(t.x + t.w - panel + 2, t.y, panel, len, col);
    g.rect(t.x - 2, t.y - 1, t.w + 4, 2, col);
    g.rect(t.x, t.y + 4, 3, 3, M.brownLight).rect(t.x + t.w - 3, t.y + t.h - 4, 3, 3, M.teal);
    // ragged hem
    for (const nx of [t.x - 1, t.x + 2, t.x + t.w - 3, t.x + t.w + 1]) g.clear(nx, t.y + len - 2, 1, 2);
  } else if (app === 'funeral_coat') {
    const len = t.h + (a.big ? 16 : 12);
    g.rect(t.x - 2, t.y - 2, panel + 1, len, M.black).rect(t.x + t.w - panel + 1, t.y - 2, panel + 1, len, M.black);
    g.rect(t.x, t.y - 3, t.w, 2, flat(C.violetLight));
    g.dots([[t.x + panel - 2, t.y, 1, len - 4, C.violet], [t.x + t.w - panel + 1, t.y, 1, len - 4, C.violet], [t.x, t.y + 6, 2, 2, C.gold]]);
  }
}

function weapon(g: Grid, hero: string, f: Frame, app: string) {
  const { x, y } = hand(hero, f);
  const big = ANCHORS[hero].big;
  switch (app) {
    case 'old_blade':
      g.line(x, y - 20, x, y - 3, 3, M.boneShade).rect(x - 3, y - 2, 7, 2, M.brownDark).rect(x - 1, y, 3, 5, M.brown);
      g.dots([[x - 1, y - 20, 1, 16, C.white]]);
      break;
    case 'grievance_cleaver':
      g.poly([[x - 2, y - 24], [x + 10, y - 24], [x + 10, y - 7], [x - 2, y - 4]], M.iron).rect(x - 1, y - 4, 3, 10, M.brown);
      g.dots([[x + 9, y - 24, 1, 17, C.violet], [x + 1, y - 21, 2, 2, C.ironDark], [x - 2, y - 24, 12, 1, C.white]]);
      break;
    case 'shiv':
      g.line(x, y - 9, x, y - 1, 2, M.iron).rect(x - 1, y, 3, 4, M.brown);
      break;
    case 'salvage_shiv':
      g.poly([[x - 1, y - 17], [x + 3, y - 15], [x + 3, y], [x - 1, y]], M.ironDark).rect(x - 1, y, 5, 4, M.red);
      g.dots([[x + 3, y - 12, 1, 1, C.iron], [x + 3, y - 7, 1, 1, C.iron], [x, y - 16, 1, 15, C.iron]]);
      break;
    case 'knuckles':
      if (big) g.rect(x - 5, y - 2, 10, 5, M.ironDark); else g.rect(x - 3, y - 2, 6, 4, M.ironDark);
      break;
    case 'riveted_knuckles':
      if (big) g.rect(x - 6, y - 3, 12, 7, M.iron).dots([[x - 4, y - 2, 2, 2, C.gold], [x - 1, y - 2, 2, 2, C.gold], [x + 2, y - 2, 2, 2, C.gold]]);
      else g.rect(x - 4, y - 3, 8, 5, M.iron).dots([[x - 3, y - 2, 1, 1, C.gold], [x, y - 2, 1, 1, C.gold], [x + 2, y - 2, 1, 1, C.gold]]);
      break;
    case 'wand':
      g.line(x, y - 14, x, y + 2, 2, M.brownLight).dots([[x, y - 16, 2, 2, C.white]]);
      break;
    case 'clause_wand':
      g.line(x, y - 20, x, y + 2, 2, M.brownDark).rect(x - 3, y - 25, 8, 4, M.parchment);
      g.dots([[x - 3, y - 23, 8, 1, C.parchmentDark], [x, y - 28, 2, 2, C.violetLight]]);
      break;
  }
}

export const LAYER_KIND: Record<string, 'head' | 'body' | 'weapon'> = {
  old_cap: 'head', union_hat: 'head', old_coat: 'body', funeral_coat: 'body',
  old_blade: 'weapon', grievance_cleaver: 'weapon', shiv: 'weapon', salvage_shiv: 'weapon',
  knuckles: 'weapon', riveted_knuckles: 'weapon', wand: 'weapon', clause_wand: 'weapon',
};

export const heroTexKey = (hero: string, layer: string, f: Frame) => `${hero}_${layer}_${f}`;
const FRAMES: Frame[] = [0, 1, 2, 3];

const spec = (key: string, w: number, h: number, fill: (g: Grid) => void): TexSpec => ({
  key, w, h, draw: (ctx: Canvasish) => { const g = new Grid(w, h); fill(g); g.render(ctx); },
});

export function heroSpecs32(appearances: readonly string[]): TexSpec[] {
  const out: TexSpec[] = [];
  for (const hero of Object.keys(ANCHORS)) {
    const a = ANCHORS[hero];
    for (const f of FRAMES) {
      out.push({ key: heroTexKey(hero, 'base', f), w: a.w, h: a.h, draw: (ctx) => drawArt(ctx, hero, f) });
      for (const app of appearances) {
        const kind = LAYER_KIND[app];
        out.push(spec(heroTexKey(hero, app, f), a.w, a.h, (g) => (kind === 'head' ? head : kind === 'body' ? body : weapon)(g, hero, f, app)));
      }
    }
  }
  return out;
}

// ---------------- Mythic monsters (battle) ----------------

function harpy(g: Grid) {
  g.poly([[16, 22], [0, 10], [2, 30], [8, 40], [17, 36]], M.parchment).poly([[32, 22], [48, 10], [46, 30], [40, 40], [31, 36]], M.parchment);
  g.dots([[3, 18, 10, 1, C.parchmentDark], [4, 24, 11, 1, C.parchmentDark], [6, 30, 9, 1, C.parchmentDark],
    [35, 18, 10, 1, C.parchmentDark], [33, 24, 11, 1, C.parchmentDark], [33, 30, 9, 1, C.parchmentDark],
    [5, 33, 3, 3, C.red], [40, 33, 3, 3, C.red]]);
  g.line(20, 46, 19, 55, 2, M.gold).line(28, 46, 29, 55, 2, M.gold).rect(15, 56, 7, 2, M.gold).rect(27, 56, 7, 2, M.gold);
  g.ellipse(24, 38, 8, 11, M.plum);
  g.dots([[21, 34, 1, 1, C.plumLight], [27, 34, 1, 1, C.plumLight], [22, 36, 1, 1, C.plumLight], [26, 36, 1, 1, C.plumLight], [23, 38, 3, 1, C.plumLight],
    [15, 58, 1, 1, C.black], [21, 58, 1, 1, C.black], [27, 58, 1, 1, C.black], [33, 58, 1, 1, C.black]]);
  g.rect(15, 16, 4, 13, M.robe).rect(29, 16, 4, 13, M.robe).ellipse(24, 14, 10, 8, M.robe);
  g.ellipse(24, 19, 6, 7, M.bone);
  g.poly([[22, 22], [27, 22], [24, 27]], M.gold);
  g.dots([[20, 17, 3, 2, C.red], [26, 17, 3, 2, C.red], [19, 15, 4, 1, C.robeDark], [26, 15, 4, 1, C.robeDark]]);
}

function minotaur(g: Grid) {
  g.rect(15, 46, 7, 14, M.coat).rect(26, 46, 7, 14, M.coat).rect(14, 59, 9, 4, M.black).rect(25, 59, 9, 4, M.black);
  g.ellipse(24, 35, 14, 11, M.brown);
  g.poly([[16, 30], [32, 30], [31, 48], [17, 48]], M.stoneDark);
  g.poly([[21, 30], [27, 30], [24, 38]], M.parchment).poly([[23, 31], [25, 31], [26, 41], [24, 43], [22, 41]], M.red);
  g.line(11, 29, 7, 45, 6, M.brown).ellipse(7, 48, 3, 3, M.brownDark);
  g.line(37, 29, 41, 41, 6, M.brown).rect(37, 41, 10, 13, M.parchmentDark);
  g.dots([[39, 44, 6, 1, C.brownDark], [39, 47, 6, 1, C.brownDark], [39, 50, 4, 1, C.brownDark], [43, 50, 2, 2, C.red]]);
  g.ellipse(13, 12, 3, 2, M.brownDark).ellipse(35, 12, 3, 2, M.brownDark);
  g.poly([[16, 10], [5, 6], [2, 0], [8, 3], [17, 5]], M.bone).poly([[32, 10], [43, 6], [46, 0], [40, 3], [31, 5]], M.bone);
  g.ellipse(24, 14, 9, 9, M.brownDark);
  g.ellipse(24, 21, 6, 4, M.brown);
  g.ellipse(24, 26, 2, 2, M.gold);
  g.dots([[19, 12, 3, 2, C.red], [26, 12, 3, 2, C.red], [18, 10, 5, 1, C.black], [25, 10, 5, 1, C.black], [21, 21, 2, 1, C.black], [25, 21, 2, 1, C.black], [24, 26, 1, 1, C.brownDark]]);
}

function basilisk(g: Grid) {
  g.line(2, 56, 10, 52, 4, M.rust);
  g.ellipse(20, 52, 14, 7, M.rust).ellipse(20, 56, 10, 2, M.parchmentDark);
  g.rect(10, 57, 3, 5, M.brownDark).rect(25, 57, 3, 5, M.brownDark);
  g.line(28, 48, 34, 34, 7, M.rust);
  g.poly([[30, 26], [31, 16], [34, 25]], M.red).poly([[34, 25], [36, 13], [38, 25]], M.red).poly([[38, 26], [42, 18], [42, 28]], M.red);
  g.ellipse(36, 30, 8, 6, M.rust).poly([[38, 32], [46, 33], [40, 37]], M.rust);
  g.ellipse(38, 28, 2, 2, flat(C.yellow));
  g.dots([[38, 27, 1, 3, C.black], [45, 34, 3, 1, C.red], [47, 33, 1, 1, C.red],
    [12, 48, 3, 2, '#c07a3e'], [18, 47, 3, 2, '#c07a3e'], [24, 49, 3, 2, '#c07a3e'], [30, 40, 2, 2, '#c07a3e'],
    [14, 53, 2, 1, C.ironDark], [22, 52, 2, 1, C.ironDark]]);
}

function hydra(g: Grid) {
  g.line(104, 100, 122, 84, 10, M.tealDark).poly([[118, 82], [127, 74], [124, 90]], M.tealDark);
  g.rect(26, 104, 18, 19, M.tealDark).rect(84, 104, 18, 19, M.tealDark).rect(24, 122, 22, 4, M.black).rect(82, 122, 22, 4, M.black);
  g.line(40, 78, 22, 38, 10, M.teal).line(64, 74, 64, 28, 11, M.teal).line(88, 78, 106, 38, 10, M.teal);
  g.ellipse(64, 92, 42, 24, M.tealDark).ellipse(64, 98, 26, 15, M.parchment);
  for (let k = 0; k < 5; k++) g.dots([[46, 90 + k * 4, 36, 1, C.parchmentDark]]);
  g.ellipse(64, 108, 4, 4, M.gold);
  g.dots([[46, 76, 6, 2, C.violet], [76, 76, 6, 2, C.violet]]);
  // Audit head (left), Red Stamp head (centre), Repossession head (right)
  g.ellipse(20, 30, 13, 10, M.teal).rect(4, 30, 10, 7, M.teal);
  g.ellipse(64, 20, 15, 12, M.teal);
  g.poly([[55, 11], [50, 0], [59, 8]], M.gold).poly([[73, 11], [78, 0], [69, 8]], M.gold);
  g.ellipse(108, 30, 13, 10, M.teal).rect(114, 30, 10, 7, M.teal);
  g.rect(56, 28, 16, 8, M.red);
  g.dots([
    [14, 26, 4, 3, C.gold], [15, 26, 1, 3, C.black], [4, 36, 12, 2, C.black], [6, 36, 1, 2, C.white], [10, 36, 1, 2, C.white],
    [56, 17, 4, 3, C.red], [68, 17, 4, 3, C.red], [57, 18, 1, 1, C.black], [70, 18, 1, 1, C.black], [58, 31, 12, 1, C.redDark],
    [110, 26, 4, 3, C.violetLight], [112, 26, 1, 3, C.black], [112, 36, 12, 2, C.black], [116, 36, 1, 2, C.white], [120, 36, 1, 2, C.white],
  ]);
}

/** Battle textures for the mythic enemies: `${worldKey}_hd`. */
export function monsterSpecs32(): TexSpec[] {
  return [
    spec('wisp_hd', 48, 64, harpy),
    spec('collector_hd', 48, 64, minotaur),
    spec('mite_hd', 48, 64, basilisk),
    spec('engine_hd', 128, 128, hydra),
  ];
}
