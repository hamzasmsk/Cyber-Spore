/* Shuriken Squad — Yolculuk (journey map), Yoldaşlar (pets), Haftalık Meydan Okuma, and the share card.
   - Tap the stage name: a map of the road ahead (regions, bosses, your record, the wall) + a share button.
   - Pets follow the squad, throw a small attack now and then and give one passive bonus. They are earned by
     playing (stage, Kule, Arena, achievements), never sold.
   - Weekly challenge: one special boss with a rule that changes every week (3 tries, chest once per week).
   - Share card: a picture of your squad and records, shared with the phone's share sheet (or shown to save). */
'use strict';
(() => {
  const SS = window.SS;
  if (!SS) return;
  const save = SS.save, R = SS.R;
  const weekKey = () => { const d = new Date(), day = (d.getDay() + 6) % 7; d.setDate(d.getDate() - day); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
  const weekNo = () => Math.floor((Date.now() - Date.UTC(2026, 0, 5)) / (7 * 864e5));

  // ================================================================ pets
  const PETS = [
    { id: 'Slime3', name: 'Balçık', txt: '+%10 altın', need: 'Bölüm 10\'a ulaş', ok: () => (save.best || 1) >= 10, mod: ['money', 1.1] },
    { id: 'Butterfly', name: 'Kelebek', txt: '+%3 kritik şansı', need: 'Kule 10. kat', ok: () => ((save.tower && save.tower.best) || 0) >= 10, mod: ['crit', 0.03] },
    { id: 'Racoon', name: 'Rakun', txt: '+%3 hazine canavarı şansı', need: 'Arena rekoru 150', ok: () => ((save.surv && save.surv.best) || 0) >= 150, mod: ['treasure', 0.03] },
    { id: 'Mole', name: 'Köstebek', txt: '+%10 hasar', need: '3 Doğuş', ok: () => (save.rebirths || 0) >= 3, mod: ['dmg', 1.1] },
    { id: 'Eye', name: 'Göz', txt: '+%8 boss hasarı', need: '10 başarım kademesi', ok: () => Object.values(save.ach || {}).reduce((a, b) => a + b, 0) >= 10, mod: ['boss', 1.08] },
  ];
  if (!save.pet || typeof save.pet !== 'object') save.pet = { on: '', seen: {} };
  const PT = save.pet;
  const pet = () => PETS.find(p => p.id === PT.on && p.ok());
  for (const k of ['money', 'dmg', 'boss']) SS.MODS[k].push(() => { const p = pet(); return p && p.mod[0] === k ? p.mod[1] : 1; });
  for (const k of ['crit', 'treasure']) SS.MODS[k].push(() => { const p = pet(); return p && p.mod[0] === k ? p.mod[1] : 0; });
  const P0 = { x: 0, y: 0, atkT: 3, dir: 'u', anim: 0, hop: 0 };
  setInterval(() => {   // newly earned pets: tell once
    for (const p of PETS) if (p.ok() && !PT.seen[p.id]) { PT.seen[p.id] = 1; if (!PT.on) PT.on = p.id; SS.persist(); SS.toast(`Yeni yoldaş: ${p.name}! (Kostüm panelinde)`); }
  }, 3000);
  SS.HOOKS.update.push(dt => {
    const p = pet(), L = SS.leader; if (!p || !L) return;
    const tx = L.x + 26 * SS.U, ty = L.y + 18 * SS.U, d = Math.hypot(tx - P0.x, ty - P0.y);
    if (d > 300) { P0.x = tx; P0.y = ty; }
    const k = Math.min(1, dt * 4); P0.x += (tx - P0.x) * k; P0.y += (ty - P0.y) * k; P0.anim += dt * (d > 6 ? 8 : 3);
    P0.dir = Math.abs(tx - P0.x) > Math.abs(ty - P0.y) ? (tx > P0.x ? 'r' : 'l') : 'u';
    P0.atkT -= dt;
    if (P0.atkT <= 0 && !R.paused) {
      P0.atkT = 3;
      const T = SS.liveTargets(); if (!T.length) return;
      let best = T[0], bd = 1e9; for (const e of T) { const dd = Math.hypot(e.x - P0.x, e.y - P0.y); if (dd < bd) { bd = dd; best = e; } }
      P0.hop = 0.25; SS.fx('fx_spark', best.x, SS.aimY(best), 0.5, 0.2); SS.sfx('magic', 0.3, P0.x, 12);
      SS.damage(best, SS.dmgPerShot() * 0.8, false, best === R.boss);
    }
    if (P0.hop > 0) P0.hop -= dt;
  });
  SS.HOOKS.light.push(() => {   // drawn with the field, under the light map
    const p = pet(); if (!p || !SS.leader) return;
    const n = Math.floor(P0.anim) % 4, lift = P0.hop > 0 ? 4 * SS.P : 0;
    SS.spr('shadow', P0.x, P0.y + SS.P, 0.75, 0.5, 0.5);
    SS.spr(`m_${p.id}_${P0.dir}${n}`, P0.x, P0.y - lift, 1);
    if (Math.floor(R.t * 2) % 6 === 0) SS.spr('heart', P0.x, P0.y - lift - 18 * SS.P, 0.25, 0.5, 0.5);
  });
  // pets section inside the Kostüm panel
  new MutationObserver(() => {
    if (document.getElementById('pTitle').dataset.k !== 'Kostüm') return;
    const root = document.querySelector('#pBody .fb-skins'); if (!root || root.querySelector('.pt-sec')) return;
    root.appendChild(SS.el('<h3 class="fb-sec pt-sec"><img src="assets/ui/ic_paw.png" alt="">Yoldaşlar</h3>'));
    for (const p of PETS) {
      const got = p.ok(), on = PT.on === p.id && got;
      const r = SS.el(`<div class="row-card ${on ? 'cur' : ''} ${got ? '' : 'lock'}"><div class="ico face"><img src="assets/ui/mon_${p.id}.png" alt=""></div><div class="info"><h4>${p.name}</h4><p>${p.txt} · düşmanlara saldırır${got ? '' : ` · <b>${p.need}</b>`}</p></div>
        ${on ? '<button class="btn grey off">YANINDA</button>' : got ? '<button class="btn green">AL</button>' : '<button class="btn grey off"><img src="assets/ui/lock.png" alt=""></button>'}</div>`);
      if (got && !on) r.querySelector('.btn').onclick = () => { PT.on = p.id; SS.persist(); SS.sfx('accept', 0); SS.closePanel(); setTimeout(() => document.querySelector('#skinBtn') && document.querySelector('#skinBtn').click(), 120); };
      root.appendChild(r);
    }
  }).observe(document.getElementById('pBody'), { childList: true });

  // ================================================================ weekly challenge
  const RULES = [
    { name: 'Dev Ana', txt: 'Boss 3 kat canlı · 60 saniye', hp: 3, time: 60 },
    { name: 'Kalabalık', txt: 'Boss sürekli asker çağırır', hp: 1.6, sig: ['summon', 'summon'] },
    { name: 'Cam Takım', txt: 'Takım x3 hasar alır, x2 hasar verir', hp: 2, glass: 1 },
    { name: 'Fırtına Gözü', txt: 'Boss %60 hızlı ve hep öfkeli', hp: 1.6, spd: 1.6, rage: 1 },
  ];
  if (!save.week || typeof save.week !== 'object') save.week = {};
  const WK = () => { if (save.week.key !== weekKey()) save.week = { key: weekKey(), tries: 0, done: false }; return save.week; };
  const rule = () => RULES[weekNo() % RULES.length];
  let glass = false;
  SS.MODS.taken.push(() => glass ? 3 : 1); SS.MODS.dmg.push(() => glass ? 2 : 1);
  function weeklyFight() {
    const w = WK(), r = rule();
    if (w.done) { SS.toast('Bu haftanın meydan okuması tamam'); return; }
    if (w.tries >= 3) { SS.toast('Bu haftaki 3 hak bitti'); return; }
    if (R.boss || R.mode) { SS.toast('Önce bu dövüşü bitir'); return; }
    SS.closePanel(); w.tries++; glass = !!r.glass;
    const keys = Object.keys(SS.BOSSES), key = keys[weekNo() % keys.length];
    const hp = 10 * Math.pow(1.3, ((save.best || 1) - 1) * 5 + 4) * 22 * r.hp;
    SS.startBoss({ key, hp, time: r.time || 40, rage: !!r.rage, spd: r.spd || 1, sig: r.sig || null, sub: `Haftalık · ${r.name}`, done: won => {
      glass = false;
      if (won) { w.done = true; SS.chest([{ icon: 'gem', label: '40 elmas', apply: () => { save.gems += 40; } }, { icon: 'ic_amulet', label: 'Tılsım Sv.2', apply: () => SS.charms && SS.charms.give(['atk', 'gold', 'guard'][weekNo() % 3], 2) }, { icon: 'ic_scroll', label: '4 parşömen', apply: () => SS.giveScroll(4) }], 'Haftalık sandık'); }
      else SS.banner('MEYDAN OKUMA', `${3 - w.tries} hak kaldı`);
      SS.persist();
    } });
    SS.banner('HAFTALIK!', r.name + ': ' + r.txt);
  }
  // weekly card inside the Arena tab
  new MutationObserver(() => {
    if (document.getElementById('pTitle').dataset.k !== 'Arena') return;
    const body = document.getElementById('pBody'); if (body.querySelector('.wk-card')) return;
    const w = WK(), r = rule();
    const c = SS.el(`<div class="row-card wk-card ${w.done ? 'done' : ''}"><div class="ico tile"><img src="assets/ui/ic_week.png" alt=""></div><div class="info"><h4>Haftalık: ${r.name}</h4><p>${r.txt} · ${w.done ? '<b>Tamamlandı</b>' : `${3 - w.tries} hak`}</p></div><button class="btn ${w.done || w.tries >= 3 ? 'grey off' : 'yellow'}">${w.done ? '✓' : 'SAVAŞ'}</button></div>`);
    c.querySelector('.btn').onclick = () => { if (!w.done && w.tries < 3) weeklyFight(); };
    body.appendChild(c);
  }).observe(document.getElementById('pBody'), { childList: true });

  // ================================================================ journey map
  function openMap() {
    SS.openPanel('Yolculuk', 'green', body => {
      const st = save.stage, best = save.best || 1, from = Math.max(1, st - 2), to = st + 9;
      body.appendChild(SS.el(`<div class="tw-head"><div><small>Şu an</small><b>${st}</b></div><div><small>Rekor</small><b>${best}</b></div><div><small>Doğuş</small><b>${save.rebirths || 0}</b></div></div>`));
      const path = SS.el('<div class="jm-path"></div>');
      for (let s = to; s >= from; s--) {
        const b = SS.BIOMES[(s - 1) % SS.BIOMES.length], key = b.bosses[Math.floor((s - 1) / SS.BIOMES.length) % b.bosses.length];
        const cls = s < st ? 'done' : s === st ? 'cur' : s <= best ? 'seen' : 'new';
        path.appendChild(SS.el(`<div class="jm-node ${cls} g-${b.ground}"><b>${s}</b><img src="assets/ui/boss_${key}.png" alt=""><span>${b.name}<small>${SS.BOSSES[key].name}${s === best && s !== st ? ' · rekor' : ''}</small></span>${s === st ? '<i class="jm-you">SEN</i>' : ''}</div>`));
      }
      body.appendChild(path);
      const sh = SS.el('<button class="btn yellow wide">PAYLAŞ</button>'); sh.onclick = share; body.appendChild(sh);
    });
    const c = document.querySelector('#pBody .jm-node.cur'); if (c) c.scrollIntoView({ block: 'center' });
  }
  const lbl = document.getElementById('stageLbl');
  if (lbl) { let down = 0; lbl.style.pointerEvents = 'auto'; lbl.addEventListener('pointerdown', () => { down = performance.now(); }); lbl.addEventListener('pointerup', () => { if (performance.now() - down < 500) { SS.sfx('open', 0); openMap(); } }); }

  // ================================================================ share card
  async function share() {
    const W = 540, H = 720, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
    g.fillStyle = '#131b1b'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#28393a'; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(W / 2, 330, 250 - i * 70, 0, Math.PI * 2); g.fill(); g.fillStyle = ['#2f4442', '#36504a', '#3e5c52'][i]; }
    try { await document.fonts.load('700 40px "Pixelify Sans"'); } catch (e) { /* fallback font */ }
    const F = (sz, c) => { g.font = `700 ${sz}px "Pixelify Sans", monospace`; g.fillStyle = c; g.textAlign = 'center'; };
    F(44, '#ffe18d'); g.fillText('SHURIKEN SQUAD', W / 2, 70);
    const team = SS.R.heroes.length ? SS.R.heroes : [];
    team.forEach((h, i) => { const f = SS.AF[`h_${h.id}_d0`]; if (!f) return; const k = 6, x = W / 2 + (i - (team.length - 1) / 2) * 90 - f[2] * k / 2; g.drawImage(SS.atlasImg, f[0], f[1], f[2], f[3], x, 250, f[2] * k, f[3] * k); });
    const rows = [['En yüksek bölüm', save.best || 1], ['Kule katı', (save.tower && save.tower.best) || 0], ['Arena rekoru', (save.surv && save.surv.best) || 0], ['Doğuş', save.rebirths || 0]];
    rows.forEach(([a, b], i) => { F(26, '#b9ad9c'); g.fillText(a, W / 2, 470 + i * 58); F(34, '#fce2ca'); g.fillText(String(b), W / 2, 500 + i * 58); });
    F(20, '#8d977f'); g.fillText('Takımımı geçebilir misin?', W / 2, H - 22);
    const show = () => SS.openPanel('Paylaşım kartı', 'yellow', body => { cv.className = 'jm-card'; body.appendChild(cv); body.appendChild(SS.el('<p class="big-note">Ekran görüntüsü alıp paylaşabilirsin.</p>')); });
    try { cv.toBlob(async blob => {
      const file = blob && new File([blob], 'shuriken-squad.png', { type: 'image/png' });
      try { if (file && navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Shuriken Squad', text: `Bölüm ${save.best} · Kule ${(save.tower && save.tower.best) || 0}` }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
      let url = ''; try { url = cv.toDataURL('image/png'); } catch (e) { show(); return; }
      SS.openPanel('Paylaşım kartı', 'yellow', body => { body.appendChild(SS.el(`<img class="jm-card" src="${url}" alt="Paylaşım kartı">`)); body.appendChild(SS.el('<p class="big-note">Görsele uzun basıp kaydedebilir ya da paylaşabilirsin.</p>')); });
    }, 'image/png'); } catch (e) { show(); }   // a file:// page cannot export the canvas: show it instead
  }
  SS.journey = { openMap, share, weeklyFight, PETS };
})();
