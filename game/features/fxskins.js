/* Shuriken Squad feature: Efekt Kaplamaları (effect skins) + the Neo Ninja / Doğuş offers.
   An effect skin is cosmetic: it works on every weapon and changes the throw flash, the projectile glow and
   trail, the hit effect and the kill effect. The equipped one gives +5% gold (like outfits); no skin adds damage.
   How each is obtained (a mix, so not everything is paid):
     Sakura Fırtınası  gems (1500)            Gece Hilali   Fener Festivali shop (lanterns)
     Ejder Alevi       purchase                Yıldırım Lotus purchase
     Neo Devre         Neo Ninja Paketi only (with Ejder + Lotus + gems, cheaper than buying them one by one)
   Any skin can be tried for 10 seconds on the field before buying ("DENE").
   Offers: Doğuş Paketi (once, 24 h, right after the first Rebirth) and Neo Ninja Paketi (always in the shop, one
   popup when the first Neo weapon comes in reach). Both are one-time purchases with fixed contents. */
'use strict';
(() => {
  const SS = window.SS;
  if (!SS) return;
  const save = SS.save, R = SS.R;
  if (!save.fxs || typeof save.fxs !== 'object') save.fxs = { owned: {}, on: '' };
  const X = save.fxs; X.owned = X.owned || {};
  const SK = {
    dragon: { name: 'Ejder Alevi', pal: 'dragon', part: 'fxp_ember', how: 'iap', sku: 'ss_fx_dragon', desc: 'Alev kuyruğu · kor patlaması · ateş çemberi' },
    lotus: { name: 'Yıldırım Lotus', pal: 'lotus', part: 'fxp_bolt', how: 'iap', sku: 'ss_fx_lotus', desc: 'Elektrik izi · dallanan şimşek · ışık halkası' },
    sakura: { name: 'Sakura Fırtınası', pal: 'sakura', part: 'fxp_petal', how: 'gems', cost: 1500, desc: 'Yaprak izi · çiçek patlaması · süzülen yapraklar' },
    moon: { name: 'Gece Hilali', pal: 'moon', part: 'fxp_moon', how: 'event', desc: 'Ay ışığı izi · hilal kesik · gölge yankısı' },
    neon: { name: 'Neo Devre', pal: 'neon', part: 'fxp_bit', how: 'pack', desc: 'Dijital iz · devre kıvılcımı · piksel dağılması' },
  };
  const ORDER = ['sakura', 'moon', 'dragon', 'lotus', 'neon'];
  let trial = null;   // { id, until } — a 10 s try-out
  const cur = () => (trial && trial.until > Date.now() ? trial.id : X.on) || '';
  const skin = () => SK[cur()];
  SS.MODS.money.push(() => (X.on && X.owned[X.on] ? 1.05 : 1));

  function give(id, quiet) {
    if (!SK[id] || X.owned[id]) return;
    X.owned[id] = true; if (!X.on) X.on = id;
    SS.persist();
    if (!quiet) SS.banner('YENİ KAPLAMA!', SK[id].name);
  }

  // ---------------- effects (all gated by the effect budget and the graphics quality)
  const busy = () => save.eco || R.fx >= 2 || R.parts.length > 150;
  const frame = (base) => `${base}_${Math.floor(Math.random() * (SS.AN[base] || 1))}`;
  function mote(s, x, y, vx, vy, life) { if (R.parts.length < 190) R.parts.push({ k: 'float', f: frame(s.part), x, y, vx, vy, life, max: life }); }
  let flashT = 0, killT = 0;
  SS.HOOKS.shot.push(q => {
    const s = skin(); if (!s || !q) return;
    q.pg = s.pal; q.fxs = 1;
    if (R.t - flashT > 0.08 && !busy()) { flashT = R.t; SS.vfx('burst', s.pal, q.x, q.y, 0.35, 0.12); }
  });
  SS.HOOKS.update.push(dt => {
    const s = skin(); if (!s || busy()) return;
    const U = SS.U;
    for (const q of R.bul) {
      if (!q.fxs) continue;
      q.fxt = (q.fxt || 0) - dt; if (q.fxt > 0) continue;
      q.fxt = s.pal === 'sakura' ? 0.06 : 0.045;
      const lead = !q.from || q.from.i === 0 || R.bul.length < 12; if (!lead && Math.random() < 0.6) continue;
      const up = s.pal === 'dragon' ? -40 : s.pal === 'sakura' ? 25 : 0;
      mote(s, q.x + (Math.random() - 0.5) * 8 * U, q.y + (Math.random() - 0.5) * 8 * U, (Math.random() - 0.5) * 30 * U, (up + (Math.random() - 0.5) * 30) * U, s.pal === 'sakura' ? 0.6 : 0.35);
    }
  });
  SS.HOOKS.hit.push((q, c) => {
    const s = skin(); if (!s || !q || !q.fxs || busy()) return;
    const x = q.x, y = q.y, U = SS.U;
    if (Math.random() < 0.5) SS.vfx('burst', s.pal, x, y, 0.5, 0.2);
    if (s.pal === 'moon') SS.fx('vx_slash_moon', x, y, 0.6, 0.22);
    else if (s.pal === 'lotus' && c && Math.random() < 0.35) { const a = Math.random() * 6.28; R.bolts.push({ x0: x, y0: y, x1: x + Math.cos(a) * 26 * U, y1: y + Math.sin(a) * 18 * U, life: 0.12 }); }
    else if (s.pal === 'dragon') SS.fx('fx_flam', x, y, 0.5, 0.25);
    for (let i = 0; i < 2; i++) mote(s, x, y, (Math.random() - 0.5) * 120 * U, (-40 - Math.random() * 80) * U, 0.4);
  });
  SS.HOOKS.kill.push(e => {
    const s = skin(); if (!s || !e || busy() || R.t - killT < 0.07) return;
    killT = R.t;
    const U = SS.U, y = e.y - 8 * SS.P;
    SS.vfx('ring', s.pal, e.x, y, 0.6, 0.3);
    if (s.pal === 'moon') SS.fx('vx_slash_moon', e.x, y, 1, 0.3);
    if (s.pal === 'neon') SS.fx('vx_slash_neon', e.x, y, 0.75, 0.25);
    const n = s.pal === 'sakura' ? 6 : 4;
    for (let i = 0; i < n; i++) { const a = i / n * 6.28 + Math.random(); mote(s, e.x, y, Math.cos(a) * 70 * U, Math.sin(a) * 50 * U - (s.pal === 'dragon' ? 40 : 0) * U, s.pal === 'sakura' ? 0.9 : 0.5); }
  });

  // ---------------- try-out and equip
  function tryOut(id) {
    trial = { id, until: Date.now() + 10000 };
    SS.closePanel(); SS.sfx('skill', 0); SS.toast(`Deneme: ${SK[id].name} · 10 sn`);
    setTimeout(() => { if (trial && trial.until <= Date.now()) { trial = null; } }, 10200);
  }
  function equip(id) { X.on = id; SS.persist(); SS.sfx('accept'); }
  const IAP = () => SS.IAP;

  function rowFor(id) {
    const s = SK[id], owned = !!X.owned[id], eq = X.on === id;
    let btn;
    if (eq) btn = '<button class="btn grey off">TAKILI</button>';
    else if (owned) btn = '<button class="btn green fx-eq">TAK</button>';
    else if (s.how === 'gems') btn = `<button class="btn yellow fx-gem"><img src="assets/ui/gem.png" alt="">${s.cost}</button>`;
    else if (s.how === 'iap' && IAP() && IAP().enabled) btn = `<button class="btn yellow fx-iap">${IAP().price(s.sku)}</button>`;
    else if (s.how === 'event') btn = `<button class="btn red fx-ev"><img src="assets/ui/mon_LanternRed.png" alt="">Festival</button>`;
    else if (s.how === 'pack' && IAP() && IAP().enabled) btn = '<button class="btn purple fx-pack">Neo Paketi</button>';
    else btn = '<button class="btn grey off">Yakında</button>';   // paid skins in a build without purchases
    const r = SS.el(`<div class="row-card fx-row ${eq ? 'cur' : ''}"><div class="ico tile"><img src="assets/ui/fxi_${id}.png" alt=""></div>
      <div class="info"><h4>${s.name}</h4><p>${s.desc}${owned ? ' · takılıyken +%5 altın' : ''}</p></div>
      <div class="fx-btns">${owned ? '' : '<button class="btn blue fx-try">DENE</button>'}${btn}</div></div>`);
    const on = (sel, f) => { const b = r.querySelector(sel); if (b) b.onclick = f; };
    on('.fx-try', () => tryOut(id));
    on('.fx-eq', () => { equip(id); reopen(); });
    on('.fx-gem', () => {
      if (save.gems < s.cost) { SS.sfx('no'); SS.toast('Yeterli elmas yok'); return; }
      save.gems -= s.cost; give(id, true); equip(id); SS.sfx('buy'); SS.toast(`${s.name} açıldı!`); SS.refreshUI(); reopen();
    });
    on('.fx-iap', async () => { if (await IAP().buy(s.sku)) reopen(); });
    on('.fx-ev', () => { SS.sfx('click'); if (SS.events && SS.events.active()) SS.events.open(); else SS.toast('Fener Festivali her hafta sonu gelir'); });
    on('.fx-pack', () => { SS.sfx('click'); if (SS.mon) SS.mon.offerOpen('ss_neo_pack', { title: 'Neo Ninja Paketi', img: 'ic_neo.png' }); });
    return r;
  }
  let reopen = () => {};
  function section(root, after) {
    const h = SS.el('<h3 class="fb-sec fx-sec"><img src="assets/ui/fxi_all.png" alt="">Efekt Kaplamaları</h3>');
    const box = SS.el('<div class="fx-box"></div>');
    box.appendChild(SS.el('<p class="big-note">Her silahta çalışır: atış parlaması, iz, isabet ve yok etme efekti değişir. Güç vermez; takılı olan <b>+%5 altın</b> verir.</p>'));
    if (X.on) { const off = SS.el('<button class="btn grey wide fx-off">Kaplamayı çıkar</button>'); off.onclick = () => { X.on = ''; SS.persist(); SS.sfx('accept'); reopen(); }; box.appendChild(off); }
    ORDER.forEach(id => box.appendChild(rowFor(id)));
    if (after && after.parentNode) { after.parentNode.insertBefore(h, after); after.parentNode.insertBefore(box, after); } else { root.appendChild(h); root.appendChild(box); }
  }
  // the section lives in the Kostüm panel, right above the shot trails
  new MutationObserver(() => {
    const t = document.getElementById('pTitle').dataset.k, body = document.getElementById('pBody');
    if (t !== 'Kostüm' || body.querySelector('.fx-sec')) return;
    const trails = [...body.querySelectorAll('h3.fb-sec')].find(h => /Atış İzleri|Shot Trails/.test(h.textContent));
    const sc = body.scrollTop;
    reopen = () => { const s2 = body.scrollTop; if (SS.skins) SS.skins.open(); requestAnimationFrame(() => { body.scrollTop = s2; }); };
    section(body, trails); body.scrollTop = sc;
  }).observe(document.getElementById('pBody'), { childList: true });

  // ---------------- purchases: skins and packs
  SS.HOOKS.purchase.push(p => {
    if (p.fx) [].concat(p.fx).forEach(id => give(id, true));
    if (p.souls && save.tree) save.tree.souls = (save.tree.souls || 0) + p.souls;
    if (p.fx || p.souls) { SS.persist(); SS.refreshUI(); }
  });

  // ---------------- offers
  const M = () => save.mon;
  const nowMs = () => Date.now();
  function popup(id, opts, hours) {
    const m = M(); if (!m || !SS.IAP || !SS.IAP.enabled || !SS.mon) return false;
    if (!document.getElementById('panel').classList.contains('hidden')) return false;
    if (nowMs() - (m.lastPopup || 0) < 864e5 && !opts.force) return false;
    const o = m.offers[id] = m.offers[id] || {};
    if (o.shown) return false;
    o.shown = nowMs(); if (hours) o.until = nowMs() + hours * 3600e3; m.lastPopup = nowMs(); SS.persist();
    SS.mon.offerOpen(id, opts); return true;
  }
  // Doğuş Paketi: once, right after the first Rebirth (the moment a player has decided to keep going)
  SS.HOOKS.rebirth.push(() => {
    if ((save.rebirths || 0) > 0 || (SS.IAP && SS.IAP.owns('ss_rebirth_pack'))) return;
    const f = () => popup('ss_rebirth_pack', { title: 'Doğuş Paketi', img: 'ic_rebirth.png', force: true }, 24);
    setTimeout(() => { if (SS.flow) SS.flow.request('rebPack', f, 3); else f(); }, 4000);
  });
  // Neo Ninja Paketi: one popup when the first Neo weapon is the next one to unlock
  setInterval(() => {
    if ((save.wbest || 0) < 7 || (SS.IAP && SS.IAP.owns('ss_neo_pack'))) return;
    const m = M(); if (!m || (m.offers.ss_neo_pack && m.offers.ss_neo_pack.shown)) return;
    if (SS.flow) SS.flow.request('neoPack', () => popup('ss_neo_pack', { title: 'Neo Ninja Paketi', img: 'ic_neo.png' }), 6);
  }, 15000);
  const rebirthOffer = () => { const m = M(), o = m && m.offers.ss_rebirth_pack; return o && o.until > nowMs() && !(SS.IAP && SS.IAP.owns('ss_rebirth_pack')) ? o.until : 0; };

  SS.fxskins = { SK, ORDER, give, equip, tryOut, cur, owned: id => !!X.owned[id], rebirthOffer };
})();
