const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const page = await (await b.newContext({ ...devices['iPhone 13'] })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message + ' ' + (e.stack || '').split('\n')[1]));
  await page.goto('file://' + require('path').resolve(__dirname, '../../index.html'));
  await page.waitForFunction(() => window.SS && SS.R.heroes.length > 0);
  const out = require('path').resolve(__dirname, 'out/variants'); require('fs').mkdirSync(out, { recursive: true });
  await page.evaluate(() => { const d = new Date(), s = SS.save; s.mon.offers.ss_starter = { shown: Date.now() }; s.login.last = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; Object.assign(s, { team: 3, gun: 1, wbest: 3, stage: 6, sub: 2, lv: { power: 5, speed: 5, money: 5 } }); s.tut = { power: true }; SS.unlock.all(); SS.setupHeroes(); SS.closePanel(); });
  await page.waitForTimeout(2000);
  await page.evaluate(() => { SS.closePanel(); SS.R.phase = 'fight'; for (const v of Object.keys(SS.VAR)) for (let i = 0; i < 2; i++) SS.spawnEnemy(v); });
  await page.waitForTimeout(2600); await page.screenshot({ path: out + '/variants.png' });
  console.log('vr', await page.evaluate(() => SS.R.en.map(e => e.vr || (e.half ? 'half' : '-')).join(',')));
  await page.evaluate(() => { SS.save.lv.power = 8; SS.save.team = 2; SS.setupHeroes(); SS.R.en.length = 0; SS.save.sub = 5; SS.save.bossReady = true; SS.startBoss(); });
  await page.waitForTimeout(2500); await page.evaluate(() => { if (SS.R.boss) SS.R.boss.hp = SS.R.boss.maxHp * 0.29; SS.save.dev = { god: true }; });
  await page.waitForTimeout(1800); await page.screenshot({ path: out + '/phase2.png' });
  console.log('boss', await page.evaluate(() => !!SS.R.boss), 'p2', await page.evaluate(() => SS.R.boss && SS.R.boss.p2), 'orbs', await page.evaluate(() => SS.R.eb.length));
  console.log('errors', errs.length ? errs : 'none'); await b.close();
})();
