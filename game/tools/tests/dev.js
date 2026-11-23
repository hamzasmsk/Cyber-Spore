// Test Paneli: opens from settings and by long-press, every button runs without errors.
const { chromium, devices } = require('playwright'), path = require('path'), fs = require('fs');
(async () => {
  const S = path.resolve(__dirname, 'out/dev'); fs.mkdirSync(S, { recursive: true });
  const b = await chromium.launch(); const page = await (await b.newContext({ ...devices['iPhone 13'] })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message + ' ' + (e.stack || '').split('\n')[1])); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('dialog', d => d.type() === 'prompt' ? d.accept('12') : d.dismiss());
  await page.goto('file://' + path.resolve(__dirname, '../../index.html'));
  await page.waitForFunction(() => window.SS && SS.R.heroes.length > 0); await page.waitForTimeout(1500);
  await page.evaluate(() => { SS.closePanel(); document.getElementById('settingsTop').click(); }); await page.waitForTimeout(400);
  const inSettings = await page.evaluate(() => !!document.querySelector('.dv-open'));
  await page.click('.dv-open'); await page.waitForTimeout(400); await page.screenshot({ path: S + '/panel.png' });
  const labels = await page.$$eval('#pBody .dv-grid .btn', a => a.map(x => x.textContent));
  let ran = 0;
  const clean = () => page.evaluate(() => { for (const x of document.querySelectorAll('.pk-ov,.un-card,.fl-card,.mz-ov')) x.parentNode.removeChild(x); SS.R.paused = false; SS.dev.open(); });
  for (const l of labels) {
    if (/Yeni oyuncu|Hedef zincirini|yeniden kilitle/.test(l)) continue;
    await clean(); await page.waitForTimeout(150);
    await page.locator('#pBody .dv-grid .btn', { hasText: l }).first().click(); ran++; await page.waitForTimeout(350);
  }
  await clean(); await page.waitForTimeout(200);
  const toggles = page.locator('#pBody .toggles .toggle'), nT = await toggles.count();
  for (let i = 0; i < nT; i++) { await toggles.nth(i).click(); await page.waitForTimeout(150); }
  await page.click('#pBody .dv-speed [data-v="4"]'); await page.waitForTimeout(800);
  const st = await page.evaluate(() => ({ stage: SS.save.stage, gems: SS.save.gems, gun: SS.save.gun, team: SS.save.team, speed: SS.R.timeScale, dev: SS.save.dev }));
  await page.evaluate(() => { const d = new Date(); SS.save.login.last = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; SS.closePanel(); }); await page.waitForTimeout(1500); await page.evaluate(() => SS.closePanel()); await page.waitForTimeout(200);
  const r = await page.evaluate(() => { const b = document.getElementById('stageLbl').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; });
  await page.mouse.move(r[0], r[1]); await page.mouse.down(); await page.waitForTimeout(900); await page.mouse.up(); await page.waitForTimeout(300);
  const lp = await page.evaluate(() => document.getElementById('pTitle').textContent);
  console.log('settings entry', inSettings, 'buttons run', ran, 'long-press opens', lp, JSON.stringify(st));
  console.log('errors', errs.length ? errs : 'none'); await b.close();
})();
