/* Shuriken Squad feature: Hayatta Kal (survival mode) — a 150-second run in the same field.
   Enemies rush the squad from every side in growing numbers; their toughness is set from the squad's own damage,
   so the run is always a fight whatever stage you are on. Every few kills the run levels up and you pick 1 of 3
   run-only boosts. Steer to dodge (the autopilot also keeps its distance). A knock-out ends the run.
   Rewards scale with kills and survival (gems, scrolls, souls after the first rebirth); a full run adds a chest.
   One free run a day; a Boss Bileti buys another. Lives as the "Arena" tab of the Görev hub. */
'use strict';
(() => {
  const SS = window.SS;
  if (!SS) return;
  const save = SS.save, R = SS.R, RUN = 150;
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
  if (!save.surv || typeof save.surv !== 'object') save.surv = { best: 0, bestT: 0, day: '', runs: 0 };
  const S = save.surv;
  const free = () => S.day !== today();
  const BOOSTS = [
    { id: 'dmg', name: 'Öfke', txt: '+%40 hasar', icon: 'ic_power' },
    { id: 'rate', name: 'Çeviklik', txt: '+%30 atış hızı', icon: 'ic_rate' },
    { id: 'heal', name: 'Nefes', txt: 'Takımı tamamen iyileştir', icon: 'ic_heal' },
    { id: 'nova', name: 'Şok Dalgası', txt: 'Her 6 sn çevreye patlama', icon: 'ic_explosion' },
    { id: 'pierce', name: 'Delici Uç', txt: 'Atışlar +1 deler', icon: 'ic_book' },
    { id: 'slow', name: 'Ağır Hava', txt: 'Düşmanlar %25 yavaş', icon: 'ic_moon' },
  ];
  let run = null;
  const prevBusy = SS.busy; SS.busy = () => !!run || (prevBusy ? prevBusy() : false);
  const lv = id => (run && run.b[id]) || 0;
  SS.MODS.dmg.push(() => 1 + 0.4 * lv('dmg'));
  SS.MODS.rate.push(() => 1 + 0.3 * lv('rate'));
  SS.MODS.pierce.push(() => lv('pierce'));

  // HUD strip
  const hud = SS.el('<div class="sv-hud hidden"><b class="sv-t">2:30</b><span class="sv-k">0</span><i class="sv-bar"><i></i></i><small class="sv-lv">Sv.1</small></div>');
  document.getElementById('ui').appendChild(hud);

  function start() {
    if (R.boss) { SS.toast('Önce boss dövüşünü bitir'); return; }
    if (!free()) { const inv = save.inv || {}; if (inv.ticket > 0) { inv.ticket--; SS.toast(`Boss Bileti kullanıldı · ${inv.ticket} kaldı`); } else { SS.sfx('no'); SS.toast('Bugünkü ücretsiz koşu kullanıldı · Boss Bileti gerekir'); return; } }
    else S.day = today();
    SS.closePanel(); S.runs++;
    for (const e of R.en) { e.dead = true; SS.puff(e.x, e.y, 1); }
    R.eb.length = 0; R.mode = 'surv'; R.phase = 'surv'; R.toSpawn = 0;
    if (R.sq) { R.sq.hp = R.sq.maxHp; R.sq.ko = 0; }
    // toughness from the squad's real damage per second: an early rusher dies in ~0.4 s of focused fire
    const dps = SS.dmgPerShot() * SS.fireRate() * Math.max(1, save.team);
    run = { t: 0, kills: 0, lvl: 1, next: 12, spawnT: 0.5, b: {}, novaT: 6, base: dps * 0.4, over: false };
    hud.classList.remove('hidden'); const gl = document.getElementById('goal'); if (gl) gl.classList.add('sv-hide'); SS.banner('HAYATTA KAL!', '150 saniye · her yönden geliyorlar'); SS.sfx('boss', 0); R.shake = 6;
    SS.persist();
  }
  function spawnOne() {
    const W = SS.W, H = SS.H, U = SS.U, side = Math.random();
    SS.spawnEnemy('none'); const e = R.en[R.en.length - 1]; if (!e) return;
    const k = Math.pow(1.13, run.t / 10) * (0.9 + Math.random() * 0.2), tough = Math.random() < Math.min(0.25, run.t / 400);
    e.hp = e.maxHp = run.base * k * (tough ? 4 : 1); e.sc = tough ? 1.5 : 1; e.elite = tough; e.vr = null;
    e.rush = true; e.ranged = false; e.gold = 0.25; e.dmg = (100 + 12 * (save.stage - 1)) * 0.06 * (tough ? 2 : 1);
    e.sp = 70 * U * (1 + run.t / 220) * (lv('slow') ? 0.75 : 1) * (e.d && e.d.spd || 1);
    if (side < 0.5) { e.x = Math.random() * W; e.y = 110; } else { e.x = side < 0.75 ? -10 : W + 10; e.y = 200 + Math.random() * (H - 420); }
    e.surv = true;
  }
  SS.HOOKS.update.push(dt => {
    if (!run || run.over || R.paused) return;
    run.t += dt;
    // spawn pacing: from ~1.3/s to ~5/s, more on screen as the run goes on
    run.spawnT -= dt;
    const cap = 10 + Math.floor(run.t / 12) * 2;
    if (run.spawnT <= 0 && R.en.length < cap) { const burst = 1 + Math.floor(run.t / 45); for (let i = 0; i < burst; i++) spawnOne(); run.spawnT = Math.max(0.2, 0.8 - run.t / 220); }
    if (lv('nova')) { run.novaT -= dt; if (run.novaT <= 0) { run.novaT = 6; const L = SS.leader; if (L) { SS.boom(L.x, L.y - 8 * SS.P, 1.5); SS.areaHit(L.x, L.y - 8 * SS.P, 120 * SS.U, run.base * 3 * Math.pow(1.13, run.t / 10)); } } }
    const left = Math.max(0, RUN - run.t), m = Math.floor(left / 60), s = Math.floor(left % 60);
    hud.querySelector('.sv-t').textContent = `${m}:${String(s).padStart(2, '0')}`;
    hud.querySelector('.sv-k').textContent = `${run.kills} düşman`;
    hud.querySelector('.sv-bar i').style.width = Math.min(100, (run.kills - (run.prev || 0)) / (run.next - (run.prev || 0)) * 100) + '%';
    hud.querySelector('.sv-lv').textContent = 'Sv.' + run.lvl;
    if (left <= 0) end(true);
  });
  SS.HOOKS.kill.push(e => {
    if (!run || !e || !e.surv) return;
    run.kills++;
    if (run.kills >= run.next) { run.prev = run.next; run.lvl++; run.next += 10 + run.lvl * 4; levelUp(); }
  });
  SS.HOOKS.ko.push(() => { if (run && !run.over) setTimeout(() => end(false), 900); });

  function levelUp() {
    R.paused = true; SS.sfx('bonus', 0);
    const pool = BOOSTS.filter(b => !(b.id === 'pierce' && lv('pierce') >= 2)).sort(() => Math.random() - 0.5).slice(0, 3);
    const ov = SS.el(`<div class="pk-ov"><div class="pk-box"><div class="pk-title">SEVİYE ${run.lvl}<small>Bu koşu için bir güç seç</small></div><div class="pk-row"></div><div class="pk-t"><i></i></div></div></div>`);
    const row = ov.querySelector('.pk-row');
    let done = false;
    const pickB = (b, el) => {
      if (done) return; done = true; clearInterval(tm);
      if (b.id === 'heal') { if (R.sq) R.sq.hp = R.sq.maxHp; } else run.b[b.id] = lv(b.id) + 1;
      el && el.classList.add('chosen'); SS.sfx('accept', 0);
      setTimeout(() => { ov.remove(); R.paused = false; }, 300);
    };
    pool.forEach((b, i) => { const c = SS.el(`<button class="pk-card r" style="animation-delay:${i * 0.06}s"><span class="pk-rar">Koşu</span><div class="pk-ico"><img src="assets/ui/${b.icon}.png" alt=""></div><b>${b.name}</b><p>${b.txt}</p><span class="pk-lv">${lv(b.id) ? '×' + (lv(b.id) + 1) : ''}</span></button>`); c.onclick = () => pickB(b, c); row.appendChild(c); });
    document.getElementById('ui').appendChild(ov);
    const t0 = performance.now(), bar = ov.querySelector('.pk-t i');
    const tm = setInterval(() => { const k = (performance.now() - t0) / 8000; bar.style.width = Math.max(0, 100 - k * 100) + '%'; if (k >= 1) pickB(pool[0], row.children[0]); }, 100);
  }

  function end(survived) {
    if (!run || run.over) return;
    run.over = true;
    const k = run.kills, t = Math.min(RUN, run.t);
    for (const e of R.en) if (e.surv && !e.dead) { e.dead = true; SS.puff(e.x, e.y, 1); }
    R.eb.length = 0; hud.classList.add('hidden'); const gl = document.getElementById('goal'); if (gl) gl.classList.remove('sv-hide');
    const gems = Math.floor(k / 8) + (survived ? 15 : 0), scrolls = Math.floor(k / 35) + (survived ? 2 : 0), souls = (save.rebirths || 0) > 0 ? Math.floor(k / 90) + (survived ? 1 : 0) : 0;
    const rec = k > S.best; S.best = Math.max(S.best, k); S.bestT = Math.max(S.bestT, Math.floor(t));
    save.gems += gems; if (scrolls) SS.giveScroll(scrolls); if (souls && save.tree) save.tree.souls = (save.tree.souls || 0) + souls;
    const finish = () => {
      run = null; R.mode = null; R.phase = 'advance'; R.advLeft = 160 * SS.U; R.advSpd = 110 * SS.U;
      if (R.sq && R.sq.ko > 0) { R.sq.ko = 0.01; }
      SS.persist(); SS.refreshUI();
    };
    SS.sfx(survived ? 'win' : 'fail', 0);
    SS.openPanel(survived ? 'Hayatta Kaldın!' : 'Koşu Bitti', survived ? 'green' : 'red', body => {
      body.appendChild(SS.el(`<div class="sv-res"><div><small>Düşman</small><b>${k}</b></div><div><small>Süre</small><b>${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}</b></div><div><small>Seviye</small><b>${run.lvl}</b></div></div>`));
      if (rec) body.appendChild(SS.el('<p class="big-note"><b>Yeni rekor!</b></p>'));
      body.appendChild(SS.el(`<div class="row-card"><div class="ico tile"><img src="assets/ui/gem.png" alt=""></div><div class="info"><h4>Ödüller</h4><p>+${gems} elmas${scrolls ? ` · +${scrolls} parşömen` : ''}${souls ? ` · +${souls} ruh` : ''}</p></div></div>`));
      const b = SS.el('<button class="btn green wide">DEVAM</button>'); b.onclick = () => { SS.closePanel(); }; body.appendChild(b);
    });
    finish();
    if (survived && SS.chest) setTimeout(() => SS.chest([{ icon: 'ic_amulet', label: 'Rastgele Tılsım', apply: () => SS.charms && SS.charms.give(['atk', 'gold', 'guard'][Math.floor(Math.random() * 3)], Math.min(4, 1 + Math.floor((save.best || 1) / 20))) }], 'Hayatta Kalma sandığı'), 600);
  }

  // Arena tab content
  function open() {
    SS.openPanel('Arena', 'purple', body => {
      if (SS.hub) SS.hub.tabs(body, 'surv');
      body.appendChild(SS.el(`<div class="tw-head"><div><small>Rekor</small><b>${S.best}</b></div><div><small>Bugün</small><b>${free() ? 'Ücretsiz' : 'Bilet'}</b></div><div><small>Bilet</small><b>${(save.inv && save.inv.ticket) || 0}</b></div></div>`));
      body.appendChild(SS.el('<div class="row-card"><div class="ico tile"><img src="assets/ui/ic_death.png" alt=""></div><div class="info"><h4>Hayatta Kal</h4><p>150 saniye boyunca her yönden gelen sürülere dayan. Düşman yendikçe seviye atla ve koşu güçleri seç. Parmağınla kaçabilirsin.</p></div></div>'));
      body.appendChild(SS.el('<p class="big-note">Ödül: her 8 düşmana 1 elmas, parşömen ve (Doğuştan sonra) ruh. Sonuna kadar dayanırsan tılsım sandığı.</p>'));
      const can = free() || ((save.inv && save.inv.ticket) || 0) > 0;
      const b = SS.el(`<button class="btn ${can ? 'purple' : 'grey off'} wide">${free() ? 'BAŞLA' : can ? 'Bilet ile BAŞLA' : 'Yarın tekrar'}</button>`);
      b.onclick = () => { if (can) start(); }; body.appendChild(b);
    });
  }
  SS.survival = { open, start, get running() { return !!run; }, free };
})();
