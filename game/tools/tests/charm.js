const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const page = await (await b.newContext({ ...devices['iPhone 13'] })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message + ' ' + (e.stack || '').split('\n')[1]));
  await page.goto('file://' + require('path').resolve(__dirname, '../../index.html'));
  await page.waitForFunction(() => window.SS && SS.R.heroes.length > 0);
  const out = require('path').resolve(__dirname, 'out/charm'); require('fs').mkdirSync(out, { recursive: true });
  await page.evaluate(() => { const d = new Date(), s = SS.save; s.mon.offers.ss_starter = { shown: Date.now() }; s.login.last = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; s.team = 3; SS.unlock.all(); SS.closePanel(); SS.chest([{ icon: 'gem', label: '50 elmas' }, { icon: 'ic_power', label: 'Saldırı Tılsımı 2' }], 'Test sandığı'); });
  await page.waitForTimeout(2600); await page.screenshot({ path: out + '/chest.png' });
  await page.waitForTimeout(5000);
  await page.evaluate(() => { for (const s of SS.charms.SLOTS) SS.charms.give(s.k, 1, 4); SS.charms.give('atk', 3, 1); });
  await page.evaluate(() => { SS.closePanel(); document.querySelector('[data-open="team"]').click(); }); await page.waitForTimeout(500);
  await page.screenshot({ path: out + '/team.png' });
  await page.click('.cm-entry'); await page.waitForTimeout(400); await page.click('.cm-row .btn.green'); await page.waitForTimeout(400);
  await page.screenshot({ path: out + '/charms.png' });
  console.log('charm', JSON.stringify(await page.evaluate(() => [SS.save.charm.atk.slice(0, 4), SS.charms.best('atk'), SS.modMul('dmg')])));
  console.log('errors', errs.length ? errs : 'none'); await b.close();
})();
