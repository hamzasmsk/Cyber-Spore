/* Shuriken Squad feature: Başarımlar — long-term goals in tiers. Each claimed tier pays gems once and adds a
   permanent +2% damage (shown at the top), so even old goals keep mattering. Counters live in save.stats. */
'use strict';
(() => {
  const SS = window.SS;
  if (!SS) { console.warn('ach: SS missing'); return; }
  const save = SS.save;
  if (!save.stats || typeof save.stats !== 'object') save.stats = {};
  const S = save.stats;
  for (const k of ['kills', 'elites', 'treasure', 'bosses', 'ults', 'perks', 'stars']) if (!(S[k] >= 0)) S[k] = 0;
  if (!save.ach || typeof save.ach !== 'object') save.ach = {};
  const GEMS = [5, 10, 20, 35, 60, 100];
  const evolvedN = () => SS.GUNS.filter((g, i) => (save.wstar[i] || 1) >= 5).length;
  const LIST = [
    { id: 'kills', name: 'Avcı', icon: 'ic_reap', val: () => S.kills, tiers: [100, 1000, 10000, 50000, 200000, 1e6], txt: n => `${SS.fmt(n)} düşman yen` },
    { id: 'bosses', name: 'Boss Avcısı', icon: 'ic_bosshunt', val: () => S.bosses, tiers: [5, 25, 100, 300, 1000, 3000], txt: n => `${SS.fmt(n)} boss yen` },
    { id: 'best', name: 'Kaşif', icon: 'ic_explore', val: () => save.best || 1, tiers: [10, 25, 50, 75, 100, 150], txt: n => `${n}. bölüme ulaş` },
    { id: 'rebirth', name: 'Yeniden Doğan', icon: 'ic_reborn', val: () => save.rebirths || 0, tiers: [1, 3, 7, 15, 30, 60], txt: n => `${n} kez Doğuş yap` },
    { id: 'tower', name: 'Kule Fatihi', icon: 'ic_towerach', val: () => (save.tower && save.tower.best) || 0, tiers: [5, 10, 20, 35, 50, 75], txt: n => `Kulede ${n}. kata çık` },
    { id: 'elite', name: 'Elit Avcısı', icon: 'ic_elite', val: () => S.elites, tiers: [10, 100, 500, 2000, 8000, 25000], txt: n => `${SS.fmt(n)} elit düşman yen` },
    { id: 'treasure', name: 'Hazine Peşinde', icon: 'ic_key', val: () => S.treasure, tiers: [3, 15, 50, 150, 400, 1000], txt: n => `${n} hazine canavarı yakala` },
    { id: 'evo', name: 'Silah Ustası', icon: 'ic_weaponm', val: evolvedN, tiers: [1, 2, 4, 6, 9, 13], txt: n => `${n} silahı evrimleştir` },
    { id: 'stars', name: 'Yıldız Toplayıcı', icon: 'ic_star', val: () => S.stars, tiers: [3, 10, 20, 32], txt: n => `${n} silah yıldızı yükselt` },
    { id: 'perks', name: 'Yetenekli', icon: 'ic_cards', val: () => S.perks, tiers: [5, 30, 100, 300, 800], txt: n => `${n} yetenek kartı seç` },
    { id: 'team', name: 'Tam Kadro', icon: 'ic_squad', val: () => save.team, tiers: [2, 3, 4, 5], txt: n => `Takımda ${n} ninja` },
    { id: 'login', name: 'Sadık Ninja', icon: 'ic_letter', val: () => save.login ? save.login.week * 7 + save.login.day : 0, tiers: [3, 7, 14, 30, 60, 100], txt: n => `${n} gün ödül al` },
  ];
  const claimed = a => save.ach[a.id] || 0;
  const reached = a => { const v = a.val(); let k = 0; while (k < a.tiers.length && v >= a.tiers[k]) k++; return k; };
  const ready = () => LIST.reduce((s, a) => s + Math.max(0, reached(a) - claimed(a)), 0);
  const tiersClaimed = () => LIST.reduce((s, a) => s + claimed(a), 0);
  SS.MODS.dmg.push(() => 1 + 0.02 * tiersClaimed());

  const H = SS.HOOKS;
  H.kill.push(e => { S.kills++; if (e && e.elite) S.elites++; if (e && e.treasure) S.treasure++; });
  H.bossWin.push(() => { S.bosses++; });
  H.star.push(() => { S.stars++; });
  H.perk.push(() => { S.perks++; });

  function claim(a) {
    const k = claimed(a); if (k >= reached(a)) return;
    const g = GEMS[Math.min(k, GEMS.length - 1)];
    save.ach[a.id] = k + 1; save.gems += g;
    SS.sfx('bonus', 0); SS.toast(`${a.name} ${'I'.repeat(Math.min(3, k + 1))}${k >= 3 ? k + 1 : ''} · +${g} elmas · +%2 kalıcı hasar`);
    SS.persist(); SS.refreshUI(); paint(); open();
  }
  function open() {
    const sc = document.getElementById('pBody').scrollTop, same = document.getElementById('pTitle').dataset.k === 'Başarımlar';
    SS.openPanel('Başarımlar', 'purple', body => {
      if (SS.hub) SS.hub.tabs(body, 'ach');
      body.appendChild(SS.el(`<div class="ac-head"><img src="assets/ui/cup.png" alt=""><div><b>+%${2 * tiersClaimed()} kalıcı hasar</b><span>Her başarım kademesi: elmas + %2 hasar</span></div></div>`));
      const rows = LIST.slice().sort((x, y) => (reached(y) > claimed(y)) - (reached(x) > claimed(x)));
      for (const a of rows) {
        const k = claimed(a), done = k >= a.tiers.length, can = reached(a) > k, goal = a.tiers[Math.min(k, a.tiers.length - 1)], v = a.val();
        const r = SS.el(`<div class="row-card ac-row ${can ? 'can' : ''} ${done ? 'done' : ''}"><div class="ico tile"><img src="assets/ui/${a.icon}.png" alt=""></div>
          <div class="info"><h4>${a.name} <span class="ac-tier">${a.tiers.map((_, i) => `<i class="${i < k ? 'on' : ''}"></i>`).join('')}</span></h4>
          <p>${done ? 'Tamamlandı!' : a.txt(goal)}</p>${done ? '' : `<div class="fa-bar ${can ? 'full' : ''}"><i style="width:${Math.min(100, v / goal * 100).toFixed(1)}%"></i><span>${SS.fmt(Math.min(v, goal))} / ${SS.fmt(goal)}</span></div>`}</div>
          ${done ? '<button class="btn grey off">✓</button>' : `<button class="btn ${can ? 'green' : 'grey off'}"><img src="assets/ui/gem.png" alt="">${GEMS[Math.min(k, GEMS.length - 1)]}</button>`}</div>`);
        if (can) r.querySelector('.btn').onclick = () => claim(a);
        body.appendChild(r);
      }
    });
    if (same) document.getElementById('pBody').scrollTop = sc;
  }
  const btn = document.getElementById('missionsBtn');
  function paint() { if (btn) btn.classList.toggle('notify', ready() > 0); }
  setInterval(paint, 4000); paint();
  SS.ach = { open, ready, LIST };
})();
