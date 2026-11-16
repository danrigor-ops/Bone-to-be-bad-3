import { CONTENT, item, itemName, KEY_ITEM_NAMES } from '../core/content';
import type { GameState, HeroId, Slot } from '../core/types';
import { HERO_IDS, SLOTS } from '../core/types';
import { DEBUG_ENABLED } from '../core/reducer';
import { h, btn, replaceKeepingFocus, txId } from './dom';
import type { UIContext } from './context';
import { SHOPS, price, shopOpen, count } from '../systems/economy';
import { craftProblem, recipeUnlocked, sourceHint, upgradeCost, upgradeProblem, describeOwner } from '../systems/crafting';
import { equipProblem, heroStats, instance, member, ownerOf, shortName, slotAccepts, eligible } from '../systems/stats';
import { OBJECTIVE_TEXT, objectiveText } from '../systems/quests';
import { EFFECT_TEXT, diffText, eligibleText, heroPreview, itemLabel, statText, statsWith } from './describe';
import { exportText } from '../persistence/storage';
import { MAX_IMPORT_BYTES, parseEnvelope } from '../persistence/serializer';
import { newGameState } from '../core/state';

export type PanelId = 'menu' | 'journal' | 'equipment' | 'inventory' | 'workshop' | 'shop' | 'settings' | 'debug';

interface PanelLocal {
  hero: HeroId;
  slot: Slot;
  recipe: string | null;
  upgradeInst: string | null;
  wsTab: 'craft' | 'upgrade';
  confirm: string | null; // key of action awaiting confirmation
  tx: string | null;
  qty: Record<string, number>;
  importText: string;
  importMsg: string;
}

export class Panels {
  open: PanelId | null = null;
  private returnFocus: HTMLElement | null = null;
  private local: PanelLocal = {
    hero: 'c404', slot: 'weapon', recipe: null, upgradeInst: null, wsTab: 'craft', confirm: null, tx: null, qty: {}, importText: '', importMsg: '',
  };
  root: HTMLElement;

  constructor(private ctx: UIContext) {
    this.root = h('div', { class: 'panel', role: 'dialog', 'aria-modal': 'true', hidden: true });
  }

  show(id: PanelId) {
    if (!this.open) this.returnFocus = document.activeElement as HTMLElement | null;
    this.open = id;
    this.local.confirm = null;
    this.local.tx = null;
    this.ctx.setPanelOpen(true);
    this.render();
    this.root.hidden = false;
    (this.root.querySelector('.body button, .body [tabindex], header button') as HTMLElement | null)?.focus();
  }

  close() {
    if (!this.open) return;
    const wasSub = this.open !== 'menu' && ['journal', 'equipment', 'inventory', 'settings', 'debug'].includes(this.open);
    this.open = null;
    this.root.hidden = true;
    this.ctx.setPanelOpen(false);
    if (wasSub && this.returnFocus?.isConnected) this.returnFocus.focus();
    else this.returnFocus?.focus?.();
    this.returnFocus = null;
  }

  render() {
    const s = this.ctx.store.state;
    if (!this.open || !s) return;
    const titles: Record<PanelId, string> = {
      menu: 'Menu', journal: 'Journal', equipment: 'Party & Gear', inventory: 'Inventory', workshop: 'Marn’s Workshop',
      shop: SHOPS[String(s.flags.open_shop ?? 'mott')]?.name ?? 'Shop', settings: 'Settings & Saves', debug: 'Debug (development build only)',
    };
    const back = this.open !== 'menu' && !['workshop', 'shop'].includes(this.open)
      ? btn('‹ Menu', () => this.show('menu'), { cls: 'ghost', key: 'back' }) : null;
    const header = h('header', null,
      back,
      h('h2', { id: 'panel-title' }, titles[this.open]),
      btn('Close ✕', () => this.close(), { key: 'close', aria: 'Close panel' }),
    );
    this.root.setAttribute('aria-labelledby', 'panel-title');
    const body = h('div', { class: 'body' });
    const fn: Record<PanelId, (s: GameState) => Node[]> = {
      menu: (st) => this.menu(st), journal: (st) => this.journal(st), equipment: (st) => this.equipment(st),
      inventory: (st) => this.inventory(st), workshop: (st) => this.workshop(st), shop: (st) => this.shop(st),
      settings: (st) => this.settings(st), debug: (st) => this.debug(st),
    };
    body.append(...fn[this.open](s));
    replaceKeepingFocus(this.root, [header, body]);
  }

