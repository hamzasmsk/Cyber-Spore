/* Swarm Squad feature: "Mağaza" — in-game currency exchange + free daily gift. No real-money purchases. */
(() => {
'use strict';
function boot() {
  const SS = window.SS; if (!SS || SS._shopB) return; SS._shopB = true;
  const save = SS.save;
  if (!save.shop || typeof save.shop !== 'object') save.shop = {};
  const S = save.shop;
  if (!(S.daily >= 0)) S.daily = 0;      // timestamp of last daily-gift claim
  if (!(S.streak >= 0)) S.streak = 0;
  const DAY = 24 * 3600 * 1000;

  // income per second: measured rate, or an estimate from current enemy HP (kill reward = maxHp*0.55*moneyMul)
  const income = () => Math.max(save.rate || 0, SS.enemyHp() * 0.55 * SS.moneyMul() * 1.2, 1);
  const PACKS = [
    { gems: 10, min: 30, name: 'Altın Kesesi', img: 'coin.png' },
    { gems: 35, min: 120, name: 'Altın Sandığı', img: 'chest.png', tag: '+%14' },
    { gems: 90, min: 360, name: 'Altın Hazinesi', img: 'chest_open.png', tag: '+%33' },
  ];
  const EXCH = [ { gems: 1, min: 15, img: 'gem.png' }, { gems: 5, min: 70, img: 'gem_big.png' } ];   // steep: ~15 min income per gem
  const dailyGems = () => 5 + Math.min(6, S.streak) * 1;
  const dailyMoney = () => income() * 15 * 60;
  const dailyReady = () => Date.now() - S.daily >= DAY;

  const fmtT = ms => { const s = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}`; };

  const btn = SS.addSideButton({ side: 'left', label: 'Mağaza', icon: 'assets/ui/ic_shop.png', color: 'yellow', id: 'shopBtn', onClick: open });
  btn.classList.add('fb-shop-btn');
  const dot = SS.el('<i class="dot hidden"></i>'); btn.appendChild(dot);
  const refreshBtn = () => { const r = dailyReady(); dot.classList.toggle('hidden', !r); };

  let live = null;
  function open() {
    SS.openPanel('Mağaza', 'yellow', body => {
      const root = SS.el('<div class="fb-shop"></div>');
      body.appendChild(root);
      root.appendChild(SS.el('<p class="fb-free-note">Tüm ürünler <b>oyun içi</b> altın ve elmasla alınır · gerçek para yok</p>'));

      // daily gift
      const gift = SS.el(`<div class="row-card fb-gift">
        <div class="ico fb-gift-box"><img src="assets/ui/chest.png" alt=""></div>
        <div class="info"><h4>Günlük Hediye</h4><p class="fb-gift-p"></p></div>
        <button class="btn green">AL</button></div>`);
      root.appendChild(gift);
      const gBtn = gift.querySelector('.btn');
      gBtn.onclick = () => {
        if (!dailyReady()) { SS.sfx('no'); return; }
        S.streak = (Date.now() - S.daily < 2 * DAY) ? S.streak + 1 : 1;
        const gm = dailyGems(), mo = dailyMoney();
        S.daily = Date.now();
        save.gems += gm; SS.addMoney(mo, SS.W / 2, SS.H / 2, 18);
        SS.sfx('win'); SS.banner('HEDİYE!', `+${gm} elmas · +${SS.fmt(mo)} altın`);
        SS.persist(); SS.refreshUI(); paint(); refreshBtn();
      };

      // gem -> money
      root.appendChild(SS.el('<h3 class="fb-sec"><img src="assets/ui/coin.png" alt="">Altın Paketleri</h3>'));
      const packRows = PACKS.map(p => {
        const row = SS.el(`<div class="row-card fb-pack"><div class="ico"><img src="assets/ui/${p.img}" alt=""></div>
          <div class="info"><h4>${p.name}${p.tag ? `<em class="fb-tag">${p.tag}</em>` : ''}</h4><p><b class="fb-amt"></b> · ${p.min >= 60 ? p.min / 60 + ' sa' : p.min + ' dk'} gelir</p></div>
          <button class="btn blue"><img src="assets/ui/gem.png" alt="">${p.gems}</button></div>`);
        row.querySelector('.btn').onclick = e => {
          if (save.gems < p.gems) { SS.sfx('no'); SS.toast('Yeterli elmas yok'); return; }
          const v = income() * p.min * 60;
          save.gems -= p.gems; SS.addMoney(v, SS.W / 2, SS.H * 0.45, 24);
          SS.sfx('buy'); SS.sfx('coin'); SS.toast(`+${SS.fmt(v)} altın!`);
          SS.persist(); SS.refreshUI(); paint();
        };
        root.appendChild(row); return { row, p };
      });

      // money -> gem
      root.appendChild(SS.el('<h3 class="fb-sec"><img src="assets/ui/gem.png" alt="">Elmas Takası</h3>'));
      const exRows = EXCH.map(x => {
        const row = SS.el(`<div class="row-card fb-pack"><div class="ico"><img src="assets/ui/${x.img}" alt=""></div>
          <div class="info"><h4>${x.gems} Elmas</h4><p>Pahalı takas · ${x.min} dk gelir</p></div>
          <button class="btn yellow"><img src="assets/ui/coin.png" alt=""><span></span></button></div>`);
        row.querySelector('.btn').onclick = () => {
          const c = income() * x.min * 60;
          if (save.money < c) { SS.sfx('no'); SS.toast('Yeterli altın yok'); return; }
          save.money -= c; save.gems += x.gems; SS.sfx('buy'); SS.toast(`+${x.gems} elmas!`);
          SS.persist(); SS.refreshUI(); paint();
        };
        root.appendChild(row); return { row, x };
      });

      function paint() {
        const r = dailyReady();
        gift.classList.toggle('ready', r); gift.classList.toggle('cur', r);
        gift.querySelector('.fb-gift-box img').src = 'assets/ui/' + (r ? 'chest.png' : 'chest_open.png');
        gBtn.className = 'btn ' + (r ? 'green pulse' : 'grey off');
        gBtn.textContent = r ? 'AL' : fmtT(S.daily + DAY - Date.now());
        gift.querySelector('.fb-gift-p').innerHTML = `<img src="assets/ui/gem.png" alt="">${dailyGems()} + <img src="assets/ui/coin.png" alt="">${SS.fmt(dailyMoney())}${S.streak > 0 ? ` · seri ${S.streak}` : ''}`;
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
  SS.shop = { open, income };
}
if (window.SS) boot(); else window.addEventListener('load', boot);
})();
