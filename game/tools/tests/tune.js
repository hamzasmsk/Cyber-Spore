// Balance knobs: setTune only takes known keys, clamps them to a safe range, changes the live formulas, and a value
// remembered in save.tune is used from the next start on. The analytics log records the new balance events.
const { chromium } = require('playwright'), path = require('path');
(async () => {
  const b = await chromium.launch(), errs = [], fail = [], ok = (c, m) => { if (!c) fail.push(m); };
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve(__dirname, '../../index.html')); await p.waitForFunction(() => window.SS && SS.R.heroes.length > 0);
  const r = await p.evaluate(() => {
    const d = new Date(); SS.save.login.last = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; SS.closePanel();
    SS.save.stage = 5; SS.save.sub = 1;
    const h0 = SS.enemyHp(), t0 = SS.bossTime();
    const ch = SS.setTune({ earlyHp: 2, bossTime: 999, nonsense: 5, waveBase: 'x' });
    return { h0, h1: SS.enemyHp(), t1: SS.bossTime(), ch, tune: { ...SS.TUNE } };
  });
  ok(r.ch.includes('earlyHp') && r.ch.includes('bossTime') && !r.ch.includes('nonsense') && !r.ch.includes('waveBase'), 'only known numeric keys');
  ok(r.tune.bossTime === 60, 'clamped to range');
  ok(Math.abs(r.h1 / r.h0 - Math.pow(2 / 2.2, 4)) < 1e-6, 'enemy health follows the knob');
  // remembered values apply on the next start
  await p.evaluate(() => { SS.save.tune = { earlyHp: 2.1 }; SS.persist(); });
  await p.reload(); await p.waitForFunction(() => window.SS && SS.TUNE);
  ok(await p.evaluate(() => SS.TUNE.earlyHp === 2.1 && SS.TUNE.bossTime === 30), 'save.tune used on start');
  // balance events
  await p.evaluate(() => { SS.save.lv.power = 9; SS.save.money = 1e12; SS.buy('power'); SS.perks.offer(); });
  await p.waitForTimeout(400);
  const log = await p.evaluate(() => SS.analytics.log.map(x => x[1]).filter(x => typeof x === 'string'));
  ok(log.some(x => /^Upgrade:power/.test(x)), 'upgrade event');
  ok(log.some(x => /^Perk:Offer:/.test(x)), 'perk offer events');
  console.log(fail.length ? 'FAIL ' + fail.join(' | ') : 'all checks passed');
  console.log(errs.length || fail.length ? 'errors ' + [...fail, ...errs].join(' ; ') : 'errors none');
  await b.close();
})();
