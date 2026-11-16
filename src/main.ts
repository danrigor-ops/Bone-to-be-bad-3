import Phaser from 'phaser';
import { CONTENT_RAW, validateContent } from './core/content';
import { Store } from './app/store';
import { SaveStore } from './persistence/storage';
import { GameUI } from './ui/app';
import { Audio } from './ui/audio';
import { BootScene } from './render/BootScene';
import { WorldScene } from './render/WorldScene';
import { BattleScene } from './render/BattleScene';
import { MAPS } from './data/maps';
import { findPath } from './systems/pathfinding';
import { view } from './app/bus';

function fatal(msg: string) {
  document.getElementById('app')!.innerHTML = `<div style="padding:16px;color:#fff;font-family:system-ui"><h2>Content validation failed</h2><pre style="white-space:pre-wrap">${msg.replace(/</g, '&lt;')}</pre></div>`;
}

const problems = validateContent(CONTENT_RAW);
for (const m of Object.values(MAPS)) {
  if (m.rows.some((r) => r.length !== m.rows[0].length)) problems.push(`map ${m.id}: ragged rows`);
}
if (problems.length) {
  fatal(problems.join('\n'));
  throw new Error('Content validation failed');
}

const saves = SaveStore.browser();
const report = saves.load();
const store = new Store(saves);
if (report.state) store.state = report.state;
const ui = new GameUI(store, new Audio(), report);
store.state = null; // title screen decides when to load

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#17121b',
  pixelArt: true,
  roundPixels: true,
  scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
  input: { activePointers: 2 },
  audio: { noAudio: true },
  banner: false,
  scene: [],
});
// Phaser caches the canvas position and only refreshes it on window resize. HUD bars above the
// canvas change height (objective text, save warnings, phone toolbars), which moves the canvas
// without a resize, so taps landed on the wrong tile. Refresh the cached bounds right before
// Phaser reads each press (capture phase on window runs ahead of Phaser's canvas listeners).
const refreshBounds = () => game.scale.updateBounds();
for (const t of ['pointerdown', 'mousedown', 'touchstart']) {
  window.addEventListener(t, refreshBounds, { capture: true, passive: true });
}
new ResizeObserver(refreshBounds).observe(document.getElementById('game')!);
game.scene.add('boot', BootScene, true);
game.events.once('texturesReady', () => {
  game.scene.add('world', WorldScene, true, { store });
  game.scene.add('battle', BattleScene, false, { store });
  ui.game = game;
  if (store.state) ui.refreshAll();
});

if (import.meta.env.DEV) {
  (window as unknown as { btbb3: unknown }).btbb3 = { store, game, ui, maps: MAPS, findPath, view };
}
