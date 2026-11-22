const { chromium, devices } = require('playwright');
(async () => {
  require('fs').mkdirSync(require('path').resolve(__dirname, 'out/perk'), { recursive: true }); require('fs').mkdirSync(require('path').resolve(__dirname, 'out'), { recursive: true });
  const S = require('path').resolve(__dirname, 'out/perk');
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'] }); const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('file://' + require('path').resolve(__dirname, '../../index.html'));
  await page.waitForFunction(() => window.SS && SS.R.heroes.length > 0); await page.evaluate(() => SS.unlock && SS.unlock.all());
  await page.evaluate(() => { SS.save.mon.offers.ss_starter = { shown: Date.now() }; SS.closePanel(); const s = SS.save; s.gems = 50; s.team = 4; s.gun = 2; s.wbest = 2; s.stage = 6; s.sub = 5; s.kills = 7; s.lv = { power: 40, speed: 30, money: 30 }; SS.setupHeroes(); });
  await page.waitForTimeout(1000);
  await page.evaluate(() => SS.perks.offer());
  await page.waitForTimeout(700); await page.screenshot({ path: S + '/1-offer.png' });
  await page.click('.pk-rr'); await page.waitForTimeout(500);
  await page.click('.pk-card >> nth=1'); await page.waitForTimeout(700);
  console.log('paused', await page.evaluate(() => SS.R.paused), JSON.stringify(await page.evaluate(() => SS.save.perks)));
  await page.evaluate(() => { SS.save.perks = { frost: 2, chain: 2, blast: 2, multi: 1, pierce: 1, flame: 1 }; });
  await page.waitForTimeout(2500); await page.screenshot({ path: S + '/2-play.png' });
  // boss win → auto offer, idle auto pick
  await page.evaluate(() => { SS.save.bossReady = true; SS.startBoss(); });
  await page.waitForTimeout(2500);
  await page.evaluate(() => { if (SS.R.boss) SS.R.boss.hp = 1; });
  await page.waitForTimeout(3000); await page.screenshot({ path: S + '/3-auto.png' });
  console.log('ov', await page.evaluate(() => !!document.querySelector('.pk-ov')));
  await page.waitForTimeout(12500);
  console.log('after auto', await page.evaluate(() => !!document.querySelector('.pk-ov')), await page.evaluate(() => SS.R.paused), JSON.stringify(await page.evaluate(() => SS.save.perks)));
  await page.evaluate(() => SS.PANELS.rebirth()); await page.waitForTimeout(400); await page.screenshot({ path: S + '/4-reb.png' });
  console.log('errors', errs.length ? errs : 'none'); await b.close();
})();
