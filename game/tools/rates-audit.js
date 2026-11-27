// Rates audit: node tools/rates-audit.js <game dir> [real seconds]   e.g.  node tools/rates-audit.js . 150
// Plays with a realistic buyer (upgrades every ~30 game-s, weapons when affordable, bosses when ready) at 6x and
// prints per-game-hour rates of every kill / boss driven system (kills, bosses, treasure, festival lanterns,
// gems, piggy gems, pass XP, scrolls). Run it before and after any balance change and compare: a system tied to
// kills or waves that suddenly runs 5x faster or stops is the side effect to fix.
const { chromium } = require('playwright'), path = require('path');
const DIR = process.argv[2], SECS = +(process.argv[3] || 120);
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('file://' + path.resolve(DIR, 'index.html')); await p.waitForFunction(() => window.SS && SS.R.heroes.length > 0);
  const r = await p.evaluate(async SECS => {
    const S = SS.save, d = new Date(); S.login.last = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    const c = { kill: 0, boss: 0, fail: 0, ko: 0, perk: 0, treasure: 0, elite: 0 };
    SS.HOOKS.kill.push(e => { c.kill++; if (e && e.treasure) c.treasure++; if (e && e.elite) c.elite++; });
    SS.HOOKS.bossWin.push(() => c.boss++); SS.HOOKS.bossFail.push(() => c.fail++); SS.HOOKS.ko.push(() => c.ko++);
    const g0 = S.gems, pig0 = (S.piggy && S.piggy.gems) || 0, xp0 = (S.pass && S.pass.xp) || 0, sc0 = (S.scrolls || []).length;
    let gemSpent = 0; const R = SS.R; R.timeScale = 6; const t0 = R.t, real0 = Date.now(); let lastBuy = 0;
    while (Date.now() - real0 < SECS * 1000) {
      await new Promise(r => setTimeout(r, 250));
      document.querySelectorAll('.pk-ov .pk-card, .un-card button, .fl-card button, .mz-card .x, .ko-card [data-k="power"]').forEach(x => { try { x.click(); } catch (e) {} });
      if (!document.getElementById('panel').classList.contains('hidden')) { const bt = document.querySelector('#pBody .btnrow .btn.green'); if (bt) bt.click(); SS.closePanel(); }
      if (R.t - lastBuy > 30) { lastBuy = R.t; for (let n = 0; n < 40; n++) for (const k of ['power', 'speed', 'power', 'money']) SS.buy(k);
        const G = SS.GUNS, nx = (S.wbest || S.gun || 0) + 1; if (G[nx] && S.gems >= G[nx].cost) { gemSpent += G[nx].cost; S.gems -= G[nx].cost; S.wbest = nx; S.gun = nx; if (SS.setupHeroes) SS.setupHeroes(); } }
      if (S.bossReady && !R.boss && !(R.sq && R.sq.ko > 0) && !R.mode) SS.startBoss();
    }
    const hrs = (R.t - t0) / 3600, per = v => Math.round(v / hrs);
    return { gameMin: Math.round((R.t - t0) / 60), stage: S.stage + '-' + S.sub, best: S.best, gun: S.gun,
      perHour: { kills: per(c.kill), bosses: per(c.boss), bossFails: per(c.fail), KOs: per(c.ko), treasure: per(c.treasure), fen: per(((S.ev && S.ev.fen) || 0)), coll: Object.values((S.dex && S.dex.m) || {}).length, elite: per(c.elite),
        gems: per(S.gems - g0 + gemSpent), piggyGems: per(((S.piggy && S.piggy.gems) || 0) - pig0), passXP: per(((S.pass && S.pass.xp) || 0) - xp0), scrolls: per((S.scrolls || []).length - sc0) } };
  }, SECS);
  console.log(JSON.stringify(r)); await b.close();
})();
