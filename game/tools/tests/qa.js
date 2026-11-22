// Full integration QA on iPhone 13 portrait: idle play, drag movement, boss, all panels.
const { chromium, devices } = require('playwright');
(async () => {
  const S = require('path').resolve(__dirname, 'out/qa'); require('fs').mkdirSync(S, { recursive: true });
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'] }); const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => { errs.push(e.message); console.log('ERR', e.message, (e.stack || '').split('\n')[1]); });
  page.on('console', m => { if (m.type() === 'error') { errs.push(m.text()); console.log('CONSOLE', m.text()); } });
  await page.goto('file://' + require('path').resolve(__dirname, '../../index.html'));
  await page.waitForFunction(() => window.SS && SS.R.heroes.length > 0); await page.evaluate(() => SS.unlock && SS.unlock.all());
  await page.waitForTimeout(3500);
  await page.screenshot({ path: S + '/01-start.png' });
  // drag to move the squad
  await page.mouse.move(195, 420); await page.mouse.down();
  for (let i = 0; i < 20; i++) { await page.mouse.move(195 + i * 3, 420 - i * 2); await page.waitForTimeout(40); }
  await page.waitForTimeout(400);
  await page.screenshot({ path: S + '/02-drag.png' });
  await page.mouse.up();
  // mid game with a full squad
  await page.evaluate(() => { const s = SS.save; s.money = 5e9; s.gems = 900; s.team = 5; s.gun = 4; s.stage = 7; s.sub = 3; s.kills = 0; s.lv = { power: 55, speed: 35, money: 45 }; SS.setupHeroes(); SS.refreshUI(); });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: S + '/03-mid.png' });
  await page.evaluate(() => { SS.save.sub = 5; SS.save.kills = 7; SS.save.auto = true; });
  await page.waitForTimeout(6000);
  await page.screenshot({ path: S + '/04-boss.png' });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: S + '/05-boss2.png' });
  console.log('state', JSON.stringify(await page.evaluate(() => ({ stage: SS.save.stage, sub: SS.save.sub, boss: !!SS.R.boss, side: [...document.querySelectorAll('.sbtn')].map(b => b.textContent.trim()) }))));
  // open every side panel
  const btns = (await page.$$('.sbtn')).concat([await page.$('#settingsTop')]);
  let i = 0;
  for (const btn of btns) {
    const label = ((await btn.textContent()).trim() || 'gear').replace(/\s+/g, '_').slice(0, 12);
    if (/oto|boss/i.test(label) || !(await btn.isVisible())) continue;
    await btn.click({ force: true }); await page.waitForTimeout(500);
    const open = await page.evaluate(() => !document.getElementById('panel').classList.contains('hidden'));
    if (open) { await page.screenshot({ path: `${S}/p${String(++i).padStart(2, '0')}-${label}.png` }); await page.evaluate(() => SS.closePanel()); await page.waitForTimeout(200); }
    else { await page.screenshot({ path: `${S}/x${String(++i).padStart(2, '0')}-${label}.png` }); }
  }
  console.log('errors', errs.length ? errs.slice(0, 8) : 'none');
  await b.close();
})();
