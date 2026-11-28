/* Shuriken Squad feature: Yetenek Kartları — after every boss win pick 1 of 3 cards.
   Cards last for the current run (until the next rebirth), stack up to a cap and change how the squad's
   throws behave (pierce, ricochet, extra blades, frost / fire / lightning / blast on hit, ...), so every run
   builds differently. The game pauses while the cards are shown; if nobody picks (idle play) the first card is
   taken automatically after a few seconds. One reroll per offer for a few gems. */
'use strict';
(() => {
  const SS = window.SS;
  if (!SS) { console.warn('perks: SS missing'); return; }
  const save = SS.save, AUTO_S = 12, REROLL_GEMS = 5;
  // r: rarity (c common, r rare, e epic) · max stacks · glow: projectile glow colour while the perk is active
  // numbers are kept modest: a card is a build choice, not a free skip past the stage's difficulty (1.0.1 ramp)
  const PERKS = [
    { id: 'sharp', r: 'c', max: 5, name: 'Keskin Uç', icon: 'ic_spike', txt: '+%15 hasar' },
    { id: 'quick', r: 'c', max: 5, name: 'Seri Atış', icon: 'ic_wind', txt: '+%8 atış hızı' },
    { id: 'greed', r: 'c', max: 5, name: 'Altın Yağmuru', icon: 'ic_goldrain', txt: '+%20 altın' },
    { id: 'crit', r: 'c', max: 4, name: 'Zayıf Nokta', icon: 'ic_crit', txt: '+%4 kritik şansı' },
    { id: 'leech', r: 'c', max: 3, name: 'Can Çalma', icon: 'ic_lifesteal', txt: 'Her düşman takıma %1.5 can verir' },
    { id: 'slayer', r: 'c', max: 3, name: 'Boss Kırıcı', icon: 'ic_punch', txt: '+%15 boss hasarı' },
    { id: 'guard', r: 'c', max: 3, name: 'Kalkan', icon: 'ic_guard', txt: '-%12 alınan hasar' },
    { id: 'pierce', r: 'r', max: 2, name: 'Delici', icon: 'ic_pierce', txt: 'Atışlar +1 düşmanı deler' },
    { id: 'bounce', r: 'r', max: 2, name: 'Sekme', icon: 'ic_ring', txt: 'Atışlar +1 kez seker' },
    { id: 'frost', r: 'r', max: 3, name: 'Buz Dokunuşu', icon: 'ic_frost', txt: '%20 şansla dondurur', glow: 'ice' },
    { id: 'flame', r: 'r', max: 3, name: 'Alev Dokunuşu', icon: 'ic_flame', txt: 'Vurulan düşman yanar', glow: 'fire' },
    { id: 'reaper', r: 'r', max: 3, name: 'Biçici', icon: 'ic_scythe', txt: 'Ölen düşman %20 şansla patlar, yanındakilere vurur', glow: 'leaf' },
    { id: 'execute', r: 'r', max: 2, name: 'İnfaz', icon: 'ic_execute', txt: 'Canı %10 altına düşen düşman anında ölür' },
    { id: 'second', r: 'r', max: 1, name: 'İkinci Rüzgar', icon: 'heart', txt: 'Nakavt olacakken bir kez yarım canla kalkar (her boss sonrası yenilenir)' },
    { id: 'multi', r: 'e', max: 2, name: 'Çifte Bıçak', icon: 'ic_auto', txt: '+1 atış (%60 hasar)' },
    { id: 'chain', r: 'e', max: 3, name: 'Şimşek Zinciri', icon: 'ic_chain', txt: '%12 şansla zincir şimşek', glow: 'magic' },
    { id: 'blast', r: 'e', max: 3, name: 'Patlayan Uç', icon: 'ic_explosion', txt: '%12 şansla alan patlaması', glow: 'gold' },
    { id: 'orbit', r: 'e', max: 3, name: 'Dönen Bıçaklar', icon: 'ic_orbit', txt: 'Takımın etrafında 2 shuriken döner, yaklaşanı keser' },
  ];
  const W8 = { c: 6, r: 3, e: 1.5 }, RNAME = { c: 'Sıradan', r: 'Nadir', e: 'Destansı' };
  const byId = id => PERKS.find(p => p.id === id);
  if (!save.perks || typeof save.perks !== 'object') save.perks = {};
  const n = id => save.perks[id] || 0;
  const total = () => Object.values(save.perks).reduce((a, b) => a + b, 0);

  // ---------------- effects
  const M = SS.MODS;
  M.dmg.push(() => 1 + 0.15 * n('sharp'));
  M.dmg.push(() => n('multi') ? 1 / (1 + n('multi')) * (1 + 0.6 * n('multi')) : 1);   // extra blades hit at 60%
  M.rate.push(() => 1 + 0.08 * n('quick'));
  M.money.push(() => 1 + 0.2 * n('greed'));
  M.crit.push(() => 0.04 * n('crit'));
  M.boss.push(() => 1 + 0.15 * n('slayer'));
  M.taken.push(() => 1 - 0.12 * n('guard'));
  M.pierce.push(() => n('pierce'));
  M.bounce.push(() => n('bounce'));
  M.shots.push(() => n('multi'));
  SS.HOOKS.kill.push(() => { const sq = SS.squad; if (n('leech') && sq && sq.ko <= 0) sq.hp = Math.min(sq.maxHp, sq.hp + sq.maxHp * 0.015 * n('leech')); });
  SS.HOOKS.shot.push(q => {   // tint the throw with the strongest elemental card so the build is visible
    if (!q) return; let best = null, bn = 0;
    for (const p of PERKS) if (p.glow && n(p.id) > bn) { bn = n(p.id); best = p.glow; }
    if (best) q.pg = best;
  });
  SS.HOOKS.hit.push((q, c, isB) => {
    if (q.special) return;
    const x = q.x, y = q.y;
    if (!isB && n('frost') && Math.random() < 0.2 * Math.min(1.5, 0.5 + n('frost') * 0.5)) { c.slow = 2.5; SS.fx('fx_ice', c.x, SS.aimY(c), 0.5, 0.4); }
    if (!isB && n('flame')) { c.burn = 2; c.burnD = Math.max(c.burnD || 0, q.dmg * 0.1 * n('flame')); c.burnT = c.burnT || 0.4; }
    if (n('chain') && Math.random() < 0.12) SS.chainBolt(c, q.dmg * (0.4 + 0.2 * n('chain')), 1 + n('chain'));
    if (n('blast') && Math.random() < 0.12) {
      SS.boom(x, y, 0.5); SS.vfx('burst', 'gold', x, y, 0.5, 0.25);
      for (const e of SS.R.en) if (e !== c && !e.dead && Math.hypot(e.x - x, SS.aimY(e) - y) < 64 * SS.U) SS.damage(e, q.dmg * (0.4 + 0.2 * n('blast')), false, false);
    }
  });
  // İnfaz: a hit that leaves an enemy under 10% (5% per extra card) finishes it
  SS.HOOKS.hit.push((q, c, isB) => {
    if (isB || !n('execute') || !c || c.dead || c.treasure) return;
    if (c.hp > 0 && c.hp < c.maxHp * (0.05 + 0.05 * n('execute'))) { SS.damage(c, c.hp + 1, false, false); SS.addText && SS.addText(c.x, c.y - 14 * SS.P, 'İNFAZ', 'crit'); }
  });
  // Biçici: kills can burst and take the neighbours with them (one level of chain, so hordes melt)
  let reapT = 0;
  SS.HOOKS.kill.push(e => {
    if (!n('reaper') || !e || e.reaped || SS.R.t - reapT < 0.03 || Math.random() > 0.2) return;
    reapT = SS.R.t;
    const dmg = SS.enemyHp() * 0.4 * (0.6 + 0.4 * n('reaper')), r = (52 + 8 * n('reaper')) * SS.U;
    SS.vfx('ring', 'leaf', e.x, e.y - 8 * SS.P, 0.8, 0.3); SS.vfx('burst', 'leaf', e.x, e.y - 8 * SS.P, 0.6, 0.25);
    for (const o of SS.R.en) if (o !== e && !o.dead && !o.treasure && Math.hypot(o.x - e.x, o.y - e.y) < r) { o.reaped = true; SS.damage(o, dmg, false, false); o.reaped = false; }
  });
  // İkinci Rüzgar: one save from a knockout per boss
  let winds = n('second');
  SS.HOOKS.bossWin.push(() => { winds = n('second'); });
  SS.HOOKS.perk.push(p => { if (p.id === 'second') winds = n('second'); });
  SS.HOOKS.hurt.push(() => {
    const sq = SS.squad; if (!sq || sq.hp > 0 || winds <= 0 || SS.R.mode) return;
    winds--; sq.hp = sq.maxHp * 0.5; sq.inv = 1.5;
    const L0 = SS.leader; if (L0) { SS.vfx('ring', 'leaf', L0.x, L0.y - 8 * SS.P, 1.6, 0.5); SS.vfx('burst', 'gold', L0.x, L0.y - 10 * SS.P, 1, 0.4); }
    SS.banner('İKİNCİ RÜZGAR!', 'Takım ayağa kalktı'); SS.sfx('skill', 0);
  });
  // Dönen Bıçaklar: 2 shuriken per card circle the squad and cut whatever comes close
  let orbA = 0, orbT = 0;
  SS.HOOKS.update.push(dt => {
    const k = n('orbit'), L0 = SS.leader; if (!k || !L0 || SS.R.paused) return;
    orbA += dt * 3.2; orbT -= dt; if (orbT > 0) return; orbT = 0.2;
    const N = 2 * k, rad = 54 * SS.U, dmg = SS.dmgPerShot() * 0.35 * (1 + 0.25 * (k - 1));
    for (let i = 0; i < N; i++) {
      const a = orbA + i * Math.PI * 2 / N, x = L0.x + Math.cos(a) * rad, y = L0.y - 10 * SS.P + Math.sin(a) * rad * 0.6;
      for (const e of SS.R.en) if (!e.dead && !e.treasure && Math.hypot(e.x - x, SS.aimY(e) - y) < 22 * SS.U) { SS.damage(e, dmg, false, false); break; }
    }
  });
  SS.HOOKS.render.push(() => {
    const k = n('orbit'), L0 = SS.leader; if (!k || !L0 || (SS.R.sq && SS.R.sq.ko > 0)) return;
    const N = 2 * k, rad = 54 * SS.U, f = Math.floor(SS.R.t * 20) % 8;
    for (let i = 0; i < N; i++) {
      const a = orbA + i * Math.PI * 2 / N;
      SS.spr(`pps_Shuriken_${f}`, L0.x + Math.cos(a) * rad, L0.y - 10 * SS.P + Math.sin(a) * rad * 0.6, 0.6, 0.5, 0.5);
    }
  });
  SS.HOOKS.rebirth.push(() => { save.perks = {}; winds = 0; });

  // ---------------- the offer
  function roll(k) {
    const pool = PERKS.filter(p => n(p.id) < p.max), out = [];
    while (out.length < k && pool.length) {
      const w = p => W8[p.r] * (p.r === 'c' ? 1 : 1 + 0.08 * total());   // longer runs see more rare / epic cards
      const sum = pool.reduce((a, p) => a + w(p), 0); let r = Math.random() * sum, i = 0;
      while (i < pool.length - 1 && (r -= w(pool[i])) > 0) i++;
      out.push(pool.splice(i, 1)[0]);
    }
    return out;
  }
  let ov = null, timer = 0;
  function offer() {
    if (ov || SS.R.boss) return;
    const cards = roll(3);
    if (!cards.length) { const g = 3; save.gems += g; SS.toast(`Tüm kartlar dolu · +${g} elmas`); return; }
    show(cards, false);
  }
  function show(cards, rerolled) {
    close(true);
    SS.R.paused = true;
    ov = SS.el(`<div class="pk-ov"><div class="pk-box"><div class="pk-title">YETENEK SEÇ<small>${(SS.save.best || 1) >= 8 ? 'Bu Doğuşun sonuna kadar geçerli' : 'Bu tur boyunca geçerli'} · ${total()} kart</small></div><div class="pk-row"></div>
      <div class="pk-foot"><button class="btn grey pk-rr ${rerolled || save.gems < REROLL_GEMS ? 'off' : ''}"><img src="assets/ui/gem.png" alt="">${REROLL_GEMS} · Yenile</button></div><div class="pk-t"><i></i></div></div></div>`);
    const row = ov.querySelector('.pk-row');
    cards.forEach((p, i) => {
      const have = n(p.id);
      const c = SS.el(`<button class="pk-card ${p.r}" data-id="${p.id}" style="animation-delay:${i * 0.07}s"><span class="pk-rar">${RNAME[p.r]}</span><div class="pk-ico"><img src="assets/ui/${p.icon}.png" alt=""></div>
        <b>${p.name}</b><p>${p.txt}</p><span class="pk-lv">${[...Array(p.max)].map((_, k) => `<i class="${k < have ? 'on' : k === have ? 'new' : ''}"></i>`).join('')}</span></button>`);
      c.onclick = () => pick(p, c);
      row.appendChild(c);
    });
    ov.querySelector('.pk-rr').onclick = e => {
      if (rerolled || save.gems < REROLL_GEMS) return;
      save.gems -= REROLL_GEMS; SS.sfx('tick', 0); SS.refreshUI(); show(roll(3), true);
    };
    document.getElementById('ui').appendChild(ov);
    SS.sfx('bonus', 0);
    const bar = ov.querySelector('.pk-t i'), t0 = performance.now();
    clearInterval(timer);
    timer = setInterval(() => {
      const k = (performance.now() - t0) / (AUTO_S * 1000);
      if (bar) bar.style.width = Math.max(0, 100 - k * 100) + '%';
      if (k >= 1) pick(cards[0], row.children[0]);
    }, 100);
  }
  function pick(p, el) {
    if (!ov || ov.dataset.done) return;
    ov.dataset.done = '1'; clearInterval(timer);
    save.perks[p.id] = n(p.id) + 1; SS.persist(); SS.refreshUI(); SS.HOOKS.perk.forEach(h => { try { h(p); } catch (e) { /* ignore */ } });
    if (el) el.classList.add('chosen');
    SS.sfx('accept', 0); SS.sfx('magic', 0);
    const L0 = SS.leader;
    if (L0) { SS.vfx('ring', p.glow || (p.r === 'e' ? 'magic' : p.r === 'r' ? 'ice' : 'gold'), L0.x, L0.y - 8 * SS.P, 1.5, 0.5); SS.vfx('burst', p.glow || 'gold', L0.x, L0.y - 10 * SS.P, 1, 0.4); }
    setTimeout(() => close(), 380);
  }
  function close(silent) {
    clearInterval(timer);
    if (ov) { ov.remove(); ov = null; }
    if (!silent) SS.R.paused = false;
  }
  SS.HOOKS.bossWin.push(() => setTimeout(offer, 1500));

  // list for the rebirth panel / anywhere else
  function list() { return PERKS.filter(p => n(p.id)).map(p => ({ ...p, n: n(p.id) })); }
  SS.perks = { PERKS, list, offer, total };
})();