  // ---------------- Menu ----------------
  private menu(s: GameState): Node[] {
    const items: [string, PanelId][] = [['Party & Gear', 'equipment'], ['Inventory', 'inventory'], ['Journal', 'journal'], ['Settings & Saves', 'settings']];
    if (DEBUG_ENABLED) items.push(['Debug tools', 'debug']);
    return [
      h('p', null, s.lastSummary),
      h('div', { class: 'menu-grid' }, ...items.map(([l, id]) => btn(l, () => this.show(id), { key: `m-${id}` }))),
      h('p', { class: 'note' }, 'Progress saves automatically after every action. Use Settings & Saves to export a backup.'),
      btn('Return to title', () => { this.close(); this.ctx.showTitle(); }, { cls: 'ghost', key: 'to-title' }),
    ];
  }

  // ---------------- Journal ----------------
  private journal(s: GameState): Node[] {
    const out: Node[] = [];
    out.push(h('div', { class: 'card' }, h('strong', null, 'Current objective'), h('p', null, objectiveText(s)), h('p', { class: 'note' }, `Last: ${s.lastSummary}`)));
    if (s.flags.slice_complete) {
      out.push(h('div', { class: 'card', style: 'border-color: var(--accent)' },
        h('strong', null, 'End of prototype'),
        h('p', null, 'This is the end of the Bone to Be Bad III vertical slice. Dregswell keeps your changes and free roam, crafting and repeat salvage remain open. The wider five-chapter campaign is not part of this build.')));
    }
    out.push(h('h3', null, 'Jobs'));
    for (const j of CONTENT.raw.jobs) {
      const q = s.questState[j.id];
      const status = { locked: 'Locked', available: 'Available at the Bureau desk', active: 'In progress', complete: 'Complete' }[q.status];
      const objs = q.status === 'locked' ? [] : j.objectives.map((o) => h('li', null, `${q.done.includes(o) ? '✓' : '○'} ${OBJECTIVE_TEXT[j.id][o]}`));
      out.push(h('div', { class: 'card' }, h('strong', null, `${j.id.toUpperCase()} — ${j.name}`), h('div', { class: 'statline' }, status), objs.length ? h('ul', null, ...objs) : null));
    }
    out.push(h('h3', null, 'Decisions'));
    const r = s.flags.labor_resolution, e = s.flags.evidence_handling;
    out.push(h('ul', null,
      h('li', null, `Job 001: ${r === 'charter' ? 'Rest Charter (worker salvage counter, materials −20%)' : r === 'compact' ? 'Village Compact (supply stall reopened, healing −20%)' : 'not decided yet'}`),
      h('li', null, `Job 002: ${e === 'public' ? 'Forgeries made public (angry crowd in Dregswell)' : e === 'trace' ? 'Evidence kept to trace the sender (sealed correspondence at the Bureau)' : 'not decided yet'}`),
    ));
    const keys = [s.flags.cellar_key ? KEY_ITEM_NAMES.cellar_key : null, s.flags.correspondence ? KEY_ITEM_NAMES.correspondence : null].filter(Boolean);
    out.push(h('h3', null, 'Key items'), h('p', null, keys.length ? keys.join(', ') : 'None.'));
    out.push(h('h3', null, 'Recap'), h('ol', null, ...s.journal.map((l) => h('li', null, l))));
    return out;
  }

