// Save robustness: corrupt main copy -> loads the backup and says so; a reload keeps progress; settings shows the last save.
const { chromium } = require('playwright'), path = require('path');
const URL = 'file://' + path.resolve(__dirname, '../../index.html');
(async () => {
  const b = await chromium.launch(), errs = [], fail = [], ok = (c, m) => { if (!c) fail.push(m); };
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'tr-TR' });
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL); await p.waitForFunction(() => window.SS && SS.R.heroes.length > 0);
  // progress, then a save that also writes the backup
  await p.evaluate(() => { Object.assign(SS.save, { stage: 9, best: 12, gems: 777 }); SS.saveState.bakAt = 0; SS.persist(); });
  ok(await p.evaluate(() => !!localStorage.getItem(SS.SAVE_KEY + '_bak')), 'backup written');
  await p.reload(); await p.waitForFunction(() => window.SS && SS.R.heroes.length > 0);
  ok(await p.evaluate(() => SS.save.stage === 9 && SS.save.gems >= 777 && SS.loadInfo.from === 'main'), 'reload keeps progress');
  // corrupt the main copy
  await p.evaluate(() => { SS.R.noSave = true; localStorage.setItem(SS.SAVE_KEY, '{"stage":9,"lv":{"po'); });
  await p.reload(); await p.waitForFunction(() => window.SS && SS.R.heroes.length > 0);
  ok(await p.evaluate(() => SS.loadInfo.from === 'backup' && SS.loadInfo.recovered && SS.save.gems >= 777 && SS.save.stage === 9), 'backup used after corruption');
  ok(await p.evaluate(() => !!localStorage.getItem(SS.SAVE_KEY + '_corrupt')), 'corrupt copy kept');
  await p.waitForTimeout(1600);
  ok(await p.evaluate(() => /yedekten/.test(document.getElementById('banner').textContent)), 'player told');
  // settings: last save line + save button
  await p.evaluate(() => { const d = new Date(); SS.save.login.last = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; document.getElementById('settingsTop').click(); });
  await p.waitForTimeout(400);
  ok(await p.evaluate(() => /Son kayıt/.test(document.querySelector('#pBody .sv-ago').textContent)), 'last save shown');
  await p.evaluate(() => document.querySelector('#pBody .sv-now .btn').click());
  ok(await p.evaluate(() => Date.now() - SS.saveState.at < 3000), 'save now');
  console.log(fail.length ? 'FAIL ' + fail.join(' | ') : 'all checks passed');
  console.log(errs.length || fail.length ? 'errors ' + [...fail, ...errs].join(' ; ') : 'errors none');
  await b.close();
})();
