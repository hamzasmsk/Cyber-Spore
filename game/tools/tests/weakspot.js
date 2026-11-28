// Weak spot: appears on a boss, a tap on it deals a heavy blow and clears it.
const { chromium } = require('playwright'), path = require('path');

(async () => { const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'tr-TR', hasTouch: true })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve(__dirname, '../../index.html')); await p.waitForFunction(() => window.SS && SS.R.heroes.length > 0);
  await p.evaluate(() => { const d = new Date(); SS.save.login.last = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; Object.assign(SS.save, { stage: 6, best: 7 }); SS.save.bossReady = true; SS.startBoss(); });
  await p.waitForFunction(() => SS.weakspot.spot, null, { timeout: 15000 });
  await p.waitForTimeout(300);

  const r = await p.evaluate(() => { const b = SS.R.boss, s = SS.weakspot.spot; return { x: b.x + s.ox, y: b.y - (b.z || 0) + s.oy, hp: b.hp }; });
  await p.mouse.click(r.x, r.y); await p.waitForTimeout(150);

  const hp2 = await p.evaluate(() => SS.R.boss ? SS.R.boss.hp : -1);
  const gone = await p.evaluate(() => !SS.weakspot.spot);
  console.log('hp before', Math.round(r.hp), 'after', Math.round(hp2), 'spot gone', gone);
  const bad = [...errs]; if (!(hp2 < r.hp * 0.97 || hp2 === -1)) bad.push('tap did no damage'); if (!gone) bad.push('spot stayed');
  console.log(bad.length ? 'errors ' + bad.join(' ; ') : 'errors none');
  await b.close(); })();
