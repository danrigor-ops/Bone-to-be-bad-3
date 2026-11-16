import type Phaser from 'phaser';
import type { Store } from '../app/store';
import { bus, view } from '../app/bus';
import type { BattleAction, Command, GameEvent, GameState, HeroId } from '../core/types';
import { CONTENT, itemName } from '../core/content';
import { reduce } from '../core/reducer';
import { newGameState } from '../core/state';
import { DIALOGUE, fillTokens } from '../data/dialogue';
import { MAPS } from '../data/maps';
import { SKILLS, SYNERGIES } from '../data/skills';
import { byId, currentActor, enemyMove, intentTarget, livingEnemies, livingHeroes, turnPreview, actionProblem } from '../systems/combat';
import { objectiveText } from '../systems/quests';
import { count } from '../systems/economy';
import { shortName } from '../systems/stats';
import { exportText } from '../persistence/storage';
import type { LoadReport } from '../persistence/storage';
import { Audio } from './audio';
import { h, btn } from './dom';
import { Panels } from './panels';
import type { Prefs, UIContext } from './context';
import { titleArt } from './describe';
import type { WorldScene } from '../render/WorldScene';

type BattleMode =
  | { m: 'root' }
  | { m: 'skills' }
  | { m: 'items' }
  | { m: 'target'; action: Partial<BattleAction> & { kind: BattleAction['kind'] }; side: 'enemy' | 'ally' | 'other_ally'; label: string }
  | { m: 'confirm'; action: BattleAction; label: string }
  | { m: 'inspect'; id: string | null };

const PREFS_KEY = 'btbb3.prefs';

const SHORT: Record<string, string> = {
  hex_mark: 'curse 2 turns', bone_verdict: '+25% if cursed', cheap_shot: '+25% if cursed', pilfer: 'steal scrap',
  stand_behind_me: 'shield an ally', heavy_hand: 'heavy hit', cinder_clause: 'magic hit', patchwork: 'heal 24 HP',
};

export class GameUI implements UIContext {
  prefs: Prefs = { dpad: false, hintSeen: false };
  private shell: HTMLElement;
  private top: HTMLElement;
  private stage: HTMLElement;
  private bottom: HTMLElement;
  private dialogueEl: HTMLElement;
  private toastsEl: HTMLElement;
  private titleEl: HTMLElement;
  private live: HTMLElement;
  private logEl: HTMLElement;
  panels: Panels;
  private focus: { id: string; label: string } | null = null;
  private typed = { key: '', done: true, timer: 0 as number | 0, shown: 0 };
  private confirmChoice: number | null = null;
  private bmode: BattleMode = { m: 'root' };
  private bkey = '';
  private enemyTimer: number | null = null;
  game: Phaser.Game | null = null;
  private lastLoc = '';