  // ---------------- Equipment ----------------
  private equipment(s: GameState): Node[] {
    const L = this.local;
    const inBattle = !!s.battle;
    const tabs = h('div', { class: 'tabs', role: 'tablist' }, ...HERO_IDS.map((id) =>
      btn(shortName(id), () => { L.hero = id; this.render(); }, { key: `hero-${id}`, cls: '' })));
    tabs.querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-pressed', String(HERO_IDS[i] === L.hero)));
    const m = member(s, L.hero);
    const st = heroStats(s, L.hero);
    const head = h('div', { class: 'grid2' },
      h('div', { class: 'card', style: 'display:flex;gap:12px;align-items:center' }, heroPreview(s, L.hero, 3),
        h('div', null, h('strong', null, `${shortName(L.hero)} · Lv ${m.level}`),
          h('div', { class: 'statline' }, `HP ${m.hp}/${st.maxHp} · MP ${m.mp}/${st.maxMp}`),
          h('div', { class: 'statline' }, `ATK ${st.attack} · MAG ${st.magic} · DEF ${st.defence} · SPD ${st.speed}`),
          h('div', { class: 'statline' }, `XP ${m.xp}`))),
      h('div', { class: 'card' }, h('strong', null, 'Slots'),
        h('div', { class: 'list' }, ...SLOTS.map((slot) => {
          const id = m.equipment[slot];
          const inst = id ? instance(s, id) : undefined;
          const b = btn([h('span', { class: 'sub' }, slotName(slot)), ' ', inst ? itemLabel(inst.definitionId, inst.rank) : '— empty —'],
            () => { L.slot = slot; this.render(); }, { key: `slot-${slot}`, cls: L.slot === slot ? 'primary' : '' });
          return b;
        }))));
    const cands = s.inventory.equipmentInstances.filter((i) => {
      const def = item(i.definitionId);
      return slotAccepts(L.slot, def) && eligible(def, L.hero);
    });
    const curId = m.equipment[L.slot];
    const cur = curId ? instance(s, curId) : undefined;
    const curStats = st;
    const list = h('div', { class: 'list' }, ...cands.map((i) => {
      const def = item(i.definitionId);
      const owner = ownerOf(s, i.instanceId);
      const isCur = i.instanceId === curId;
      const after = statsWith(s, L.hero, L.slot, def.id, i.rank);
      const problem = isCur ? null : equipProblem(s, L.hero, L.slot, i.instanceId) ?? (owner && owner.hero !== L.hero ? `Equipped by ${shortName(owner.hero)} — unequip it there first.` : null);
      return h('div', { class: `item ${isCur ? 'selected' : ''}` },
        h('div', null,
          h('div', { class: 'name' }, itemLabel(def.id, i.rank), isCur ? ' (equipped)' : ''),
          h('div', { class: 'sub' }, `${statText(def, i.rank)} · ${isCur ? 'equipped now' : `if equipped: ${diffText(curStats, after)}`}`),
          ...(def.effects ?? []).map((e) => h('div', { class: 'sub' }, `★ ${EFFECT_TEXT[e]}`)),
          problem && !isCur ? h('div', { class: 'sub bad' }, problem) : null),
        isCur ? null : btn('Equip', () => this.ctx.dispatch({ type: 'equip', heroId: L.hero, slot: L.slot, instanceId: i.instanceId }), { cls: 'primary', disabled: !!problem || inBattle, key: `eq-${i.instanceId}` }));
    }));
    const unequip = cur && L.slot !== 'weapon'
      ? btn('Unequip this slot', () => this.ctx.dispatch({ type: 'equip', heroId: L.hero, slot: L.slot, instanceId: null }), { key: 'unequip', disabled: inBattle })
      : null;
    return [
      inBattle ? h('p', { class: 'bad' }, 'Equipment can only be changed outside battle.') : null,
      tabs, head,
      h('h3', null, `${slotName(L.slot)} options for ${shortName(L.hero)}`),
      cands.length ? list : h('p', { class: 'note' }, 'Nothing you own fits this slot. Accessories come from the workshop.'),
      unequip,
      h('p', { class: 'note' }, 'Weapon, head and body pieces change how the hero looks in exploration and battle.'),
    ].filter(Boolean) as Node[];
  }

