const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function st(p) { return p.evaluate(() => window.btbb3.store.state); }
async function tapTile(p, x, y) {
  const pt = await p.evaluate(([x, y]) => {
    const g = window.btbb3.game; const sc = g.scene.getScene('world'); const cam = sc.cameras.main;
    const r = g.canvas.getBoundingClientRect();
    const wx = x * 16 + 8, wy = y * 16 + 8;
    return { x: r.left + (wx - cam.worldView.x) * cam.zoom, y: r.top + (wy - cam.worldView.y) * cam.zoom };
  }, [x, y]);
  if (process.env.DBG) console.log('pt', JSON.stringify(pt), await p.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? e.tagName + '.' + e.className : 'none'; }, [pt.x, pt.y]), JSON.stringify(await p.evaluate(() => { const c = window.btbb3.game.canvas.getBoundingClientRect(); const cam = window.btbb3.game.scene.getScene('world').cameras.main; return { c: [c.left, c.top, c.width, c.height], wv: [cam.worldView.x, cam.worldView.y, cam.worldView.width, cam.worldView.height], z: cam.zoom }; })));
  await p.mouse.click(pt.x, pt.y);
}
async function settle(p) {
  await sleep(150);
  for (let i = 0; i < 100; i++) {
    const moving = await p.evaluate(() => window.btbb3.game.scene.getScene('world').moving);
    if (!moving) { await sleep(150); return; }
    await sleep(100);
  }
}
async function dialogue(p, choices = []) {
  for (let i = 0; i < 100; i++) {
    const s = await st(p);
    if (!s.dialogue) return;
    const ch = await p.$$('.choice');
    if (ch.length) {
      const want = choices.shift();
      let idx = 0;
      if (want) for (let k = 0; k < ch.length; k++) if ((await ch[k].innerText()).includes(want)) idx = k;
      await ch[idx].click(); await sleep(100);
      const again = await p.$(`.choice.confirming`);
      if (again) { await again.click(); await sleep(100); }
      continue;
    }
    await p.click('.dialogue'); await sleep(60);
  }
}
/** Tap the farthest on-screen tile of the route, repeatedly, like a player would. */
async function walkToward(p, x, y, adjacentOnly = false) {
  for (let k = 0; k < 8; k++) {
    const r = await p.evaluate(([x, y]) => {
      const B = window.btbb3; const s = B.store.state;
      const g = B.game; const cam = g.scene.getScene('world').cameras.main; const v = cam.worldView;
      const vis = (t) => t.x * 16 + 8 >= v.x + 4 && t.x * 16 + 8 <= v.x + v.width - 4 && t.y * 16 + 8 >= v.y + 4 && t.y * 16 + 8 <= v.y + v.height - 4;
      if (vis({ x, y })) return { x, y, final: true };
      const path = B.findPath(s, { x: s.location.tileX, y: s.location.tileY }, { x, y });
      if (!path) return null;
      let best = null; for (const t of path) if (vis(t)) best = t;
      return best ? { ...best, final: false } : null;
    }, [x, y]);
    if (!r) { const s = await st(p); require('fs').writeFileSync('e2e-shots/fail_state.json', JSON.stringify(s)); throw new Error(`no route to ${x},${y} from ${JSON.stringify(s.location)} dlg=${JSON.stringify(s.dialogue)} battle=${!!s.battle}`); }
    await tapTile(p, r.x, r.y); await settle(p);
    if (process.env.DBG) { const s2 = await st(p); console.log('tap', JSON.stringify(r), '->', JSON.stringify(s2.location), 'dlg', s2.dialogue && s2.dialogue.nodeId); }
    if (r.final) return;
  }
}
const ROUTES = {
  'bureau>village': [4, 8], 'village>bureau': [8, 0], 'village>mill_yard': [15, 5], 'mill_yard>village': [0, 4],
  'mill_yard>cellar_entry': [12, 10], 'cellar_entry>mill_yard': [4, 0], 'cellar_entry>cellar_archive': [4, 6],
  'cellar_archive>cellar_entry': [4, 0], 'cellar_entry>cellar_store': [9, 3], 'cellar_store>cellar_entry': [0, 3],
};
const GRAPH = { bureau: ['village'], village: ['bureau', 'mill_yard'], mill_yard: ['village', 'cellar_entry'], cellar_entry: ['mill_yard', 'cellar_archive', 'cellar_store'], cellar_archive: ['cellar_entry'], cellar_store: ['cellar_entry'] };
async function goTo(p, target) {
  for (let n = 0; n < 8; n++) {
    const s = await st(p);
    if (s.location.id === target) return;
    // BFS
    const prev = { [s.location.id]: null }; const q = [s.location.id];
    while (q.length) { const m = q.shift(); for (const x of GRAPH[m]) if (!(x in prev)) { prev[x] = m; q.push(x); } }
    let step = target; while (prev[step] !== s.location.id) step = prev[step];
    const [x, y] = ROUTES[`${s.location.id}>${step}`];
    await walkToward(p, x, y);
    await dialogue(p);
  }
  throw new Error('goTo failed ' + target);
}
async function talk(p, id, choices = []) {
  const s = await st(p);
  const o = await p.evaluate(([m, id]) => window.btbb3.maps[m].objects.find((o) => o.id === id), [s.location.id, id]);
  if (!o) throw new Error('no object ' + id);
  const near = await p.evaluate(([o]) => {
    const B = window.btbb3; const s = B.store.state;
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      if (B.findPath(s, { x: s.location.tileX, y: s.location.tileY }, { x: o.x + dx, y: o.y + dy })) return { x: o.x + dx, y: o.y + dy };
    }
    return null;
  }, [o]);
  if (near) await walkToward(p, near.x, near.y);
  await tapTile(p, o.x, o.y); await settle(p);
  const label = await p.innerText('[data-key="interact"]');
  if (!label.includes(':')) throw new Error(`no interact focus for ${id}: ${label}`);
  await p.click('[data-key="interact"]'); await sleep(150);
  await dialogue(p, choices);
}
async function fight(p) {
  for (let i = 0; i < 300; i++) {
    const s = await st(p);
    if (!s.battle) return;
    if (s.battle.phase === 'victory') { await p.click('[data-key="b-continue"]'); await sleep(200); return; }
    if (s.battle.phase === 'defeat') throw new Error('defeated');
    if (s.battle.phase === 'player') {
      const atk = await p.$('[data-key="b-attack"]');
      if (!atk) { await sleep(100); continue; }
      await atk.click(); await sleep(60);
      const t = await p.$('.cmds [data-key^="t-"]');
      if (t) await t.click();
      await sleep(250);
    } else await sleep(200);
  }
  const s = await st(p);
  const anim = await p.evaluate(() => JSON.stringify({ hidden: document.hidden, timer: window.btbb3.ui.enemyTimer, battleActive: window.btbb3.game.scene.isActive('battle'), worldActive: window.btbb3.game.scene.isActive('world'), title: window.btbb3.ui.titleEl.hidden }));
  throw new Error('fight did not finish: ' + JSON.stringify({ phase: s.battle && s.battle.phase, seq: s.battle && s.battle.seq, anim }));
}
async function smartFight(p) {
  for (let i = 0; i < 600; i++) {
    const s = await st(p);
    if (!s.battle) return;
    const b = s.battle;
    if (b.phase === 'victory') { await p.click('[data-key="b-continue"]'); await sleep(250); return; }
    if (b.phase === 'defeat') throw new Error('defeated');
    if (b.phase !== 'player') { await sleep(150); continue; }
    if (!(await p.$('[data-key="b-attack"]'))) { await sleep(100); continue; }
    const cur = b.queue[b.turnIndex];
    const heroes = b.actors.filter((a) => a.side === 'hero' && a.hp > 0);
    const me = b.actors.find((a) => a.id === cur);
    const weakest = heroes.slice().sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp)[0];
    const engine = b.actors.find((a) => a.defId === 'foreclosure_engine' && a.hp > 0);
    const repo = engine && engine.aiStep % 3 === 2;
    const clickSeq = async (...keys) => { for (const k of keys) { await p.click(`[data-key="${k}"]`); await sleep(70); } };
    if (cur === 'hexa' && weakest.hp / weakest.maxHp < 0.5 && me.mp >= 4) await clickSeq('b-skills', 'sk-patchwork', `t-${weakest.id}`, 'b-confirm');
    else if (repo && me.hp < 50 && cur !== 'hexa') await clickSeq('b-guard');
    else if (cur === 'c404' && b.dp >= 30) await clickSeq('b-skills', 'sy-fine_print', 'b-confirm');
    else {
      const t = b.actors.filter((a) => a.side === 'enemy' && a.hp > 0).sort((x, y) => x.hp - y.hp)[0];
      await clickSeq('b-attack', `t-${t.id}`);
    }
    await sleep(200);
  }
  throw new Error('smartFight did not finish');
}
module.exports = { sleep, st, tapTile, settle, dialogue, goTo, talk, fight, smartFight };
