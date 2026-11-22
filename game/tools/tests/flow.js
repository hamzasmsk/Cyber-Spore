const { chromium, devices } = require('playwright');
(async () => {
  require('fs').mkdirSync(require('path').resolve(__dirname, 'out/flow'), { recursive: true }); require('fs').mkdirSync(require('path').resolve(__dirname, 'out'), { recursive: true });
  const S = require('path').resolve(__dirname, 'out/flow');
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'] }); const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message + ' ' + (e.stack||'').split('\n')[1])); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('file://' + require('path').resolve(__dirname, '../../index.html'));
  await page.waitForFunction(() => window.SS && SS.R.heroes.length > 0);
  await page.waitForTimeout(2500); await page.screenshot({ path: S + '/f1-goal.png' });
  console.log('goal', await page.evaluate(() => document.querySelector('#goal span').textContent));
  await page.click('#goal'); await page.waitForTimeout(300);
  await page.evaluate(() => { SS.save.money = 1000; }); for (let i = 0; i < 3; i++) { await page.click('.ucard[data-up="power"]'); await page.waitForTimeout(150); }
  await page.waitForTimeout(1500);
  console.log('after power', await page.evaluate(() => [document.querySelector('#goal span').textContent, SS.save.gems, document.getElementById('toast').textContent]));
  // simulate progress to stage 6: unlock cards + daily should queue, one at a time
  await page.evaluate(() => { SS.save.best = 6; SS.save.stage = 6; });
  const seen = [];
  for (let i = 0; i < 40; i++) { await page.waitForTimeout(500); const r = await page.evaluate(() => [document.querySelectorAll('.un-card,.fl-card').length, !document.getElementById('panel').classList.contains('hidden') ? document.getElementById('pTitle').textContent : '']); seen.push(r.join(':')); if (r[0] > 1) console.log('TWO CARDS AT ONCE'); if (i === 3) await page.screenshot({ path: S + '/f2-card.png' }); if (i % 8 === 0) console.log(await page.evaluate(() => JSON.stringify([SS.flow.queue, SS.flow.calm(), !!SS.R.boss, SS.R.paused, SS.R.sq.ko, !!document.querySelector('.pk-ov,.mz-ov')]))); }
  console.log('timeline', [...new Set(seen)].join(' | '));
  // KO revive
  await page.evaluate(() => { SS.closePanel(); document.querySelectorAll('.un-card').forEach(c => c.remove()); SS.knockout(); });
  await page.waitForTimeout(500); console.log('revive card', await page.evaluate(() => !!document.querySelector('.fl-revive')));
  await page.screenshot({ path: S + '/f3-revive.png' });
  console.log('errors', errs.length ? errs : 'none'); await b.close();
})();
