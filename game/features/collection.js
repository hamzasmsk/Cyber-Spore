/* Shuriken Squad feature: Koleksiyon (bestiary). Every monster and boss gets a card with its pack portrait.
   Kill milestones give stars (monsters 10 / 100 / 1000 kills, bosses 1 / 5 / 20 wins); every star is a permanent
   +1% gold. Discovering a new monster gives a gem. Requires window.SS. */
'use strict';
(() => {
  const SS = window.SS;
  if (!SS) { console.warn('collection: SS missing'); return; }
  const save = SS.save;
  if (!save.dex || typeof save.dex !== 'object') save.dex = {};
  const D = save.dex;
  for (const k of ['m', 'b']) if (!D[k] || typeof D[k] !== 'object') D[k] = {};
  if (!Array.isArray(D.unseen)) D.unseen = [];

  const NAMES = {
    Slime3: 'Mavi Balçık', Mushroom: 'Mantarcık', Snake2: 'Yeşil Yılan', Butterfly: 'Kızıl Kelebek',
    Bamboo: 'Bambu Ruhu', KappaGreen: 'Kappa', Racoon: 'Rakun', SpiderRed: 'Kızıl Örümcek', BlueBat: 'Mavi Yarasa',
    Lizard: 'Kertenkele', Mole: 'Köstebek', Reptile2: 'Sürüngen', YellowsBat: 'Sarı Yarasa', Skull: 'Kafatası',
    Slime: 'Buz Balçığı', AxolotBlue: 'Aksolotl', Octopus2: 'Buz Ahtapotu', Eye: 'Göz', SkullBlue: 'Mavi Kafatası',
    Flam: 'Alev', Spirit2: 'Kor Ruhu', Cyclope: 'Tepegöz', Beast2: 'Kara Canavar', LanternRed: 'Fener Ruhu',
    GoldRacoon: 'Altın Rakun',
  };
  const M_STEPS = [20, 500, 5000], B_STEPS = [1, 5, 20];   // ~9000 kills an hour: monster stars over days, not hours
  const starsOf = (n, steps) => steps.filter(s => n >= s).length;
  const allMon = () => SS.BIOMES.flatMap(b => b.pool).concat(['GoldRacoon']);
  const allBoss = () => SS.BIOMES.flatMap(b => b.bosses);
  const totalStars = () => allMon().reduce((a, k) => a + starsOf(D.m[k] || 0, M_STEPS), 0) + allBoss().reduce((a, k) => a + starsOf(D.b[k] || 0, B_STEPS), 0);
  const maxStars = () => (allMon().length + allBoss().length) * 3;
  let bonusCache = 1, cacheT = 0;
  SS.MODS.money.push(() => { const now = performance.now(); if (now - cacheT > 1000) { cacheT = now; bonusCache = 1 + totalStars() * 0.01; } return bonusCache; });

  function bump(map, key, steps, label) {
    const before = map[key] || 0, after = before + 1; map[key] = after;
    if (before === 0) {
      if (map === D.m) { save.gems += 1; SS.toast(`Yeni: ${label}! +1 elmas`); SS.sfx('gem', 0); }
      if (!D.unseen.includes(key)) D.unseen.push(key);
    }
    if (starsOf(after, steps) > starsOf(before, steps)) { SS.toast(`${label} ★${starsOf(after, steps)} · kalıcı +%1 altın`); SS.sfx('bonus', 0); cacheT = 0; }
    paintDot();
  }
  SS.HOOKS.kill.push(e => { if (e && e.type) bump(D.m, e.type, M_STEPS, NAMES[e.type] || e.type); });
  SS.HOOKS.bossWin.push(b => { if (b && b.key) bump(D.b, b.key, B_STEPS, (SS.BOSSES[b.key] || {}).name || b.key); });

  const btn = SS.addSideButton({ side: 'left', label: 'Koleksiyon', icon: 'assets/ui/ic_book.png', color: 'blue', id: 'dexBtn', onClick: () => open() });
  function paintDot() { btn.classList.toggle('notify', D.unseen.length > 0); }

  let tab = 'm';
  function card(key, isBoss) {
    const n = (isBoss ? D.b : D.m)[key] || 0, steps = isBoss ? B_STEPS : M_STEPS, st = starsOf(n, steps), seen = n > 0;
    const name = seen ? (isBoss ? (SS.BOSSES[key] || {}).name : NAMES[key]) || key : '???';
    const next = st < 3 ? steps[st] : null;
    const isNew = D.unseen.includes(key);
    return `<div class="dex-card ${seen ? '' : 'locked'} ${isNew ? 'new' : ''}">
      <div class="dex-face"><img src="assets/ui/${isBoss ? 'boss' : 'mon'}_${key}.png" alt=""></div>
      <b>${name}</b>
      <div class="stars">${[1, 2, 3].map(k => `<i class="${k <= st ? 'on' : ''}"></i>`).join('')}</div>
      <small>${seen ? `${SS.fmt(n)}${next ? ' / ' + SS.fmt(next) : ''}` : 'Keşfedilmedi'}</small></div>`;
  }
  function open() {
    SS.openPanel('Koleksiyon', 'blue', body => {
      const ts = totalStars(), ms = maxStars();
      body.appendChild(SS.el(`<div class="dex-head"><div><b>${ts}</b> / ${ms} yıldız</div><span>Kalıcı altın bonusu: <em>+%${ts}</em></span>
        <div class="pbar"><i style="width:${Math.round(ts / ms * 100)}%"></i></div></div>`));
      const tabs = SS.el(`<div class="dex-tabs"><button class="btn ${tab === 'm' ? 'blue' : 'grey'}" data-t="m">Canavarlar</button><button class="btn ${tab === 'b' ? 'red' : 'grey'}" data-t="b">Bosslar</button></div>`);
      tabs.querySelectorAll('button').forEach(b => b.onclick = () => { SS.sfx('tick', 0); tab = b.dataset.t; open(); });
      body.appendChild(tabs);
      SS.BIOMES.forEach(bio => {
        const keys = tab === 'm' ? bio.pool : bio.bosses;
        body.appendChild(SS.el(`<h3 class="dex-region">${bio.name}</h3>`));
        body.appendChild(SS.el(`<div class="dex-grid">${keys.map(k => card(k, tab === 'b')).join('')}</div>`));
      });
      if (tab === 'm') { body.appendChild(SS.el('<h3 class="dex-region">Nadir</h3>')); body.appendChild(SS.el(`<div class="dex-grid">${card('GoldRacoon', false)}</div>`)); }
      body.appendChild(SS.el(`<p class="big-note">${tab === 'm' ? 'Canavar yıldızları: 10 · 100 · 1000 yenme' : 'Boss yıldızları: 1 · 5 · 20 zafer'} — her yıldız kalıcı +%1 altın.</p>`));
      // cards shown in this tab are no longer "new"
      const shown = new Set(tab === 'm' ? allMon() : allBoss());
      D.unseen = D.unseen.filter(k => !shown.has(k)); paintDot(); SS.persist();
    });
  }
  paintDot();
  SS.collection = { open, totalStars };
})();
