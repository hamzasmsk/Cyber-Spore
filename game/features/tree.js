/* Shuriken Squad feature: Ruh Ağacı — the rebirth talent tree.
   Every rebirth gives souls (1 + 1 per 5 stages past the rebirth minimum). Souls buy levels in three branches
   (Saldırı / Servet / Ustalık); a node opens once the node above it has a level, and the bottom node (Gölge Yolu)
   needs the last node of every branch. Costs rise per level, so the whole tree takes many rebirths.
   Respec costs gems and returns every soul spent. Effects plug into SS.MODS. */
'use strict';
(() => {
  const SS = window.SS;
  if (!SS) { console.warn('tree: SS missing'); return; }
  const save = SS.save, RESPEC_GEMS = 50;
  const pct = v => '%' + Math.round(v * 100);
  const NODES = [
    { id: 'blade', b: 0, r: 0, name: 'Keskin Bıçak', icon: 'ic_power', max: 10, fx: l => `+${pct(0.15 * l)} hasar` },
    { id: 'hand', b: 0, r: 1, name: 'Hızlı El', icon: 'ic_rate', max: 5, fx: l => `+${pct(0.05 * l)} atış hızı` },
    { id: 'eye', b: 0, r: 2, name: 'Kartal Gözü', icon: 'ic_vision', max: 5, fx: l => `+${pct(0.02 * l)} kritik şansı` },
    { id: 'fatal', b: 0, r: 3, name: 'Ölümcül Vuruş', icon: 'ic_death', max: 4, fx: l => `Kritik hasarı x${(3 + 0.5 * l).toFixed(1).replace('.0', '')}` },
    { id: 'gold', b: 1, r: 0, name: 'Altın Ruh', icon: 'ic_money', max: 10, fx: l => `+${pct(0.15 * l)} altın` },
    { id: 'hunt', b: 1, r: 1, name: 'Hazine Avcısı', icon: 'ic_luck', max: 3, fx: l => `+${pct(0.02 * l)} hazine canavarı şansı` },
    { id: 'sleep', b: 1, r: 2, name: 'Derin Uyku', icon: 'ic_moon', max: 4, fx: l => `Çevrimdışı kazanç sınırı +${2 * l} saat` },
    { id: 'gemsoul', b: 1, r: 3, name: 'Elmas Ruhu', icon: 'gem', max: 5, fx: l => `+${pct(0.2 * l)} Doğuş elması` },
    { id: 'body', b: 2, r: 0, name: 'Demir Beden', icon: 'ic_heal', max: 5, fx: l => `+${pct(0.15 * l)} takım canı` },
    { id: 'time', b: 2, r: 1, name: 'Zaman Ustası', icon: 'ic_sun', max: 5, fx: l => `Boss süresi +${3 * l} saniye` },
    { id: 'armor', b: 2, r: 2, name: 'Çelik Zırh', icon: 'ic_shield', max: 4, fx: l => `Takım -${pct(0.08 * l)} hasar alır` },
    { id: 'slayer', b: 2, r: 3, name: 'Boss Avcısı', icon: 'ic_weapon', max: 5, fx: l => `Bosslara +${pct(0.1 * l)} hasar` },
    { id: 'shadow', b: 1, r: 4, name: 'Gölge Yolu', icon: 'ic_boot', max: 4, cap: true, fx: l => `Doğuş sonrası ilk ${5 * l} bölüm: düşman canı yarı` },
  ];
  const BR = [{ name: 'Saldırı', col: 'red' }, { name: 'Servet', col: 'yellow' }, { name: 'Ustalık', col: 'blue' }];

  if (!save.tree || typeof save.tree !== 'object') save.tree = { souls: (save.rebirths || 0) * 4, lv: {} };   // earlier rebirths count
  if (!save.tree.lv) save.tree.lv = {};
  if (save.tree.lv.storm) { save.tree.lv.armor = save.tree.lv.storm; delete save.tree.lv.storm; }   // Fırtına was removed
  const lv = id => save.tree.lv[id] || 0;
  const cost = n => n.r + 1 + lv(n.id);
  const open = n => n.cap ? NODES.filter(o => o.r === 3).every(o => lv(o.id) > 0) : n.r === 0 || lv(NODES.find(o => o.b === n.b && o.r === n.r - 1).id) > 0;
  const points = () => save.tree.souls || 0;
  const spent = () => NODES.reduce((s, n) => { for (let k = 0; k < lv(n.id); k++) s += n.r + 1 + k; return s; }, 0);
  const soulGain = () => save.stage >= SS.REBIRTH_MIN ? 1 + Math.floor((save.stage - SS.REBIRTH_MIN) / 5) : 0;
  const canBuy = () => { const p = points(); if (!p) return false; for (const n of NODES) if (lv(n.id) < n.max && open(n) && cost(n) <= p) return true; return false; };

  // effects
  const M = SS.MODS;
  M.dmg.push(() => 1 + 0.15 * lv('blade'));
  M.rate.push(() => 1 + 0.05 * lv('hand'));
  M.crit.push(() => 0.02 * lv('eye'));
  M.critDmg.push(() => 0.5 * lv('fatal'));
  M.money.push(() => 1 + 0.15 * lv('gold'));
  M.treasure.push(() => 0.02 * lv('hunt'));
  M.offH.push(() => 2 * lv('sleep'));
  M.rgems.push(() => 1 + 0.2 * lv('gemsoul'));
  M.hp.push(() => 1 + 0.15 * lv('body'));
  M.bossTime.push(() => 3 * lv('time'));
  M.taken.push(() => 1 - 0.08 * lv('armor'));
  M.boss.push(() => 1 + 0.1 * lv('slayer'));
  M.ehp.push(() => lv('shadow') && save.stage <= 5 * lv('shadow') ? 0.5 : 1);
  SS.HOOKS.rebirth.push(() => { save.tree.souls = points() + soulGain(); });

  let sel = 'blade';
  function build(body) {
    const n = NODES.find(o => o.id === sel) || NODES[0], l = lv(n.id), op = open(n), mx = l >= n.max, c = cost(n);
    body.appendChild(SS.el(`<div class="tr-head"><img src="assets/ui/ic_rebirth.png" alt=""><div><b>${points()} ruh</b><span>${soulGain() ? `Şimdi doğarsan +${soulGain()} ruh` : `Doğuş ruh verir (${SS.REBIRTH_MIN}. bölümden)`} · her 5 bölüm +1</span></div></div>`));
    // detail of the selected node
    const lockTxt = n.cap ? 'Üç dalın son düğümü açılınca' : 'Üstteki düğüm açılınca';
    const d = SS.el(`<div class="tr-detail ${BR[n.b].col}"><div class="ico tile"><img src="assets/ui/${n.icon}.png" alt=""></div><div class="info">
      <h4>${n.name} <small>${l}/${n.max}</small></h4><p>${l ? 'Şu an: ' + n.fx(l) : 'Henüz açılmadı'}${mx ? '' : `<br>Sonraki: <b>${n.fx(l + 1)}</b>`}</p></div>
      ${mx ? '<button class="btn grey off">MAKS</button>' : !op ? `<button class="btn grey off"><img src="assets/ui/lock.png" alt=""></button>` : `<button class="btn purple ${points() >= c ? '' : 'off'}">${c} ruh</button>`}</div>`);
    if (!op && !mx) d.querySelector('p').insertAdjacentHTML('beforeend', `<br><em>${lockTxt}</em>`);
    const bt = d.querySelector('.btn.purple');
    if (bt) bt.onclick = () => {
      if (points() < c) { SS.sfx('no'); SS.toast('Yeterli ruh yok · Doğuş ile kazan'); return; }
      save.tree.souls -= c; save.tree.lv[n.id] = l + 1; SS.persist(); SS.refreshUI();
      SS.sfx('buy', 0, undefined, [0, 2, 4, 7, 9, 12, 14][Math.min(6, l)]); SS.sfx('magic', 0);
      if (n.id === 'body' && SS.squad) SS.squad.maxHp = SS.sqMaxHp();
      SS.PANELS.rebirth('t');
      const t = document.querySelector(`.tr-node[data-id="${n.id}"]`); if (t) { t.classList.add('got'); }
    };
    body.appendChild(d);
    // the tree: three branches side by side, the capstone below
    const grid = SS.el('<div class="tr-grid"></div>');
    BR.forEach((b, bi) => {
      const col = SS.el(`<div class="tr-col ${b.col}"><div class="tr-br">${b.name}</div></div>`);
      NODES.filter(o => o.b === bi && !o.cap).forEach(o => col.appendChild(node(o)));
      grid.appendChild(col);
    });
    body.appendChild(grid);
    const capRow = SS.el('<div class="tr-cap"></div>'); capRow.appendChild(node(NODES.find(o => o.cap))); body.appendChild(capRow);
    const sp = spent();
    const foot = SS.el(`<div class="btnrow"><button class="btn grey ${sp ? '' : 'off'}"><img src="assets/ui/gem.png" alt="">${RESPEC_GEMS} · Sıfırla</button></div>`);
    foot.querySelector('.btn').onclick = () => {
      if (!sp) return;
      if (save.gems < RESPEC_GEMS) { SS.sfx('no'); SS.toast('Yeterli elmas yok'); return; }
      if (!confirm(`Ruh Ağacı sıfırlansın mı? ${sp} ruh geri döner (${RESPEC_GEMS} elmas).`)) return;
      save.gems -= RESPEC_GEMS; save.tree.souls = points() + sp; save.tree.lv = {}; SS.persist(); SS.refreshUI(); SS.sfx('close', 0); SS.PANELS.rebirth('t');
    };
    body.appendChild(foot);
  }
  function node(o) {
    const l = lv(o.id), op = open(o), afford = op && l < o.max && cost(o) <= points();
    const t = SS.el(`<button class="tr-node ${op ? '' : 'lock'} ${l ? 'has' : ''} ${l >= o.max ? 'max' : ''} ${afford ? 'can' : ''} ${o.id === sel ? 'sel' : ''}" data-id="${o.id}">
      <img src="assets/ui/${op ? o.icon : 'lock'}.png" alt=""><span>${l}/${o.max}</span></button>`);
    t.onclick = () => { sel = o.id; SS.sfx('tick', 0); SS.PANELS.rebirth('t'); };
    return t;
  }
  SS.tree = { build, points, soulGain, canBuy, lv, NODES, open: () => SS.PANELS.rebirth('t') };
})();
