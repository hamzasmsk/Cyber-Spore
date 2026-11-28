const { chromium, devices } = require('playwright');
(async () => {
  require('fs').mkdirSync(require('path').resolve(__dirname, 'out/daily'), { recursive: true }); require('fs').mkdirSync(require('path').resolve(__dirname, 'out'), { recursive: true });
  const S = require('path').resolve(__dirname, 'out/daily');
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'] }); const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('file://' + require('path').resolve(__dirname, '../../index.html'));
  await page.waitForFunction(() => window.SS && SS.R.heroes.length > 0); await page.evaluate(() => SS.unlock && SS.unlock.all());
  await page.waitForTimeout(3500);
  await page.screenshot({ path: S + '/1-auto.png' });
  console.log('open', await page.evaluate(() => document.getElementById('pTitle').textContent + ' ' + !document.getElementById('panel').classList.contains('hidden')));
  await page.click('#pBody .btn.green.wide'); await page.waitForTimeout(600);
  console.log('after', JSON.stringify(await page.evaluate(() => ({ L: SS.save.login, gems: SS.save.gems, ready: SS.daily.ready() }))));
  await page.evaluate(() => { SS.save.login.day = 6; SS.save.login.last = ''; SS.daily.open(); }); await page.waitForTimeout(400);
  await page.screenshot({ path: S + '/2-day7.png' });
  console.log('plan', JSON.stringify(await page.evaluate(() => SS.daily.Notif.plan().map(e => [new Date(e.at).toString().slice(0, 21), e.title]))));
  await page.evaluate(() => SS.closePanel()); await page.waitForTimeout(300); await page.screenshot({ path: S + '/3-hud.png' });
  console.log('errors', errs.length ? errs : 'none'); await b.close();
})();
