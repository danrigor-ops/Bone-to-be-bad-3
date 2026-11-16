import Phaser from 'phaser';
import type { Store } from '../app/store';
import { bus, view } from '../app/bus';
import type { GameState, HeroId } from '../core/types';
import { HERO_IDS } from '../core/types';
import { MAPS, exitAt, visibleObjects, walkable, type MapObject } from '../data/maps';
import { findPath, pathToAdjacent, type P } from '../systems/pathfinding';
import { HeroSprite } from './heroSprite';
import { tileTexture, type Frame } from './sprites';
import { heroGear } from './gear';

const TILE = 16;
const STEP_MS = 140;

export class WorldScene extends Phaser.Scene {
  private store!: Store;
  private mapId = '';
  private tiles?: Phaser.GameObjects.Container;
  private objs: Phaser.GameObjects.GameObject[] = [];
  private player!: HeroSprite;
  private followers: HeroSprite[] = [];
  private trail: P[] = [];
  private path: P[] = [];
  private moving = false;
  private pendingTarget: string | null = null;
  private bubble?: Phaser.GameObjects.Image;
  private tapMark?: Phaser.GameObjects.Image;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private walkPhase = 0;
  private objSig = '';

  constructor() {
    super('world');
  }

  init(data: { store: Store }) {
    this.store = data.store;
  }

