// Every icon should mean one thing: opens every menu, panel and tab, records which image is shown next to which
// title, and fails when the same image stands for two different things. Same-meaning repeats (a gem next to a
// price, a weapon's own icon in its row and on the Silah button) are allowed through ALLOW.
const { chromium } = require('playwright'), path = require('path');
const URL = 'file://' + path.resolve(__dirname, '../../index.html');
const ALLOW = /\/(gem|gem_big|coin|lock|play|key|x|heart|mon_LanternRed|face_[A-Za-z]+|wi_[A-Za-z]+|mon_[A-Za-z0-9]+|boss_[A-Za-z0-9]+|chest|chest_open|cup|ic_neo|ic_rebirth|ic_luck|ic_ticket|ic_rapid|ic_boost|ic_scroll|ic_amulet)\.png$/;
(async () => {
  const b = await chromium.launch(), use = new Map();
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'tr-TR' })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL); await p.waitForFunction(() => window.SS && SS.R.heroes.length > 0);
  await p.evaluate(() => { const d = new Date(); Object.assign(SS.save, { stage: 20, best: 21, team: 5, wbest: 6, gems: 5000, rebirths: 1 }); SS.save.login.last = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; SS.unlock.all(); SS.setupHeroes(); SS.forceEvent = true; });
  await p.waitForTimeout(800);
  const grab = async where => {
    const r = await p.evaluate(() => {
      const out = [], key = s => s.replace(/[\d.,%+×x:]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 28);
      for (const im of document.querySelectorAll('#ui .sbtn img, #pBody img, #pTitle img')) {
        if (!im.offsetParent) continue;
        const holder = im.closest('.row-card, .sbtn, h3, .dex-card, .tr-node, .ev-head, .ac-head, button');
        if (!holder) continue;
        const t = holder.querySelector('h4, span, b') || holder;
        out.push([im.getAttribute('src'), key(holder.matches('h3') ? holder.textContent : t.textContent || '')]);
      }
      return out;
    });
    for (const [src, label] of r) { if (!label || /\.png$/.test(src) === false) continue; if (!use.has(src)) use.set(src, new Map()); use.get(src).set(label, where); }
  };
  await grab('hud');
  const ids = await p.evaluate(() => [...document.querySelectorAll('#ui .sbtn')].map(e => e.id || e.dataset.open).filter(Boolean));
  for (const id of ids) {
    await p.evaluate(id => { SS.closePanel(); (document.getElementById(id) || document.querySelector(`[data-open="${id}"]`)).click(); }, id);
    await p.waitForTimeout(250); await grab(id);
    const n = await p.evaluate(() => document.querySelectorAll('#pBody .dex-tabs button, #pBody .hub-tabs button').length);
    for (let i = 0; i < n; i++) { await p.evaluate(([id, i]) => { SS.closePanel(); (document.getElementById(id) || document.querySelector(`[data-open="${id}"]`)).click(); const t = document.querySelectorAll('#pBody .dex-tabs button, #pBody .hub-tabs button')[i]; t && t.click(); }, [id, i]); await p.waitForTimeout(200); await grab(id + ':' + i); }
  }
  for (const f of ['SS.charms.open()', 'SS.tree && SS.tree.open && SS.tree.open()', 'SS.events.open()']) { await p.evaluate(f => { SS.closePanel(); eval(f); }, f); await p.waitForTimeout(250); await grab(f); }
  // static part: (1) two files with the same pixels must not both be in use; (2) every data list entry
  // (perks, tree, tower, arena, charms, achievements, festival) uses its own icon
  const fs = require('fs'), crypto = require('crypto'), dir = path.resolve(__dirname, '../../assets/ui');
  const src = ['game.js', 'index.html', 'monetize.config.js', ...fs.readdirSync(path.resolve(__dirname, '../../features')).filter(f => f.endsWith('.js') && f !== 'i18n.js').map(f => 'features/' + f)]
    .map(f => fs.readFileSync(path.resolve(__dirname, '../..', f), 'utf8')).join('\n');
  const used = n => new RegExp(`['"/]${n}(\\.png)?['"\`]`).test(src);
  const byHash = new Map();
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.png'))) { const h = crypto.createHash('md5').update(fs.readFileSync(path.join(dir, f))).digest('hex'); (byHash.get(h) || byHash.set(h, []).get(h)).push(f.slice(0, -4)); }
  const same = [...byHash.values()].filter(v => v.length > 1 && v.filter(used).length > 1);
  for (const v of same) console.log('same picture, different names:', v.filter(used).join(' = '));
  const icons = new Map();
  for (const m of src.matchAll(/name: '([^']+)'[^}\n]*?(?:icon|img): '([a-zA-Z_]+)'/g)) { const [_, name, ic] = m; if (/^(gem|gem_big|face_|mon_)/.test(ic)) continue; (icons.get(ic) || icons.set(ic, new Set()).get(ic)).add(name); }
  const listDup = [...icons].filter(([ic, n]) => n.size > 1);
  for (const [ic, n] of listDup) console.log(ic, '→ list entries', [...n].join(' | '));
  const dup = [...use].filter(([src, m]) => m.size > 1 && !ALLOW.test(src));
  for (const [src, m] of dup) console.log(src.replace('assets/ui/', ''), '→', [...m].map(([l, w]) => `"${l}" (${w})`).join(' | '));
  const bad = dup.length + same.length + listDup.length;
  console.log(bad ? `errors ${bad} shared icons` : (errs.length ? 'errors ' + errs.join(';') : 'errors none'));
  await b.close();
})();
