const { chromium, devices } = require('playwright');
(async () => {
  const S = require('path').resolve(__dirname, 'out/weap'); require('fs').mkdirSync(S, { recursive: true });
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'] }); const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => { errs.push(e.message); console.log('ERR', e.message, (e.stack || '').split('\n')[1]); });
  await page.goto('file://' + require('path').resolve(__dirname, '../../index.html'));
  await page.waitForFunction(() => window.SS && SS.R.heroes.length > 0); await page.evaluate(() => SS.unlock && SS.unlock.all());
  await page.evaluate(() => { const s = SS.save; s.money = 1e6; s.gems = 5000; s.team = 5; s.stage = 3; s.sub = 2; s.lv = { power: 8, speed: 25, money: 5 }; SS.setupHeroes(); SS.refreshUI(); });
  for (let g = 0; g < 8; g++) {
    await page.evaluate(g => { SS.save.gun = g; SS.R.phase = 'fight'; SS.R.toSpawn = 6; SS.R.spawnT = 0; }, g);
    await page.waitForTimeout(2600);
    await page.screenshot({ path: `${S}/g${g}.png` });
  }
  // panel preview
  await page.evaluate(() => { SS.save.gun = 3; SS.save.wbest = 3; SS.save.mon.offers.ss_starter = { shown: Date.now() }; });
  await page.evaluate(() => SS.closePanel()); await page.click('[data-open="guns"]'); await page.waitForTimeout(1300); await page.screenshot({ path: `${S}/panel.png` });
  await page.click('.row-card:nth-of-type(6) .ico', { force: true }).catch(() => {}); await page.waitForTimeout(900); await page.screenshot({ path: `${S}/panel2.png` });
  // buy next weapon -> unlock moment
  await page.evaluate(() => SS.closePanel()); await page.click('[data-open="guns"]'); await page.waitForTimeout(300);
  await page.click('.row-card .btn.yellow'); await page.waitForTimeout(400); await page.screenshot({ path: `${S}/unlock.png` });
  const ms = await page.evaluate(() => new Promise(r => { let n = 0, t0 = performance.now(); const f = () => { if (++n < 120) requestAnimationFrame(f); else r((performance.now() - t0) / n); }; requestAnimationFrame(f); }));
  console.log('frame ms', ms.toFixed(2), 'errors', errs.length ? errs.slice(0, 5) : 'none');
  await b.close();
})();
