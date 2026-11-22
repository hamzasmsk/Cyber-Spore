/* Shuriken Squad feature: "Mağaza".
   Real-money items (through SS.IAP, see features/monetize.js) + free rewards (daily gift, rewarded-ad gems,
   monthly-card daily claim) + in-game exchanges (gems -> gold packs, gold -> gems).
   Order follows value for the player: offer, starter, free things, gems, monthly card, no-ads, exchanges. */
(() => {
'use strict';
function boot() {
  const SS = window.SS; if (!SS || SS._shopB) return; SS._shopB = true;
  const save = SS.save;
  if (!save.shop || typeof save.shop !== 'object') save.shop = {};
  const S = save.shop;
  if (!(S.daily >= 0)) S.daily = 0;
  if (!(S.streak >= 0)) S.streak = 0;
  const DAY = 24 * 3600 * 1000;
  const IAP = SS.IAP, Ads = SS.Ads, mon = SS.mon;
  const paid = !!(IAP && IAP.enabled);

  const income = () => Math.max(Math.min(save.rate || 0, SS.reward() * 0.5 * SS.moneyMul() * 8), SS.reward() * 0.5 * SS.moneyMul() * 0.6, 1);   // ~gold per second, from the reward curve
  const PACKS = [
    { gems: 10, min: 30, name: 'Altın Kesesi', img: 'coin.png' },
    { gems: 35, min: 120, name: 'Altın Sandığı', img: 'chest.png', tag: '+%14' },
    { gems: 90, min: 360, name: 'Altın Hazinesi', img: 'chest_open.png', tag: '+%33' },
  ];
  const EXCH = [{ gems: 1, min: 15, img: 'gem.png' }, { gems: 5, min: 70, img: 'gem_big.png' }];
  const dailyGems = () => 5 + Math.min(6, S.streak);
  const dailyMoney = () => income() * 15 * 60;
  const dailyReady = () => Date.now() - S.daily >= DAY;
  const fmtT = ms => { const s = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}`; };

  const btn = SS.addSideButton({ side: 'right', label: 'Mağaza', icon: 'assets/ui/ic_shop.png', color: 'yellow', id: 'shopBtn', onClick: () => open() });
  const somethingFree = () => dailyReady() || (mon && mon.monthlyClaimable()) || (Ads && Ads.available('freeGems'));
  const refreshBtn = () => btn.classList.toggle('notify', !!(dailyReady() || (mon && mon.monthlyClaimable()) || (mon && mon.activeOffer())));

  const sec = (title, img) => SS.el(`<h3 class="fb-sec"><img src="assets/ui/${img}" alt="">${title}</h3>`);
  const buyBtn = (id, cls = 'yellow') => `<button class="btn ${cls} mz-buy" data-sku="${id}">${IAP.price(id)}</button>`;
  function wireBuys(root) {
    root.querySelectorAll('.mz-buy').forEach(b => b.onclick = async () => { if (await IAP.buy(b.dataset.sku)) open(); });
  }

  let live = null;
  function open() {
    SS.openPanel('Mağaza', 'yellow', body => {
      const root = SS.el('<div class="fb-shop"></div>'); body.appendChild(root);

      if (paid) {
        // contextual offer (time-limited) and the one-time starter pack
        const off = mon.activeOffer();
        if (off) {
          const p = IAP.product(off);
          root.appendChild(SS.el(`<div class="row-card mz-hero mz-offer-row"><div class="ico tile"><img src="assets/ui/ic_power.png" alt=""></div>
            <div class="info"><h4>${p.title}<em class="fb-tag">SÜRELİ</em></h4><p>${p.desc}</p><p class="mz-timer"><b data-until="${save.mon.offers[off].until}"></b></p></div>${buyBtn(off)}</div>`));
        }
        if (!IAP.owns('ss_starter')) {
          const p = IAP.product('ss_starter');
          root.appendChild(SS.el(`<div class="row-card mz-hero"><div class="ico face"><img src="assets/ui/face_KnightGold.png" alt=""></div>
            <div class="info"><h4>${p.title}<em class="fb-tag">x4 DEĞER</em></h4><p>${p.desc}</p><p class="mz-once">Tek seferlik</p></div>${buyBtn('ss_starter')}</div>`));
        }
      }

      // free things
      root.appendChild(sec('Ücretsiz', 'chest.png'));
      const gift = SS.el(`<div class="row-card fb-gift"><div class="ico fb-gift-box"><img src="assets/ui/chest.png" alt=""></div>
        <div class="info"><h4>Günlük Hediye</h4><p class="fb-gift-p"></p></div><button class="btn green">AL</button></div>`);
      root.appendChild(gift);
      const gBtn = gift.querySelector('.btn');
      gBtn.onclick = () => {
        if (!dailyReady()) { SS.sfx('no'); return; }
        S.streak = (Date.now() - S.daily < 2 * DAY) ? S.streak + 1 : 1;
        const gm = dailyGems(), mo = dailyMoney();
        S.daily = Date.now(); save.gems += gm; SS.addMoney(mo, SS.W / 2, SS.H / 2, 18);
        SS.sfx('win'); SS.banner('HEDİYE!', `+${gm} elmas · +${SS.fmt(mo)} altın`);
        SS.persist(); SS.refreshUI(); paint(); refreshBtn();
      };
      let adRow = null, mRow = null;
      if (Ads && Ads.enabled) {
        const g = 3;
        adRow = SS.el(`<div class="row-card"><div class="ico tile"><img src="assets/ui/play.png" alt=""></div>
          <div class="info"><h4>Reklam izle, elmas al</h4><p class="mz-ad-p"></p></div><button class="btn yellow"><img src="assets/ui/gem.png" alt="">+${g}</button></div>`);
        adRow.querySelector('.btn').onclick = async () => { if (await Ads.show('freeGems')) { save.gems += g; SS.sfx('gem', 0); SS.toast(`+${g} elmas`); SS.persist(); SS.refreshUI(); } paint(); };
        root.appendChild(adRow);
      }
      if (paid && mon.monthlyActive()) {
        mRow = SS.el(`<div class="row-card mz-month-on"><div class="ico tile"><img src="assets/ui/ic_moon.png" alt=""></div>
          <div class="info"><h4>Aylık Kart</h4><p class="mz-m-p"></p></div><button class="btn green"><img src="assets/ui/gem.png" alt="">+${save.mon.monthly.daily || 60}</button></div>`);
        mRow.querySelector('.btn').onclick = () => { mon.claimMonthly(); paint(); refreshBtn(); };
        root.appendChild(mRow);
      }

      if (paid) {
        root.appendChild(sec('Elmas', 'gem.png'));
        ['ss_gems_1', 'ss_gems_2', 'ss_gems_3', 'ss_gems_4', 'ss_gems_5'].forEach(id => {
          const p = IAP.product(id); if (!p) return;
          root.appendChild(SS.el(`<div class="row-card fb-pack ${id === 'ss_gems_5' ? 'mz-best' : ''}"><div class="ico"><img src="assets/ui/${p.img}" alt=""></div>
            <div class="info"><h4>${SS.fmt(p.gems)} elmas${p.tag ? `<em class="fb-tag">${p.tag}</em>` : ''}</h4><p>${p.title}</p></div>${buyBtn(id, 'blue')}</div>`));
        });
        root.appendChild(sec('Paketler', 'cup.png'));
        if (!mon.monthlyActive()) {
          const p = IAP.product('ss_monthly');
          root.appendChild(SS.el(`<div class="row-card"><div class="ico tile"><img src="assets/ui/ic_moon.png" alt=""></div>
            <div class="info"><h4>${p.title}<em class="fb-tag">x5 DEĞER</em></h4><p>${p.desc}</p></div>${buyBtn('ss_monthly')}</div>`));
        }
        if (!IAP.owns('ss_noads')) {
          const p = IAP.product('ss_noads');
          root.appendChild(SS.el(`<div class="row-card"><div class="ico tile"><img src="assets/ui/ic_vision.png" alt=""></div>
            <div class="info"><h4>${p.title}</h4><p>${p.desc}</p><p class="mz-once">Kalıcı</p></div>${buyBtn('ss_noads')}</div>`));
        } else root.appendChild(SS.el('<div class="row-card cur"><div class="ico tile"><img src="assets/ui/ic_vision.png" alt=""></div><div class="info"><h4>Reklamsız</h4><p>Aktif · ödüller anında · +%10 altın</p></div></div>'));
      }

      // in-game exchanges
      root.appendChild(sec('Altın Paketleri', 'coin.png'));
      const packRows = PACKS.map(p => {
        const row = SS.el(`<div class="row-card fb-pack"><div class="ico"><img src="assets/ui/${p.img}" alt=""></div>
          <div class="info"><h4>${p.name}${p.tag ? `<em class="fb-tag">${p.tag}</em>` : ''}</h4><p><b class="fb-amt"></b> · ${p.min >= 60 ? p.min / 60 + ' sa' : p.min + ' dk'} gelir</p></div>
          <button class="btn blue"><img src="assets/ui/gem.png" alt="">${p.gems}</button></div>`);
        row.querySelector('.btn').onclick = () => {
          if (save.gems < p.gems) { SS.sfx('no'); SS.toast('Yeterli elmas yok'); return; }
          const v = income() * p.min * 60; save.gems -= p.gems; SS.addMoney(v, SS.W / 2, SS.H * 0.45, 24);
          SS.sfx('buy'); SS.toast(`+${SS.fmt(v)} altın!`); SS.persist(); SS.refreshUI(); paint();
        };
        root.appendChild(row); return { row, p };
      });
      root.appendChild(sec('Elmas Takası', 'gem.png'));
      const exRows = EXCH.map(x => {
        const row = SS.el(`<div class="row-card fb-pack"><div class="ico"><img src="assets/ui/${x.img}" alt=""></div>
          <div class="info"><h4>${x.gems} Elmas</h4><p>${x.min} dk gelir</p></div>
          <button class="btn yellow"><img src="assets/ui/coin.png" alt=""><span></span></button></div>`);
        row.querySelector('.btn').onclick = () => {
          const c = income() * x.min * 60;
          if (save.money < c) { SS.sfx('no'); SS.toast('Yeterli altın yok'); return; }
          save.money -= c; save.gems += x.gems; SS.sfx('buy'); SS.toast(`+${x.gems} elmas!`); SS.persist(); SS.refreshUI(); paint();
        };
        root.appendChild(row); return { row, x };
      });

      if (paid) {
        const rs = SS.el('<button class="btn grey wide mz-restore">Satın almaları geri yükle</button>');
        rs.onclick = () => IAP.restore().then(() => open());
        root.appendChild(rs);
        root.appendChild(SS.el(`<p class="mz-legal">Ödemeler App Store / Google Play hesabından alınır. Rastgele ödül (sandık/loot box) satılmaz; her ürünün içeriği yazılıdır.${mon.mode === 'test' ? ' <b>TEST MODU</b>: gerçek ödeme alınmaz.' : ''}</p>`));
        wireBuys(root);
      }

      function paint() {
        const r = dailyReady();
        gift.classList.toggle('cur', r);
        gift.querySelector('.fb-gift-box img').src = 'assets/ui/' + (r ? 'chest.png' : 'chest_open.png');
        gBtn.className = 'btn ' + (r ? 'green' : 'grey off');
        gBtn.textContent = r ? 'AL' : fmtT(S.daily + DAY - Date.now());
        gift.querySelector('.fb-gift-p').innerHTML = `${dailyGems()} elmas + ${SS.fmt(dailyMoney())} altın${S.streak > 0 ? ` · seri ${S.streak}` : ''}`;
        if (adRow) { const left = Ads.remaining('freeGems'); adRow.querySelector('.mz-ad-p').textContent = Ads.noads() ? `Reklamsız: anında · bugün ${left} hak` : `Bugün ${left} hak kaldı`; adRow.querySelector('.btn').classList.toggle('off', left <= 0); }
        if (mRow) { const can = mon.monthlyClaimable(), left = Math.ceil((save.mon.monthly.end - Date.now()) / DAY); mRow.querySelector('.mz-m-p').textContent = `${left} gün kaldı · ${can ? 'bugünkü elmasın hazır' : 'yarın tekrar gel'}`; mRow.querySelector('.btn').className = 'btn ' + (can ? 'green' : 'grey off'); }
        packRows.forEach(({ row, p }) => { row.querySelector('.fb-amt').textContent = '+' + SS.fmt(income() * p.min * 60); row.querySelector('.btn').classList.toggle('cant', save.gems < p.gems); });
        exRows.forEach(({ row, x }) => { const c = income() * x.min * 60; row.querySelector('.btn span').textContent = SS.fmt(c); row.querySelector('.btn').classList.toggle('cant', save.money < c); });
      }
      paint();
      live = { body, paint };
    });
  }

  let acc = 0;
  SS.HOOKS.update.push(dt => {
    acc += dt; if (acc < 0.5) return; acc = 0;
    refreshBtn();
    if (live) { if (!document.getElementById('panel').classList.contains('hidden') && live.body.querySelector('.fb-shop')) live.paint(); else live = null; }
  });
  refreshBtn();
  SS.shop = { open, income, somethingFree };
}
if (window.SS) boot(); else window.addEventListener('load', boot);
})();
