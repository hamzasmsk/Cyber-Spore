// English mode: open every panel/tab/overlay and list visible text that is still Turkish.
const { chromium } = require('playwright'), path = require('path');
const URL = 'file://' + path.resolve(__dirname, '../../index.html');
const MID = { money: 5e9, gems: 900, stage: 14, sub: 3, kills: 0, best: 20, lv: { power: 60, speed: 40, money: 45 }, gun: 4, wbest: 6, team: 5, rebirths: 2, rp: 30, tut: { power: true } };
const TR = /[çğıöşüÇĞİÖŞÜ]|\d(?:sa|dk|sn|Mr)\b|\b(ve|ile|bir|için|düşman|elmas|altın|bölüm|kat|sn|dk|sa|gün|kalan|hasar|takım|yeni|ilk|her|kez|seviye)\b/i;
(async () => {
  const b = await chromium.launch(), found = new Map();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-US' });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('ERR', e.message));
  await page.goto(URL); await page.waitForFunction(() => window.SS && SS.R.heroes.length > 0);
  await page.evaluate(m => { const s = SS.save, d = new Date(); Object.assign(s, JSON.parse(JSON.stringify(m))); s.login.last = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; SS.unlock.all(); SS.setupHeroes(); SS.forceEvent = true; }, MID);
  await page.waitForTimeout(1500);
  const grab = async tag => { const r = await page.evaluate(src => { const re = new RegExp(src, 'i'), out = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { const p = n.parentElement; if (!p || p.closest('script,style,.dv-grid,.dv-h,.hidden') ) continue; const t = n.data.trim(); if (t && re.test(t) && !/Türkçe|Dil \/ Language/.test(t)) out.push(t); } return out; }, TR.source); r.forEach(t => { if (!found.has(t)) found.set(t, tag); }); };
  await grab('hud');
  const ids = await page.evaluate(() => [...document.querySelectorAll('.sbtn,[data-open],.tilebtn')].map(e => e.id || e.dataset.open).filter(Boolean));
  for (const id of [...new Set(ids)]) {
    await page.evaluate(id => { SS.closePanel(); const e = document.getElementById(id) || document.querySelector(`[data-open="${id}"]`); e && e.click(); }, id);
    await page.waitForTimeout(300); await grab(id);
    // click every tab-like button inside the panel once
    const n = await page.evaluate(() => document.querySelectorAll('#pBody .dex-tabs button, #pBody .hub-tabs button, #pBody .tabs button, #pBody .cm-entry').length);
    for (let i = 0; i < n; i++) { await page.evaluate(([id, i]) => { SS.closePanel(); const e = document.getElementById(id) || document.querySelector(`[data-open="${id}"]`); e && e.click(); const t = document.querySelectorAll('#pBody .dex-tabs button, #pBody .hub-tabs button, #pBody .tabs button, #pBody .cm-entry')[i]; t && t.click(); }, [id, i]); await page.waitForTimeout(250); await grab(id + ' tab' + i); }
  }
  await page.evaluate(() => { SS.closePanel(); SS.events && SS.events.open(); }); await page.waitForTimeout(300); await grab('events');
  await page.evaluate(() => { SS.closePanel(); SS.tree && SS.tree.open && SS.tree.open(); }); await page.waitForTimeout(300); await grab('tree');
  await page.evaluate(() => { SS.closePanel(); SS.perks && SS.perks.offer && SS.perks.offer(); }); await page.waitForTimeout(600); await grab('perks');
  await page.evaluate(() => { document.querySelectorAll('.pk-ov').forEach(x => x.remove()); SS.R.paused = false; SS.chest && SS.chest([{ icon: 'gem', label: '5 elmas' }], 'Boss sandığı'); }); await page.waitForTimeout(2500); await grab('chest');
  await page.evaluate(() => { document.querySelectorAll('.ch-ov').forEach(x => x.remove()); SS.R.paused = false; SS.offlineReward && SS.offlineReward(3600); }); await page.waitForTimeout(800); await grab('offline');
  for (const [t, tag] of found) console.log(`[${tag}] ${t}`);
  console.log('TOTAL', found.size); console.log(found.size ? `errors ${found.size} untranslated` : 'errors none');
  await b.close();
})();
