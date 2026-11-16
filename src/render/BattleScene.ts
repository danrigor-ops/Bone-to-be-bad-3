import Phaser from 'phaser';
import type { Store } from '../app/store';
import { bus, view } from '../app/bus';
import type { BattleActor, BattleState, GameState, HeroId } from '../core/types';
import { HeroSprite } from './heroSprite';
import { RES } from './art32';
import { heroGear } from './gear';
import { MAPS } from '../data/maps';
import { currentActor } from '../systems/combat';

interface ActorView {
  id: string;
  root: Phaser.GameObjects.Container;
  hero?: HeroSprite;
  img?: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  status: Phaser.GameObjects.Text;
  hpBack: Phaser.GameObjects.Rectangle;
  hpBar: Phaser.GameObjects.Rectangle;
  outline: Phaser.GameObjects.Rectangle;
  w: number;
  h: number;
  home: { x: number; y: number };
}

const ENEMY_TEX: Record<string, string> = {
  paper_wisp: 'wisp', debt_collector: 'collector', rust_mite: 'mite', foreclosure_engine: 'engine',
};

const BG: Record<string, [number, number]> = {
  indoor: [0x3a2840, 0x5a3f42], village: [0x2f4a44, 0x4d6640], yard: [0x3a3f3d, 0x6b5b45], cellar: [0x1d1a24, 0x2f2c38],
};

export class BattleScene extends Phaser.Scene {
  private store!: Store;
  private views = new Map<string, ActorView>();
  private seqShown = -1;
  private encounterKey = '';
  private bg?: Phaser.GameObjects.Graphics;
  private target: string | null = null;
  private scaleF = 2;

  constructor() {
    super('battle');
  }

  init(data: { store: Store }) {
    this.store = data.store;
  }

  create() {
    this.store.subscribe((s) => this.onState(s));
    bus.on('battleTarget', (id) => { this.target = (id as string) ?? null; this.refresh(this.store.state!); });
    this.scale.on('resize', () => { if (this.store.state?.battle) this.build(this.store.state); });
    if (this.store.state?.battle) this.build(this.store.state);
  }

  private onState(s: GameState) {
    if (!s.battle) {
      for (const v of this.views.values()) v.root.destroy();
      this.views.clear();
      this.encounterKey = '';
      view.battleAnimating = false;
      return;
    }
    // Rebuild only for a new battle (different encounter, a retry resetting seq, or nothing built yet).
    if (this.views.size === 0 || s.battle.encounterId !== this.encounterKey || s.battle.seq < this.seqShown) this.build(s);
    else this.refresh(s);
  }

  build(s: GameState) {
    const b = s.battle!;
    this.encounterKey = b.encounterId;
    for (const v of this.views.values()) v.root.destroy();
    this.views.clear();
    this.bg?.destroy();
    const W = this.scale.width, H = this.scale.height;
    this.cameras.main.setZoom(1).centerOn(W / 2, H / 2);
    this.scaleF = Math.max(1, Math.min(3, Math.floor(Math.min(W / 170, H / 140))));
    const amb = MAPS[b.returnTo.id]?.ambient ?? 'yard';
    const [top, floor] = BG[amb];
    this.bg = this.add.graphics();
    this.bg.fillStyle(top).fillRect(0, 0, W, H * 0.45);
    this.bg.fillStyle(floor).fillRect(0, H * 0.45, W, H * 0.55);
    this.bg.fillStyle(0x000000, 0.15);
    for (let x = 0; x < W; x += 16 * this.scaleF) this.bg.fillRect(x, H * 0.45, 2, H * 0.55);
    this.bg.setDepth(0);

    const heroes = b.actors.filter((a) => a.side === 'hero');
    const enemies = b.actors.filter((a) => a.side === 'enemy');
    const sc = this.scaleF;
    // Feet positions: two staggered rows so labels never overlap and nothing clips the bottom.
    const rowA = Math.round(H * 0.56), rowB = Math.round(H - 8);
    const heroPos: Record<string, { x: number; y: number }> = {
      c404: { x: W * 0.11, y: rowA }, grib: { x: W * 0.31, y: rowA },
      hexa: { x: W * 0.13, y: rowB }, brugg: { x: W * 0.34, y: rowB },
    };
    heroes.forEach((a) => {
      const pos = heroPos[a.id] ?? { x: W * 0.2, y: rowB };
      this.addActor(s, a, pos.x, pos.y, sc);
    });
    enemies.forEach((a, i) => {
      const n = enemies.length;
      const boss = a.defId === 'foreclosure_engine';
      const x = n === 1 ? W * 0.74 : W * (0.7 + 0.12 * (i % 2));
      const y = n === 1 ? (boss ? rowB : Math.round(H * 0.8)) : (i === 0 ? rowA : rowB);
      this.addActor(s, a, x, y, boss ? Math.max(1, Math.min(sc, Math.floor((H - 70) / 64))) : sc);
    });
    this.seqShown = b.seq;
    this.refresh(s);
  }

