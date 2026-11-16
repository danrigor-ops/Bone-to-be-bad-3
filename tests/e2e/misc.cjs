const { chromium } = require('playwright');
const L = require('./lib.cjs');
require('fs').mkdirSync('e2e-shots', { recursive: true });
const BASE = process.env.BASE_URL || 'http://localhost:5173/';
const out = (...a) => console.log(...a);
(async () => {
  const b = await chromium.launch();
  // ---- A. storage denied ----
  {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
    await ctx.addInitScript(() => { Storage.prototype.setItem = function () { throw new DOMException('denied', 'SecurityError'); }; });
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
    await p.goto(BASE); await L.sleep(800);
    await p.screenshot({ path: 'e2e-shots/nostorage_title.png' });
    await p.click('text=New Game'); await L.sleep(300); await L.dialogue(p);
    const warn = await p.$('.savebad');
    out('A storage denied: warning shown =', !!warn);
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-key="top-export"]')]);
    const path = await dl.path();
    const text = require('fs').readFileSync(path, 'utf8');
    out('A export works =', text.includes('"schemaVersion": 1') || text.includes('"schemaVersion":1'), 'bytes', text.length);
    await L.talk(p, 'desk', ['Accept job 001']);
    out('A still playable =', (await L.st(p)).questState.job001.status === 'active', 'errors', errs);
    await p.screenshot({ path: 'e2e-shots/nostorage_play.png' });
    await ctx.close();
  }
  // ---- B. background mid-fight, malformed import, landscape ----
  {
    const ctx = await b.newContext({ viewport: { width: 360, height: 640 } });
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
    await p.goto(BASE); await p.evaluate(() => localStorage.clear()); await p.reload(); await L.sleep(800);
    await p.click('text=New Game'); await L.sleep(300); await L.dialogue(p);
    await p.evaluate(() => window.btbb3.store.dispatch({ type: 'debug', op: 'boss' }));
    await L.sleep(300);
    // Hero turns until enemy phase begins; hide the page first
    await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
    for (let i = 0; i < 3; i++) { await p.click('[data-key="b-guard"]').catch(() => {}); await L.sleep(250); }
    const s1 = await L.st(p);
    await L.sleep(3000);
    const s2 = await L.st(p);
    out('B hidden: phase', s1.battle.phase, 'seq stays', s1.battle.seq === s2.battle.seq);
    await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
    await L.sleep(1500);
    const s3 = await L.st(p);
    out('B visible again: enemy acted =', s3.battle.seq > s2.battle.seq);
    // Withdraw from boss
    for (let i = 0; i < 20; i++) { const s = await L.st(p); if (s.battle.phase === 'player') break; await L.sleep(300); }
    await p.click('[data-key="b-leave"]'); await p.click('[data-key="b-leave"]'); await L.sleep(400);
    const s4 = await L.st(p);
    out('B withdraw: battle cleared', !s4.battle, 'at', s4.location.id, 'boss still undefeated', !s4.claimedRewards.includes('encounter:foreclosure_boss'));
    // Malformed import
    await p.click('[data-key="menu"]'); await p.click('[data-key="m-settings"]'); await L.sleep(200);
    await p.fill('textarea[data-key="import-text"]', '{"schemaVersion": 7, "payload": {}}');
    await p.click('[data-key="import"]'); await L.sleep(200);
    const msg = await p.innerText('[role="status"]');
    const s5 = await L.st(p);
    out('B import future schema rejected:', msg.slice(0, 90), '| state unchanged', s5.revision === s4.revision);
    await p.fill('textarea[data-key="import-text"]', 'garbage');
    await p.click('[data-key="import"]'); await L.sleep(200);
    out('B import garbage:', (await p.innerText('[role="status"]')).slice(0, 60));
    await p.screenshot({ path: 'e2e-shots/settings.png' });
    await p.click('[data-key="close"]');
    // Landscape: resize and keep state
    await p.setViewportSize({ width: 740, height: 360 }); await L.sleep(500);
    await p.screenshot({ path: 'e2e-shots/landscape_world.png' });
    await p.evaluate(() => window.btbb3.store.dispatch({ type: 'debug', op: 'boss' })); await L.sleep(500);
    await p.screenshot({ path: 'e2e-shots/landscape_battle.png' });
    const s6 = await L.st(p);
    out('B landscape keeps state:', s6.revision > s5.revision, 'overflow', await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), 'errors', errs);
    await ctx.close();
  }
  await b.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