  // ---------------- Inventory ----------------
  private inventory(s: GameState): Node[] {
    const stacks = Object.entries(s.inventory.stacks).filter(([, v]) => v > 0);
    const cons = stacks.filter(([k]) => item(k).kind === 'consumable');
    const mats = stacks.filter(([k]) => item(k).kind === 'material');
    const row = (k: string, v: number) => h('div', { class: 'item' }, h('div', null, h('div', { class: 'name' }, `${itemName(k)} ×${v}`), h('div', { class: 'sub' }, item(k).kind === 'consumable' ? describeConsumable(k) : sourceHint(s, k))));
    return [
      h('p', null, h('strong', null, `Gold: ${s.inventory.gold}`)),
      h('h3', null, 'Consumables'), cons.length ? h('div', { class: 'list' }, ...cons.map(([k, v]) => row(k, v))) : h('p', { class: 'note' }, 'None.'),
      h('h3', null, 'Materials'), mats.length ? h('div', { class: 'list' }, ...mats.map(([k, v]) => row(k, v))) : h('p', { class: 'note' }, 'None.'),
      h('h3', null, 'Key items'),
      h('p', null, [s.flags.cellar_key ? 'Cellar Key' : null, s.flags.correspondence ? 'Brokered Correspondence (cannot be sold)' : null].filter(Boolean).join(', ') || 'None.'),
      h('h3', null, 'Equipment'),
      h('div', { class: 'list' }, ...s.inventory.equipmentInstances.map((i) => h('div', { class: 'item' }, h('div', null,
        h('div', { class: 'name' }, itemLabel(i.definitionId, i.rank)),
        h('div', { class: 'sub' }, `${statText(item(i.definitionId), i.rank)} · ${describeOwner(s, i.instanceId)}`))))),
      h('p', { class: 'note' }, 'There is no selling or dismantling in this prototype.'),
    ];
  }

  // ---------------- Shop ----------------
  private shop(s: GameState): Node[] {
    const shopId = String(s.flags.open_shop ?? 'mott');
    const shop = SHOPS[shopId];
    const L = this.local;
    if (!shopOpen(s, shopId)) return [h('p', null, 'This shop is closed.')];
    const rows = shop.stock.map((id) => {
      const p = price(s, shopId, id);
      const base = CONTENT.raw.shopBasePrices[id];
      const qty = L.qty[id] ?? 1;
      const key = `buy-${id}`;
      const confirming = L.confirm === key;
      const afford = s.inventory.gold >= p * qty;
      return h('div', { class: 'item' },
        h('div', null,
          h('div', { class: 'name' }, itemName(id)),
          h('div', { class: 'sub' }, p < base ? h('span', null, h('s', null, `${base}g`), ' ', h('span', { class: 'good' }, `${p}g`)) : `${p}g`, ` · owned ${count(s, id)}`),
          h('div', { class: 'sub' }, item(id).kind === 'consumable' ? describeConsumable(id) : 'Crafting material')),
        h('div', { style: 'display:flex;gap:4px;align-items:center' },
          btn('−', () => { L.qty[id] = Math.max(1, qty - 1); L.confirm = null; this.render(); }, { key: `${key}-minus`, aria: `Fewer ${itemName(id)}` }),
          h('span', { 'aria-live': 'polite' }, `×${qty}`),
          btn('+', () => { L.qty[id] = Math.min(20, qty + 1); L.confirm = null; this.render(); }, { key: `${key}-plus`, aria: `More ${itemName(id)}` }),
          confirming
            ? btn(`Pay ${p * qty}g`, () => { this.ctx.dispatch({ type: 'buy', itemId: id, qty, txId: L.tx! }); L.confirm = null; this.render(); }, { cls: 'primary', key: `${key}-confirm` })
            : btn('Buy', () => { L.confirm = key; L.tx = txId('buy'); this.render(); }, { disabled: !afford, key })));
    });
    return [
      h('p', null, shop.blurb),
      h('p', null, h('strong', null, `Gold: ${s.inventory.gold}`)),
      h('div', { class: 'list' }, ...rows),
      h('p', { class: 'note' }, 'No selling in this prototype. No real money is involved anywhere in the game.'),
    ];
  }

