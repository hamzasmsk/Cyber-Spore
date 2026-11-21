/* Swarm Squad feature: timed boosts (simulated ad boost x2 damage + x2 money, gem-bought rapid fire). Requires window.SS. */
'use strict';
(() => {
  const SS = window.SS;
  if (!SS) { console.warn('boosts: SS missing'); return; }
  const save = SS.save;

  const AD_DUR = 3 * 60 * 1000, AD_CD = 10 * 60 * 1000, AD_SIM = 2000;
  const RATE_DUR = 2 * 60 * 1000, RATE_COST = 5;

  const st = () => {
    if (!save.boost || typeof save.boost !== 'object') save.boost = {};
    const b = save.boost;
    for (const k of ['adEnd', 'adCd', 'rateEnd']) if (typeof b[k] !== 'number' || !isFinite(b[k])) b[k] = 0;
    return b;
  };
  const now = () => Date.now();
  const adOn = () => st().adEnd > now();
  const adCooling = () => !adOn() && st().adCd > now();
  const rateOn = () => st().rateEnd > now();
  const mmss = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };

  SS.MODS.dmg.push(() => adOn() ? 2 : 1);
  SS.MODS.money.push(() => adOn() ? 2 : 1);
  SS.MODS.rate.push(() => rateOn() ? 1.5 : 1);
  const vib = ms => { if (save.vibrate !== false && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) { /* ignore */ } } };

  // ---------------- simulated ad
  let simulating = false;
  function fakeAd(done) {
    if (simulating) return;
    simulating = true;
    const ov = SS.el(`<div class="fa-ad"><div class="fa-adbox">
      <div class="fa-adtag">REKLAM</div>
      <img src="assets/ui/ic_play.png" alt="">
      <b>Reklam simülasyonu</b><small>Gerçek reklam gösterilmez</small>
      <div class="fa-bar"><i></i></div></div></div>`);
    document.body.appendChild(ov);
    const fill = ov.querySelector('.fa-bar i'), t0 = performance.now();
    const step = t => {
      const k = Math.min(1, (t - t0) / AD_SIM);
      fill.style.width = (k * 100).toFixed(1) + '%';
      if (k < 1) requestAnimationFrame(step);
      else { ov.remove(); simulating = false; done(); }
    };
    requestAnimationFrame(step);
  }

  function startAd() {
    if (adOn() || adCooling() || simulating) { SS.sfx('no'); return; }
    SS.closePanel();
    fakeAd(() => {
      const b = st(); b.adEnd = now() + AD_DUR; b.adCd = b.adEnd + AD_CD;
      SS.persist(); SS.refreshUI(); SS.sfx('win'); vib(60);
      SS.banner('x2 GÜÇ!', 'Hasar ve para 3 dakika boyunca x2');
      paint();
    });
  }
  function buyRate() {
    if (rateOn()) return;
    if ((save.gems || 0) < RATE_COST) { SS.sfx('no'); SS.toast('Yeterli elmas yok'); return; }
    save.gems -= RATE_COST;
    st().rateEnd = now() + RATE_DUR;
    SS.persist(); SS.refreshUI(); SS.sfx('buy'); vib(40);
    SS.toast('Hızlı Ateş aktif! x1.5 atış hızı');
    open(); paint();
  }

  // ---------------- side button
  const btn = SS.addSideButton({ side: 'left', label: 'x2', icon: 'assets/ui/ic_power.png', color: 'red', id: 'boostBtn', onClick: () => open() });
  btn.classList.add('fa-boost-btn');
  const lbl = btn.querySelector('span');
  const badge = SS.el('<em class="fa-bbadge">x2</em>'); btn.appendChild(badge);
  const lbar = SS.el('<i class="fa-btime"></i>'); btn.appendChild(lbar);

  let refs = null;
  function paint() {
    const b = st(), t = now();
    const a = adOn(), cd = adCooling(), r = rateOn();
    btn.classList.toggle('on', a);
    btn.classList.toggle('fa-cool', !a && cd);
    btn.classList.toggle('ready', !a && !cd);
    btn.classList.toggle('fa-rate', !a && r);
    if (a) { lbl.textContent = mmss(b.adEnd - t); lbar.style.width = ((b.adEnd - t) / AD_DUR * 100).toFixed(1) + '%'; }
    else if (r) { lbl.textContent = mmss(b.rateEnd - t); lbar.style.width = ((b.rateEnd - t) / RATE_DUR * 100).toFixed(1) + '%'; }
    else if (cd) { lbl.textContent = mmss(b.adCd - t); lbar.style.width = '0%'; }
    else { lbl.textContent = 'Boost'; lbar.style.width = '0%'; }
    badge.style.display = a || (!cd) ? '' : 'none';
    badge.textContent = a ? 'x2' : 'AD';
    if (refs && refs.wrap.isConnected && !document.getElementById('panel').classList.contains('hidden')) {
      if (refs.state !== stateKey()) open();
      else {
        refs.adTxt.textContent = adText();
        refs.rateTxt.textContent = rateText();
      }
    }
  }
  const stateKey = () => [adOn(), adCooling(), rateOn(), (save.gems || 0) >= RATE_COST].join();
  const adText = () => adOn() ? `Aktif · ${mmss(st().adEnd - now())} kaldı` : adCooling() ? `Bekleme · ${mmss(st().adCd - now())}` : 'Hasar ve para x2 · 3 dakika';
  const rateText = () => rateOn() ? `Aktif · ${mmss(st().rateEnd - now())} kaldı` : 'Atış hızı x1.5 · 2 dakika';

  function open() {
    SS.openPanel('Güçlendirme', 'red', body => {
      const wrap = SS.el('<div class="fa-mwrap"></div>');
      wrap.appendChild(SS.el('<p class="big-note">Kısa süreli güçlendirmelerle bölümleri hızla geç!</p>'));
      const a = adOn(), cd = adCooling();
      const ad = SS.el(`<div class="row-card fa-boostrow ${a ? 'fa-active' : ''}">
        <div class="ico fa-x"><img src="assets/ui/ic_power.png" alt=""><em>x2</em></div>
        <div class="info"><h4>Süper Güç</h4><p></p></div>
        ${a ? '<button class="btn grey off">AKTİF</button>' : cd ? '<button class="btn grey off">BEKLE</button>' : '<button class="btn green pulse"><img src="assets/ui/ic_play.png" alt="">İZLE</button>'}</div>`);
      if (!a && !cd) ad.querySelector('.btn').onclick = startAd;
      const canBuy = (save.gems || 0) >= RATE_COST, r = rateOn();
      const rate = SS.el(`<div class="row-card fa-boostrow ${r ? 'fa-active' : ''}">
        <div class="ico fa-x"><img src="assets/ui/ic_rate.png" alt=""><em>x1.5</em></div>
        <div class="info"><h4>Hızlı Ateş</h4><p></p></div>
        ${r ? '<button class="btn grey off">AKTİF</button>' : `<button class="btn yellow ${canBuy ? '' : 'fa-poor'}"><img src="assets/ui/gem_blue.png" alt="">${RATE_COST}</button>`}</div>`);
      if (!r) rate.querySelector('.btn').onclick = buyRate;
      wrap.appendChild(ad); wrap.appendChild(rate);
      wrap.appendChild(SS.el('<p class="big-note fa-small">Süreler oyun kapalıyken de işler.</p>'));
      body.appendChild(wrap);
      refs = { wrap, adTxt: ad.querySelector('p'), rateTxt: rate.querySelector('p'), state: stateKey() };
      refs.adTxt.textContent = adText(); refs.rateTxt.textContent = rateText();
    });
  }

  // ---------------- active-boost glow drawn over the field edge
  let tk = 0, wasA = adOn(), wasR = rateOn();
  SS.HOOKS.update.push(dt => {
    tk += dt; if (tk < 0.25) return; tk = 0;
    const a = adOn(), r = rateOn();
    if (wasA && !a) { SS.toast('Süper Güç bitti'); SS.refreshUI(); }
    if (wasR && !r) { SS.toast('Hızlı Ateş bitti'); SS.refreshUI(); }
    wasA = a; wasR = r;
    paint();
  });
  SS.HOOKS.render.push(ctx => {
    if (!adOn() || save.eco) return;
    const W = SS.W, H = SS.H, p = 0.18 + Math.sin(performance.now() / 300) * 0.06;
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.75);
    g.addColorStop(0, 'rgba(255,120,40,0)'); g.addColorStop(1, `rgba(255,120,40,${p.toFixed(3)})`);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.scale(SS.DPR || 1, SS.DPR || 1);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
  });

  st(); paint();
  SS.boosts = { open, adOn, rateOn, startAd, buyRate };
})();
