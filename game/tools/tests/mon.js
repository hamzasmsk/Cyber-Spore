const { chromium, devices } = require('playwright');
(async () => {
  const S = require('path').resolve(__dirname, 'out/mon'); require('fs').mkdirSync(S, { recursive: true });
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'] }); const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => { errs.push(e.message); console.log('ERR', e.message, (e.stack || '').split('\n')[1]); });
  await page.addInitScript(() => localStorage.clear());
  await page.goto('file://' + require('path').resolve(__dirname, '../../index.html'));
  await page.waitForFunction(() => window.SS && SS.R.heroes.length > 0); await page.evaluate(() => SS.unlock && SS.unlock.all());
  await page.waitForTimeout(1500);
  console.log('mode', await page.evaluate(() => SS.mon.mode));
  await page.screenshot({ path: `${S}/01-field.png` });
  // store
  await page.click('#shopBtn'); await page.waitForTimeout(400); await page.screenshot({ path: `${S}/02-shop.png` });
  await page.evaluate(() => document.getElementById('pBody').scrollTop = 600); await page.waitForTimeout(200); await page.screenshot({ path: `${S}/03-shop2.png` });
  // buy starter (test dialog)
  await page.evaluate(() => document.getElementById('pBody').scrollTop = 0);
  await page.click('.mz-buy[data-sku="ss_starter"]'); await page.waitForTimeout(300); await page.screenshot({ path: `${S}/04-testbuy.png` });
  await page.click('.mz-ov .btn.green'); await page.waitForTimeout(600); await page.screenshot({ path: `${S}/05-bought.png` });
  console.log('after starter', await page.evaluate(() => JSON.stringify({ gems: SS.save.gems, owned: SS.save.mon.owned, skin: SS.save.skins && SS.save.skins.owned, boost: SS.save.boost })));
  // free gems via test ad (the shop re-opened itself after the purchase)
  await page.evaluate(() => { if (document.getElementById('panel').classList.contains('hidden')) SS.shop.open(); }); await page.waitForTimeout(300);
  const adBtn = await page.$('.fb-shop .row-card:has(.mz-ad-p) .btn'); await adBtn.click(); await page.waitForTimeout(800); await page.screenshot({ path: `${S}/06-ad.png` });
  await page.waitForTimeout(2400);
  console.log('after ad', await page.evaluate(() => JSON.stringify({ gems: SS.save.gems, ads: SS.save.mon.ads })));
  await page.evaluate(() => SS.closePanel());
  // pass
  await page.evaluate(() => SS.pass.addXp(700)); await page.click('#passBtn'); await page.waitForTimeout(400); await page.screenshot({ path: `${S}/07-pass.png` });
  // piggy
  await page.evaluate(() => { SS.closePanel(); SS.save.piggy.gems = 240; SS.piggy.refresh(); }); await page.click('#piggyBtn'); await page.waitForTimeout(400); await page.screenshot({ path: `${S}/08-piggy.png` });
  await page.evaluate(() => SS.closePanel());
  // boss reward card + continue
  await page.evaluate(() => { const s = SS.save; s.stage = 2; s.sub = 5; s.kills = 8; s.bossReady = true; s.team = 5; s.lv.power = 60; SS.setupHeroes(); SS.startBoss(); });
  await page.waitForTimeout(4500); await page.screenshot({ path: `${S}/09-reward.png` });
  await page.evaluate(() => { const s = SS.save; s.sub = 5; s.kills = 8; s.bossReady = true; s.lv.power = 0; SS.R.en.length = 0; SS.startBoss(); });
  await page.waitForTimeout(2000); await page.evaluate(() => { SS.R.boss.t = 0.2; SS.R.boss.hp = SS.R.boss.maxHp * 0.3; });
  await page.waitForTimeout(800); await page.screenshot({ path: `${S}/10-continue.png` });
  console.log('paused', await page.evaluate(() => SS.R.paused));
  console.log('errors', errs.length ? errs : 'none');
  await b.close();
})();