  create() {
    this.cameras.main.setRoundPixels(true);
    this.player = new HeroSprite(this, 'c404', 0, 0);
    this.followers = (HERO_IDS.filter((h) => h !== 'c404') as HeroId[]).map((h) => new HeroSprite(this, h, 0, 0));
    this.bubble = this.add.image(0, 0, 'marker_talk').setOrigin(0.5, 1).setVisible(false).setDepth(10000);
    this.tapMark = this.add.image(0, 0, 'tap_target').setOrigin(0, 0).setVisible(false).setDepth(5);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onTap(p));
    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('UP,DOWN,LEFT,RIGHT,W,A,S,D') as Record<string, Phaser.Input.Keyboard.Key>;
    kb.disableGlobalCapture();
    this.store.subscribe((s, prev) => this.onState(s, prev));
    bus.on('cancelMovement', () => this.cancelMovement());
    bus.on('focusRefresh', () => this.updateFocus());
    this.scale.on('resize', () => this.applyZoom());
    if (this.store.state) this.rebuild(this.store.state);
    this.applyZoom();
  }

  private applyZoom() {
    const w = this.scale.width, h = this.scale.height;
    const zoom = Math.max(2, Math.min(5, Math.floor(Math.min(w / (10 * TILE), h / (10 * TILE)))));
    this.cameras.main.setZoom(zoom);
  }

  private onState(s: GameState, prev: GameState | null) {
    if (s.battle) return;
    if (!prev || s.location.id !== this.mapId || prev.battle) {
      this.rebuild(s);
      return;
    }
    // Objects may change (branch props, defeated markers).
    this.syncObjects(s);
    this.syncGear(s);
    if (!this.moving) this.snapPlayer(s);
    if (s.dialogue) this.cancelMovement();
    this.updateFocus();
  }

  rebuild(s: GameState) {
    this.cancelMovement();
    this.mapId = s.location.id;
    const m = MAPS[this.mapId];
    this.tiles?.destroy();
    const imgs: Phaser.GameObjects.Image[] = [];
    m.rows.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        const base = ch === 'T' || ch === 'f' ? 't_grass' : null;
        if (base) imgs.push(this.add.image(x * TILE, y * TILE, base).setOrigin(0));
        imgs.push(this.add.image(x * TILE, y * TILE, tileTexture(ch, m.ambient)).setOrigin(0));
      });
    });
    // Exit hints: small gold arrows on exit tiles so doors are discoverable.
    for (const e of m.exits) {
      const g = this.add.rectangle(e.x * TILE + 8, e.y * TILE + 8, 4, 4, 0xd4a944).setOrigin(0.5);
      imgs.push(g as unknown as Phaser.GameObjects.Image);
    }
    this.tiles = this.add.container(0, 0, imgs).setDepth(0);
    this.objSig = '';
    this.syncObjects(s);
    this.syncGear(s);
    this.trail = [];
    this.snapPlayer(s);
    for (const f of this.followers) f.container.setPosition(this.player.container.x, this.player.container.y);
    this.updateFocus();
  }

  private syncGear(s: GameState) {
    this.player.setGear(heroGear(s, 'c404'));
    this.followers.forEach((f) => f.setGear(heroGear(s, f.hero as HeroId)));
  }

  private syncObjects(s: GameState) {
    const vis = visibleObjects(s, this.mapId);
    const sig = vis.map((o) => o.id).join(',');
    if (sig === this.objSig) return;
    this.objSig = sig;
    for (const o of this.objs) o.destroy();
    this.objs = [];
    const reduced = s.settings.reducedMotion;
    for (const o of vis) {
      const img = this.add.image(o.x * TILE + 8, (o.y + 1) * TILE, o.sprite).setOrigin(0.5, 1).setDepth(o.y * 10 + 5);
      this.objs.push(img);
      if (o.kind === 'marker') {
        const bang = this.add.image(o.x * TILE + 8, o.y * TILE - (img.height - 16) - 2, 'marker_bang').setOrigin(0.5, 1).setScale(0.75).setDepth(9000);
        this.objs.push(bang);
        if (!reduced) this.tweens.add({ targets: bang, y: bang.y - 2, duration: 500, yoyo: true, repeat: -1 });
      }
    }
  }

  private tileCenter(x: number, y: number) {
    return { x: x * TILE + 8, y: (y + 1) * TILE - 1 };
  }

  private snapPlayer(s: GameState) {
    const c = this.tileCenter(s.location.tileX, s.location.tileY);
    this.player.container.setPosition(c.x, c.y).setDepth(s.location.tileY * 10 + 6);
    this.player.setFrame(0);
    this.player.setFlip(s.location.facing === 'left');
    this.positionFollowers(false);
  }

  private positionFollowers(animate: boolean) {
    const s = this.store.state!;
    this.followers.forEach((f, i) => {
      const t = this.trail[this.trail.length - 1 - i];
      const pos = t ? this.tileCenter(t.x, t.y) : { x: this.player.container.x, y: this.player.container.y };
      const off = t ? 0 : (i + 1) * 3;
      const depth = (t ? t.y : s.location.tileY) * 10 + 4 - i * 0.1;
      f.container.setDepth(depth);
      if (animate && !s.settings.reducedMotion) {
        this.tweens.add({ targets: f.container, x: pos.x - off, y: pos.y, duration: STEP_MS });
      } else {
        f.container.setPosition(pos.x - off, pos.y);
      }
      if (t) f.setFlip(pos.x < f.container.x);
    });
  }

  update() {
    const s = this.store.state;
    if (!s || s.battle) return;
    this.updateCamera(s);
    if (this.moving || view.panelOpen || s.dialogue || view.hidden) return;
    const k = this.keys;
    let dx = 0, dy = 0;
    if (k.LEFT.isDown || k.A.isDown) dx = -1;
    else if (k.RIGHT.isDown || k.D.isDown) dx = 1;
    else if (k.UP.isDown || k.W.isDown) dy = -1;
    else if (k.DOWN.isDown || k.S.isDown) dy = 1;
    if (dx || dy) this.stepDir(dx, dy);
  }

  /** Shared by keyboard and on-screen D-pad; same grid rules as tapping. */
  stepDir(dx: number, dy: number) {
    const s = this.store.state!;
    if (this.moving || s.dialogue || s.battle) return;
    this.pendingTarget = null;
    const nx = s.location.tileX + dx, ny = s.location.tileY + dy;
    if (walkable(s, s.location.id, nx, ny) || exitAt(s.location.id, nx, ny)) {
      this.path = [{ x: nx, y: ny }];
      this.step();
    } else {
      this.player.setFlip(dx < 0);
    }
  }

  private updateCamera(s: GameState) {
    const cam = this.cameras.main;
    const m = MAPS[s.location.id];
    const mw = m.rows[0].length * TILE, mh = m.rows.length * TILE;
    const vw = cam.width / cam.zoom, vh = cam.height / cam.zoom;
    const px = this.player.container.x, py = this.player.container.y - 12;
    const cx = mw <= vw ? mw / 2 : Phaser.Math.Clamp(px, vw / 2, mw - vw / 2);
    const cy = mh <= vh ? mh / 2 : Phaser.Math.Clamp(py, vh / 2, mh - vh / 2);
    cam.centerOn(Math.round(cx), Math.round(cy));
  }

  private onTap(p: Phaser.Input.Pointer) {
    const s = this.store.state;
    if (!s || s.battle || s.dialogue || view.panelOpen) return;
    // Phaser maps the pointer through the real canvas/camera transform.
    const tx = Math.floor(p.worldX / TILE), ty = Math.floor(p.worldY / TILE);
    const from = { x: s.location.tileX, y: s.location.tileY };
    const obj = visibleObjects(s, s.location.id).find((o) => o.x === tx && o.y === ty);
    let path: P[] | null;
    if (obj) {
      path = pathToAdjacent(s, from, obj);
      this.pendingTarget = path ? obj.id : null;
    } else {
      path = findPath(s, from, { x: tx, y: ty });
      this.pendingTarget = null;
      if (!path) {
        const ex = exitAt(s.location.id, tx, ty);
        if (ex?.blocked?.(s)) this.store.emit({ type: 'toast', text: ex.blocked(s)! });
      }
    }
    if (!path) return;
    this.tapMark?.setPosition(tx * TILE, ty * TILE).setVisible(true);
    this.path = path;
    if (!this.moving) this.step();
    if (!path.length) this.updateFocus();
  }

  cancelMovement() {
    this.path = [];
    this.tapMark?.setVisible(false);
  }

  private step() {
    const s = this.store.state!;
    const next = this.path.shift();
    if (!next || s.dialogue || s.battle || view.panelOpen) {
      this.moving = false;
      this.player.setFrame(0);
      this.tapMark?.setVisible(false);
      this.updateFocus();
      return;
    }
    const prevTile = { x: s.location.tileX, y: s.location.tileY };
    const prevMap = s.location.id;
    this.moving = true; // keep onState from snapping the sprite ahead of the tween
    const r = this.store.dispatch({ type: 'move', x: next.x, y: next.y });
    const ns = this.store.state!;
    if (!r || r.error || ns.location.id !== prevMap || ns.battle) {
      this.moving = false;
      this.path = [];
      this.tapMark?.setVisible(false);
      if (ns.location.id === prevMap) this.snapPlayer(ns);
      this.updateFocus();
      return;
    }
    if (ns.location.tileX === prevTile.x && ns.location.tileY === prevTile.y) {
      // blocked exit: facing changed only
      this.moving = false;
      this.path = [];
      this.snapPlayer(ns);
      this.updateFocus();
      return;
    }
    this.moving = true;
    this.trail.push(prevTile);
    if (this.trail.length > 3) this.trail.shift();
    const c = this.tileCenter(next.x, next.y);
    this.player.setFlip(ns.location.facing === 'left' || (ns.location.facing !== 'right' && this.player.container.scaleX < 0));
    this.walkPhase = (this.walkPhase + 1) % 2;
    this.player.setFrame((this.walkPhase + 1) as Frame);
    this.followers.forEach((f) => f.setFrame((((this.walkPhase + 1) % 2) + 1) as Frame));
    this.player.container.setDepth(next.y * 10 + 6);
    this.positionFollowers(true);
    this.tweens.add({
      targets: this.player.container, x: c.x, y: c.y, duration: STEP_MS,
      onComplete: () => {
        this.followers.forEach((f) => f.setFrame(0));
        this.step();
      },
    });
  }

  /** Decide which adjacent object the Interact button should act on. */
  updateFocus() {
    const s = this.store.state;
    let focus: MapObject | null = null;
    if (s && !s.battle && !this.moving) {
      const { tileX: x, tileY: y, facing } = s.location;
      const adj = visibleObjects(s, s.location.id).filter((o) => Math.abs(o.x - x) + Math.abs(o.y - y) === 1);
      const fx = x + (facing === 'right' ? 1 : facing === 'left' ? -1 : 0);
      const fy = y + (facing === 'down' ? 1 : facing === 'up' ? -1 : 0);
      focus = adj.find((o) => o.id === this.pendingTarget) ?? adj.find((o) => o.x === fx && o.y === fy) ?? adj[0] ?? null;
    }
    view.focusObject = focus?.id ?? null;
    if (focus && this.bubble) {
      this.bubble.setPosition(focus.x * TILE + 8, focus.y * TILE - 6).setVisible(!s?.dialogue);
    } else this.bubble?.setVisible(false);
    bus.emit('focusChanged', focus ? { id: focus.id, label: focus.label } : null);
  }
}