  // ---------------- Workshop ----------------
  private workshop(s: GameState): Node[] {
    const L = this.local;
    if (!s.flags.workshop_open) return [h('p', null, 'The workshop opens after job 001.')];
    const tabs = h('div', { class: 'tabs' },
      btn('Craft', () => { L.wsTab = 'craft'; L.confirm = null; this.render(); }, { key: 'ws-craft' }),
      btn('Upgrade', () => { L.wsTab = 'upgrade'; L.confirm = null; this.render(); }, { key: 'ws-upgrade' }));
    tabs.children[0].setAttribute('aria-pressed', String(L.wsTab === 'craft'));
    tabs.children[1].setAttribute('aria-pressed', String(L.wsTab === 'upgrade'));
    const pinned = s.pinnedRecipe ? CONTENT.recipes.get(s.pinnedRecipe) : null;
    const pin = pinned ? h('div', { class: 'pin' }, `📌 Pinned: ${itemName(pinned.outputItem)} — ${Object.entries(pinned.materials).map(([k, v]) => `${itemName(k)} ${count(s, k)}/${v}`).join(', ')}, gold ${s.inventory.gold}/${pinned.gold}`) : null;
    const head = [h('p', null, h('strong', null, `Gold: ${s.inventory.gold}`)), tabs, pin].filter(Boolean) as Node[];
    return L.wsTab === 'craft' ? [...head, ...this.craftTab(s)] : [...head, ...this.upgradeTab(s)];
  }

