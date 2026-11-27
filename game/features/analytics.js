/* Shuriken Squad — analytics (GameAnalytics JavaScript SDK, vendor/GameAnalytics.min.js, MIT).
   What it answers: how many players come back (day 1 / 7 / 30, automatic from sessions), where they stop
   (boss progression per stage), which systems they find (first opening of every menu, goals), what they buy and
   which rewarded ads they watch. Nothing personal is sent: GameAnalytics uses a random install id.
   Off in web previews and tests (analytics.config.js: enabled 'native'); a player can turn it off in Ayarlar.
   Every call goes through send(), so a missing SDK or a network error never touches the game. */
'use strict';
(() => {
  const SS = window.SS, C = window.SS_ANALYTICS || {};
  if (!SS) return;
  const save = SS.save;
  const native = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  const forced = /[?&]ga=1\b/.test(location.search);
  const wanted = C.enabled === 'always' || (C.enabled === 'native' && native) || forced;
  const optOut = () => save.noTrack === true;
  const GA = window.gameanalytics && window.gameanalytics.GameAnalytics;
  const E = window.gameanalytics || {};
  let ready = false;
  const log = [];   // last events (visible in the test panel / tests even when nothing is sent)
  function send(kind, ...args) {
    log.push([kind, ...args]); if (log.length > 60) log.shift();
    if (!ready || optOut()) return;
    try { GA[kind](...args); } catch (e) { /* never break the game for analytics */ }
  }
  if (wanted && GA && C.gameKey && C.secretKey) {
    try {
      GA.setEnabledInfoLog(forced);
      GA.configureBuild(`${native ? 'android' : 'web'} ${window.SS_VERSION || '1.0'}`);
      GA.configureAvailableCustomDimensions01(['tr', 'en']);
      GA.configureAvailableCustomDimensions02(['free', 'payer']);
      GA.configureAvailableResourceCurrencies(['gems']);
      GA.configureAvailableResourceItemTypes(['weapon', 'star', 'skin', 'fxskin', 'shop', 'boss', 'purchase', 'ad', 'reward']);
      GA.setCustomDimension01(save.lang === 'en' ? 'en' : 'tr');
      GA.setCustomDimension02(save.mon && save.mon.log && save.mon.log.length ? 'payer' : 'free');
      GA.initialize(C.gameKey, C.secretKey);
      GA.setEnabledEventSubmission(!optOut());
      ready = true;
    } catch (e) { ready = false; }
  }
  const P = E.EGAProgressionStatus || { Start: 1, Complete: 2, Fail: 3 };
  const pad = n => String(n).padStart(3, '0');
  const H = SS.HOOKS;

  // ---------------- progression: every main boss attempt (where do players get stuck?)
  H.bossStart.push(b => { if (b && !b.ex) send('addProgressionEvent', P.Start, 'stage', pad(save.stage)); });
  H.bossWin.push(() => send('addProgressionEvent', P.Complete, 'stage', pad(save.stage)));
  H.bossFail.push(() => send('addProgressionEvent', P.Fail, 'stage', pad(save.stage)));
  H.tower && H.tower.push(f => send('addDesignEvent', 'Tower:Floor', f));
  H.rebirth.push(gain => send('addDesignEvent', 'Rebirth:Done', (save.rebirths || 0) + 1, { stage: save.stage, gain }));
  H.ko.push(() => send('addDesignEvent', 'Squad:KO', save.stage));
  H.perk && H.perk.push(p => send('addDesignEvent', `Perk:${(p && p.id) || 'x'}`));
  H.star && H.star.push(() => send('addDesignEvent', `Weapon:Star:${save.gun}`, save.wstar[save.gun] || 1));

  // ---------------- first opening of each menu, goals, weapons (do players find the systems?)
  const seen = save.gaSeen = save.gaSeen || {};
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('#ui .sbtn, #settingsTop'); if (!b || b.classList.contains('m-lock')) return;
    const k = b.id || b.dataset.open; if (!k || seen[k]) return;
    seen[k] = 1; send('addDesignEvent', `Menu:First:${k}`, save.best || 1);
  }, true);
  let goals = Object.keys((save.goals && save.goals.done) || {}).length;
  let wbest = save.wbest || 0, best = save.best || 1;
  setInterval(() => {
    const g = save.goals && save.goals.done ? Object.keys(save.goals.done) : [];
    if (g.length > goals) { goals = g.length; send('addDesignEvent', `Goal:${g[g.length - 1]}`, save.best || 1); }
    if ((save.wbest || 0) > wbest) { wbest = save.wbest; send('addDesignEvent', `Weapon:Unlock:${wbest}`, save.best || 1); }
    if ((save.best || 1) > best) { best = save.best; if (best % 5 === 0) send('addDesignEvent', 'Stage:Best', best); }
  }, 2000);

  // ---------------- money: purchases and rewarded ads
  H.purchase.push(p => {
    if (!p) return;
    const usd = parseFloat(String(p.usd || '').replace(/[^0-9.]/g, '')) || 0;
    send('addBusinessEvent', 'USD', Math.round(usd * 100), p.kind || 'item', p.id, 'shop');
    if (p.gems) send('addResourceEvent', (E.EGAResourceFlowType || {}).Source || 1, 'gems', p.gems, 'purchase', p.id);
    if (ready && GA) try { GA.setCustomDimension02('payer'); } catch (e) { /* ignore */ }
  });
  const wrapAds = () => {
    const A = SS.Ads; if (!A || A.__ga) return; A.__ga = true;
    const show = A.show.bind(A);
    A.show = async pl => {
      const ok = await show(pl);
      const T = E.EGAAdType || { RewardedVideo: 2 }, Ac = E.EGAAdAction || { RewardReceived: 4, FailedShow: 3 };
      send('addAdEvent', ok ? Ac.RewardReceived : Ac.FailedShow, T.RewardedVideo, 'admob', String(pl || 'reward'));
      return ok;
    };
  };
  wrapAds(); setTimeout(wrapAds, 0);
  // offers shown (does a popup lead to a purchase?)
  const offers = save.mon && save.mon.offers;
  if (offers) { const shown = {}; for (const k in offers) shown[k] = offers[k].shown; setInterval(() => { for (const k in offers) if (offers[k].shown && offers[k].shown !== shown[k]) { shown[k] = offers[k].shown; send('addDesignEvent', `Offer:Show:${k}`, save.best || 1); } }, 3000); }

  // ---------------- player choice: Ayarlar → "Analiz verisi" toggle
  new MutationObserver(() => {
    if (document.getElementById('pTitle').dataset.k !== 'Ayarlar') return;
    const w = document.querySelector('#pBody .fa-mwrap'); if (!w || w.querySelector('.ga-opt')) return;
    const on = !optOut();
    const paint = r => { const v = !optOut(); r.classList.toggle('on', v); r.querySelector('em').textContent = SS.t ? SS.t(v ? 'AÇIK' : 'KAPALI') : (v ? 'AÇIK' : 'KAPALI'); };
    const row = SS.el(`<button class="toggle fa-toggle ga-opt ${on ? 'on' : ''}"><img src="assets/ui/ic_chart.png" alt=""><span>Anonim kullanım verisi<small>Oyunu geliştirmemize yardım eder · kişisel veri yok</small></span><em></em><b></b></button>`);
    paint(row);
    row.onclick = () => { save.noTrack = !optOut(); if (ready) try { GA.setEnabledEventSubmission(!save.noTrack); } catch (e) { /* ignore */ } SS.persist(); paint(row); SS.sfx('click'); };
    const tg = w.querySelector('.toggles'); (tg || w).appendChild(row);
  }).observe(document.getElementById('pBody'), { childList: true });

  // ---------------- balance: how long each stage takes, where the gold goes, which cards are offered vs. taken
  // Stage:Time:<stage> = minutes of play (app in front) from reaching the previous best stage to this one
  const K = () => save.rank || {};
  let stBest = save.best || 1, stAt = K().play || 0;
  setInterval(() => {
    const b = save.best || 1;
    if (b > stBest) { const now = K().play || 0; if (b <= 60) send('addDesignEvent', `Stage:Time:${pad(b)}`, Math.round((now - stAt) / 6) / 10); stBest = b; stAt = now; }
  }, 2000);
  // Upgrade:<power|speed|money> every 10 levels bought, value = stage (which upgrades players lean on, and when)
  H.buy && H.buy.push(k => { const lv = save.lv && save.lv[k]; if (lv && lv % 10 === 0) send('addDesignEvent', `Upgrade:${k}`, save.stage); });
  // Boss:Time:<stage> = seconds a won fight took (how close the timer was)
  let bossT0 = 0; H.bossStart.push(b => { if (b && !b.ex) bossT0 = SS.R.t; });
  H.bossWin.push(() => { if (bossT0) send('addDesignEvent', `Boss:Time:${pad(save.stage)}`, Math.round(SS.R.t - bossT0)); bossT0 = 0; });
  // Perk:Offer:<id> for every card shown (pick rate = Perk:<id> / Perk:Offer:<id>)
  if (SS.perks) new MutationObserver(() => {
    const ov = document.querySelector('#ui .pk-ov .pk-row'); if (!ov || ov.dataset.ga) return; ov.dataset.ga = '1';
    for (const c of ov.querySelectorAll('.pk-card[data-id]')) send('addDesignEvent', `Perk:Offer:${c.dataset.id}`);
  }).observe(document.getElementById('ui'), { childList: true });

  // ---------------- Remote Configs: re-balance without a new release (game.js TUNE, store/DENGE.md)
  // keys "tune_<name>" with a number; the values are clamped to a safe range in game.js setTune and remembered in
  // save.tune so the next start uses them from the first second
  function pullTune() {
    if (!ready || !GA || !GA.isRemoteConfigsReady || !GA.isRemoteConfigsReady()) return;
    const o = {};
    for (const k in SS.TUNE_DEF || {}) {
      let v = null; try { v = GA.getRemoteConfigsValueAsString('tune_' + k, ''); } catch (e) { v = null; }
      if (v !== null && v !== '' && isFinite(+v)) o[k] = +v;
    }
    // keys removed from the dashboard fall back to the built-in value
    const full = { ...SS.TUNE_DEF, ...o }, ch = SS.setTune(full);
    save.tune = o; SS.persist && SS.persist();
    if (ch.length) send('addDesignEvent', 'Tune:Applied', ch.length);
  }
  if (ready && GA && GA.addRemoteConfigsListener) {
    try { GA.addRemoteConfigsListener({ onRemoteConfigsUpdated: pullTune }); } catch (e) { /* ignore */ }
    setTimeout(pullTune, 4000);
  }

  SS.analytics = { get ready() { return ready; }, log, send, pullTune };
})();
