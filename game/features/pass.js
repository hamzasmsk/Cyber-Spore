/* Shuriken Squad feature: "Ninja Yolu" — a 28-day season pass.
   XP from play (kills, elites, treasure, boss wins, first login of the day) fills 30 levels. Every level has a free
   reward; the premium track (one purchase per season, SS.IAP 'ss_pass') adds gems, x2 power and the pass-only
   "Usta" costume. Buying premium late still pays out every level already reached. */
'use strict';
(() => {
  const SS = window.SS;
  if (!SS) { console.warn('pass: SS missing'); return; }
  const save = SS.save, DAY = 864e5, SEASON_DAYS = 28, LEVELS = 30, XP_PER = 150;
  const EPOCH = Date.UTC(2026, 0, 5);
  const seasonNo = () => Math.floor((Date.now() - EPOCH) / (SEASON_DAYS * DAY)) + 1;
  const seasonEnd = () => EPOCH + seasonNo() * SEASON_DAYS * DAY;
  function st() {
    if (!save.pass || typeof save.pass !== 'object' || save.pass.season !== seasonNo())
      save.pass = { season: seasonNo(), xp: 0, free: {}, prem: {}, premium: false, login: '' };
    return save.pass;
  }
  const level = () => Math.min(LEVELS, Math.floor(st().xp / XP_PER));
  // reward tables (gold rewards scale with the current stage's income at claim time)
  const FREE = l => l % 5 === 0 ? { gems: 10 + l } : l % 2 === 1 ? { goldMin: 10 } : { gems: 3 };
  const PREM = l => l === 30 ? { skin: 'Master', gems: 100 } : l === 20 ? { boostMin: 120, gems: 20 } : l === 10 ? { boostMin: 60, gems: 20 }
    : l === 15 ? { gems: 80 } : l % 5 === 0 ? { gems: 40 + 2 * l } : { gems: 12 };
  const label = r => [r.skin ? 'Usta kostümü' : '', r.gems ? `${r.gems} elmas` : '', r.boostMin ? `${r.boostMin / 60} sa x2` : '', r.goldMin ? `${r.goldMin} dk altın` : ''].filter(Boolean).join(' + ');
  const icon = r => r.skin ? 'face_Master.png' : r.boostMin ? 'ic_boost.png' : r.goldMin ? 'coin.png' : 'gem.png';
  function give(r) {
    if (r.gems) save.gems += r.gems;
    if (r.goldMin) { const inc = SS.shop ? SS.shop.income() : 1; SS.addMoney(inc * r.goldMin * 60, SS.W / 2, SS.H / 2, 12); }
    if (r.boostMin) { const b = save.boost = save.boost || {}; b.adEnd = Math.max(Date.now(), b.adEnd || 0) + r.boostMin * 60000; b.adCd = Math.max(b.adCd || 0, b.adEnd); }
    if (r.skin) { save.skins = save.skins || {}; save.skins.owned = save.skins.owned || {}; save.skins.owned[r.skin] = true; }
  }
  function addXp(n) {
    const s = st(), before = level(); s.xp += n;
    if (level() > before) { SS.toast(`Ninja Yolu seviye ${level()}!`); SS.sfx('bonus', 0); paintDot(); }
  }
  SS.HOOKS.kill.push(e => addXp(e && e.treasure ? 10 : e && e.elite ? 4 : 1));
  SS.HOOKS.bossWin.push(() => addXp(40));
  { const s = st(), d = new Date().toISOString().slice(0, 10); if (s.login !== d) { s.login = d; s.xp += 60; } }

  const claimable = () => { const s = st(), L = level(); let n = 0; for (let l = 1; l <= L; l++) { if (!s.free[l]) n++; if (s.premium && !s.prem[l]) n++; } return n; };
  const btn = SS.addSideButton({ side: 'left', label: 'Ninja Yolu', icon: 'assets/ui/ic_orb.png', color: 'purple', id: 'passBtn', onClick: () => open() });
  function paintDot() { btn.classList.toggle('notify', claimable() > 0); }

  function claimAll() {
    const s = st(), L = level(); let n = 0;
    for (let l = 1; l <= L; l++) {
      if (!s.free[l]) { s.free[l] = 1; give(FREE(l)); n++; }
      if (s.premium && !s.prem[l]) { s.prem[l] = 1; give(PREM(l)); n++; }
    }
    if (n) { SS.sfx('gem', 0); SS.toast(`${n} ödül alındı`); SS.persist(); SS.refreshUI(); }
    paintDot(); return n;
  }
  function unlockPremium() { st().premium = true; SS.persist(); paintDot(); setTimeout(() => { claimAll(); if (!document.getElementById('panel').classList.contains('hidden')) open(); }, 300); }

  function open() {
    const s = st(), L = level(), IAP = SS.IAP;
    SS.openPanel('Ninja Yolu', 'purple', body => {
      const into = s.xp - L * XP_PER, pct = L >= LEVELS ? 100 : Math.round(into / XP_PER * 100);
      body.appendChild(SS.el(`<div class="ps-head"><div class="ps-lv"><b>${L}</b><small>/ ${LEVELS}</small></div>
        <div class="ps-info"><b>Sezon ${s.season}</b><span>Bitiş: <em>${(() => { const ms = seasonEnd() - Date.now(), d = Math.floor(ms / DAY), h = Math.floor(ms % DAY / 3600e3); return d > 0 ? `${d} gün ${h} sa` : `${h} sa`; })()}</em></span>
        <div class="pbar"><i style="width:${pct}%"></i><span>${L >= LEVELS ? 'TAMAM' : `${into} / ${XP_PER} XP`}</span></div></div></div>`));
      if (!s.premium && IAP && IAP.enabled) {
        const pb = SS.el(`<div class="row-card mz-hero"><div class="ico face"><img src="assets/ui/face_Master.png" alt=""></div>
          <div class="info"><h4>Premium yol</h4><p>${(IAP.product('ss_pass') || {}).desc || ''}</p><p class="mz-once">Ulaştığın seviyelerin ödülleri hemen gelir</p></div>
          <button class="btn yellow">${IAP.price('ss_pass')}</button></div>`);
        pb.querySelector('.btn').onclick = () => IAP.buy('ss_pass');
        body.appendChild(pb);
      }
      const cl = SS.el(`<button class="btn green wide ${claimable() ? '' : 'off'}">Hepsini al (${claimable()})</button>`);
      cl.onclick = () => { claimAll(); open(); };
      body.appendChild(cl);
      const list = SS.el('<div class="ps-list"></div>');
      for (let l = 1; l <= LEVELS; l++) {
        const f = FREE(l), p = PREM(l), reached = l <= L;
        const cell = (r, got, locked) => `<div class="ps-cell ${got ? 'got' : ''} ${locked ? 'locked' : ''} ${reached && !got && !locked ? 'ready' : ''}"><img src="assets/ui/${icon(r)}" alt=""><span>${label(r)}</span></div>`;
        list.appendChild(SS.el(`<div class="ps-row ${reached ? 'on' : ''}"><div class="ps-num">${l}</div>${cell(f, s.free[l])}${cell(p, s.prem[l], !s.premium)}</div>`));
      }
      body.appendChild(SS.el('<div class="ps-cols"><span></span><b>Ücretsiz</b><b class="pp">Premium</b></div>'));
      body.appendChild(list);
      body.appendChild(SS.el('<p class="big-note">XP: düşman +1 · elit +4 · hazine +10 · boss +40 · günün ilk girişi +60</p>'));
      paintDot();
    });
  }
  // the pass-only costume cannot be bought with gems
  if (SS.skins && SS.skins.byId) { const m = SS.skins.byId('Master'); if (m) m.pass = true; }
  paintDot();
  SS.pass = { open, unlockPremium, level, claimAll, addXp };
})();
