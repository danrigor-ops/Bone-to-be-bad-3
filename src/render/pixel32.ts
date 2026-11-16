// "32-bit era" pixel painter: shapes are rasterised onto a small grid of materials, then every
// material is shaded with its own three-tone ramp (light from the upper left, two-pixel shadow on
// the lower right) and the silhouette gets a plum outline. All art is still generated in code and
// still provisional (see docs/ASSET_INVENTORY.md).
import type { Canvasish } from './sprites';
import { C } from './palette';

export interface Mat { c: string; l: string; d: string; flat?: boolean }
export const ramp = (c: string, l: string, d: string): Mat => ({ c, l, d });
export const flat = (c: string): Mat => ({ c, l: c, d: c, flat: true });

/** Material ramps built on the III palette. */
export const M = {
  bone: ramp(C.bone, C.white, C.boneShade),
  boneShade: ramp(C.boneShade, C.bone, C.boneDark),
  coat: ramp(C.charcoal, '#4a4656', '#1d1b24'),
  goblin: ramp(C.goblin, '#9bcf70', C.goblinDark),
  goblinDark: ramp(C.goblinDark, C.goblin, '#36561f'),
  ogre: ramp(C.ogre, '#a8c19e', C.ogreDark),
  ogreDark: ramp(C.ogreDark, C.ogre, '#3f5240'),
  belly: ramp('#93ad8a', '#b3c9aa', C.ogre),
  robe: ramp(C.robe, '#4f3d6b', C.robeDark),
  robeDark: ramp(C.robeDark, C.robe, '#17111f'),
  skin: ramp(C.skin, '#efc6a0', C.skinDark),
  hair: ramp(C.charcoal, C.stone, C.black),
  brown: ramp(C.brown, C.brownLight, C.brownDark),
  brownDark: ramp(C.brownDark, C.brown, '#2e1f14'),
  brownLight: ramp(C.brownLight, '#a8805a', C.brown),
  wood: ramp(C.wood, C.woodLight, C.brownDark),
  iron: ramp(C.iron, '#cdd2d6', C.ironDark),
  ironDark: ramp(C.ironDark, C.iron, '#41454a'),
  gold: ramp(C.gold, '#f0cf6a', C.goldDark),
  yellow: ramp(C.yellow, '#f4dc72', C.goldDark),
  red: ramp(C.red, '#d0685a', C.redDark),
  violet: ramp(C.violet, C.violetLight, '#5e3580'),
  parchment: ramp(C.parchment, '#f6ecd0', C.parchmentDark),
  parchmentDark: ramp(C.parchmentDark, C.parchment, '#a8956a'),
  plum: ramp(C.plum, C.plumLight, '#33203a'),
  black: ramp(C.black, C.charcoal, C.black),
  stone: ramp(C.stone, C.stoneLight, C.stoneDark),
  stoneDark: ramp(C.stoneDark, C.stone, '#33313a'),
  teal: ramp(C.teal, '#58908b', C.tealDark),
  tealDark: ramp(C.tealDark, C.teal, '#1b3332'),
  rust: ramp('#9a5a2e', '#c07a3e', '#6a3a1c'),
};

type P = [number, number];

export class Grid {
  private px: (Mat | null)[];
  constructor(public w: number, public h: number) {
    this.px = new Array(w * h).fill(null);
  }
  set(x: number, y: number, m: Mat) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.px[y * this.w + x] = m;
  }
  get(x: number, y: number): Mat | null {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    return this.px[y * this.w + x];
  }
  clear(x: number, y: number, w: number, h: number) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const X = Math.round(x + i), Y = Math.round(y + j);
      if (X >= 0 && Y >= 0 && X < this.w && Y < this.h) this.px[Y * this.w + X] = null;
    }
    return this;
  }
  rect(x: number, y: number, w: number, h: number, m: Mat) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, m);
    return this;
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, m: Mat) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / (rx + 0.5), dy = (y + 0.5 - cy) / (ry + 0.5);
        if (dx * dx + dy * dy <= 1) this.set(x, y, m);
      }
    }
    return this;
  }
  poly(pts: P[], m: Mat) {
    const ys = pts.map((p) => p[1]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
      const yc = y + 0.5;
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
        if ((y0 <= yc && y1 > yc) || (y1 <= yc && y0 > yc)) xs.push(x0 + ((yc - y0) / (y1 - y0)) * (x1 - x0));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) this.set(x, y, m);
      }
    }
    return this;
  }
  /** Thick line (limbs, weapons, necks). */
  line(x0: number, y0: number, x1: number, y1: number, t: number, m: Mat) {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
    const r = t / 2;
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n, y = y0 + ((y1 - y0) * i) / n;
      if (t <= 1) this.set(Math.floor(x), Math.floor(y), m);
      else this.rect(Math.round(x - r), Math.round(y - r), t, t, m);
    }
    return this;
  }
  /** Unshaded detail pixels (eyes, stitching, ledger lines). */
  dots(rects: [number, number, number, number, string][]) {
    for (const [x, y, w, h, c] of rects) this.rect(x, y, w, h, flat(c));
    return this;
  }

  render(ctx: Canvasish, outline: string | null = C.outline) {
    const { w, h } = this;
    const same = (a: Mat | null, b: Mat | null) => !!a && !!b && a.c === b.c;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const m = this.get(x, y);
        if (!m) {
          if (outline && (this.get(x - 1, y) || this.get(x + 1, y) || this.get(x, y - 1) || this.get(x, y + 1))) {
            ctx.fillStyle = outline;
            ctx.fillRect(x, y, 1, 1);
          }
          continue;
        }
        let col = m.c;
        if (!m.flat) {
          const lit = !same(this.get(x - 1, y), m) || !same(this.get(x, y - 1), m);
          const shade = !same(this.get(x + 1, y), m) || !same(this.get(x, y + 1), m) ||
            !same(this.get(x + 2, y), m) || !same(this.get(x, y + 2), m);
          if (shade && !lit) col = m.d;
          else if (lit && !shade) col = m.l;
        }
        ctx.fillStyle = col;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
}
