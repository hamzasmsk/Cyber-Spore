/* Shuriken Squad — monetization service (rewarded ads, in-app purchases, offers).
   One API for the whole game:
     SS.Ads.available(placement) / SS.Ads.show(placement) -> Promise<boolean rewarded>
     SS.IAP.price(id) / SS.IAP.buy(id) -> Promise<boolean> / SS.IAP.restore() / SS.IAP.owns(id)
     SS.mon.bossReward(gems) · SS.mon.canContinue() · SS.mon.offerContinue(cb) · SS.mon.offerOffline(gain, cb)
   Providers: inside the Capacitor app the real SDKs (@capacitor-community/admob, @revenuecat/purchases-capacitor);
   in a browser a clearly labelled TEST mode (or nothing, see monetize.config.js).
   Design rules: rewarded ads only (opt-in, daily caps), no interstitials, no paid randomness, every price is the
   store's localized price, non-consumables can be restored. */
'use strict';
(() => {
  const SS = window.SS;
  if (!SS) { console.warn('monetize: SS missing'); return; }
  const C = window.MONETIZE || { mode: 'off', products: [], ads: { dailyCap: 0, placements: {} } };
  const save = SS.save;
  const DAY = 864e5, now = () => Date.now(), today = () => new Date().toISOString().slice(0, 10);
  if (!save.mon || typeof save.mon !== 'object') save.mon = {};
  const M = save.mon;
  M.owned = M.owned || {};
  M.ads = M.ads && M.ads.day ? M.ads : { day: '', n: 0, per: {} };
  M.monthly = M.monthly || { end: 0, last: '' };
  M.offers = M.offers || {};
  M.log = Array.isArray(M.log) ? M.log.slice(-50) : [];

  const cap = window.Capacitor;
  const native = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
  const platform = native ? cap.getPlatform() : 'web';
  const mode = C.mode === 'auto' ? (native ? 'native' : (C.webMode || 'off')) : C.mode;   // native | test | off
  const P = {}; (C.products || []).forEach(p => { P[p.id] = p; });
  const prices = {};

  // ================================================================ test-mode dialogs (browser only)
  function testDialog(title, lines, okText) {
    return new Promise(res => {
      const ov = SS.el(`<div class="mz-ov"><div class="panel mz-box">
        <div class="ribbon grey">TEST MODU</div>
        <h4>${title}</h4><p>${lines}</p><p class="mz-warn">Gerçek ödeme alınmaz / gerçek reklam gösterilmez.</p>
        <div class="btnrow"><button class="btn grey">İptal</button><button class="btn green">${okText}</button></div></div></div>`);
      document.body.appendChild(ov);
      const done = v => { ov.remove(); res(v); };
      ov.querySelector('.btn.grey').onclick = () => done(false);
      ov.querySelector('.btn.green').onclick = () => done(true);
    });
  }
  function testAd(label) {
    return new Promise(res => {
      const ov = SS.el(`<div class="mz-ov"><div class="panel mz-box mz-ad">
        <div class="ribbon yellow">REKLAM · TEST</div>
        <img src="assets/ui/play.png" alt=""><h4>${label}</h4>
        <div class="pbar"><i></i></div><p class="mz-warn">Gerçek reklam gösterilmez.</p>
        <button class="btn grey mz-skip">Kapat (ödülsüz)</button></div></div>`);
      document.body.appendChild(ov);
      const fill = ov.querySelector('.pbar i'), t0 = performance.now(), D = 2500;
      let over = false;
      const end = v => { if (over) return; over = true; ov.remove(); res(v); };
      ov.querySelector('.mz-skip').onclick = () => end(false);
      const step = t => { if (over) return; const k = Math.min(1, (t - t0) / D); fill.style.width = Math.floor(k * 20) * 5 + '%'; if (k < 1) requestAnimationFrame(step); else end(true); };
      requestAnimationFrame(step);
    });
  }

  // ================================================================ native adapters (Capacitor plugins)
  const plug = name => (cap && cap.Plugins && cap.Plugins[name]) || null;
  const AdMobN = {
    ok: false,
    async init() {
      const A = plug('AdMob'); if (!A) return;
      const a = C.admob || {};
      try {
        if (platform === 'ios' && a.requestTracking && A.trackingAuthorizationStatus) {
          const st = await A.trackingAuthorizationStatus();
          if (st && st.status === 'notDetermined' && A.requestTrackingAuthorization) await A.requestTrackingAuthorization();
        }
        await A.initialize({ tagForChildDirectedTreatment: !!a.childDirected, tagForUnderAgeOfConsent: !!a.underAgeOfConsent, maxAdContentRating: a.childDirected ? 'General' : 'ParentalGuidance' });
        if (a.requestConsent && A.requestConsentInfo) {
          const info = await A.requestConsentInfo();
          if (info && info.isConsentFormAvailable && info.status === 'REQUIRED' && A.showConsentForm) await A.showConsentForm();
        }
        this.ok = true;
      } catch (e) { console.warn('AdMob init', e); }
    },
    show() {
      const A = plug('AdMob'); if (!A || !this.ok) return Promise.resolve(false);
      const adId = ((C.admob || {}).rewarded || {})[platform];
      return new Promise(async res => {
        let rewarded = false; const subs = [];
        const done = v => { subs.forEach(s => { try { s.remove(); } catch (e) { /* ignore */ } }); res(v); };
        try {
          if (A.addListener) {
            subs.push(await A.addListener('onRewardedVideoAdReward', () => { rewarded = true; }));
            subs.push(await A.addListener('onRewardedVideoAdDismissed', () => done(rewarded)));
            subs.push(await A.addListener('onRewardedVideoAdFailedToShow', () => done(false)));
          }
          await A.prepareRewardVideoAd({ adId, isTesting: /^ca-app-pub-3940256099942544\//.test(adId || '') });
          const r = await A.showRewardVideoAd();
          if (r) rewarded = true;
          if (!A.addListener) done(rewarded);
        } catch (e) { console.warn('AdMob show', e); done(false); }
      });
    },
  };
  const RevenueCatN = {
    ok: false,
    async init() {
      const Pu = plug('Purchases'); if (!Pu) return;
      try {
        await Pu.configure({ apiKey: (C.revenuecat || {})[platform] });
        const r = await Pu.getProducts({ productIdentifiers: Object.keys(P), type: 'NON_SUBSCRIPTION' });
        (r && r.products || []).forEach(sp => { prices[sp.identifier] = sp.priceString; });
        this.products = (r && r.products) || [];
        this.ok = true;
      } catch (e) { console.warn('RevenueCat init', e); }
    },
    async buy(id) {
      const Pu = plug('Purchases'); const sp = (this.products || []).find(x => x.identifier === id);
      if (!Pu || !sp) { SS.toast('Mağaza şu an kullanılamıyor'); return false; }
      try { await Pu.purchaseStoreProduct({ product: sp }); return true; }
      catch (e) { if (!(e && (e.userCancelled || e.code === '1'))) SS.toast('Satın alma tamamlanamadı'); return false; }
    },
    async restore() {
      const Pu = plug('Purchases'); if (!Pu) return [];
      try {
        const r = await Pu.restorePurchases(), ci = r && (r.customerInfo || r);
        return (ci && ci.allPurchasedProductIdentifiers) || ((ci && ci.nonSubscriptionTransactions) || []).map(t => t.productIdentifier);
      } catch (e) { SS.toast('Geri yükleme başarısız'); return []; }
    },
  };

  // ================================================================ rewards
  function boostMinutes(min) {
    if (!save.boost || typeof save.boost !== 'object') save.boost = {};
    const b = save.boost; b.adEnd = Math.max(now(), b.adEnd || 0) + min * 60000; b.adCd = Math.max(b.adCd || 0, b.adEnd);
  }
  function grant(p, silent) {
    const got = [];
    if (p.gems) { save.gems += p.gems; got.push(`+${p.gems} elmas`); }
    if (p.skin) { save.skins = save.skins || {}; save.skins.owned = save.skins.owned || {}; save.skins.owned[p.skin] = true; got.push('yeni kostüm'); }
    if (p.boostMin) { boostMinutes(p.boostMin); got.push(`${p.boostMin >= 60 ? p.boostMin / 60 + ' sa' : p.boostMin + ' dk'} x2 güç`); }
    if (p.flag) M.owned[p.flag] = true;
    if (p.kind === 'non_consumable') M.owned[p.id] = true;
    if (p.monthly) { M.monthly.end = Math.max(now(), M.monthly.end || 0) + p.monthly.days * DAY; M.monthly.daily = p.monthly.daily; M.monthly.last = ''; got.push('Aylık Kart aktif'); }
    if (p.pass && SS.pass) { SS.pass.unlockPremium(p.passLevels || 0); got.push('Ninja Yolu Premium' + (p.passLevels ? ` + ${p.passLevels} seviye` : '')); }
    if (p.piggy && SS.piggy && SS.piggy.breakPaid) SS.piggy.breakPaid();
    M.log.push({ id: p.id, t: now() });
    SS.persist(); SS.refreshUI();
    if (!silent) { SS.banner('TEŞEKKÜRLER!', got.join(' · ') || p.title); SS.sfx('win', 0); SS.sfx('gem', 0); }
    SS.HOOKS.purchase && SS.HOOKS.purchase.forEach(f => { try { f(p); } catch (e) { /* ignore */ } });
  }

  // ================================================================ public API
  const Ads = {
    enabled: mode !== 'off',
    noads: () => !!M.owned.noads,
    roll() { if (M.ads.day !== today()) { M.ads = { day: today(), n: 0, per: {} }; } },
    remaining(pl) {
      this.roll(); const c = (C.ads.placements || {})[pl]; if (!c || !this.enabled) return 0;
      return Math.max(0, Math.min(c.cap - (M.ads.per[pl] || 0), (C.ads.dailyCap || 20) - M.ads.n));
    },
    available(pl) { return this.remaining(pl) > 0; },
    busy: false,
    async show(pl) {
      if (!this.available(pl) || this.busy) { SS.sfx('no'); if (this.enabled) SS.toast('Bugünlük reklam hakkı doldu'); return false; }
      const label = ((C.ads.placements || {})[pl] || {}).label || 'Ödül';
      let ok;
      this.busy = true;
      SS.audioInit && SS.audioInit();
      const muted = save.music; if (mode === 'native') { save.music = false; SS.musicUpdate && SS.musicUpdate(); }
      try {
        if (this.noads()) { ok = true; SS.toast('Reklamsız: ödül anında'); }
        else if (mode === 'native') ok = await AdMobN.show();
        else ok = await testAd(label);
      } finally { this.busy = false; if (mode === 'native') { save.music = muted; SS.musicUpdate && SS.musicUpdate(); } }
      if (ok) { this.roll(); M.ads.n++; M.ads.per[pl] = (M.ads.per[pl] || 0) + 1; SS.persist(); }
      return ok;
    },
  };
  const IAP = {
    enabled: mode !== 'off',
    product: id => P[id],
    price: id => prices[id] || (P[id] && P[id].price) || '',
    owns: id => !!M.owned[id],
    async buy(id) {
      const p = P[id]; if (!p || !this.enabled) return false;
      if (p.kind === 'non_consumable' && M.owned[id]) { SS.toast('Zaten sahipsin'); return false; }
      let ok;
      if (mode === 'native') ok = await RevenueCatN.buy(id);
      else ok = await testDialog(p.title, `${p.desc || (p.gems ? p.gems + ' elmas' : '')}<br><b>${this.price(id)}</b>`, 'Satın al (test)');
      if (ok) grant(p);
      return ok;
    },
    async restore() {
      if (mode !== 'native') { SS.toast('Test modu: geri yüklenecek satın alma yok'); return; }
      const ids = await RevenueCatN.restore(); let n = 0;
      ids.forEach(id => { const p = P[id]; if (p && p.kind === 'non_consumable' && !M.owned[id]) { grant(p, true); n++; } });
      SS.toast(n ? `${n} satın alma geri yüklendi` : 'Geri yüklenecek satın alma yok'); SS.persist();
    },
  };
  SS.Ads = Ads; SS.IAP = IAP;
  if (!SS.HOOKS.purchase) SS.HOOKS.purchase = [];

  // perks of owned items
  SS.MODS.money.push(() => M.owned.noads ? 1.1 : 1);

  // ================================================================ monthly card
  const monthlyActive = () => (M.monthly.end || 0) > now();
  const monthlyClaimable = () => monthlyActive() && M.monthly.last !== today();
  function claimMonthly() {
    if (!monthlyClaimable()) return false;
    M.monthly.last = today(); const g = M.monthly.daily || 60; save.gems += g;
    SS.sfx('gem', 0); SS.toast(`Aylık Kart: +${g} elmas`); SS.persist(); SS.refreshUI(); return true;
  }

  // ================================================================ in-run placements
  // after a boss win: a small non-blocking card offers to double the gems with a rewarded ad
  function bossReward(gems) {
    if (!Ads.available('bossReward') || gems <= 0) return;
    const card = SS.el(`<div class="mz-card"><img src="assets/ui/gem.png" alt=""><b>+${gems}</b><span>Zafer elması</span>
      <button class="btn yellow"><img src="assets/ui/play.png" alt="">x2</button><i class="mz-t"></i></div>`);
    document.getElementById('ui').appendChild(card);
    let gone = false; const close = () => { if (gone) return; gone = true; card.classList.add('out'); setTimeout(() => card.remove(), 300); };
    const tm = setTimeout(close, 7000);
    card.querySelector('.btn').onclick = async () => {
      clearTimeout(tm); card.querySelector('.btn').classList.add('off');
      if (await Ads.show('bossReward')) { save.gems += gems; SS.toast(`+${gems} elmas daha!`); SS.sfx('gem', 0); SS.persist(); SS.refreshUI(); }
      close();
    };
  }
  // boss timer ran out: one +15 s continue per fight
  const tickets = () => (save.inv && save.inv.ticket) || 0;
  const canContinue = () => Ads.available('continue') || tickets() > 0;
  function offerContinue(cb) {
    SS.openPanel('Süre doldu!', 'red', body => {
      body.appendChild(SS.el(`<div class="big-num">+15 sn</div>`));
      const tk = tickets(), ad = Ads.available('continue');
      body.appendChild(SS.el(`<p class="big-note">Boss kaçmak üzere. ${tk ? `Boss Bileti kullan (${tk} adet)` : 'Bir reklam izle'}, 15 saniye daha savaş.</p>`));
      const row = SS.el(`<div class="btnrow"><button class="btn grey">Vazgeç</button>${tk ? '<button class="btn yellow tk"><img src="assets/ui/ic_shield.png" alt="">Bilet</button>' : ''}${ad ? `<button class="btn green ad"><img src="assets/ui/play.png" alt="">${Ads.noads() ? 'Devam' : 'İzle'}</button>` : ''}</div>`);
      let done = false; const fin = v => { if (done) return; done = true; SS.closePanel(); cb(v); };
      row.children[0].onclick = () => fin(false);
      const tb = row.querySelector('.tk'), ab = row.querySelector('.ad');
      if (tb) tb.onclick = () => { save.inv.ticket--; SS.persist(); fin(true); };
      if (ab) ab.onclick = async () => fin(await Ads.show('continue'));
      body.appendChild(row);
      // closing the panel any other way counts as "no"
      const watch = setInterval(() => { if (document.getElementById('panel').classList.contains('hidden')) { clearInterval(watch); fin(false); } }, 200);
    });
  }

  // ================================================================ offers (contextual, rate-limited, dismissible)
  const OFFER_GAP = DAY;   // at most one popup per day
  function offerOpen(id, opts = {}) {
    const p = P[id]; if (!p || !IAP.enabled) return;
    SS.openPanel(opts.title || 'Özel Teklif', 'red', body => {
      const until = M.offers[id] && M.offers[id].until;
      body.appendChild(SS.el(`<div class="mz-offer"><div class="mz-offer-ico"><img src="assets/ui/${opts.img || 'chest_open.png'}" alt=""></div>
        <h3>${p.title}</h3><p>${p.desc || ''}</p>${until ? `<p class="mz-timer">Kalan süre: <b data-until="${until}"></b></p>` : ''}</div>`));
      const b = SS.el(`<button class="btn yellow wide">${IAP.price(id)}</button>`);
      b.onclick = async () => { if (await IAP.buy(id)) { if (M.offers[id]) M.offers[id].bought = now(); SS.closePanel(); } };
      body.appendChild(b);
      const later = SS.el('<button class="btn grey wide">Belki sonra</button>'); later.onclick = () => SS.closePanel(); body.appendChild(later);
      body.appendChild(SS.el('<p class="mz-legal">Ödeme App Store / Google Play hesabından alınır. Rastgele ödül satılmaz.</p>'));
    });
  }
  function maybePopup(id, opts, hours) {
    if (!IAP.enabled || !document.getElementById('panel').classList.contains('hidden')) return false;
    if (now() - (M.lastPopup || 0) < OFFER_GAP) return false;
    const o = M.offers[id] = M.offers[id] || {};
    if (o.bought && now() - o.bought < 3 * DAY) return false;
    if (hours) o.until = now() + hours * 3600e3;
    o.shown = now(); M.lastPopup = now(); SS.persist();
    offerOpen(id, opts); return true;
  }
  const activeOffer = () => { const o = M.offers.ss_offer_power; return o && o.until > now() && !(o.bought && o.bought > o.shown) ? 'ss_offer_power' : null; };
  // triggers
  SS.HOOKS.bossFail = SS.HOOKS.bossFail || [];
  SS.HOOKS.bossFail.push(() => {
    if (save.stage >= 5 && SS.R.bossFails >= 2) setTimeout(() => maybePopup('ss_offer_power', { title: 'Güç Paketi', img: 'ic_power.png' }, 6), 2600);
  });
  SS.HOOKS.stage.push(() => {
    if (save.stage >= 3 && !M.owned.ss_starter && !(M.offers.ss_starter && M.offers.ss_starter.shown)) setTimeout(() => maybePopup('ss_starter', { title: 'Başlangıç Paketi', img: 'face_KnightGold.png' }), 1500);
  });

  // countdown labels inside open panels
  const fmtT = ms => { const s = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}`; };
  let tk = 0;
  SS.HOOKS.update.push(dt => { tk += dt; if (tk < 0.5) return; tk = 0; document.querySelectorAll('[data-until]').forEach(e => { e.textContent = fmtT(+e.dataset.until - now()); }); });

  SS.mon = { mode, platform, grant, bossReward, canContinue, offerContinue, offerOpen, activeOffer, monthlyActive, monthlyClaimable, claimMonthly, fmtT, M };

  // ================================================================ boot native SDKs
  if (mode === 'native') { AdMobN.init(); RevenueCatN.init(); }
})();
