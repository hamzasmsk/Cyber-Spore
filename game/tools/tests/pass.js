const { chromium, devices } = require('playwright');
(async () => {
  const S = require('path').resolve(__dirname, 'out/pass'); require('fs').mkdirSync(S, { recursive: true });
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'] }); const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => { errs.push(e.message); console.log('ERR', e.message, (e.stack || '').split('\n')[1]); });
  await page.addInitScript(() => localStorage.clear());
  await page.goto('file://' + require('path').resolve(__dirname, '../../index.html'));
  await page.waitForFunction(() => window.SS && SS.R.heroes.length > 0); await page.evaluate(() => SS.unlock && SS.unlock.all());
  await page.waitForTimeout(1200);
  await page.evaluate(() => SS.pass.addXp(1000));
  await page.click('#passBtn'); await page.waitForTimeout(250); await page.screenshot({ path: `${S}/01.png` });
  await page.evaluate(() => document.getElementById('pBody').scrollTop = 520); await page.waitForTimeout(150); await page.screenshot({ path: `${S}/02.png` });
  await page.evaluate(() => document.getElementById('pBody').scrollTop = 0);
  await page.click('.ps-buy [data-sku="ss_pass"]'); await page.waitForTimeout(200); await page.click('.mz-ov .btn.green'); await page.waitForTimeout(900);
  await page.screenshot({ path: `${S}/03-prem.png` });
  console.log(await page.evaluate(() => JSON.stringify({ inv: SS.save.inv, cos: SS.save.cos, gems: SS.save.gems, lv: SS.pass.level(), skins: Object.keys(SS.save.skins.owned) })));
  await page.evaluate(() => { SS.closePanel(); SS.pass.open('t'); }); await page.waitForTimeout(200); await page.screenshot({ path: `${S}/04-tasks.png` });
  await page.evaluate(() => { SS.closePanel(); SS.save.cos.trails = { fire: true, magic: true }; SS.save.skins.owned.Master = true; SS.skins.open(); document.getElementById('pBody').scrollTop = 900; }); await page.waitForTimeout(300); await page.screenshot({ path: `${S}/05-costume.png` });
  await page.evaluate(() => { SS.closePanel(); SS.save.cos.trail = 'fire'; SS.save.gun = 1; }); await page.waitForTimeout(2500); await page.screenshot({ path: `${S}/06-trail.png` });
  // panel opening timing: frames between click and stable panel
  const t = await page.evaluate(async () => { const t0 = performance.now(); SS.pass.open(); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); return performance.now() - t0; });
  console.log('open->2 frames ms', t.toFixed(1));
  console.log('errors', errs.length ? errs : 'none');
  await b.close();
})();
