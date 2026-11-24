// Sıralama tab: rank tiers, records, rebirth cycles, milestone history, tier-up banner and the page leaderboard list.
const { chromium } = require('playwright'), path = require('path');
(async () => {
  const b = await chromium.launch(), errs = [], fail = [], ok = (c, m) => { if (!c) fail.push(m); };
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'tr-TR' })).newPage();
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve(__dirname, '../../index.html')); await p.waitForFunction(() => window.SS && SS.R.heroes.length > 0 && SS.ranking);
  await p.evaluate(() => { const d = new Date(); SS.save.login.last = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; });
  ok(await p.evaluate(() => !SS.unlocked('rank')), 'locked before stage 4');
  // a player at stage 24 who rebirthed twice
  await p.evaluate(() => {
    const s = SS.save; s.best = 24; s.stage = 24; s.rebirths = 2; s.stats.bosses = 41; s.stats.kills = 12345; s.rank.play = 3 * 3600 + 25 * 60;
    s.rank.lives = [{ n: 1, best: 14, t: Date.now() - 4e8 }, { n: 2, best: 19, t: Date.now() - 2e8 }];
    s.rank.hist = [5, 10, 15, 20].map((x, i) => ({ s: x, t: Date.now() - (4 - i) * 86400000 }));
  });
  await p.waitForTimeout(200);
  ok(await p.evaluate(() => SS.unlocked('rank') && SS.ranking.tier().name === 'Genin'), 'Genin at 24');
  // reaching 26: milestone 25 recorded with today's date, tier-up banner (Chunin)
  await p.evaluate(() => { SS.save.best = 26; SS.save.stage = 26; });
  await p.waitForTimeout(2200);
  ok(await p.evaluate(() => SS.save.rank.hist.some(h => h.s === 25 && h.t > Date.now() - 60000)), 'milestone 25 recorded');
  ok(await p.evaluate(() => /RÜTBE/.test(document.getElementById('banner').textContent)), 'tier-up banner');
  // a fake page leaderboard (as features/cloudsave.js provides inside the claude.ai viewer)
  await p.evaluate(() => { SS.board = { submit() {}, top: async () => [{ best: 61, name: 'Ayşe' }, { best: 33, name: 'Mert' }, { best: 26, name: 'Can', me: true }, { best: 12, name: '' }] }; });
  await p.evaluate(() => SS.missions.open()); await p.waitForTimeout(200);
  ok(await p.evaluate(() => !!document.querySelector('.hub-tabs [data-k="rank"]')), 'hub tab shown');
  await p.click('.hub-tabs [data-k="rank"]'); await p.waitForTimeout(500);
  ok(await p.evaluate(() => document.querySelector('.rk-info>b').textContent === 'Chunin' && document.querySelector('.rk-best b').textContent === '26'), 'hero card');
  ok(await p.evaluate(() => document.querySelectorAll('.rk-grid>div').length === 8 && document.querySelectorAll('.rk-lives>div').length === 2), 'records + cycles');
  ok(await p.evaluate(() => document.querySelectorAll('.rk-list li').length === 4 && document.querySelector('.rk-list li.me')), 'leaderboard list');
  await p.screenshot({ path: path.resolve(__dirname, 'out/rank-tr.png') });
  await p.evaluate(() => { document.getElementById('pBody').scrollTop = 9999; }); await p.waitForTimeout(150);
  await p.screenshot({ path: path.resolve(__dirname, 'out/rank-tr2.png') });
  // a rebirth closes the cycle
  await p.evaluate(() => { SS.closePanel(); SS.HOOKS.rebirth.forEach(f => f(1)); SS.save.stage = 1; });
  ok(await p.evaluate(() => SS.save.rank.lives.length === 3 && SS.save.rank.lives[2].best === 26 && SS.save.rank.life === 1), 'rebirth cycle stored');
  // English
  await p.evaluate(() => { SS.save.lang = 'en'; SS.persist(); }); await p.reload(); await p.waitForFunction(() => window.SS && SS.ranking);
  await p.evaluate(() => { SS.ranking.open(); }); await p.waitForTimeout(400);
  ok(await p.evaluate(() => /Ranking|Records/.test(document.getElementById('panel').textContent) && !/Rekorlar|Rütbe/.test(document.getElementById('panel').textContent)), 'english');
  await p.screenshot({ path: path.resolve(__dirname, 'out/rank-en.png') });
  console.log(fail.length ? 'FAIL ' + fail.join(' | ') : 'all checks passed');
  console.log(errs.length || fail.length ? 'errors ' + [...fail, ...errs].join(' ; ') : 'errors none');
  await b.close();
})();
