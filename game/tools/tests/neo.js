// Neo Ninja weapons, effect skins and the two new packs.
const { chromium } = require('playwright'), path = require('path');
(async () => {
  const b = await chromium.launch(), errs = [], fail = [];
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'tr-TR' })).newPage();
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.addInitScript(() => localStorage.clear());
  await p.goto('file://' + path.resolve(__dirname, '../../index.html')); await p.waitForFunction(() => window.SS && SS.R.heroes.length > 0);
  await p.evaluate(() => { const d = new Date(); Object.assign(SS.save, { stage: 25, best: 26, team: 5, wbest: 7, gem: 0, gems: 200000 }); SS.save.login.last = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; SS.unlock.all(); SS.setupHeroes(); });
  const ok = (c, m) => { if (!c) fail.push(m); };
  ok(await p.evaluate(() => SS.GUNS.length === 13 && SS.GUNS.slice(8).every(g => g.neo && SS.AF[`p_${g.spr}_0`])), 'neo weapons + sprites');
  // buy the five Neo weapons through the panel, fight with each a moment
  for (let i = 8; i < 13; i++) {
    await p.evaluate(() => { SS.closePanel(); document.querySelectorAll('.un-card,.fl-card,.pk-ov,.ch-ov,.mz-ov').forEach(x => x.remove()); SS.R.paused = false; SS.PANELS.guns(); });
    await p.waitForTimeout(150);
    const r = await p.evaluate(i => { const b = document.querySelectorAll('#pBody .row-card')[i].querySelector('.btn.buy'); if (!b) return 'no buy'; b.click(); return SS.save.wbest === i && SS.save.gun === i ? 'ok' : 'not bought'; }, i);
    ok(r === 'ok', `buy weapon ${i}: ${r}`);
    await p.evaluate(() => { SS.save.wstar[SS.save.gun] = 5; document.querySelectorAll('.un-card,.fl-card,.pk-ov,.ch-ov').forEach(x => x.remove()); SS.R.paused = false; SS.closePanel(); });
    await p.waitForTimeout(1500);
  }
  ok(await p.evaluate(() => !!document.querySelector('#pBody') && SS.save.gun === 12), 'drone equipped');
  // effect skins: sakura with gems, try-out, equip, bonus only when owned + equipped
  await p.evaluate(() => { SS.closePanel(); SS.skins.open(); });
  await p.waitForTimeout(250);
  ok(await p.evaluate(() => document.querySelectorAll('#pBody .fx-row').length === 5), 'five skin rows');
  const g0 = await p.evaluate(() => SS.save.gems);
  await p.evaluate(() => document.querySelector('#pBody .fx-row .fx-gem').click());
  ok(await p.evaluate(g0 => SS.fxskins.owned('sakura') && SS.save.fxs.on === 'sakura' && SS.save.gems === g0 - 1500, g0), 'sakura bought with gems');
  await p.evaluate(() => SS.skins.open()); await p.waitForTimeout(200);
  await p.evaluate(() => { [...document.querySelectorAll('#pBody .fx-row')].find(r => /Yıldırım/.test(r.textContent)).querySelector('.fx-try').click(); });
  ok(await p.evaluate(() => SS.fxskins.cur() === 'lotus' && !SS.fxskins.owned('lotus')), 'try-out');
  await p.waitForTimeout(2500);
  ok(await p.evaluate(() => SS.R.bul.some(q => q.pg === 'lotus') || SS.R.parts.some(x => /fxp_bolt|vx_.*lotus/.test(x.f || x.a || ''))), 'try-out effects on the field');
  // Neo Ninja Paketi grants three skins + gems (test-mode purchase)
  const g1 = await p.evaluate(() => SS.save.gems);
  await p.evaluate(() => { SS.closePanel(); SS.mon.offerOpen('ss_neo_pack', { title: 'Neo Ninja Paketi' }); document.querySelector('#pBody .btn.yellow').click(); });
  await p.waitForTimeout(300); await p.evaluate(() => { const b = document.querySelector('.mz-ov .btn.green'); b && b.click(); }); await p.waitForTimeout(500);
  ok(await p.evaluate(g1 => ['dragon', 'lotus', 'neon'].every(SS.fxskins.owned) && SS.save.gems === g1 + 800, g1), 'neo pack grants');
  // Doğuş Paketi: offered once after the first Rebirth, with a 24 h timer, shown in the shop
  // (the squad is kept safe here: a knockout card would rightly hold the popup back)
  await p.evaluate(() => { SS.R.sq.inv = 1e9; const k = document.getElementById('koCard'); if (k) k.remove(); SS.save.rebirths = 0; SS.save.mon.lastPopup = 0; SS.closePanel(); SS.HOOKS.rebirth.forEach(f => { try { f(); } catch (e) {} }); });
  // the popup waits for the flow's calm gap (up to 25 s after the previous popup)
  for (let i = 0; i < 40 && !(await p.evaluate(() => !!(SS.save.mon.offers.ss_rebirth_pack && SS.save.mon.offers.ss_rebirth_pack.until > Date.now()))); i++) await p.waitForTimeout(1000);
  ok(await p.evaluate(() => !!(SS.save.mon.offers.ss_rebirth_pack && SS.save.mon.offers.ss_rebirth_pack.until > Date.now())), 'rebirth pack offered');
  await p.evaluate(() => { SS.closePanel(); document.getElementById('shopBtn').click(); });
  await p.waitForTimeout(250);
  ok(await p.evaluate(() => !!document.querySelector('#pBody .mz-buy[data-sku="ss_rebirth_pack"]')), 'rebirth pack in shop');
  await p.screenshot({ path: path.resolve(__dirname, 'out/neo-shop.png') });
  console.log(fail.length ? 'FAIL ' + fail.join(' | ') : 'all checks passed');
  console.log(errs.length || fail.length ? 'errors ' + [...fail, ...errs].join(' ; ') : 'errors none');
  await b.close();
})();
