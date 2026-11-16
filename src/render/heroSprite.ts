import Phaser from 'phaser';
import type { Frame } from './sprites';
import { heroTexKey } from './sprites';

export interface Gear { weapon: string | null; head: string | null; body: string | null }

/** Layered hero: base + body + head + weapon textures sharing per-character anchors. */
export class HeroSprite {
  container: Phaser.GameObjects.Container;
  private base: Phaser.GameObjects.Image;
  private body: Phaser.GameObjects.Image;
  private head: Phaser.GameObjects.Image;
  private weapon: Phaser.GameObjects.Image;
  private frame: Frame = 0;
  gear: Gear = { weapon: null, head: null, body: null };

  constructor(scene: Phaser.Scene, public hero: string, x: number, y: number) {
    this.base = scene.add.image(0, 0, heroTexKey(hero, 'base', 0)).setOrigin(0.5, 1);
    this.body = scene.add.image(0, 0, heroTexKey(hero, 'old_coat', 0)).setOrigin(0.5, 1);
    this.head = scene.add.image(0, 0, heroTexKey(hero, 'old_cap', 0)).setOrigin(0.5, 1);
    this.weapon = scene.add.image(0, 0, heroTexKey(hero, 'old_blade', 0)).setOrigin(0.5, 1);
    this.container = scene.add.container(x, y, [this.base, this.body, this.head, this.weapon]);
  }

  setGear(g: Gear) {
    this.gear = g;
    this.apply();
  }

  setFrame(f: Frame) {
    if (f === this.frame) return;
    this.frame = f;
    this.apply();
  }

  private apply() {
    const f = this.frame;
    this.base.setTexture(heroTexKey(this.hero, 'base', f));
    const layer = (img: Phaser.GameObjects.Image, app: string | null) => {
      if (app) img.setTexture(heroTexKey(this.hero, app, f)).setVisible(true);
      else img.setVisible(false);
    };
    layer(this.body, this.gear.body);
    layer(this.head, this.gear.head);
    layer(this.weapon, this.gear.weapon);
  }

  setFlip(flip: boolean) {
    this.container.setScale(flip ? -Math.abs(this.container.scaleX) : Math.abs(this.container.scaleX), this.container.scaleY);
  }

  setTint(color: number | null) {
    for (const img of [this.base, this.body, this.head, this.weapon]) {
      if (color === null) img.clearTint();
      else img.setTintFill(color);
    }
  }
}