  private addActor(s: GameState, a: BattleActor, x: number, y: number, sc: number) {
    const root = this.add.container(x, y).setDepth(y);
    let hero: HeroSprite | undefined;
    let img: Phaser.GameObjects.Image | undefined;
    let w: number, h: number;
    if (a.side === 'hero') {
      hero = new HeroSprite(this, a.id, 0, 0);
      hero.setGear(heroGear(s, a.id as HeroId));
      hero.container.setScale(sc);
      root.add(hero.container);
      w = (a.id === 'brugg' ? 32 : 24) * sc;
      h = (a.id === 'brugg' ? 40 : 32) * sc;
    } else {
      // Battle uses the high-detail mythic monster art (`<key>_hd`, drawn at RES×).
      img = this.add.image(0, 0, `${ENEMY_TEX[a.defId] ?? 'wisp'}_hd`).setOrigin(0.5, 1).setScale(sc / RES);
      img.setFlipX(true);
      root.add(img);
      w = (img.width * sc) / RES;
      h = (img.height * sc) / RES;
    }
    const outline = this.add.rectangle(0, -h / 2, w + 8, h + 8).setStrokeStyle(3, 0xd4a944).setVisible(false);
    const label = this.add.text(0, -h - 22, a.name, {
      fontFamily: 'system-ui, sans-serif', fontSize: '13px', fontStyle: 'bold', color: '#f7f3e8',
      stroke: '#241a2b', strokeThickness: 4,
    }).setOrigin(0.5, 1).setResolution(2);
    const status = this.add.text(0, -h - 38, '', {
      fontFamily: 'system-ui, sans-serif', fontSize: '12px', fontStyle: 'bold', color: '#b07ed6',
      stroke: '#241a2b', strokeThickness: 4,
    }).setOrigin(0.5, 1).setResolution(2);
    const bw = Math.max(40, w * 0.9);
    const hpBack = this.add.rectangle(-bw / 2, -h - 16, bw, 6, 0x241a2b).setOrigin(0, 0.5);
    const hpBar = this.add.rectangle(-bw / 2 + 1, -h - 16, bw - 2, 4, 0x7c9a5c).setOrigin(0, 0.5);
    root.add([outline, hpBack, hpBar, label, status]);
    const hit = this.add.zone(0, -h / 2, w + 16, h + 16).setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => bus.emit('battleTap', a.id));
    root.add(hit);
    this.views.set(a.id, { id: a.id, root, hero, img, label, status, hpBack, hpBar, outline, w, h, home: { x, y } });
  }

  refresh(s: GameState) {
    const b = s.battle;
    if (!b) return;
    const cur = b.phase === 'player' || b.phase === 'enemy' ? currentActor(b).id : null;
    for (const a of b.actors) {
      const v = this.views.get(a.id);
      if (!v) continue;
      const frac = Math.max(0, a.hp / a.maxHp);
      v.hpBar.width = Math.max(0, (v.hpBack.width - 2) * frac);
      v.hpBar.fillColor = frac > 0.5 ? 0x7c9a5c : frac > 0.25 ? 0xd4a944 : 0xb0483a;
      const ko = a.hp <= 0;
      v.root.setAlpha(ko ? 0.4 : 1);
      const tags: string[] = [];
      if (ko) tags.push('KO');
      if (a.statuses.curse > 0) tags.push(`CURSED ${a.statuses.curse}`);
      if (a.statuses.guard) tags.push('GUARD');
      if (a.statuses.weakened > 0) tags.push(`WEAK ${a.statuses.weakened}`);
      if (b.protectLink?.ward === a.id) tags.push('PROTECTED');
      v.status.setText(tags.join(' · '));
      v.label.setText(cur === a.id ? `▶ ${a.name}` : a.name);
      const isTarget = this.target === a.id;
      v.outline.setVisible(cur === a.id || isTarget);
      v.outline.setStrokeStyle(3, isTarget ? 0xb07ed6 : 0xd4a944);
      if (isTarget) v.label.setText(`◎ ${a.name} (target)`);
    }
    if (b.seq !== this.seqShown) {
      this.seqShown = b.seq;
      this.animate(s, b);
    }
  }

  private animate(s: GameState, b: BattleState) {
    const rec = b.lastAction;
    if (!rec) return;
    const reduced = s.settings.reducedMotion;
    const actor = this.views.get(rec.actor);
    view.battleAnimating = true;
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      view.battleAnimating = false;
      bus.emit('battleAnimDone');
    };
    // Real-time fallback so a destroyed scene object can never stall enemy turns.
    window.setTimeout(done, reduced ? 300 : 560);
    if (actor?.hero) {
      actor.hero.setFrame(3);
      this.time.delayedCall(260, () => { if (actor.root.active) actor.hero?.setFrame(0); });
    }
    if (actor && !reduced) {
      const dir = actor.id.startsWith('enemy') ? -1 : 1;
      this.tweens.add({ targets: actor.root, x: actor.home.x + dir * 14, duration: 110, yoyo: true });
    }
    rec.hits.forEach((h, i) => {
      const v = this.views.get(h.target);
      if (!v) return;
      const color = h.kind === 'damage' ? '#ffd2c8' : h.kind === 'heal' ? '#c8ffd0' : '#c8e0ff';
      const txt = this.add.text(v.root.x, v.root.y - v.h - 30, `${h.kind === 'damage' ? '−' : '+'}${h.amount}${h.kind === 'mp' ? ' MP' : ''}`, {
        fontFamily: 'system-ui, sans-serif', fontSize: '18px', fontStyle: 'bold', color, stroke: '#241a2b', strokeThickness: 5,
      }).setOrigin(0.5).setDepth(10000).setResolution(2);
      this.tweens.add({ targets: txt, y: txt.y - 24, alpha: 0, delay: 120 + i * 40, duration: 700, onComplete: () => txt.destroy() });
      if (h.kind === 'damage' && !reduced) {
        v.hero?.setTint(0xffffff);
        v.img?.setTintFill(0xffffff);
        this.time.delayedCall(90, () => { if (!v.root.active) return; v.hero?.setTint(null); v.img?.clearTint(); });
      }
    });
    if (!reduced && rec.hits.some((h) => h.kind === 'damage' && h.amount >= 25)) this.cameras.main.shake(140, 0.006);
    bus.emit('sfx', rec.hits.some((h) => h.kind === 'damage') ? 'hit' : rec.hits.length ? 'heal' : 'blip');
    this.time.delayedCall(reduced ? 250 : 480, done);
  }
}
