const { chromium, devices } = require('playwright');
(async () => {
  require('fs').mkdirSync(require('path').resolve(__dirname, 'out/tree'), { recursive: true }); require('fs').mkdirSync(require('path').resolve(__dirname, 'out'), { recursive: true });
  const S = require('path').resolve(__dirname, 'out/tree');
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'] }); const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('dialog', d => d.accept());
  await page.goto('file://' + require('path').resolve(__dirname, '../../index.html'));
  await page.waitForFunction(() => window.SS && SS.R.heroes.length > 0); await page.evaluate(() => SS.unlock && SS.unlock.all());
  await page.evaluate(() => { SS.save.mon.offers.ss_starter = { shown: Date.now() }; SS.save.stage = 30; SS.save.rebirths = 0; });
  await page.waitForTimeout(1500);
  await page.evaluate(() => SS.closePanel());
  await page.evaluate(() => SS.PANELS.rebirth());
  await page.waitForTimeout(400); await page.screenshot({ path: S + '/1-rebirth.png' });
  await page.click('#pBody .btn.purple.wide'); await page.waitForTimeout(800);
  console.log('after', JSON.stringify(await page.evaluate(() => ({ souls: SS.tree.points(), stage: SS.save.stage, rp: SS.save.rp }))));
  await page.evaluate(() => SS.PANELS.rebirth('t')); await page.waitForTimeout(400);
  await page.screenshot({ path: S + '/2-tree.png' });
  await page.click('.tr-detail .btn.purple'); await page.waitForTimeout(300);
  await page.click('.tr-node[data-id="blade"]'); await page.waitForTimeout(300);
  await page.screenshot({ path: S + '/3-bought.png' });
  await page.evaluate(() => { SS.save.tree.souls = 200; SS.PANELS.rebirth('t'); });
  for (const id of ['hand','eye','fatal','gold','hunt','sleep','gemsoul','body','time','armor','slayer','shadow']) { await page.click(`.tr-node[data-id="${id}"]`); await page.waitForTimeout(80); const bt = await page.$('.tr-detail .btn.purple:not(.off)'); if (bt) await bt.click(); await page.waitForTimeout(80); }
  await page.screenshot({ path: S + '/4-full.png' });
  console.log('mods', JSON.stringify(await page.evaluate(() => ({ crit: SS.critChance(), bt: SS.bossTime(), ehp: SS.modMul('ehp'), lv: SS.save.tree.lv, souls: SS.tree.points() }))));
  console.log('errors', errs.length ? errs : 'none'); await b.close();
})();