  private craftTab(s: GameState): Node[] {
    const L = this.local;
    const recipes = CONTENT.raw.recipes;
    if (!L.recipe) L.recipe = recipes.find((r) => recipeUnlocked(s, r))?.id ?? null;
    const list = h('div', { class: 'list' }, ...recipes.map((r) => {
      const unlocked = recipeUnlocked(s, r);
      const ok = !craftProblem(s, r.id);
      return h('div', { class: `item ${L.recipe === r.id ? 'selected' : ''}` },
        h('div', null, h('div', { class: 'name' }, itemName(r.outputItem)),
          h('div', { class: 'sub' }, unlocked ? (ok ? h('span', { class: 'good' }, 'Can craft') : 'Missing materials or gold') : `Unlocks after ${CONTENT.jobs.get(r.unlockAfter)!.name}`)),
        btn('Details', () => { L.recipe = r.id; L.confirm = null; this.render(); }, { key: `rec-${r.id}`, disabled: !unlocked }));
    }));
    const out: Node[] = [h('h3', null, 'Recipes'), list];
    const r = L.recipe ? CONTENT.recipes.get(L.recipe) : null;
    if (r && recipeUnlocked(s, r)) {
      const def = item(r.outputItem);
      const problem = craftProblem(s, r.id);
      const confirming = L.confirm === `craft-${r.id}`;
      const compare = HERO_IDS.filter((hid) => eligible(def, hid)).map((hid) => {
        const slot: Slot = def.slot === 'accessory' ? (member(s, hid).equipment.accessory1 ? 'accessory2' : 'accessory1') : def.slot as Slot;
        const now = heroStats(s, hid);
        const after = statsWith(s, hid, slot, def.id, 0);
        return h('li', null, `${shortName(hid)}: ${diffText(now, after)} vs current ${slotName(slot).toLowerCase()}`);
      });
      out.push(h('h3', null, `${def.name} +0`),
        h('div', { class: 'card' },
          def.slot === 'weapon' || def.slot === 'head' || def.slot === 'body'
            ? h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' }, ...HERO_IDS.filter((hid) => eligible(def, hid)).slice(0, 4).map((hid) => heroPreview(s, hid, 2, { slot: def.slot as 'weapon', app: def.appearance ?? null })))
            : null,
          h('p', null, `${slotName((def.slot === 'accessory' ? 'accessory1' : def.slot) as Slot)} · ${statText(def)} · Usable by: ${eligibleText(def)}`),
          ...(def.effects ?? []).map((e) => h('p', null, `★ ${EFFECT_TEXT[e]}`)),
          h('strong', null, 'Needs'),
          h('ul', null,
            ...Object.entries(r.materials).map(([k, v]) => h('li', { class: count(s, k) >= v ? 'good' : 'bad' }, `${itemName(k)}: ${count(s, k)}/${v} — `, h('span', { class: 'note' }, sourceHint(s, k)))),
            h('li', { class: s.inventory.gold >= r.gold ? 'good' : 'bad' }, `Gold: ${s.inventory.gold}/${r.gold}`)),
          compare.length ? h('div', null, h('strong', null, 'Compared with what is equipped now'), h('ul', null, ...compare)) : null,
          problem ? h('p', { class: 'bad' }, problem) : null,
          h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' },
            confirming
              ? btn(`Confirm: craft for ${r.gold}g + materials`, () => { this.ctx.dispatch({ type: 'craft', recipeId: r.id, txId: L.tx! }); L.confirm = null; this.render(); }, { cls: 'primary', key: 'craft-confirm' })
              : btn('Craft', () => { L.confirm = `craft-${r.id}`; L.tx = txId('craft'); this.render(); }, { cls: 'primary', key: 'craft', disabled: !!problem }),
            confirming ? btn('Cancel', () => { L.confirm = null; this.render(); }, { key: 'craft-cancel' }) : null,
            btn(s.pinnedRecipe === r.id ? 'Unpin' : 'Pin recipe', () => this.ctx.dispatch({ type: 'pinRecipe', recipeId: s.pinnedRecipe === r.id ? null : r.id }), { key: 'pin' }))));
    }
    out.push(h('p', { class: 'note' }, 'Crafting is instant and never required. Starter gear can finish the slice. New items arrive at +0; equip them from Party & Gear.'));
    return out;
  }

  private upgradeTab(s: GameState): Node[] {
    const L = this.local;
    const insts = s.inventory.equipmentInstances.filter((i) => item(i.definitionId).upgradable);
    const list = h('div', { class: 'list' }, ...insts.map((i) => h('div', { class: `item ${L.upgradeInst === i.instanceId ? 'selected' : ''}` },
      h('div', null, h('div', { class: 'name' }, itemLabel(i.definitionId, i.rank)), h('div', { class: 'sub' }, `${statText(item(i.definitionId), i.rank)} · ${describeOwner(s, i.instanceId)}`)),
      btn('Select', () => { L.upgradeInst = i.instanceId; L.confirm = null; this.render(); }, { key: `up-${i.instanceId}` }))));
    const out: Node[] = [h('p', { class: 'note' }, 'Each rank adds +1 to the item’s primary stat only. Maximum +3. Accessories cannot be upgraded.'), list];
    const inst = L.upgradeInst ? instance(s, L.upgradeInst) : undefined;
    if (inst) {
      const def = item(inst.definitionId);
      const cost = upgradeCost(inst.rank);
      const problem = upgradeProblem(s, inst.instanceId);
      const confirming = L.confirm === `up-${inst.instanceId}`;
      out.push(h('h3', null, `Upgrade ${itemLabel(def.id, inst.rank)}`), h('div', { class: 'card' },
        cost ? h('p', null, `${itemLabel(def.id, inst.rank)} → +${inst.rank + 1}: ${def.primaryStat?.toUpperCase()} +1. Cost: ${cost.gold} gold, ${Object.entries(cost.items).map(([k, v]) => `${v} ${itemName(k)} (have ${count(s, k)})`).join(', ')}.`) : h('p', null, 'This item is already +3, the maximum in this prototype.'),
        problem ? h('p', { class: 'bad' }, problem) : null,
        h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' },
          confirming
            ? btn('Confirm upgrade', () => { this.ctx.dispatch({ type: 'upgrade', instanceId: inst.instanceId, txId: L.tx! }); L.confirm = null; this.render(); }, { cls: 'primary', key: 'up-confirm' })
            : btn(inst.rank >= 3 ? 'Upgrade to +4' : `Upgrade to +${inst.rank + 1}`, () => {
              if (problem) { this.ctx.toast(problem); return; }
              L.confirm = `up-${inst.instanceId}`; L.tx = txId('up'); this.render();
            }, { cls: 'primary', key: 'up-go', title: problem ?? undefined }),
          confirming ? btn('Cancel', () => { L.confirm = null; this.render(); }, { key: 'up-cancel' }) : null)));
    }
    return out;
  }

  // ---------------- Settings ----------------
  private settings(s: GameState): Node[] {
    const L = this.local;
    const toggle = (label: string, key: 'music' | 'sfx' | 'reducedMotion' | 'instantText') => {
      const input = h('input', { type: 'checkbox', 'data-key': `set-${key}` }) as HTMLInputElement;
      input.checked = s.settings[key];
      input.addEventListener('change', () => this.ctx.dispatch({ type: 'settings', patch: { [key]: input.checked } }));
      return h('label', { class: 'toggle' }, label, input);
    };
    const dpad = h('input', { type: 'checkbox', 'data-key': 'set-dpad' }) as HTMLInputElement;
    dpad.checked = this.ctx.prefs.dpad;
    dpad.addEventListener('change', () => this.ctx.setPref('dpad', dpad.checked));
    const theme = h('select', { 'data-key': 'set-theme', style: 'min-height:44px;font-size:16px' },
      h('option', { value: 'classic_bone' }, 'Classic Bone'), h('option', { value: 'bureau_brass' }, 'Bureau Brass')) as HTMLSelectElement;
    theme.value = s.settings.theme;
    theme.addEventListener('change', () => this.ctx.dispatch({ type: 'settings', patch: { theme: theme.value as 'classic_bone' } }));
    const fileInput = h('input', { type: 'file', accept: '.json,application/json', 'data-key': 'import-file' }) as HTMLInputElement;
    fileInput.addEventListener('change', async () => {
      const f = fileInput.files?.[0];
      if (!f) return;
      if (f.size > MAX_IMPORT_BYTES) { L.importMsg = `File is too large (${Math.round(f.size / 1024)} KB; limit ${MAX_IMPORT_BYTES / 1024} KB). Nothing was changed.`; this.render(); return; }
      L.importText = await f.text();
      L.importMsg = '';
      this.render();
    });
    const ta = h('textarea', { 'aria-label': 'Paste exported save text', 'data-key': 'import-text', placeholder: 'Or paste exported save text here' }) as HTMLTextAreaElement;
    ta.value = L.importText;
    ta.addEventListener('input', () => { L.importText = ta.value; L.confirm = null; });
    const saving = this.ctx.store.saves;
    return [
      h('h3', null, 'Audio & accessibility'),
      toggle('Music (original procedural tunes)', 'music'),
      toggle('Sound effects', 'sfx'),
      toggle('Reduced motion (no shake or flashes)', 'reducedMotion'),
      toggle('Instant text', 'instantText'),
      h('label', { class: 'toggle' }, 'On-screen arrow buttons', dpad),
      h('label', { class: 'toggle' }, 'Shell theme', theme),
      h('h3', null, 'Saving'),
      h('p', null, saving.failing ? h('span', { class: 'bad' }, `Progress is NOT saving: ${saving.lastError ?? 'storage unavailable'}. Export a backup below.`) : 'Progress saves to this browser after every action (two alternating copies).'),
      h('p', { class: 'note' }, 'Browser storage can be cleared by the browser or by you, so export a backup if you care about this run or want to move devices.'),
      h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' },
        btn('Export save file', () => this.ctx.exportSave(), { key: 'export', cls: 'primary' }),
        btn('Copy save text', () => this.ctx.copySave(), { key: 'copy' })),
      h('h3', null, 'Import a save'),
      fileInput, ta,
      L.importMsg ? h('p', { class: L.importMsg.startsWith('Imported') ? 'good' : 'bad', role: 'status' }, L.importMsg) : null,
      L.confirm === 'import'
        ? h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' },
          btn('Replace current progress with this save', () => this.doImport(), { cls: 'danger', key: 'import-confirm' }),
          btn('Cancel', () => { L.confirm = null; this.render(); }, { key: 'import-cancel' }))
        : btn('Check & import…', () => this.checkImport(), { key: 'import' }),
      h('h3', null, 'Danger zone'),
      L.confirm === 'reset'
        ? h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' },
          h('p', { class: 'bad' }, 'This erases your saved progress in this browser and starts a new game.'),
          btn('Yes, erase and start over', () => { const st = newGameState(s.settings); saving.clear(); this.ctx.store.load(st); L.confirm = null; this.close(); }, { cls: 'danger', key: 'reset-confirm' }),
          btn('Cancel', () => { L.confirm = null; this.render(); }, { key: 'reset-cancel' }))
        : btn('Erase progress & start a new game…', () => { L.confirm = 'reset'; this.render(); }, { cls: 'danger', key: 'reset' }),
      h('p', { class: 'note' }, `Build: content ${CONTENT.raw.contentVersion}, save schema v1.`),
    ].filter(Boolean) as Node[];
  }

  private checkImport() {
    const L = this.local;
    if (!L.importText.trim()) { L.importMsg = 'Choose a save file or paste save text first.'; this.render(); return; }
    if (L.importText.length > MAX_IMPORT_BYTES) { L.importMsg = 'That save text is too large. Nothing was changed.'; this.render(); return; }
    const r = parseEnvelope(L.importText);
    if (!r.ok) { L.importMsg = `Import rejected: ${r.reason} Your current progress is unchanged.`; this.render(); return; }
    L.importMsg = `Valid save found (revision ${r.envelope.revision}). Last: ${r.envelope.payload.lastSummary}`;
    L.confirm = 'import';
    this.render();
  }

  private doImport() {
    const L = this.local;
    const r = parseEnvelope(L.importText);
    if (!r.ok) { L.importMsg = `Import rejected: ${r.reason}`; L.confirm = null; this.render(); return; }
    const st = r.envelope.payload;
    // Keep revisions monotonic relative to whatever is stored here.
    st.revision = Math.max(st.revision, (this.ctx.store.state?.revision ?? 0) + 1);
    this.ctx.store.load(st);
    L.importMsg = 'Imported. Your progress has been replaced.';
    L.importText = '';
    L.confirm = null;
    this.render();
  }

  // ---------------- Debug ----------------
  private debug(s: GameState): Node[] {
    if (!DEBUG_ENABLED) return [h('p', null, 'Not available.')];
    const d = (op: string, arg?: string) => this.ctx.dispatch({ type: 'debug', op, arg });
    const saves = this.ctx.store.saves;
    return [
      h('div', { class: 'debug' },
        h('p', null, 'Development-only tools. These are excluded from production builds.'),
        h('div', { class: 'menu-grid' },
          btn('Grant materials + 300g', () => d('grant'), { key: 'd-grant' }),
          btn('Jump to job 002', () => d('jump', 'job002'), { key: 'd-j2' }),
          btn('Jump to job 003', () => d('jump', 'job003'), { key: 'd-j3' }),
          btn('Start boss', () => { d('boss'); this.close(); }, { key: 'd-boss' }),
          btn('Heal party', () => d('heal'), { key: 'd-heal' }),
          btn('Teleport: archive', () => { d('teleport', 'cellar_archive'); this.close(); }, { key: 'd-tp' }),
          btn(saves.simulateFailure ? 'Stop simulating save failure' : 'Simulate save failure', () => { saves.simulateFailure = !saves.simulateFailure; this.ctx.store.persist(); this.ctx.refreshAll(); }, { key: 'd-fail' })),
        h('h3', null, 'State'),
        h('textarea', { readonly: true, style: 'min-height:240px' }, JSON.stringify(s, null, 1))),
    ];
  }
}

function slotName(slot: Slot) {
  return { weapon: 'Weapon', head: 'Head', body: 'Body', accessory1: 'Accessory 1', accessory2: 'Accessory 2' }[slot];
}

function describeConsumable(id: string): string {
  const def = item(id);
  const r = CONTENT.raw.consumableRules[def.effect!];
  if (r.restoreHp) return `Restores ${r.restoreHp} HP to a living ally (no revive). Uses a turn in battle.`;
  if (r.restoreMp) return `Restores ${r.restoreMp} MP to a living ally. Uses a turn in battle.`;
  return '';
}

export const _exportForTests = { exportText };
