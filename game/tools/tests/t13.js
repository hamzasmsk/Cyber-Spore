const { chromium, devices } = require('playwright');
(async () => {
  require('fs').mkdirSync(require('path').resolve(__dirname, 'out/t13'), { recursive: true }); require('fs').mkdirSync(require('path').resolve(__dirname, 'out'), { recursive: true });
  const S = require('path').resolve(__dirname, 'out/t13');
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'] }); const page = await ctx.newPage();
  const errs = []; page.on('requestfailed', r => console.log('FAIL', r.url().split('/game/')[1])); page.on('pageerror', e => errs.push(e.message + ' ' + (e.stack||'').split('\n')[1])); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); if (m.text().startsWith('DBG')) console.log(m.text()); });
  let promptVal = null; page.on('dialog', async d => { if (d.type() === 'prompt') { if (promptVal) await d.accept(promptVal); else { console.log('code len', d.defaultValue().length); await d.accept(); } } else await d.accept(); });
  await page.goto('file://' + require('path').resolve(__dirname, '../../index.html'));
  await page.waitForFunction(() => window.SS && SS.R.heroes.length > 0); await page.evaluate(() => SS.unlock && SS.unlock.all());
  await page.evaluate(() => { const d = new Date(); SS.save.mon.offers.ss_starter = { shown: Date.now() }; SS.save.login.last = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; const s = SS.save; s.team = 5; s.money = 1e12; s.stage = 10; s.scrolls = [4, 2, 0, 9, 1]; s.hlv = [2, 1, 1, 3, 1]; SS.setupHeroes(); SS.forceEvent = true; });
  await page.waitForTimeout(600); await page.evaluate(() => SS.closePanel());
  await page.click('[data-open="team"]'); await page.waitForTimeout(400); await page.screenshot({ path: S + '/1-team.png' });
  await page.click('.hl-row .btn.green.up'); await page.waitForTimeout(300);
  console.log('hlv', JSON.stringify(await page.evaluate(() => [SS.save.hlv, SS.save.scrolls])));
  await page.evaluate(() => { SS.closePanel(); SS.save.ev.fen = 500; SS.events.open(); }); await page.waitForTimeout(400); await page.screenshot({ path: S + '/2-fest.png' });
  await page.click('.ev-row .btn.red'); await page.waitForTimeout(400);
  console.log('princess', await page.evaluate(() => !!SS.save.skins.owned.Princess), await page.evaluate(() => SS.save.ev.fen));
  // costume ownership survives a reload: equip the festival skin and a pass skin, then reload
  await page.evaluate(() => { SS.save.skins.owned.Tengu = true; SS.skins.equip('Princess'); SS.persist(); });
  await page.reload(); await page.waitForFunction(() => window.SS && SS.R.heroes.length > 0); await page.waitForTimeout(500);
  console.log('after reload', JSON.stringify(await page.evaluate(() => ({ skin: SS.save.skin, owned: Object.keys(SS.save.skins.owned), lead: SS.R.heroes[0].id }))));
  // save code roundtrip
  await page.evaluate(() => { SS.closePanel(); document.getElementById('settingsTop').click(); }); await page.waitForTimeout(400);
  await page.screenshot({ path: S + '/3-settings.png' });
  await page.click('.sv-code .btn.blue'); await page.waitForTimeout(300);
  const code = await page.evaluate(() => 'SS1.' + btoa(unescape(encodeURIComponent(localStorage.getItem('swarmsquad_idle_v1')))));
  await page.evaluate(() => { SS.save.gems = 1; SS.persist(); });
  promptVal = code; await page.click('.sv-code .btn.grey'); await page.waitForTimeout(1500);
  await page.waitForFunction(() => window.SS && SS.R.heroes.length > 0);
  console.log('restored gems', await page.evaluate(() => SS.save.gems), 'stage', await page.evaluate(() => SS.save.stage));
  console.log('errors', errs.length ? errs : 'none'); await b.close();
})();
