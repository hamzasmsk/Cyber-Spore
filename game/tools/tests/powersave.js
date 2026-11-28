// Power-save screen: opens from the HUD button, keeps the game running without drawing, slides open, restores sound.
const { chromium } = require('playwright'), path = require('path');
(async () => {
  const b = await chromium.launch(), errs = [], fail = [], ok = (c, m) => { if (!c) fail.push(m); };
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'tr-TR', hasTouch: true })).newPage();
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve(__dirname, '../../index.html')); await p.waitForFunction(() => window.SS && SS.R.heroes.length > 0);
  await p.evaluate(() => { const d = new Date(); SS.save.login.last = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; SS.save.sound = true; SS.save.music = true; });
  await p.waitForTimeout(800);
  await p.screenshot({ path: path.resolve(__dirname, 'out/ps-hud.png') });
  await p.click('#psBtn');
  await p.waitForTimeout(300);
  ok(await p.evaluate(() => SS.R.psave && !document.getElementById('psave').classList.contains('hidden') && SS.save.sound === false), 'opened, muted');
  const k0 = await p.evaluate(() => SS.save.stats.kills);
  await p.evaluate(() => { SS.R.timeScale = 6; }); await p.waitForTimeout(4000); await p.evaluate(() => { SS.R.timeScale = 1; });
  ok(await p.evaluate(k0 => SS.save.stats.kills > k0, k0), 'game keeps running');
  await p.waitForTimeout(1100);
  await p.screenshot({ path: path.resolve(__dirname, 'out/ps-screen.png') });
  // a tap does not wake it
  await p.mouse.click(195, 420); await p.waitForTimeout(200);
  ok(await p.evaluate(() => SS.R.psave), 'tap does not wake');
  // slide the knob
  const box = await p.evaluate(() => { const r = document.querySelector('.ps-slide').getBoundingClientRect(); return { x: r.left + 26, y: r.top + r.height / 2, w: r.width }; });
  await p.mouse.move(box.x, box.y); await p.mouse.down(); await p.mouse.move(box.x + box.w * 0.5, box.y, { steps: 5 }); await p.mouse.move(box.x + box.w, box.y, { steps: 5 }); await p.mouse.up();
  await p.waitForTimeout(400);
  ok(await p.evaluate(() => !SS.R.psave && document.getElementById('psave').classList.contains('hidden') && SS.save.sound === true && SS.save.music === true), 'slide wakes, sound back');
  // auto after inactivity (setting 2 min, simulated)
  await p.evaluate(() => { SS.save.psAuto = 2; });
  await p.evaluate(() => { const now = Date.now(); Date.now = () => now + 3 * 60000; });
  await p.waitForTimeout(5600);
  ok(await p.evaluate(() => SS.R.psave), 'auto power save');
  console.log(fail.length ? 'FAIL ' + fail.join(' | ') : 'all checks passed');
  console.log(errs.length || fail.length ? 'errors ' + [...fail, ...errs].join(' ; ') : 'errors none');
  await b.close();
})();
