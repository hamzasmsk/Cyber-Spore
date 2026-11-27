// AFK earnings: panel on start (time away, gold, limit bar, mine gems), paid once; and again after returning from
// the background for more than 2 minutes.
const { chromium } = require('playwright'), path = require('path');
(async () => {
  const b = await chromium.launch(), errs = [], fail = [], ok = (c, m) => { if (!c) fail.push(m); };
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'tr-TR' });
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  const URL = 'file://' + path.resolve(__dirname, '../../index.html');
  await p.goto(URL); await p.waitForFunction(() => window.SS && SS.R.heroes.length > 0);
  // a save that was last seen 10 hours ago, earning 50 gold/s
  await p.evaluate(() => { const d = new Date(); SS.save.login.last = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; SS.save.rate = 50; SS.save.mine = { lv: 3, stored: 7, t: Date.now() }; SS.persist();
    const o = JSON.parse(localStorage.getItem(SS.SAVE_KEY)); o.t = o.tMax = Date.now() - 10 * 3600e3; localStorage.setItem(SS.SAVE_KEY, JSON.stringify(o)); SS.R.noSave = true; });
  await p.reload(); await p.waitForFunction(() => window.SS && SS.R.heroes.length > 0); await p.waitForTimeout(800);
  ok(await p.evaluate(() => document.getElementById('pTitle').dataset.k === 'Hoş geldin!'), 'panel on start');
  ok(await p.evaluate(() => !!document.querySelector('.off-cap.full') && /8 sa/.test(document.querySelector('.off-cap').textContent)), 'limit bar full at 8 h');
  ok(await p.evaluate(() => !!document.querySelector('.off-mine')), 'mine line');
  await p.screenshot({ path: path.resolve(__dirname, 'out/offline.png') });
  const m0 = await p.evaluate(() => SS.save.money);
  await p.click('#pBody .btnrow .btn.green'); await p.waitForTimeout(400);
  const m1 = await p.evaluate(() => SS.save.money);
  ok(Math.abs((m1 - m0) - 8 * 3600 * 50 * 0.5) < 2, 'paid 8 h x 50/s x 50% (' + (m1 - m0) + ')');
  // back from the background after 5 minutes
  await p.evaluate(() => { SS.save.rate = 50; SS.persist(); SS.save.t = SS.save.tMax = Date.now() - 300e3;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange'));
    const t0 = Date.now(); const real = Date.now; Date.now = () => real() + 300e3; window.__restore = () => { Date.now = real; };
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
  await p.waitForTimeout(900);
  ok(await p.evaluate(() => !document.getElementById('panel').classList.contains('hidden') && document.getElementById('pTitle').dataset.k === 'Hoş geldin!'), 'panel after returning from background');
  console.log(fail.length ? 'FAIL ' + fail.join(' | ') : 'all checks passed');
  console.log(errs.length || fail.length ? 'errors ' + [...fail, ...errs].join(' ; ') : 'errors none');
  await b.close();
})();
