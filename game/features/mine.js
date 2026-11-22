/* Swarm Squad feature: "Maden" — idle gem mine (works offline via timestamps in save.mine). */
(() => {
'use strict';
function boot() {
  const SS = window.SS; if (!SS || SS._mineB) return; SS._mineB = true;
  const save = SS.save;
  const MAX_LV = 20;
  if (!save.mine || typeof save.mine !== 'object') save.mine = {};
  const M = save.mine;
  if (!(M.lv >= 1)) M.lv = 1;
  if (!(M.stored >= 0)) M.stored = 0;
  if (!(M.t > 0)) M.t = Date.now();

  // gems per hour, storage cap (hours of production), upgrade cost (scales with stage)
  const perHour = lv => 2 * Math.pow(1.15, lv - 1);            // lv1: 2 gems / hour (balanced against the gem economy)
  const capOf = lv => Math.max(16, Math.floor(perHour(lv) * 8)); // 8 hours of storage: one collection a night is enough
  const costOf = lv => (SS.reward ? SS.reward() : SS.enemyHp()) * 45 * Math.pow(2.05, lv - 1);

  function accrue() {
    const now = Date.now(), dt = Math.max(0, now - (M.t || now)) / 3.6e6;
    M.stored = Math.min(capOf(M.lv), M.stored + dt * perHour(M.lv));
    M.t = now;
  }
  accrue();

  const fmtT = s => { s = Math.max(0, Math.ceil(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
    return h ? `${h}sa ${String(m).padStart(2, '0')}dk` : `${m}dk ${String(x).padStart(2, '0')}sn`; };

  // ---------- side button
  const btn = SS.addSideButton({ side: 'right', label: 'Maden', icon: 'assets/ui/ic_mine.png', color: 'blue', id: 'mineBtn', onClick: open });
  btn.classList.add('fb-mine-btn');
  const badge = SS.el('<em class="fb-badge hidden">0</em>');
  btn.appendChild(badge);
  let lastBadge = '';
  function refreshBtn() {
    const n = Math.floor(M.stored), full = M.stored >= capOf(M.lv) - 1e-6;
    const key = n + '|' + full;
    if (key === lastBadge) return; lastBadge = key;
    badge.textContent = n; badge.classList.toggle('hidden', n < 1);
    btn.classList.toggle('ready', full);
  }

  // ---------- panel
  let live = null;
  function open() {
    accrue();
    SS.openPanel('Elmas Madeni', 'blue', body => {
      const wrap = SS.el(`<div class="fb-mine">
        <div class="fb-mine-scene">
          <img class="fb-mcry c1" src="assets/ui/crystal.png" alt=""><img class="fb-mcry c2" src="assets/ui/crystal.png" alt="">
          <img class="fb-pick" src="assets/ui/ic_mine.png" alt="">
          <img class="fb-mgem g1" src="assets/ui/gem.png" alt=""><img class="fb-mgem g2" src="assets/ui/gem.png" alt=""><img class="fb-mgem g3" src="assets/ui/gem.png" alt="">
          <div class="fb-lv">Sv.<b></b></div>
        </div>
        <div class="fb-store"><img src="assets/ui/gem.png" alt=""><b class="fb-stored">0</b><small class="fb-cap">/ 0</small></div>
        <div class="fb-bar"><i></i><span class="fb-next"></span></div>
        <div class="fb-stats"><div><small>Üretim</small><b class="fb-rate"></b></div><div><small>Depo</small><b class="fb-capv"></b></div><div><small>Doluluk</small><b class="fb-full"></b></div></div>
      </div>`);
      body.appendChild(wrap);
      body.appendChild(SS.el('<p class="big-note">Maden sen oyunda olmasan da elmas kazar. Depo dolunca üretim durur, sık sık topla!</p>'));
      const collect = SS.el('<button class="btn green wide"><img src="assets/ui/gem.png" alt="">TOPLA</button>');
      const up = SS.el('<div class="row-card fb-up"><div class="ico"><img src="assets/ui/ic_boost.png" alt=""></div><div class="info"><h4>Madeni Geliştir</h4><p class="fb-upinfo"></p></div><button class="btn yellow"><img src="assets/ui/coin.png" alt=""><span>0</span></button></div>');
      body.appendChild(collect); body.appendChild(up);
      const upBtn = up.querySelector('.btn');
      collect.onclick = () => {
        accrue();
        const n = Math.floor(M.stored);
        if (n < 1) { SS.sfx('no'); SS.toast('Henüz elmas yok'); return; }
        M.stored -= n; SS.save.gems += n; SS.sfx('win'); SS.toast(`+${n} elmas toplandı!`);
        burst(wrap.querySelector('.fb-store'), n);
        SS.persist(); SS.refreshUI(); paint();
      };
      upBtn.onclick = () => {
        if (M.lv >= MAX_LV) return;
        const c = costOf(M.lv);
        if (SS.save.money < c) { SS.sfx('no'); SS.toast('Yeterli altın yok'); return; }
        accrue();
        SS.save.money -= c; M.lv++; SS.sfx('buy'); SS.toast(`Maden seviye ${M.lv}!`);
        wrap.querySelector('.fb-mine-scene').classList.remove('lvup'); void wrap.offsetWidth; wrap.querySelector('.fb-mine-scene').classList.add('lvup');
        SS.persist(); SS.refreshUI(); paint();
      };
      const q = s => wrap.querySelector(s);
      function paint() {
        accrue();
        const cap = capOf(M.lv), ph = perHour(M.lv), full = M.stored >= cap - 1e-6;
        const frac = M.stored - Math.floor(M.stored);
        q('.fb-lv b').textContent = M.lv;
        q('.fb-stored').textContent = Math.floor(M.stored);
        q('.fb-cap').textContent = '/ ' + cap;
        q('.fb-bar i').style.width = (full ? 100 : frac * 100) + '%';
        q('.fb-next').textContent = full ? 'DEPO DOLU!' : 'Sonraki elmas: ' + fmtT((1 - frac) / ph * 3600);
        q('.fb-rate').textContent = (ph >= 10 ? Math.round(ph) : ph.toFixed(1)) + '/sa';
        q('.fb-capv').textContent = cap;
        q('.fb-full').textContent = full ? 'DOLU' : fmtT((cap - M.stored) / ph * 3600);
        wrap.classList.toggle('full', full);
        collect.classList.toggle('off', M.stored < 1);
        collect.classList.toggle('pulse', full);
        if (M.lv >= MAX_LV) {
          up.querySelector('.fb-upinfo').textContent = 'Maksimum seviye';
          upBtn.className = 'btn grey off'; upBtn.innerHTML = 'MAKS';
        } else {
          const c = costOf(M.lv), nph = perHour(M.lv + 1);
          up.querySelector('.fb-upinfo').textContent = `Sv.${M.lv + 1}: ${nph >= 10 ? Math.round(nph) : nph.toFixed(1)}/sa · depo ${capOf(M.lv + 1)}`;
          upBtn.querySelector('span').textContent = SS.fmt(c);
          upBtn.classList.toggle('cant', SS.save.money < c);
        }
      }
      paint();
      live = { body, paint };
    });
  }
  function burst(anchor, n) {
    const r = anchor.getBoundingClientRect();
    for (let i = 0; i < Math.min(12, n + 3); i++) {
      const g = SS.el('<img class="fb-fly" src="assets/ui/gem.png" alt="">');
      g.style.left = (r.left + r.width / 2) + 'px'; g.style.top = (r.top + r.height / 2) + 'px';
      g.style.setProperty('--dx', (Math.random() * 160 - 80) + 'px'); g.style.setProperty('--dy', (-60 - Math.random() * 90) + 'px');
      g.style.animationDelay = (i * 0.03) + 's';
      document.body.appendChild(g); setTimeout(() => g.remove(), 1100);
    }
  }

  // ---------- ticking (cheap: once per 0.25s)
  let acc = 0;
  SS.HOOKS.update.push(dt => {
    acc += dt; if (acc < 0.25) return; acc = 0;
    accrue(); refreshBtn();
    if (live) { if (live.body.isConnected && !document.getElementById('panel').classList.contains('hidden') && live.body.querySelector('.fb-mine')) live.paint(); else live = null; }
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { accrue(); refreshBtn(); } });
  refreshBtn();
  SS.mine = { open, accrue, perHour, capOf, costOf };
}
if (window.SS) boot(); else window.addEventListener('load', boot);
})();
