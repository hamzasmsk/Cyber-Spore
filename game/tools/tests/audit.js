// Full audit: every screen size × language, every panel, layout problems; then a fast-forward soak run.
// Reports: page errors, elements outside the screen, clipped one-line texts, HUD overlaps, NaN in the save,
// growing arrays, stuck progress. Screenshots in tools/tests/out/audit/.
const { chromium } = require('playwright'), path = require('path'), fs = require('fs');
const S = path.resolve(__dirname, 'out/audit'); fs.mkdirSync(S, { recursive: true });
const URL = 'file://' + path.resolve(__dirname, '../../index.html');
const SIZES = [[320, 568, 2], [360, 640, 3], [390, 844, 3], [412, 915, 2.6], [768, 1024, 2]];
const LANGS = ['en-US', 'tr-TR'];
const MID = { money: 5e9, gems: 900, stage: 14, sub: 3, kills: 0, best: 20, lv: { power: 60, speed: 40, money: 45 }, gun: 4, wbest: 6, team: 5, rebirths: 2, rp: 30, tut: { power: true } };
const issues = new Set(), errs = new Set();
const PANELS = ['guns', 'team', 'rebirth', 'skinBtn', 'passBtn', 'dexBtn', 'dailyBtn', 'missionsBtn', 'shopBtn', 'mineBtn', 'piggyBtn', 'boostBtn', 'settingsTop'];
async function layoutCheck(page, tag) {
  const r = await page.evaluate(() => {
    const W = innerWidth, H = innerHeight, out = [];
    if (document.documentElement.scrollWidth > W + 1) out.push('page scrolls sideways');
    const vis = el => { const cs = getComputedStyle(el); return cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05 && !el.closest('.hidden'); };
    const inScroll = el => { let p = el.parentElement; while (p && p !== document.body) { const ps = getComputedStyle(p); if (/auto|scroll/.test(ps.overflowY + ps.overflowX)) return true; p = p.parentElement; } return false; };
    for (const el of document.querySelectorAll('#ui *')) {
      if (!vis(el) || inScroll(el) || el.closest('#bossCard,#evoTag,#banner,.mz-card,#tut')) continue;
      const b = el.getBoundingClientRect(); if (b.width < 3 || b.height < 3) continue;
      if (b.left < -2 || b.right > W + 2 || b.top < -2 || b.bottom > H + 2) out.push(`off-screen ${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}.${[...el.classList].slice(0, 2).join('.')} "${(el.textContent || '').trim().slice(0, 20)}"`);
      const cs = getComputedStyle(el);
      if (el.children.length === 0 && (el.textContent || '').trim() && el.scrollWidth > el.clientWidth + 2 && cs.overflow !== 'visible' && cs.textOverflow !== 'ellipsis') out.push(`clipped text "${el.textContent.trim().slice(0, 30)}"`);
    }
    // HUD pieces that should never overlap
    const ids = ['#goal', '#stageLbl', '#bossBtn', '#toast.show', '.sv-hud:not(.hidden)', '#bossHud:not(.hidden)'];
    const boxes = ids.map(q => [q, document.querySelector(q)]).filter(([q, e]) => e && vis(e)).map(([q, e]) => [q, e.getBoundingClientRect()]);
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) { const a = boxes[i][1], b = boxes[j][1]; if (a.left < b.right - 4 && b.left < a.right - 4 && a.top < b.bottom - 4 && b.top < a.bottom - 4) out.push(`overlap ${boxes[i][0]} × ${boxes[j][0]}`); }
    return out;
  });
  r.forEach(x => issues.add(`${tag}: ${x}`));
}
(async () => {
  const b = await chromium.launch();
  for (const [w, h, dpr] of SIZES) for (const loc of LANGS) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, isMobile: true, hasTouch: true, locale: loc });
    const page = await ctx.newPage(), tag = `${w}x${h}-${loc.slice(0, 2)}`;
    page.on('pageerror', e => errs.add(`${tag}: ${e.message} ${(e.stack || '').split('\n')[1] || ''}`));
    page.on('console', m => { if (m.type() === 'error') errs.add(`${tag}: ${m.text()}`); });
    await page.goto(URL);
    await page.waitForFunction(() => window.SS && SS.R.heroes.length > 0, null, { timeout: 20000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${S}/${tag}-fresh.png` });
    await layoutCheck(page, tag + ' fresh');
    await page.evaluate(m => { const s = SS.save, d = new Date(); Object.assign(s, JSON.parse(JSON.stringify(m))); s.login.last = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; s.mon.offers.ss_starter = { shown: Date.now() }; SS.unlock.all(); SS.setupHeroes(); SS.closePanel(); }, MID);
    await page.waitForTimeout(2500);
    await page.evaluate(() => { SS.closePanel(); for (const x of document.querySelectorAll('.un-card,.fl-card,.pk-ov,.ch-ov')) x.parentNode.removeChild(x); SS.R.paused = false; });
    await page.screenshot({ path: `${S}/${tag}-mid.png` });
    await layoutCheck(page, tag + ' mid');
    for (const p of PANELS) {
      await page.evaluate(id => { SS.closePanel(); const e = document.getElementById(id) || document.querySelector(`[data-open="${id}"]`); if (e) e.click(); }, p);
      await page.waitForTimeout(350);
      const open = await page.evaluate(() => !document.getElementById('panel').classList.contains('hidden'));
      if (!open) { issues.add(`${tag}: panel ${p} did not open`); continue; }
      await layoutCheck(page, `${tag} panel ${p}`);
      if (w === 360) await page.screenshot({ path: `${S}/${tag}-${p}.png` });
    }
    for (const t of ['surv', 'tower', 'ach']) { await page.evaluate(k => { SS.closePanel(); SS.missions.open(); const b = document.querySelector(`.hub-tabs [data-k="${k}"]`); if (b) b.click(); }, t); await page.waitForTimeout(300); await layoutCheck(page, `${tag} tab ${t}`); if (w === 360) await page.screenshot({ path: `${S}/${tag}-tab-${t}.png` }); }
    await ctx.close();
  }
  // soak: 3 real minutes at x8 with a fresh save on a phone size
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'en-US' });
  const page = await ctx.newPage();
  page.on('pageerror', e => errs.add(`soak: ${e.message} ${(e.stack || '').split('\n')[1] || ''}`));
  await page.goto(URL); await page.waitForFunction(() => window.SS && SS.R.heroes.length > 0);
  await page.evaluate(() => { SS.R.timeScale = 8; window.__mx = {}; window.__buy = setInterval(() => { for (const k of ['power', 'speed', 'money']) SS.buy(k); document.querySelectorAll('.pk-ov .pk-card, .ch-ok.show').forEach((c, i) => i === 0 && c.click()); if (!document.getElementById('panel').classList.contains('hidden')) SS.closePanel(); for (const x of document.querySelectorAll('.un-card,.fl-card')) x.click(); }, 400); });
  const samples = [];
  for (let i = 0; i < 18; i++) {
    await page.waitForTimeout(10000);
    const s = await page.evaluate(() => { const R = SS.R, sv = SS.save, bad = []; const scan = (o, p) => { for (const k in o) { const v = o[k]; if (typeof v === 'number' && !isFinite(v)) bad.push(p + k); else if (v && typeof v === 'object' && p.split('.').length < 4) scan(v, p + k + '.'); } }; scan(sv, ''); return { t: Math.round(R.t), stage: sv.stage, sub: sv.sub, best: sv.best, money: sv.money, en: R.en.length, bul: R.bul.length, parts: R.parts.length, eb: R.eb.length, txt: R.txt.length, coins: R.coins.length, decals: R.decals.length, phase: R.phase, boss: !!R.boss, mode: R.mode, bad, fx: R.fx, flashes: (R.flashes || []).length }; });
    samples.push(s);
  }
  console.log('soak', samples.map(s => `t${s.t} st${s.stage}-${s.sub} ${s.phase}${s.boss ? '+boss' : ''} en${s.en} bul${s.bul} parts${s.parts} fx${s.fx}${s.bad.length ? ' NaN:' + s.bad.join(',') : ''}`).join('\n'));
  const last = samples[samples.length - 1], first = samples[0];
  if (last.stage === first.stage && last.sub === first.sub) issues.add('soak: no progress in 3 minutes at x8');
  await page.screenshot({ path: `${S}/soak-end.png` });
  await b.close();
  const grp = {}; for (const x of issues) { const i = x.indexOf(': '), k = x.slice(i + 2); (grp[k] = grp[k] || []).push(x.slice(0, i)); }
  console.log('ISSUES ' + Object.keys(grp).length); for (const [k, v] of Object.entries(grp)) console.log(`${k}  ×${v.length}  e.g. ${v.slice(0, 3).join(' | ')}`);
  console.log('errors', errs.size ? [...errs] : 'none');
})();
