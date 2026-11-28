const { chromium, devices } = require('playwright');
(async () => {
  require('fs').mkdirSync(require('path').resolve(__dirname, 'out/tw'), { recursive: true }); require('fs').mkdirSync(require('path').resolve(__dirname, 'out'), { recursive: true });
  const S = require('path').resolve(__dirname, 'out/tw');
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'] }); const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message + ' ' + (e.stack||'').split('\n')[1])); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('file://' + require('path').resolve(__dirname, '../../index.html'));
  await page.waitForFunction(() => window.SS && SS.R.heroes.length > 0); await page.evaluate(() => SS.unlock && SS.unlock.all());
  await page.evaluate(() => { SS.save.mon.offers.ss_starter = { shown: Date.now() }; SS.save.login.last = new Date().getFullYear() + '-' + (new Date().getMonth() + 1) + '-' + new Date().getDate(); const s = SS.save; s.team = 3; s.gun = 3; s.wbest = 3; s.stage = 9; s.best = 12; s.lv = { power: 50, speed: 40, money: 40 }; SS.setupHeroes(); });
  await page.waitForTimeout(800); await page.evaluate(() => SS.closePanel());
  await page.click('#missionsBtn'); await page.waitForTimeout(400); await page.screenshot({ path: S + '/1-missions.png' });
  await page.click('.hub-tabs [data-k="tower"]'); await page.waitForTimeout(400); await page.screenshot({ path: S + '/2-tower.png' });
  await page.click('#pBody .btn.wide'); await page.waitForTimeout(2500); await page.screenshot({ path: S + '/3-fight.png' });
  await page.waitForFunction(() => !SS.R.boss, null, { timeout: 60000 });
  await page.waitForTimeout(3200); await page.screenshot({ path: S + '/4-after.png' });
  console.log('tower', JSON.stringify(await page.evaluate(() => ({ t: SS.save.tower, stage: SS.save.stage, ready: SS.save.bossReady, phase: SS.R.phase }))));
  // lose a floor: very high floor
  await page.evaluate(() => { SS.closePanel(); SS.save.tower.best = 60; SS.tower.fight(); });
  await page.waitForFunction(() => !SS.R.boss, null, { timeout: 60000 });
  await page.waitForTimeout(1000);
  console.log('lost', JSON.stringify(await page.evaluate(() => ({ t: SS.save.tower, att: SS.tower.attempts() }))));
  await page.evaluate(() => { SS.closePanel(); SS.ach.open(); }); await page.waitForTimeout(400); await page.screenshot({ path: S + '/5-ach.png' });
  const can = await page.$('.ac-row.can .btn'); if (can) { await can.click(); await page.waitForTimeout(300); }
  console.log('ach', JSON.stringify(await page.evaluate(() => ({ a: SS.save.ach, st: SS.save.stats, gems: SS.save.gems }))));
  console.log('errors', errs.length ? errs : 'none'); await b.close();
})();
