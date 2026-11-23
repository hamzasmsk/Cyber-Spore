// Analytics: off by default in the browser, on with ?ga=1; events for bosses, menus, purchases, ads; opt-out works.
const { chromium } = require('playwright'), path = require('path');
const URL = 'file://' + path.resolve(__dirname, '../../index.html');
(async () => {
  const b = await chromium.launch(), errs = [], fail = [], ok = (c, m) => { if (!c) fail.push(m); };
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'tr-TR' });
  let p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL); await p.waitForFunction(() => window.SS && SS.R.heroes.length > 0);
  ok(await p.evaluate(() => !!window.gameanalytics && !SS.analytics.ready), 'off in a web preview');
  await p.close();
  p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL + '?ga=1'); await p.waitForFunction(() => window.SS && SS.R.heroes.length > 0);
  ok(await p.evaluate(() => SS.analytics.ready), 'on with ?ga=1');
  await p.evaluate(() => { const d = new Date(); SS.save.login.last = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; SS.save.bossReady = true; SS.startBoss(); });
  await p.waitForTimeout(300);
  await p.evaluate(() => { SS.bossWin(); });
  await p.evaluate(() => { SS.unlock.all(); document.getElementById('shopBtn').click(); });
  await p.waitForTimeout(300);
  await p.evaluate(() => { SS.closePanel(); SS.mon.grant(SS.IAP.product('ss_gems_1'), true); });
  const kinds = await p.evaluate(() => SS.analytics.log.map(e => e[0] + ':' + e.slice(1, 4).join('/')));
  ok(kinds.some(k => k.startsWith('addProgressionEvent:1/stage')), 'boss start');
  ok(kinds.some(k => k.startsWith('addProgressionEvent:2/stage')), 'boss win');
  ok(kinds.some(k => k.startsWith('addDesignEvent:Menu:First:shopBtn')), 'first menu open');
  ok(kinds.some(k => k.startsWith('addBusinessEvent:USD/99')), 'purchase in USD cents');
  // opt-out from Ayarlar
  await p.evaluate(() => { document.getElementById('settingsTop').click(); });
  await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelector('#pBody .ga-opt').click());
  ok(await p.evaluate(() => SS.save.noTrack === true && !document.querySelector('#pBody .ga-opt').classList.contains('on')), 'opt-out toggle');
  console.log(fail.length ? 'FAIL ' + fail.join(' | ') : 'all checks passed', kinds.slice(0, 8));
  console.log(errs.length || fail.length ? 'errors ' + [...fail, ...errs].join(' ; ') : 'errors none');
  await b.close();
})();
