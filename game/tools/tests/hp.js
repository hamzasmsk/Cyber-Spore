// Squad health: bar hidden at full health, shown when hurt; enemies lunge (with a "!" warning); a knockout costs one
// step of the stage and shows the knockout card with upgrade shortcuts.
const { chromium } = require('playwright'), path = require('path');
(async () => {
  const b = await chromium.launch(), errs = [], fail = [], ok = (c, m) => { if (!c) fail.push(m); };
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'tr-TR' })).newPage();
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve(__dirname, '../../index.html')); await p.waitForFunction(() => window.SS && SS.R.heroes.length > 0);
  await p.evaluate(() => { const d = new Date(); SS.save.login.last = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; SS.closePanel(); });
  await p.waitForTimeout(3200);
  ok(await p.evaluate(() => SS.R.sq.hp === SS.R.sq.maxHp && SS.R.sq.showT <= 0), 'bar hidden at full health');
  // enemies that are left standing lunge at the squad
  await p.evaluate(() => { SS.save.stage = 6; SS.save.best = 6; SS.save.lv.power = 0; SS.R.sq.hp = SS.R.sq.maxHp = SS.sqMaxHp(); for (let i = 0; i < 6; i++) SS.spawnEnemy(); for (const e of SS.R.en) e.hp = e.maxHp = 1e9; });
  let hurt = 0; await p.exposeFunction('noop', () => {});
  await p.evaluate(() => { window.__h = 0; SS.HOOKS.hurt.push(() => window.__h++); });
  await p.waitForTimeout(9000);
  hurt = await p.evaluate(() => window.__h);
  ok(hurt >= 2, 'enemies hurt the squad (' + hurt + ')');
  ok(await p.evaluate(() => SS.R.sq.showT > 0), 'bar shown when hurt');
  await p.screenshot({ path: path.resolve(__dirname, 'out/hp-hurt.png') });
  // knockout: one step back + card
  await p.evaluate(() => { SS.save.sub = 3; SS.save.kills = 4; SS.save.bossReady = false; SS.R.sq.inv = 0; SS.R.sq.hp = 1; SS.hurtSquad(50, 100, 100); });
  await p.waitForTimeout(400);
  ok(await p.evaluate(() => SS.save.sub === 2 && SS.save.kills === 0 && !!document.getElementById('koCard')), 'knockout costs a step, card shown');
  await p.screenshot({ path: path.resolve(__dirname, 'out/hp-ko.png') });
  // revive keeps the step (when the revive offer is available)
  if (await p.evaluate(() => !!document.querySelector('.ko-rev'))) {
    await p.click('.ko-rev'); await p.waitForTimeout(2500);
    const r = await p.evaluate(() => [SS.save.sub, SS.R.sq.ko]);
    ok(r[0] === 3, 'revive restores the step (' + r + ')');
    await p.evaluate(() => { SS.R.en.length = 0; SS.R.sq.inv = 0; SS.R.sq.ko = 0; SS.R.sq.hp = 1; SS.hurtSquad(50, 100, 100); });
    await p.waitForTimeout(300);
  }
  await p.click('#koCard [data-k="power"]'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => !document.getElementById('koCard') || document.getElementById('koCard').classList.contains('out')), 'card closes');
  // boss gate: a knockout with the boss ready takes the gate back
  await p.waitForTimeout(3500);
  await p.evaluate(() => { SS.R.en.length = 0; SS.save.bossReady = true; SS.save.sub = 5; SS.R.sq.inv = 0; SS.R.sq.hp = 1; SS.hurtSquad(50, 100, 100); });
  ok(await p.evaluate(() => SS.save.bossReady === false && SS.save.sub === 5), 'boss gate lost');
  console.log(fail.length ? 'FAIL ' + fail.join(' | ') : 'all checks passed');
  console.log(errs.length || fail.length ? 'errors ' + [...fail, ...errs].join(' ; ') : 'errors none');
  await b.close();
})();
