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
  const PERKS = [
    { id: 'sharp', r: 'c', max: 5, name: 'Keskin Uç', icon: 'ic_power', txt: '+%25 hasar' },
    { id: 'quick', r: 'c', max: 5, name: 'Seri Atış', icon: 'ic_rate', txt: '+%12 atış hızı' },
    { id: 'greed', r: 'c', max: 5, name: 'Altın Yağmuru', icon: 'ic_money', txt: '+%25 altın' },
    { id: 'crit', r: 'c', max: 4, name: 'Zayıf Nokta', icon: 'ic_vision', txt: '+%5 kritik şansı' },
    { id: 'leech', r: 'c', max: 3, name: 'Can Çalma', icon: 'ic_heal', txt: 'Her düşman takıma %2 can verir' },
    { id: 'slayer', r: 'c', max: 3, name: 'Boss Kırıcı', icon: 'ic_weapon', txt: '+%20 boss hasarı' },
    { id: 'storm', r: 'c', max: 3, name: 'Fırtına Çağrısı', icon: 'ic_amulet', txt: 'Fırtına %25 hızlı dolar' },
    { id: 'pierce', r: 'r', max: 2, name: 'Delici', icon: 'ic_book', txt: 'Atışlar +1 düşmanı deler' },
    { id: 'bounce', r: 'r', max: 2, name: 'Sekme', icon: 'ic_ring', txt: 'Atışlar +1 kez seker' },
    { id: 'frost', r: 'r', max: 3, name: 'Buz Dokunuşu', icon: 'wi_IceSpike', txt: '%20 şansla dondurur', glow: 'ice' },
    { id: 'flame', r: 'r', max: 3, name: 'Alev Dokunuşu', icon: 'wi_Fireball', txt: 'Vurulan düşman yanar', glow: 'fire' },
    { id: 'multi', r: 'e', max: 2, name: 'Çifte Bıçak', icon: 'shuriken', txt: '+1 atış (tam hasar)' },
    { id: 'chain', r: 'e', max: 3, name: 'Şimşek Zinciri', icon: 'ic_magic', txt: '%15 şansla zincir şimşek', glow: 'magic' },
    { id: 'blast', r: 'e', max: 3, name: 'Patlayan Uç', icon: 'ic_explosion', txt: '%15 şansla alan patlaması', glow: 'gold' },
  ];
  const W8 = { c: 6, r: 3, e: 1.5 }, RNAME = { c: 'Sıradan', r: 'Nadir', e: 'Destansı' };
  const byId = id => PERKS.find(p => p.id === id);
  if (!save.perks || typeof save.perks !== 'object') save.perks = {};
  const n = id => save.perks[id] || 0;
  const total = () => Object.values(save.perks).reduce((a, b) => a + b, 0);

  // ---------------- effects
  const M = SS.MODS;
  M.dmg.push(() => 1 + 0.25 * n('sharp'));
  M.rate.push(() => 1 + 0.12 * n('quick'));
  M.money.push(() => 1 + 0.25 * n('greed'));
  M.crit.push(() => 0.05 * n('crit'));
  M.boss.push(() => 1 + 0.2 * n('slayer'));
  M.ult.push(() => 1 + 0.25 * n('storm'));
  M.pierce.push(() => n('pierce'));
  M.bounce.push(() => n('bounce'));
  M.shots.push(() => n('multi'));
  SS.HOOKS.kill.push(() => { const sq = SS.squad; if (n('leech') && sq && sq.ko <= 0) sq.hp = Math.min(sq.maxHp, sq.hp + sq.maxHp * 0.02 * n('leech')); });
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
    if (n('chain') && Math.random() < 0.15) SS.chainBolt(c, q.dmg * (0.4 + 0.2 * n('chain')), 1 + n('chain'));
    if (n('blast') && Math.random() < 0.15) {
      SS.boom(x, y, 0.5); SS.vfx('burst', 'gold', x, y, 0.5, 0.25);
      for (const e of SS.R.en) if (e !== c && !e.dead && Math.hypot(e.x - x, SS.aimY(e) - y) < 64 * SS.U) SS.damage(e, q.dmg * (0.4 + 0.2 * n('blast')), false, false);
    }
  });
  SS.HOOKS.rebirth.push(() => { save.perks = {}; });

  // ---------------- the offer
  function roll(k) {
    const pool = PERKS.filter(p => n(p.id) < p.max), out = [];
    while (out.length < k && pool.length) {
      const sum = pool.reduce((a, p) => a + W8[p.r], 0); let r = Math.random() * sum, i = 0;
      while (i < pool.length - 1 && (r -= W8[pool[i].r]) > 0) i++;
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
    ov = SS.el(`<div class="pk-ov"><div class="pk-box"><div class="pk-title">YETENEK SEÇ<small>Bu Doğuşun sonuna kadar geçerli · ${total()} kart</small></div><div class="pk-row"></div>
      <div class="pk-foot"><button class="btn grey pk-rr ${rerolled || save.gems < REROLL_GEMS ? 'off' : ''}"><img src="assets/ui/gem.png" alt="">${REROLL_GEMS} · Yenile</button></div><div class="pk-t"><i></i></div></div></div>`);
    const row = ov.querySelector('.pk-row');
    cards.forEach((p, i) => {
      const have = n(p.id);
      const c = SS.el(`<button class="pk-card ${p.r}" style="animation-delay:${i * 0.07}s"><span class="pk-rar">${RNAME[p.r]}</span><div class="pk-ico"><img src="assets/ui/${p.icon}.png" alt=""></div>
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
