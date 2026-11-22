/* Shuriken Squad feature: Kule (tower) — an endless ladder of boss floors with a rule each.
   Floor difficulty is fixed (floor f ≈ stage 0.6·f), so the tower measures the squad's real strength and
   grows with every weapon, rebirth and Ruh Ağacı level. 3 attempts a day (a win costs nothing; a Boss Bileti
   buys one more). Every floor pays gems the first time; every 5th a Yıldız Taşı, every 10th is a guardian
   with a bigger chest. */
'use strict';
(() => {
  const SS = window.SS;
  if (!SS) { console.warn('tower: SS missing'); return; }
  const save = SS.save, TRIES = 3;
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
  if (!save.tower || typeof save.tower !== 'object') save.tower = { best: 0, day: '', used: 0 };
  const T = save.tower;
  const attempts = () => { if (T.day !== today()) { T.day = today(); T.used = 0; } return Math.max(0, TRIES - T.used); };
  const KEYS = Object.keys(SS.BOSSES);
  const RULES = [
    { id: 'normal', name: 'Sınav', txt: 'Kuralsız dövüş', icon: 'ic_weapon' },
    { id: 'rage', name: 'Öfke', txt: 'Boss baştan öfkeli', icon: 'ic_fire', rage: 1 },
    { id: 'fast', name: 'Çeviklik', txt: 'Boss %40 hızlı saldırır · can -%20', icon: 'ic_rate', spd: 1.4, hp: 0.8 },
    { id: 'horde', name: 'Kalabalık', txt: 'Boss sürekli asker çağırır', icon: 'ic_team', sig: ['summon', 'rain'] },
    { id: 'clock', name: 'Zamana Karşı', txt: '20 saniye · can -%30', icon: 'ic_moon', time: 20, hp: 0.7 },
    { id: 'giant', name: 'Dev', txt: 'Can +%60 · 40 saniye', icon: 'ic_shield', time: 40, hp: 1.6 },
  ];
  const GUARD = { id: 'guard', name: 'Muhafız', txt: 'Can x2 · öfkeli · 45 saniye', icon: 'ic_death', time: 45, hp: 2, rage: 1, spd: 1.15 };
  const rule = f => f % 10 === 0 ? GUARD : RULES[(f - 1) % RULES.length];
  const keyOf = f => KEYS[(f * 7 + Math.floor(f / 10) * 3) % KEYS.length];
  const hpOf = f => 10 * Math.pow(1.3, 3 * (f - 1)) * 22 * (rule(f).hp || 1);
  const rewardOf = f => ({ gems: 2 + Math.floor(f / 5) + (f % 10 === 0 ? 10 : 0), star: f % 10 === 0 ? 2 : f % 5 === 0 ? 1 : 0, ticket: f % 20 === 0 ? 1 : 0 });
  const rewTxt = r => [r.gems && `<span><img src="assets/ui/gem.png" alt="">${r.gems}</span>`, r.star && `<span><img src="assets/ui/ic_luck.png" alt="">${r.star}</span>`,
r.ticket && `<span><img src="assets/ui/ic_shield.png" alt="">${r.ticket}</span>`].filter(Boolean).join('');
  // rough difficulty from the squad's damage per second against the floor's HP and time limit
  const diff = f => { const dps = SS.dmgPerShot() * SS.fireRate() * Math.max(1, save.team) * SS.modMul('boss'), k = hpOf(f) / dps / (rule(f).time || 30);
    return k < 0.35 ? { t: 'Kolay', c: 'ez' } : k < 0.8 ? { t: 'Zorlu', c: 'md' } : k < 1.4 ? { t: 'Çok zor', c: 'hd' } : { t: 'İmkânsız gibi', c: 'no' }; };
  let inTower = false;
  const prevBusy = SS.busy; SS.busy = () => inTower || (prevBusy ? prevBusy() : false);

  function fight() {
    const f = T.best + 1, r = rule(f);
    if (SS.R.boss) { SS.toast('Önce bu boss dövüşünü bitir'); return; }
    if (SS.squad && SS.squad.ko > 0) { SS.toast('Takım toparlanıyor…'); return; }
    if (attempts() <= 0) {
      const inv = save.inv || {};
      if (inv.ticket > 0) { inv.ticket--; T.used--; SS.toast(`Boss Bileti kullanıldı · ${inv.ticket} kaldı`); }
      else { SS.sfx('no'); SS.toast('Bugünkü haklar bitti · yarın yenilenir'); return; }
    }
    SS.closePanel();
    inTower = true;
    const ok = SS.startBoss({ key: keyOf(f), hp: hpOf(f), time: r.time || 30, rage: !!r.rage, spd: r.spd || 1, sig: r.sig || null,
      sub: `Kule ${f}. kat · ${r.name}`, done: (won) => done(f, won) });
    if (!ok) { inTower = false; return; }
    SS.banner(`KULE · ${f}. KAT`, `${r.name}: ${r.txt}`);
  }
  function done(f, won) {
    inTower = false;
    if (won) {
      T.best = Math.max(T.best, f);
      const r = rewardOf(f), inv = save.inv = save.inv || {};
      save.gems += r.gems; for (const k of ['star', 'ticket']) if (r[k]) inv[k] = (inv[k] || 0) + r[k];
      SS.addMoney(SS.reward() * 12 * SS.moneyMul(), SS.W / 2, SS.H * 0.4, 10); setTimeout(() => SS.giveScroll(2), 1800);
      SS.banner(`${f}. KAT GEÇİLDİ!`, `+${r.gems} elmas${r.star ? ' · Yıldız Taşı' : ''}`);
      SS.HOOKS.tower && SS.HOOKS.tower.forEach(h => { try { h(f); } catch (e) { /* ignore */ } });
      setTimeout(() => { if (!SS.R.boss && document.getElementById('panel').classList.contains('hidden') && !document.querySelector('.pk-ov')) open(); }, 2600);
    } else {
      T.used++;
      SS.banner('KULE: YENİLDİN', attempts() ? `${attempts()} hak kaldı · güçlen ve tekrar dene` : 'Haklar yarın yenilenir');
    }
    SS.persist(); SS.refreshUI();
  }
  function open() {
    const f = T.best + 1, r = rule(f), a = attempts(), tk = (save.inv && save.inv.ticket) || 0;
    SS.openPanel('Kule', 'purple', body => {
      if (SS.hub) SS.hub.tabs(body, 'tower');
      body.appendChild(SS.el(`<div class="tw-head"><div><small>En yüksek kat</small><b>${T.best}</b></div><div><small>Bugünkü hak</small><span class="tw-dots">${[0, 1, 2].map(i => `<i class="${i < a ? 'on' : ''}"></i>`).join('')}</span></div>${tk ? `<div><small>Boss Bileti</small><b>${tk}</b></div>` : ''}</div>`));
      const card = SS.el(`<div class="tw-next ${f % 10 === 0 ? 'guard' : ''}"><div class="tw-floor"><small>KAT</small><b>${f}</b></div>
        <div class="tw-boss"><img src="assets/ui/boss_${keyOf(f)}.png" alt=""></div>
        <div class="tw-info"><h4>${SS.BOSSES[keyOf(f)].name}</h4><p class="tw-rule"><img src="assets/ui/${r.icon}.png" alt=""><b>${r.name}</b> ${r.txt}</p>
          <p class="tw-hp">Can ${SS.fmt(hpOf(f))} · ${r.time || 30} sn · <em class="${diff(f).c}">${diff(f).t}</em></p><div class="tw-rew">${rewTxt(rewardOf(f))}</div></div></div>`);
      body.appendChild(card);
      const busy = !!SS.R.boss;
      const b = SS.el(`<button class="btn ${a > 0 || tk ? 'purple' : 'grey off'} wide">${busy ? 'Boss dövüşü sürüyor' : a > 0 ? 'SAVAŞ' : tk ? 'Bilet ile SAVAŞ' : 'Haklar yarın yenilenir'}</button>`);
      if (busy) b.classList.add('off');
      b.onclick = () => { if (!busy) fight(); };
      body.appendChild(b);
      // the ladder ahead
      const list = SS.el('<div class="tw-list"></div>');
      for (let k = f + 1; k <= f + 6; k++) {
        const rk = rule(k);
        list.appendChild(SS.el(`<div class="tw-row ${k % 10 === 0 ? 'guard' : ''}"><b>${k}</b><img class="tw-face" src="assets/ui/boss_${keyOf(k)}.png" alt=""><span><img src="assets/ui/${rk.icon}.png" alt="">${rk.name}</span><div class="tw-rew">${rewTxt(rewardOf(k))}</div></div>`));
      }
      body.appendChild(list);
      body.appendChild(SS.el('<p class="big-note">Galibiyet hak harcamaz. Kat zorluğu sabittir: silah, Doğuş ve Ruh Ağacı ile güçlendikçe daha yükseğe çıkarsın.</p>'));
    });
  }
  SS.tower = { open, attempts, best: () => T.best, fight };
})();
