import Phaser from 'phaser';
import { allTextureSpecs, requiredAppearanceKeys } from './sprites';

/** Generates every texture from code, then validates required appearance keys. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }
  create() {
    for (const spec of allTextureSpecs()) {
      if (this.textures.exists(spec.key)) continue;
      const tex = this.textures.createCanvas(spec.key, spec.w, spec.h)!;
      const ctx = tex.getContext();
      ctx.imageSmoothingEnabled = false;
      spec.draw(ctx);
      tex.refresh();
    }
    const missing = requiredAppearanceKeys().filter((k) => !this.textures.exists(k));
    if (missing.length) throw new Error(`Missing appearance textures: ${missing.join(', ')}`);
    this.game.events.emit('texturesReady');
  }
}
