/* Shuriken Squad — menus unlock step by step (loads after layout.js).
   A new player starts with the three upgrade cards, the boss button and nothing else; each menu appears when it
   becomes useful (best stage reached), with a short introduction card the first time. Locked menus stay on screen
   greyed out with the stage they open at. Players already past a step (older saves) simply have it open. The Görev panel's Kule / Başarım tabs follow the same rule. */
'use strict';
(() => {
  const SS = window.SS;
  if (!SS) return;
  const save = SS.save;
  // [element id or data-open key, best stage needed, title, one-line introduction, icon]
  const STEPS = [
    ['guns', 2, 'Silahlar', 'Bosslardan düşen elmaslarla yeni silahlar aç ve yıldızlarını yükselt.', 'ic_weapon'],
    ['dailyBtn', 2, 'Günlük Ödül', 'Her gün uğra, 7 günde büyüyen ödülleri topla.', 'ic_daily'],
    ['team', 3, 'Takım', 'Altınla yeni ninjalar kat: her biri bir atıcı ve bir yetenek daha.', 'ic_team'],
    ['missionsBtn', 3, 'Görevler', 'Günlük görevleri bitir, elmas kazan.', 'ic_missions'],
    ['shopBtn', 4, 'Mağaza', 'Paketler, ücretsiz elmas ve takviyeler.', 'ic_shop'],
    ['boostBtn', 5, 'Güçlendirme', 'Kısa süreli x2 güç ve altın.', 'ic_boost'],
    ['mineBtn', 5, 'Maden', 'Sen yokken bile elmas üretir. Sık sık topla!', 'ic_mine'],
    ['skinBtn', 6, 'Kostüm', 'Kaptanın görünümünü değiştir; her kostümün bir bonusu var.', 'ic_skins'],
    ['passBtn', 7, 'Ninja Yolu', 'Oynadıkça XP topla, sezon ödüllerini aç.', 'ic_sun'],
    ['rebirth', 8, 'Yeniden Doğuş', 'Takıldığında baştan başla: kalıcı güç ve Ruh Ağacı için ruh kazan.', 'ic_rebirth'],
    ['dexBtn', 9, 'Koleksiyon', 'Yendiğin her canavar ve boss burada kayıtlı.', 'ic_book'],
    ['piggyBtn', 10, 'Kumbara', 'Düşmanlar kumbaraya elmas biriktirir.', 'ic_piggy'],
  ];
  const TABS = { ach: 5, surv: 6, tower: 12 };
  if (!save.unl || typeof save.unl !== 'object') {
    save.unl = {};
    for (const s of STEPS) if ((save.best || 1) >= s[1]) save.unl[s[0]] = 2;   // older saves: already known, no intro
  }
  const U = save.unl;
  const el = k => document.getElementById(k) || document.querySelector(`[data-open="${k}"]`);
  const on = k => !!U[k];
  SS.unlocked = k => { const s = STEPS.find(x => x[0] === k); return s ? on(k) : TABS[k] ? (save.best || 1) >= TABS[k] : true; };

  // locked menus stay visible (greyed, padlock, "Bölüm N") so a new player sees what is coming
  function paint() {
    for (const [k, lv] of STEPS) {
      const b = el(k); if (!b) continue;
      b.style.display = ''; b.classList.toggle('m-lock', !on(k)); b.classList.toggle('is-new', U[k] === 1);
      if (!on(k)) b.dataset.lv = 'Bölüm ' + lv; else delete b.dataset.lv;
    }
  }
  // a tap on a locked menu explains when it opens instead of opening it
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('.sbtn.m-lock'); if (!b) return;
    e.stopImmediatePropagation(); e.preventDefault();
    const s = STEPS.find(x => el(x[0]) === b); if (!s) return;
    SS.sfx('no'); SS.toast(`${s[2]} ${s[1]}. bölümde açılır`);
    b.classList.remove('m-shake'); void b.offsetWidth; b.classList.add('m-shake');
  }, true);
  let queue = [], showing = false;
  function intro(s) {
    const [k, , title, txt, icon] = s, b = el(k);
    const card = SS.el(`<div class="un-card"><div class="un-ico"><img src="assets/ui/${icon}.png" alt=""></div><div class="un-txt"><small>YENİ MENÜ</small><b>${title}</b><span>${txt}</span></div><button class="btn green">AÇ</button></div>`);
    const done = () => { card.classList.add('out'); setTimeout(() => card.remove(), 250); if (SS.flow) SS.flow.mark(); };
    card.querySelector('.btn').onclick = e => { e.stopPropagation(); U[k] = 2; SS.persist(); paint(); done(); if (b) b.click(); };
    card.onclick = () => done();
    document.getElementById('ui').appendChild(card);
    SS.sfx('bonus', 0);
    if (b) { b.classList.add('un-pop'); setTimeout(() => b.classList.remove('un-pop'), 900); }
    setTimeout(() => { if (card.isConnected) done(); }, 7000);
  }
  function next() {
    if (!queue.length) return;
    const s = queue.shift();
    if (SS.flow) SS.flow.request('un_' + s[0], () => intro(s), 2, 6000); else intro(s);
    next();
  }
  function check() {
    const best = save.best || 1; let ch = false;
    for (const s of STEPS) if (!U[s[0]] && best >= s[1]) { U[s[0]] = 1; queue.push(s); ch = true; }
    if (ch) { SS.persist(); paint(); next(); }
  }
  // a menu stays marked "new" until it is opened once
  for (const [k] of STEPS) { const b = el(k); if (b) b.addEventListener('click', () => { if (U[k] === 1) { U[k] = 2; SS.persist(); paint(); } }); }
  paint(); check();
  setInterval(check, 1000);
  const all = () => { for (const [k] of STEPS) U[k] = 2; paint(); };   // testing / support helper
  SS.unlock = { STEPS, check, all };
})();