  constructor(public store: Store, public audio: Audio, private report: LoadReport) {
    try { Object.assign(this.prefs, JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}')); } catch { /* per-viewer prefs only */ }
    this.top = h('header', { class: 'top' });
    this.dialogueEl = h('div', { class: 'dialogue', hidden: true, role: 'dialog', 'aria-live': 'polite' });
    this.toastsEl = h('div', { class: 'toasts', 'aria-live': 'polite' });
    this.logEl = h('div', { class: 'blog', hidden: true, 'aria-live': 'polite' });
    this.stage = h('main', { class: 'stage' }, h('div', { id: 'game', 'aria-label': 'Game world. Tap the ground to walk, tap people or objects to approach them.' }), this.dialogueEl, this.toastsEl, this.logEl);
    this.bottom = h('footer', { class: 'bottom' });
    this.panels = new Panels(this);
    this.titleEl = h('div', { class: 'title' });
    this.live = h('div', { class: 'sr', 'aria-live': 'assertive' });
    this.shell = h('div', { class: 'shell' }, this.top, this.stage, this.bottom, this.panels.root, this.titleEl, this.live);
    document.getElementById('app')!.append(this.shell);

    store.subscribe((s, prev) => this.onState(s, prev));
    store.onEvent((e) => this.onEvent(e));
    bus.on('focusChanged', (f) => { this.focus = f as typeof this.focus; this.renderBottom(); });
    bus.on('battleTap', (id) => this.onBattleTap(id as string));
    bus.on('battleAnimDone', () => this.scheduleEnemy());
    bus.on('sfx', (n) => this.audio.play(n as string));
    this.dialogueEl.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.choice')) return;
      this.advanceDialogue();
    });
    document.addEventListener('keydown', (e) => this.onKey(e));
    const unlock = () => this.audio.unlock();
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });
    document.addEventListener('visibilitychange', () => this.onVisibility());
    window.addEventListener('pagehide', () => this.store.persist());
    this.showTitle();
  }

  // ---------------- context API ----------------
  dispatch(cmd: Command) {
    const r = this.store.dispatch(cmd);
    if (r && !r.error) this.audio.play('blip');
    return r;
  }
  toast(text: string, kind: 'reward' | 'info' = 'info') {
    const t = h('div', { class: `toast ${kind === 'reward' ? 'reward' : ''}` }, text);
    this.toastsEl.append(t);
    this.live.textContent = text;
    while (this.toastsEl.children.length > 3) this.toastsEl.firstElementChild?.remove();
    setTimeout(() => t.remove(), kind === 'reward' ? 4500 : 2800);
  }
  setPanelOpen(open: boolean) {
    view.panelOpen = open;
    if (open) bus.emit('cancelMovement');
    else bus.emit('focusRefresh');
  }
  setPref<K extends keyof Prefs>(k: K, v: Prefs[K]) {
    this.prefs[k] = v;
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(this.prefs)); } catch { /* ignore */ }
    this.renderBottom();
  }
  exportSave() {
    const s = this.store.state;
    if (!s) return;
    const blob = new Blob([exportText(s)], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `btbb3-save-r${s.revision}.json` });
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    this.toast('Save file exported.');
  }
  copySave() {
    const s = this.store.state;
    if (!s) return;
    navigator.clipboard?.writeText(exportText(s)).then(() => this.toast('Save text copied.'), () => this.toast('Copy failed; use Export instead.'));
  }
  refreshAll() {
    const s = this.store.state;
    if (s) this.onState(s, s);
  }

  // ---------------- Title ----------------
  showTitle() {
    view.panelOpen = true;
    const r = this.report;
    const s = this.store.state ?? r.state;
    const menu = h('div', { class: 'menu' });
    const startNew = () => {
      const st = newGameState(s?.settings);
      this.store.saves.clear();
      this.hideTitle();
      this.store.load(st);
    };
    if (s) {
      menu.append(
        h('div', { class: 'summary' }, h('strong', null, 'Last time: '), s.lastSummary, h('br'), h('strong', null, 'Objective: '), objectiveText(s)),
        btn('Resume', () => { this.hideTitle(); if (!this.store.state) this.store.load(s); else this.refreshAll(); }, { cls: 'primary', key: 't-continue' }),
      );
      let confirming = false;
      const ng = btn('New Game', () => {
        if (!confirming) { confirming = true; ng.textContent = 'Replace existing progress? Tap again'; ng.classList.add('danger'); return; }
        startNew();
      }, { key: 't-new' });
      menu.append(ng);
    } else {
      menu.append(btn('New Game', startNew, { cls: 'primary', key: 't-new' }));
    }
    if (r.blocked) {
      menu.prepend(h('div', { class: 'summary' }, `A save was found but this build can't use it: ${r.blocked.reason} Your old save is untouched. You can export it before starting a new game.`,
        btn('Export old save', () => {
          const blob = new Blob([r.blocked!.raw], { type: 'application/json' });
          const a = h('a', { href: URL.createObjectURL(blob), download: 'btbb3-old-save.json' });
          document.body.append(a); a.click(); a.remove();
        }, { key: 't-export-old' })));
    }
    if (r.notice) menu.prepend(h('div', { class: 'summary' }, r.notice));
    if (this.store.saves.failing) menu.prepend(h('div', { class: 'summary' }, 'Browser storage is unavailable, so progress will not save between visits. You can still play and export a backup from Settings.'));
    this.titleEl.replaceChildren(
      titleArt(3),
      h('h1', null, 'BONE TO BE BAD III'),
      h('div', { class: 'sub' }, 'No Rest for the Wicked'),
      menu,
      h('p', { class: 'foot' }, 'Prototype vertical slice. Art and music are provisional, generated in code. Saves stay in this browser; export a backup from Settings. No accounts, ads or purchases.'),
    );
    this.titleEl.hidden = false;
    this.audio.setMood('title');
    (this.titleEl.querySelector('button') as HTMLButtonElement | null)?.focus();
  }

  private hideTitle() {
    this.titleEl.hidden = true;
    view.panelOpen = false;
    this.report = { state: null, notice: null, blocked: null };
  }

  // ---------------- state & events ----------------
  private onState(s: GameState, prev: GameState | null) {
    this.shell.className = `shell theme-${s.settings.theme}`;
    this.audio.setEnabled(s.settings.music, s.settings.sfx);
    this.syncScenes(s);
    if (!s.battle) this.audio.setMood(MAPS[s.location.id].ambient);
    else this.audio.setMood(s.battle.isBoss ? 'boss' : 'battle');
    const locKey = `${s.location.id}:${s.location.tileX}:${s.location.tileY}`;
    if (this.lastLoc && locKey !== this.lastLoc && !this.prefs.hintSeen) this.setPref('hintSeen', true);
    this.lastLoc = locKey;
    if (!s.battle || prev?.battle?.seq !== s.battle.seq || prev?.battle?.phase !== s.battle.phase) {
      if (s.battle && (prev?.battle?.seq !== s.battle.seq || !prev?.battle)) this.bmode = { m: 'root' };
    }
    this.renderTop();
    this.renderDialogue();
    this.renderBottom();
    if (this.panels.open) this.panels.render();
    this.scheduleEnemy();
  }

  private onEvent(e: GameEvent) {
    switch (e.type) {
      case 'toast': this.toast(e.text); break;
      case 'reward': this.toast(`Received: ${e.text}`, 'reward'); break;
      case 'openPanel': this.panels.show(e.panel); break;
      case 'sfx': this.audio.play(e.name); break;
      case 'travel': this.audio.play('door'); break;
      case 'battleStart': this.bmode = { m: 'root' }; bus.emit('battleTarget', null); break;
      case 'battleEnd': bus.emit('battleTarget', null); break;
    }
  }

  private syncScenes(s: GameState) {
    const g = this.game;
    if (!g) return;
    const sm = g.scene;
    if (s.battle) {
      if (!sm.isActive('battle')) sm.run('battle', { store: this.store });
      if (sm.isActive('world')) sm.sleep('world');
    } else {
      if (!sm.isActive('world')) sm.run('world', { store: this.store });
      if (sm.isActive('battle')) sm.sleep('battle');
    }
  }

  private onVisibility() {
    view.hidden = document.hidden;
    if (document.hidden) {
      this.store.persist();
      this.audio.pause();
      bus.emit('cancelMovement');
      if (this.enemyTimer) { clearTimeout(this.enemyTimer); this.enemyTimer = null; }
    } else {
      this.audio.resume();
      this.scheduleEnemy();
    }
  }

  /** Enemy turns resolve one complete action at a time, only while the page is visible. */
  private scheduleEnemy() {
    const s = this.store.state;
    if (!s?.battle || s.battle.phase !== 'enemy' || this.enemyTimer || view.battleAnimating || document.hidden || !this.titleEl.hidden) return;
    const delay = s.settings.reducedMotion ? 250 : 420;
    this.enemyTimer = window.setTimeout(() => {
      this.enemyTimer = null;
      const st = this.store.state;
      if (!st?.battle || st.battle.phase !== 'enemy' || view.battleAnimating || document.hidden) { this.scheduleEnemy(); return; }
      this.store.dispatch({ type: 'enemyAct' });
    }, delay);
  }

  // ---------------- top strip ----------------
  private renderTop() {
    const s = this.store.state!;
    const saveBad = this.store.saves.failing
      ? h('div', { class: 'savebad', role: 'alert' }, 'Progress is not saving.', btn('Export backup', () => this.exportSave(), { key: 'top-export' }))
      : null;
    if (s.battle) {
      const b = s.battle;
      const intents = livingEnemies(b).map((e) => {
        const mv = enemyMove(e);
        const warn = mv.name === 'Repossession';
        const after = e.defId === 'foreclosure_engine' ? ` · then ${enemyMove(e, 1).name}` : '';
        return h('span', { class: warn ? 'warn' : '' }, `${e.name}: ${warn ? '⚠ ' : ''}${mv.tell.replace(/→ .*/, '')}→ ${intentTarget(b, e)}${after}`);
      });
      const order = turnPreview(b, 7).map((id) => byId(b, id).name).join(' › ');
      this.top.replaceChildren(h('div', { class: 'battle-top' },
        h('div', { class: 'intent', 'aria-label': 'Enemy intents' }, h('strong', null, `${b.isBoss ? 'BOSS · ' : ''}Next: `), ...intents),
        h('div', { class: 'order' }, `Round ${b.round} · Order: ${order}`)), saveBad ?? '');
      return;
    }
    this.top.replaceChildren(
      h('div', { class: 'row' }, h('span', { class: 'loc' }, MAPS[s.location.id].name), h('span', { class: 'loc' }, `${s.inventory.gold}g`)),
      h('div', { class: 'objective' }, objectiveText(s)),
      saveBad ?? '',
    );
  }

  // ---------------- dialogue ----------------
  private renderDialogue() {
    const s = this.store.state!;
    if (!s.dialogue) {
      this.dialogueEl.hidden = true;
      this.typed.key = '';
      this.confirmChoice = null;
      return;
    }
    const node = DIALOGUE[s.dialogue.nodeId];
    const line = node.lines[s.dialogue.cursor];
    const key = `${node.id}:${s.dialogue.cursor}`;
    const obj = objectiveText(s);
    const text = fillTokens(line.t, s, obj);
    const speaker = fillTokens(line.s, s, obj);
    if (key !== this.typed.key) {
      this.typed = { key, done: s.settings.instantText, timer: 0, shown: s.settings.instantText ? text.length : 0 };
      this.confirmChoice = null;
      if (!this.typed.done) this.typeOn(text);
    }
    const last = s.dialogue.cursor === node.lines.length - 1;
    const choices = last && node.choices && this.typed.done
      ? h('div', { class: 'choices', role: 'group', 'aria-label': 'Choices' }, ...node.choices.map((c, i) => {
        const confirming = this.confirmChoice === i;
        const b = h('button', { class: `choice ${confirming ? 'confirming' : ''}`, type: 'button', 'data-key': `choice-${i}` },
          confirming ? `Confirm: ${c.label}` : c.label,
          c.preview ? h('span', { class: 'preview' }, c.preview) : null,
          confirming ? h('span', { class: 'preview' }, 'This decision is permanent. Tap again to confirm, or pick the other option.') : null);
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          if (c.confirm && this.confirmChoice !== i) { this.confirmChoice = i; this.renderDialogue(); return; }
          this.confirmChoice = null;
          this.dispatch({ type: 'dialogueChoose', index: i });
        });
        return b;
      }))
      : null;
    const shown = this.typed.done ? text : text.slice(0, this.typed.shown);
    this.dialogueEl.replaceChildren(
      speaker ? h('div', { class: 'speaker' }, speaker) : h('div', { class: 'speaker' }, ' '),
      h('div', { class: 'text' }, shown),
      choices ?? h('div', { class: 'more' }, this.typed.done ? (last && !node.choices ? 'Tap / Enter to close ▸' : 'Tap / Enter ▸') : 'Tap to show all'),
    );
    this.dialogueEl.hidden = false;
    if (choices) {
      const want = this.confirmChoice !== null ? `[data-key="choice-${this.confirmChoice}"]` : '.choice';
      (this.dialogueEl.querySelector(want) as HTMLElement | null)?.focus();
    }
  }

  private typeOn(text: string) {
    const key = this.typed.key;
    const tick = () => {
      if (this.typed.key !== key || this.typed.done) return;
      this.typed.shown += 2;
      if (this.typed.shown >= text.length) { this.typed.done = true; this.renderDialogue(); return; }
      const el = this.dialogueEl.querySelector('.text');
      if (el) el.textContent = text.slice(0, this.typed.shown);
      this.typed.timer = window.setTimeout(tick, 18);
    };
    this.typed.timer = window.setTimeout(tick, 18);
  }

  private advanceDialogue() {
    const s = this.store.state;
    if (!s?.dialogue) return;
    if (!this.typed.done) { this.typed.done = true; this.renderDialogue(); return; }
    const node = DIALOGUE[s.dialogue.nodeId];
    if (s.dialogue.cursor === node.lines.length - 1 && node.choices) return;
    this.dispatch({ type: 'dialogueAdvance' });
  }

  // ---------------- bottom bar ----------------
  private renderBottom() {
    const s = this.store.state;
    if (!s) return;
    if (s.battle) { this.renderBattle(s); return; }
    this.logEl.hidden = true;
    const world = () => this.game?.scene.getScene('world') as WorldScene | undefined;
    const interact = btn(this.focus ? `Interact: ${this.focus.label}` : 'Interact', () => {
      if (this.focus) this.dispatch({ type: 'interact', objectId: this.focus.id });
    }, { cls: `interact ${this.focus ? 'primary' : ''}`, disabled: !this.focus || !!s.dialogue, key: 'interact' });
    const row = h('div', { class: 'controls' },
      interact,
      btn('Journal', () => this.panels.show('journal'), { key: 'journal', disabled: !!s.dialogue }),
      btn('Menu', () => this.panels.show('menu'), { key: 'menu', disabled: !!s.dialogue }));
    const parts: Node[] = [row];
    if (this.prefs.dpad) {
      const d = (cls: string, label: string, dx: number, dy: number) => btn(label, () => world()?.stepDir(dx, dy), { cls, aria: `Step ${cls}`, key: `dpad-${cls}` });
      parts.push(h('div', { class: 'controls', style: 'margin-top:6px;justify-content:center' },
        h('div', { class: 'dpad' }, d('up', '▲', 0, -1), d('left', '◀', -1, 0), d('down', '▼', 0, 1), d('right', '▶', 1, 0))));
    }
    if (!this.prefs.hintSeen) {
      parts.push(h('div', { class: 'hint' }, 'Tap the ground to walk (or arrow keys / WASD). Tap a person or object to walk over, then press Interact (Enter / Space). Gold squares mark exits.'));
    }
    this.bottom.replaceChildren(...parts);
  }

  // ---------------- battle ----------------
  private renderBattle(s: GameState) {
    const b = s.battle!;
    const key = `${b.seq}:${b.phase}:${b.turnIndex}:${b.round}`;
    if (key !== this.bkey) { this.bkey = key; if (this.bmode.m !== 'inspect') this.bmode = { m: 'root' }; }
    const active = b.phase === 'player' ? currentActor(b) : null;
    const party = h('div', { class: 'party' }, ...b.actors.filter((a) => a.side === 'hero').map((a) =>
      h('div', { class: `pm ${active?.id === a.id ? 'active' : ''} ${a.hp <= 0 ? 'ko' : ''}`, 'aria-label': `${a.name} HP ${a.hp} of ${a.maxHp}, MP ${a.mp} of ${a.maxMp}${a.hp <= 0 ? ', KO' : ''}` },
        h('div', { class: 'n' }, `${active?.id === a.id ? '▶ ' : ''}${a.name}${a.hp <= 0 ? ' (KO)' : ''}`),
        h('div', { class: 'bar' }, h('i', { style: `width:${Math.round(100 * a.hp / a.maxHp)}%` })),
        h('div', null, `HP ${a.hp}`, h('span', { class: 'mpn' }, ` · MP ${a.mp}`)))));
    const dp = h('div', { class: 'dp', 'aria-label': `Dark Power ${b.dp} of 100` }, h('span', null, 'Dark Power'), h('div', { class: 'bar' }, h('i', { style: `width:${b.dp}%` })), h('span', null, `${b.dp}/100`));
    this.logEl.textContent = b.log.slice(-2).join(' · ');
    this.logEl.hidden = false;
    const parts: Node[] = [party, dp];
    if (b.phase === 'victory') {
      parts.push(h('div', { class: 'prompt' }, h('strong', null, 'Victory! '), b.log.slice(-3).filter((l) => /Victory|level|Salvage/.test(l)).join(' ')),
        h('div', { class: 'cmds' }, btn('Continue', () => this.dispatch({ type: 'battleContinue' }), { cls: 'primary', key: 'b-continue' })));
    } else if (b.phase === 'defeat') {
      parts.push(h('div', { class: 'prompt' }, h('strong', null, 'Defeated. '), 'Nothing you earned is lost.'),
        h('div', { class: 'cmds' },
          btn('Retry battle', () => this.dispatch({ type: 'battleRetry' }), { cls: 'primary', key: 'b-retry' }),
          btn('Return to Bureau', () => this.dispatch({ type: 'battleReturnBureau' }), { key: 'b-home' })));
    } else if (b.phase === 'enemy') {
      const a = currentActor(b);
      parts.push(h('div', { class: 'prompt' }, `${a.name} is acting…`));
    } else if (active) {
      parts.push(...this.battleCommands(s, active.id));
    }
    this.bottom.replaceChildren(...parts);
    const want = this.bottom.querySelector('.cmds .primary, .cmds .btn:not([aria-disabled="true"])') as HTMLElement | null;
    if (want && !this.bottom.contains(document.activeElement)) want.focus({ preventScroll: true });
  }

  private preview(s: GameState, action: BattleAction): string {
    const r = reduce(s, { type: 'battleAction', action });
    if (r.error || !r.state.battle?.lastAction) return '';
    const hits = r.state.battle.lastAction.hits;
    if (!hits.length) return '';
    return hits.map((h2) => `${byId(r.state.battle!, h2.target).name} ${h2.kind === 'damage' ? '−' : '+'}${h2.amount}${h2.kind === 'mp' ? ' MP' : h2.kind === 'heal' ? ' HP' : ''}`).join(', ');
  }

  private battleCommands(s: GameState, actorId: string): Node[] {
    const b = s.battle!;
    const actor = byId(b, actorId);
    const mode = this.bmode;
    const setMode = (m: BattleMode) => { this.bmode = m; if (m.m !== 'target' && m.m !== 'confirm') bus.emit('battleTarget', null); this.renderBottom(); };
    const act = (action: BattleAction) => { bus.emit('battleTarget', null); this.dispatch({ type: 'battleAction', action }); };
    const cancel = btn('Cancel', () => setMode({ m: 'root' }), { key: 'b-cancel', cls: 'ghost' });

    if (mode.m === 'target') {
      const list = mode.side === 'enemy' ? livingEnemies(b) : livingHeroes(b).filter((a) => mode.side === 'ally' || a.id !== actorId);
      const desc = mode.action.kind === 'skill' ? SKILLS[(mode.action as { skillId: string }).skillId].description : mode.action.kind === 'synergy' ? SYNERGIES[(mode.action as { synergyId: string }).synergyId].description : '';
      return [h('div', { class: 'prompt' }, `${mode.label}${desc ? ` — ${desc}` : ''} Choose a target (tap it on the stage or below).`),
        h('div', { class: 'cmds' }, ...list.map((t) => {
          const full = { ...mode.action, target: t.id } as BattleAction;
          const pv = this.preview(s, full);
          return btn([t.name, h('small', null, pv || `HP ${t.hp}/${t.maxHp}`)], () => this.chooseTarget(s, full, mode.label), { key: `t-${t.id}` });
        }), cancel)];
    }
    if (mode.m === 'confirm') {
      const pv = this.preview(s, mode.action);
      return [h('div', { class: 'prompt' }, `${mode.label}${pv ? ` — expected: ${pv}` : ''}`),
        h('div', { class: 'cmds' }, btn('Confirm', () => act(mode.action), { cls: 'primary', key: 'b-confirm' }), cancel)];
    }
    if (mode.m === 'skills') {
      const skills = CONTENT.party.get(actorId)!.skills.map((id) => SKILLS[id]);
      const syn = Object.values(SYNERGIES).filter((x) => x.initiator === actorId);
      return [h('div', { class: 'prompt' }, `${actor.name}: skills (MP ${actor.mp}) and synergies (DP ${b.dp}). Pick one to see its full effect before confirming.`),
        h('div', { class: 'cmds' },
          ...skills.map((sk) => {
            const ok = actor.mp >= sk.mp;
            return btn([sk.name, h('small', null, `${sk.mp} MP · ${SHORT[sk.id]}`)], () => {
              const label = `${sk.name} (${sk.mp} MP)`;
              if (sk.target === 'enemy') setMode({ m: 'target', action: { kind: 'skill', skillId: sk.id }, side: 'enemy', label });
              else if (sk.target === 'ally') setMode({ m: 'target', action: { kind: 'skill', skillId: sk.id }, side: 'ally', label });
              else if (sk.target === 'other_ally') setMode({ m: 'target', action: { kind: 'skill', skillId: sk.id }, side: 'other_ally', label });
            }, { disabled: !ok, key: `sk-${sk.id}`, title: ok ? undefined : 'Not enough MP' });
          }),
          ...syn.map((sy) => {
            const partnerUp = byId(b, sy.partner).hp > 0;
            const ok = partnerUp && b.dp >= sy.dp;
            const why = !partnerUp ? `${shortName(sy.partner)} is KO` : b.dp < sy.dp ? `needs ${sy.dp} DP` : `${sy.dp} DP`;
            return btn([`${sy.name}`, h('small', null, `+${shortName(sy.partner)} · ${why}`)], () => {
              const label = `${sy.name} (${sy.dp} DP)`;
              if (sy.target === 'enemy') setMode({ m: 'target', action: { kind: 'synergy', synergyId: sy.id }, side: 'enemy', label });
              else setMode({ m: 'confirm', action: { kind: 'synergy', synergyId: sy.id }, label: `${label} on all enemies` });
            }, { disabled: !ok, key: `sy-${sy.id}` });
          }),
          cancel)];
    }
    if (mode.m === 'items') {
      const items = ['poultice', 'ether'];
      return [h('div', { class: 'prompt' }, 'Items (uses this hero’s turn)'),
        h('div', { class: 'cmds' }, ...items.map((id) => btn([`${itemName(id)} ×${count(s, id)}`, h('small', null, id === 'poultice' ? '+30 HP, no revive' : '+10 MP')], () =>
          setMode({ m: 'target', action: { kind: 'item', itemId: id }, side: 'ally', label: itemName(id) }), { disabled: count(s, id) < 1, key: `it-${id}` })), cancel)];
    }
    if (mode.m === 'inspect') {
      const id = mode.id ?? livingEnemies(b)[0]?.id;
      const e = id ? b.actors.find((a) => a.id === id) : undefined;
      const def = e ? CONTENT.enemies.get(e.defId) : undefined;
      const info: Node[] = [];
      if (e && def) {
        const cyc = [0, 1, 2].map((k) => enemyMove(e, k).name).slice(0, e.defId === 'foreclosure_engine' ? 3 : e.defId === 'rust_mite' ? 1 : 2);
        info.push(h('div', { class: 'prompt' }, h('strong', null, `${e.name}: `), `HP ${e.hp}/${e.maxHp} · ATK ${e.attack} · MAG ${e.magic} · DEF ${e.defence} · SPD ${e.speed}. Pattern: ${cyc.join(' → ')} (repeats). Next: ${enemyMove(e).tell}.${e.statuses.curse ? ` Cursed for ${e.statuses.curse} more turns.` : ''}`));
      }
      return [...info, h('div', { class: 'cmds' }, ...livingEnemies(b).map((x) => btn(x.name, () => setMode({ m: 'inspect', id: x.id }), { key: `in-${x.id}` })), btn('Back', () => setMode({ m: 'root' }), { key: 'b-back', cls: 'primary' }))];
    }
    // root
    const leaveLabel = b.isBoss ? 'Withdraw to Bureau' : 'Flee (no reward)';
    let confirmingLeave = false;
    const leave = btn(leaveLabel, () => {
      if (!confirmingLeave) { confirmingLeave = true; leave.textContent = `${leaveLabel}? Tap again`; return; }
      this.dispatch({ type: 'battleEscape' });
    }, { key: 'b-leave', cls: 'ghost' });
    return [h('div', { class: 'prompt' }, `${actor.name}’s turn. Choose a command.`),
      h('div', { class: 'cmds' },
        btn(['Attack', h('small', null, '+5 DP')], () => setMode({ m: 'target', action: { kind: 'attack' }, side: 'enemy', label: 'Attack' }), { cls: 'primary', key: 'b-attack' }),
        btn(['Skills', h('small', null, `MP ${actor.mp}`)], () => setMode({ m: 'skills' }), { key: 'b-skills' }),
        btn(['Guard', h('small', null, '−50% until next turn')], () => act({ kind: 'guard' }), { key: 'b-guard' }),
        btn(['Items', h('small', null, `${count(s, 'poultice')} poultice · ${count(s, 'ether')} ether`)], () => setMode({ m: 'items' }), { key: 'b-items' }),
        btn(['Inspect', h('small', null, 'free')], () => setMode({ m: 'inspect', id: null }), { key: 'b-inspect' }),
        leave)];
  }

  private chooseTarget(s: GameState, action: BattleAction, label: string) {
    const problem = actionProblem(s, action);
    if (problem) { this.toast(problem); return; }
    bus.emit('battleTarget', (action as { target?: string }).target ?? null);
    const costly = action.kind === 'skill' ? SKILLS[action.skillId].mp > 0 : action.kind === 'synergy' || action.kind === 'item';
    const tname = (action as { target?: string }).target ? byId(s.battle!, (action as { target: string }).target).name : '';
    if (costly) {
      this.bmode = { m: 'confirm', action, label: `${label} → ${tname}` };
      this.renderBottom();
    } else {
      bus.emit('battleTarget', null);
      this.dispatch({ type: 'battleAction', action });
    }
  }

  private onBattleTap(id: string) {
    const s = this.store.state;
    if (!s?.battle || s.battle.phase !== 'player') return;
    const mode = this.bmode;
    const a = byId(s.battle, id);
    if (mode.m === 'target') {
      const okSide = mode.side === 'enemy' ? a.side === 'enemy' : a.side === 'hero' && (mode.side === 'ally' || a.id !== currentActor(s.battle).id);
      if (!okSide || a.hp <= 0) { this.toast('Not a valid target.'); return; }
      this.chooseTarget(s, { ...mode.action, target: id } as BattleAction, mode.label);
    } else if (a.side === 'enemy') {
      this.bmode = { m: 'inspect', id };
      this.renderBottom();
    }
  }

  // ---------------- keyboard ----------------
  private onKey(e: KeyboardEvent) {
    if (!this.titleEl.hidden) return;
    const s = this.store.state;
    if (!s) return;
    const tag = (e.target as HTMLElement).tagName;
    const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    if (e.key === 'Escape') {
      if (this.panels.open) { this.panels.close(); e.preventDefault(); return; }
      if (s.battle && this.bmode.m !== 'root') { this.bmode = { m: 'root' }; bus.emit('battleTarget', null); this.renderBottom(); e.preventDefault(); return; }
      if (!s.battle && !s.dialogue) { this.panels.show('menu'); e.preventDefault(); }
      return;
    }
    if (typing || this.panels.open) return;
    const onButton = tag === 'BUTTON';
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'e' || e.key === 'E') {
      if (onButton && (e.key === 'Enter' || e.key === ' ')) return; // native button activation
      if (s.dialogue) { e.preventDefault(); this.advanceDialogue(); return; }
      if (!s.battle && this.focus) { e.preventDefault(); this.dispatch({ type: 'interact', objectId: this.focus.id }); }
      return;
    }
    if (!s.battle && !s.dialogue) {
      if (e.key === 'j' || e.key === 'J') this.panels.show('journal');
      if (e.key === 'm' || e.key === 'M') this.panels.show('menu');
    }
  }
}

export { HeroId };
