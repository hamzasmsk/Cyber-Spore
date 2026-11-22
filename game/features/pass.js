/* Shuriken Squad feature: "Ninja Yolu" — 28-day season pass.
   - 30 levels, each with a free and a premium reward drawn from every reward type in the game: gems, gold,
     x2 power, rapid fire, treasure hunter, Yıldız Taşı (weapon star), Fırtına Tılsımı (instant ultimate),
     Boss Bileti (+15 s without an ad), mine chests, and the season's exclusive costumes and shot trails.
   - Milestone chests every 5 levels; after level 30 a bonus chest every 300 XP.
   - Daily and weekly pass tasks give XP; levels can be skipped with gems.
   - Premium (one purchase per season) pays out every level already reached; Premium+ also adds 10 levels.
   - Seasons rotate through 4 themes, each with its own pair of costumes and trails. */
'use strict';
(() => {
  const SS = window.SS;
  if (!SS) { console.warn('pass: SS missing'); return; }
  const save = SS.save, DAY = 864e5, SEASON_DAYS = 28, LEVELS = 30, XP_PER = 150, BONUS_XP = 300, SKIP_GEMS = 25;
  const EPOCH = Date.UTC(2026, 0, 5);
  const seasonNo = () => Math.floor((Date.now() - EPOCH) / (SEASON_DAYS * DAY)) + 1;
  const seasonEnd = () => EPOCH + seasonNo() * SEASON_DAYS * DAY;

  // ---------------- cosmetics: season-exclusive costumes and shot trails
  const SKINS = {
    NinjaMageBlack: { name: 'Kara Büyücü', bonus: { dmg: 1.08, rate: 1.04 }, desc: '+%8 hasar · +%4 atış hızı' },
    Master: { name: 'Usta', bonus: { dmg: 1.08, money: 1.05 }, desc: '+%8 hasar · +%5 altın' },
    NinjaEskimo: { name: 'Kar Ninjası', bonus: { rate: 1.08 }, desc: '+%8 atış hızı' },
    Tengu: { name: 'Tengu', bonus: { dmg: 1.12 }, desc: '+%12 hasar' },
    MaskRacoon: { name: 'Rakun Maske', bonus: { money: 1.12 }, desc: '+%12 altın' },
    SamuraiRed: { name: 'Kızıl Samuray', bonus: { dmg: 1.1, rate: 1.03 }, desc: '+%10 hasar · +%3 atış hızı' },
    NinjaDark: { name: 'Gölge Ninja', bonus: { rate: 1.1 }, desc: '+%10 atış hızı' },
    Vampire: { name: 'Vampir', bonus: { dmg: 1.08, money: 1.08 }, desc: '+%8 hasar · +%8 altın' },
  };
  const TRAILS = {
    gold: { name: 'Altın İz', col: '#ffe18d' }, magic: { name: 'Büyü İzi', col: '#d3a2c0' }, fire: { name: 'Alev İzi', col: '#ff9554' },
    ice: { name: 'Buz İzi', col: '#8feff1' }, leaf: { name: 'Yaprak İzi', col: '#adbc3a' }, ink: { name: 'Gölge İzi', col: '#8d977f' },
  };
  const THEMES = [
    { name: 'Kızıl Ay', skins: ['NinjaMageBlack', 'Master'], trails: ['fire', 'magic'], col: 'red' },
    { name: 'Buz Fırtınası', skins: ['NinjaEskimo', 'Tengu'], trails: ['ice', 'gold'], col: 'blue' },
    { name: 'Bambu Ruhu', skins: ['MaskRacoon', 'SamuraiRed'], trails: ['leaf', 'gold'], col: 'green' },
    { name: 'Gölge Dansı', skins: ['NinjaDark', 'Vampire'], trails: ['ink', 'magic'], col: 'purple' },
  ];
  const theme = () => THEMES[(seasonNo() - 1) % THEMES.length];
  // costumes join the Kostüm list (marked as pass-only, so they cannot be bought with gems)
  if (SS.skins && SS.skins.SKINS) for (const [id, d] of Object.entries(SKINS)) {
    const ex = SS.skins.byId(id);
    if (ex) ex.pass = true; else SS.skins.SKINS.push({ id, name: d.name, cost: 0, pass: true, bonus: d.bonus, desc: d.desc });
  }
  if (!save.cos || typeof save.cos !== 'object') save.cos = {};
  if (!save.cos.trails || typeof save.cos.trails !== 'object') save.cos.trails = {};
  if (!save.inv || typeof save.inv !== 'object') save.inv = {};
  for (const k of ['star', 'storm', 'ticket']) if (!(save.inv[k] >= 0)) save.inv[k] = 0;

  // ---------------- reward tables (premium uses the season's two costumes [A at 15, B at 30] and trails [10, 20])
  const C = (o, chest) => Object.assign({ chest: !!chest }, o);
  const FREE = [null,
    { goldMin: 10 }, { gems: 5 }, { storm: 1 }, { goldMin: 15 }, C({ gems: 15, ticket: 1 }, 1),
    { ticket: 1 }, { goldMin: 20 }, { gems: 5 }, { boostMin: 15 }, C({ gems: 20, star: 1 }, 1),
    { goldMin: 25 }, { gems: 8 }, { storm: 1 }, { goldMin: 30 }, C({ gems: 25, ticket: 1 }, 1),
    { ticket: 1 }, { gems: 8 }, { goldMin: 40 }, { treasureMin: 20 }, C({ gems: 30, star: 1 }, 1),
    { goldMin: 45 }, { gems: 10 }, { storm: 1 }, { goldMin: 60 }, C({ gems: 35, storm: 2 }, 1),
    { ticket: 1 }, { gems: 10 }, { goldMin: 90 }, { mineH: 8 }, C({ gems: 50, star: 1 }, 1)];
  const PREM = [null,
    { gems: 20 }, { storm: 1 }, { goldMin: 30 }, { ticket: 1 }, C({ trail: 0, gems: 20 }, 1),
    { gems: 30 }, { boostMin: 30 }, { star: 1 }, { storm: 2 }, C({ gems: 60, rapidMin: 30 }, 1),
    { treasureMin: 30 }, { ticket: 2 }, { goldMin: 60 }, { star: 1 }, C({ skin: 0, gems: 40 }, 1),
    { gems: 40 }, { boostMin: 60 }, { storm: 3 }, { star: 1 }, C({ trail: 1, gems: 50 }, 1),
    { gems: 40 }, { ticket: 2 }, { mineH: 8 }, { star: 2 }, C({ gems: 80, boostMin: 60 }, 1),
    { boostMin: 120 }, { storm: 3 }, { star: 2 }, { gems: 100 }, C({ skin: 1, gems: 150, star: 2 }, 1)];
  const resolve = r => { const t = theme(), o = Object.assign({}, r); if ('skin' in r) o.skin = t.skins[r.skin]; if ('trail' in r) o.trail = t.trails[r.trail]; return o; };

  // label, icon and rarity of a reward
  const PARTS = [
    ['skin', r => SKINS[r.skin] ? SKINS[r.skin].name : 'Kostüm', r => `face_${r.skin}.png`, 'epic'],
    ['trail', r => TRAILS[r.trail].name, () => 'ic_magic.png', 'rare'],
    ['star', r => `${r.star} Yıldız Taşı`, () => 'ic_luck.png', 'rare'],
    ['storm', r => `${r.storm} Fırtına Tılsımı`, () => 'ic_explosion.png', ''],
    ['ticket', r => `${r.ticket} Boss Bileti`, () => 'ic_shield.png', ''],
    ['gems', r => `${r.gems} elmas`, () => 'gem.png', ''],
    ['boostMin', r => `${r.boostMin >= 60 ? r.boostMin / 60 + ' sa' : r.boostMin + ' dk'} x2 güç`, () => 'ic_boost.png', ''],
    ['rapidMin', r => `${r.rapidMin} dk hızlı ateş`, () => 'ic_rate.png', ''],
    ['treasureMin', r => `${r.treasureMin} dk hazine avcısı`, () => 'ic_vision.png', ''],
    ['mineH', r => `${r.mineH} sa maden sandığı`, () => 'ic_mine.png', ''],
    ['goldMin', r => `${r.goldMin} dk altın`, () => 'coin.png', ''],
  ];
  const describe = r => {
    const ks = PARTS.filter(p => r[p[0]] !== undefined);
    return { label: ks.map(p => p[1](r)).join(' + '), icon: r.chest && !r.skin && !r.trail ? 'chest.png' : ks.length ? ks[0][2](r) : 'gem.png', rarity: (ks.find(p => p[3]) || [0, 0, 0, ''])[3] };
  };

  function give(r) {
    const b = save.boost = save.boost || {}, now = Date.now();
    if (r.gems) save.gems += r.gems;
    if (r.goldMin) { const inc = SS.shop ? SS.shop.income() : 1; SS.addMoney(inc * r.goldMin * 60, SS.W / 2, SS.H / 2, 10); }
    if (r.boostMin) { b.adEnd = Math.max(now, b.adEnd || 0) + r.boostMin * 60000; b.adCd = Math.max(b.adCd || 0, b.adEnd); }
    if (r.rapidMin) b.rateEnd = Math.max(now, b.rateEnd || 0) + r.rapidMin * 60000;
    if (r.treasureMin) b.treasureEnd = Math.max(now, b.treasureEnd || 0) + r.treasureMin * 60000;
    if (r.mineH && SS.mine) save.gems += Math.floor(SS.mine.perHour((save.mine && save.mine.lv) || 1) * r.mineH);
    if (r.star) save.inv.star += r.star;
    if (r.storm) save.inv.storm += r.storm;
    if (r.ticket) save.inv.ticket += r.ticket;
    if (r.skin) { save.skins = save.skins || {}; save.skins.owned = save.skins.owned || {}; save.skins.owned[r.skin] = true; SS.banner('YENİ KOSTÜM!', (SKINS[r.skin] || {}).name || r.skin); }
    if (r.trail) { save.cos.trails[r.trail] = true; if (!save.cos.trail) save.cos.trail = r.trail; SS.toast(`${TRAILS[r.trail].name} açıldı · Kostüm panelinden tak`); }
  }

  // ---------------- state, XP and tasks
  const weekKey = () => { const d = new Date(), day = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - day); return d.toISOString().slice(0, 10); };
  const today = () => new Date().toISOString().slice(0, 10);
  const DAILY = [
    { id: 'd_kill', text: 'Düşman yen', goal: 150, xp: 100, ev: 'kill' }, { id: 'd_boss', text: 'Boss yen', goal: 1, xp: 120, ev: 'boss' },
    { id: 'd_elite', text: 'Elit düşman yen', goal: 3, xp: 80, ev: 'elite' }, { id: 'd_ult', text: 'Fırtına kullan', goal: 2, xp: 80, ev: 'ult' },
    { id: 'd_buy', text: 'Geliştirme al', goal: 25, xp: 60, ev: 'buy' },
  ];
  const WEEKLY = [
    { id: 'w_kill', text: 'Düşman yen', goal: 2000, xp: 400, ev: 'kill' }, { id: 'w_boss', text: 'Boss yen', goal: 15, xp: 500, ev: 'boss' },
    { id: 'w_tre', text: 'Hazine canavarı yakala', goal: 3, xp: 300, ev: 'treasure' }, { id: 'w_star', text: 'Silah yıldızı yükselt', goal: 2, xp: 300, ev: 'star' },
    { id: 'w_reb', text: 'Yeniden doğ', goal: 1, xp: 400, ev: 'rebirth' },
  ];
  function st() {
    let s = save.pass;
    if (!s || typeof s !== 'object' || s.season !== seasonNo()) s = save.pass = { season: seasonNo(), xp: 0, free: {}, prem: {}, premium: false, login: '', bonus: 0 };
    if (!s.tasks || s.tasks.day !== today()) {   // 3 daily tasks, rotated by date
      const seed = [...today()].reduce((a, c) => a * 31 + c.charCodeAt(0) | 0, 7), pick = DAILY.slice().sort((a, b) => ((a.id.length * 7 + seed) % 5) - ((b.id.length * 3 + seed) % 5)).slice(0, 3);
      s.tasks = { day: today(), list: pick.map(t => ({ id: t.id, n: 0, done: false })) };
    }
    if (!s.week || s.week.key !== weekKey()) s.week = { key: weekKey(), list: WEEKLY.map(t => ({ id: t.id, n: 0, done: false })) };
    return s;
  }
  const def = id => DAILY.concat(WEEKLY).find(t => t.id === id);
  const level = () => Math.min(LEVELS, Math.floor(st().xp / XP_PER));
  function addXp(n) {
    const s = st(), before = level(); s.xp += n;
    if (level() > before) { SS.toast(`Ninja Yolu seviye ${level()}!`); SS.sfx('bonus', 0); }
    paintDot();
  }
  function progress(ev, k = 1) {
    const s = st(); let changed = false;
    for (const t of s.tasks.list.concat(s.week.list)) { const d = def(t.id); if (d && d.ev === ev && !t.done && t.n < d.goal) { t.n = Math.min(d.goal, t.n + k); changed = true; } }
    if (changed) paintDot();
  }
  SS.HOOKS.kill.push(e => { addXp(e && e.treasure ? 10 : e && e.elite ? 4 : 1); progress('kill'); if (e && e.elite) progress('elite'); if (e && e.treasure) progress('treasure'); });
  SS.HOOKS.bossWin.push(() => { addXp(40); progress('boss'); });
  SS.HOOKS.buy.push(() => progress('buy'));
  for (const ev of ['ult', 'star', 'rebirth']) { SS.HOOKS[ev] = SS.HOOKS[ev] || []; SS.HOOKS[ev].push(() => progress(ev)); }
  { const s = st(); if (s.login !== today()) { s.login = today(); s.xp += 60; } }

  const bonusChests = () => { const s = st(); return Math.max(0, Math.floor((s.xp - LEVELS * XP_PER) / BONUS_XP)) - (s.bonus || 0); };
  const tasksReady = () => { const s = st(); return s.tasks.list.concat(s.week.list).filter(t => !t.done && t.n >= def(t.id).goal).length; };
  const claimable = () => { const s = st(), L = level(); let n = bonusChests(); for (let l = 1; l <= L; l++) { if (!s.free[l]) n++; if (s.premium && !s.prem[l]) n++; } return n + tasksReady(); };
  const btn = SS.addSideButton({ side: 'left', label: 'Ninja Yolu', icon: 'assets/ui/ic_orb.png', color: 'purple', id: 'passBtn', onClick: () => open() });
  function paintDot() { btn.classList.toggle('notify', claimable() > 0); }

  function claimLevel(l, prem) {
    const s = st(); if (l > level()) return false;
    if (prem) { if (!s.premium || s.prem[l]) return false; s.prem[l] = 1; give(resolve(PREM[l])); }
    else { if (s.free[l]) return false; s.free[l] = 1; give(resolve(FREE[l])); }
    return true;
  }
  function claimAll() {
    const s = st(); let n = 0;
    for (let l = 1; l <= level(); l++) { if (claimLevel(l, false)) n++; if (s.premium && claimLevel(l, true)) n++; }
    for (let k = bonusChests(); k > 0; k--) { s.bonus = (s.bonus || 0) + 1; give(s.premium ? { gems: 35, storm: 1 } : { gems: 10 }); n++; }
    if (n) { SS.sfx('gem', 0); SS.toast(`${n} ödül alındı`); SS.persist(); SS.refreshUI(); }
    paintDot(); return n;
  }
  function unlockPremium(plusLevels = 0) {
    const s = st(); s.premium = true;
    if (plusLevels) s.xp = Math.max(s.xp, Math.min(LEVELS, level() + plusLevels) * XP_PER);
    SS.persist(); paintDot();
    setTimeout(() => { claimAll(); if (!document.getElementById('panel').classList.contains('hidden')) open('r'); }, 300);
  }

  // ---------------- panel
  const premSummary = () => {
    const sum = k => PREM.reduce((a, r) => a + ((r && r[k]) || 0), 0);
    return `2 özel kostüm · 2 atış izi · ${sum('gems')} elmas · ${sum('star')} Yıldız Taşı · ${sum('storm')} Tılsım · ${sum('ticket')} Boss Bileti · ${Math.round(sum('boostMin') / 60 * 10) / 10} sa x2 güç`;
  };
  let tab = 'r';
  const timeLeft = () => { const ms = seasonEnd() - Date.now(), d = Math.floor(ms / DAY), h = Math.floor(ms % DAY / 3600e3); return d > 0 ? `${d} gün ${h} sa` : `${h} sa`; };
  function rewardCell(r, got, locked, ready) {
    const d = describe(r);
    return `<div class="ps-cell ${d.rarity} ${r.chest ? 'chest' : ''} ${got ? 'got' : ''} ${locked ? 'locked' : ''} ${ready ? 'ready' : ''}">
      <div class="ps-ico"><img src="assets/ui/${d.icon}" alt=""></div><span>${d.label}</span>${locked ? '<img class="ps-lock" src="assets/ui/lock.png" alt="">' : ''}</div>`;
  }
  function open(t) {
    if (t) tab = t;
    const s = st(), L = level(), IAP = SS.IAP, th = theme();
    SS.openPanel('Ninja Yolu', 'purple', body => {
      const into = s.xp - L * XP_PER, pct = L >= LEVELS ? Math.round(((s.xp - LEVELS * XP_PER) % BONUS_XP) / BONUS_XP * 100) : Math.round(into / XP_PER * 100);
      body.appendChild(SS.el(`<div class="ps-head ${th.col}"><div class="ps-lv"><small>SV</small><b>${L}</b></div>
        <div class="ps-info"><b>Sezon ${s.season} · ${th.name}</b><span>Bitiş: <em>${timeLeft()}</em>${s.premium ? ' · <i class="ps-prem">PREMIUM</i>' : ''}</span>
        <div class="pbar"><i style="width:${pct}%"></i><span>${L >= LEVELS ? `Bonus sandık: ${(s.xp - LEVELS * XP_PER) % BONUS_XP} / ${BONUS_XP} XP` : `${into} / ${XP_PER} XP`}</span></div></div></div>`));
      // inventory strip
      body.appendChild(SS.el(`<div class="ps-inv"><span><img src="assets/ui/ic_luck.png" alt="">Yıldız Taşı <b>${save.inv.star}</b></span><span><img src="assets/ui/ic_explosion.png" alt="">Tılsım <b>${save.inv.storm}</b></span><span><img src="assets/ui/ic_shield.png" alt="">Bilet <b>${save.inv.ticket}</b></span></div>`));
      // season showcase
      const sh = SS.el(`<div class="ps-show"><b>Bu sezona özel</b><div class="ps-show-row">
        ${th.skins.map((id, i) => `<div class="ps-sk"><img src="assets/ui/face_${id}.png" alt=""><span>${SKINS[id].name}</span><small>Premium ${i ? 30 : 15}. seviye</small></div>`).join('')}
        ${th.trails.map((id, i) => `<div class="ps-tr"><i style="background:${TRAILS[id].col}"></i><span>${TRAILS[id].name}</span><small>Premium ${i ? 20 : 5}. seviye</small></div>`).join('')}</div>
        <small class="ps-note">Sezon bitince bu ödüller kaybolur; aynı tema 4 sezon sonra döner.</small></div>`);
      body.appendChild(sh);
      if (!s.premium && IAP && IAP.enabled) {
        const pb = SS.el(`<div class="ps-buy"><div class="ps-buy-txt"><b>Premium yolu aç</b><span>${premSummary()}</span></div>
          <div class="ps-buy-btns"><button class="btn yellow" data-sku="ss_pass">${IAP.price('ss_pass')}</button><button class="btn purple" data-sku="ss_pass_plus">+10 sv · ${IAP.price('ss_pass_plus')}</button></div></div>`);
        pb.querySelectorAll('[data-sku]').forEach(b => b.onclick = () => IAP.buy(b.dataset.sku));
        body.appendChild(pb);
      }
      const tabs = SS.el(`<div class="dex-tabs"><button class="btn ${tab === 'r' ? 'purple' : 'grey'}" data-t="r">Ödüller</button><button class="btn ${tab === 't' ? 'purple' : 'grey'}" data-t="t">Görevler${tasksReady() ? ` (${tasksReady()})` : ''}</button></div>`);
      tabs.querySelectorAll('button').forEach(b => b.onclick = () => { SS.sfx('tick', 0); open(b.dataset.t); });
      body.appendChild(tabs);
      if (tab === 'r') {
        const row = SS.el('<div class="btnrow"></div>');
        const cl = SS.el(`<button class="btn green ${claimable() - tasksReady() ? '' : 'off'}">Hepsini al (${claimable() - tasksReady()})</button>`);
        cl.onclick = () => { claimAll(); open(); };
        const sk = SS.el(`<button class="btn blue ${L < LEVELS && save.gems >= SKIP_GEMS ? '' : 'off'}">+1 sv · <img src="assets/ui/gem.png" alt="">${SKIP_GEMS}</button>`);
        sk.onclick = () => { if (L >= LEVELS || save.gems < SKIP_GEMS) return; save.gems -= SKIP_GEMS; s.xp = (L + 1) * XP_PER; SS.sfx('buy', 0); SS.persist(); SS.refreshUI(); open(); };
        row.appendChild(cl); row.appendChild(sk); body.appendChild(row);
        body.appendChild(SS.el('<div class="ps-cols"><span></span><b>Ücretsiz</b><b class="pp">Premium</b></div>'));
        const list = SS.el('<div class="ps-list"></div>');
        for (let l = 1; l <= LEVELS; l++) {
          const f = resolve(FREE[l]), p = resolve(PREM[l]), reached = l <= L;
          const r = SS.el(`<div class="ps-row ${reached ? 'on' : ''} ${f.chest ? 'mile' : ''} ${l === L + 1 ? 'next' : ''}"><div class="ps-num">${l}</div>
            ${rewardCell(f, s.free[l], false, reached && !s.free[l])}${rewardCell(p, s.prem[l], !s.premium, reached && s.premium && !s.prem[l])}</div>`);
          const cells = r.querySelectorAll('.ps-cell');
          cells[0].onclick = () => { if (claimLevel(l, false)) { SS.sfx('gem', 0); SS.persist(); SS.refreshUI(); open(); } };
          cells[1].onclick = () => { if (claimLevel(l, true)) { SS.sfx('gem', 0); SS.persist(); SS.refreshUI(); open(); } else if (!s.premium) SS.toast('Premium yol gerekli'); };
          list.appendChild(r);
        }
        list.appendChild(SS.el(`<div class="ps-row on mile"><div class="ps-num">+</div>${rewardCell({ gems: 10, chest: 1 }, false, false, bonusChests() > 0)}${rewardCell({ gems: 35, storm: 1, chest: 1 }, false, !s.premium, s.premium && bonusChests() > 0)}</div>`));
        body.appendChild(list);
        body.appendChild(SS.el(`<p class="big-note">30. seviyeden sonra her ${BONUS_XP} XP bir bonus sandık.</p>`));
        requestAnimationFrame(() => { const nx = list.querySelector('.next') || list.querySelector('.ps-row:last-child'); if (nx) list.scrollTop = Math.max(0, nx.offsetTop - list.offsetTop - 70); });
      } else {
        const section = (title, items, reset) => {
          body.appendChild(SS.el(`<h3 class="dex-region">${title} <small>${reset}</small></h3>`));
          items.forEach(t => {
            const d = def(t.id), ok = t.n >= d.goal;
            const r = SS.el(`<div class="row-card ${t.done ? 'lock' : ok ? 'cur' : ''}"><div class="info"><h4>${d.text}</h4><div class="pbar"><i style="width:${Math.round(t.n / d.goal * 100)}%"></i><span>${SS.fmt(t.n)} / ${SS.fmt(d.goal)}</span></div></div>
              <button class="btn ${t.done ? 'grey off' : ok ? 'green' : 'grey off'}">${t.done ? 'ALINDI' : `+${d.xp} XP`}</button></div>`);
            if (ok && !t.done) r.querySelector('.btn').onclick = () => { t.done = true; addXp(d.xp); SS.sfx('bonus', 0); SS.persist(); open('t'); };
            body.appendChild(r);
          });
        };
        const ms = new Date(); const hl = 24 - ms.getUTCHours();
        section('Günlük', s.tasks.list, `· ${hl} sa içinde yenilenir`);
        section('Haftalık', s.week.list, '· pazartesi yenilenir');
        body.appendChild(SS.el('<p class="big-note">Oynarken de XP kazanırsın: düşman +1 · elit +4 · hazine +10 · boss +40 · günün ilk girişi +60</p>'));
      }
      paintDot();
    });
  }
  paintDot();
  SS.pass = { open, unlockPremium, level, claimAll, addXp, TRAILS, SKINS, theme };
})();
