/* Shuriken Squad feature: Tılsımlar (charms) + the shared chest-opening moment.
   Three slots: Saldırı (damage), Servet (gold), Koruma (less damage taken + more squad HP). Charms drop — never
   for money, never random-paid — from first boss clears, Kule floors and now and then from repeat bosses. The best
   charm of each slot is worn automatically; three of the same tier merge into one of the next tier (max 10).
   SS.chest(rewards, title) plays the chest moment: the chest shakes, bursts open and the rewards pop out one by one. */
'use strict';
(() => {
  const SS = window.SS;
  if (!SS) return;
  const save = SS.save, MAX = 10;
  const SLOTS = [
    { k: 'atk', name: 'Saldırı Tılsımı', icon: 'ic_power', col: 'red', fx: t => `+%${12 * t} hasar` },
    { k: 'gold', name: 'Servet Tılsımı', icon: 'ic_money', col: 'yellow', fx: t => `+%${12 * t} altın` },
    { k: 'guard', name: 'Koruma Tılsımı', icon: 'ic_shield', col: 'blue', fx: t => `-%${4 * t} alınan hasar · +%${8 * t} can` },
  ];
  if (!save.charm || typeof save.charm !== 'object') save.charm = {};
  for (const s of SLOTS) if (!Array.isArray(save.charm[s.k])) save.charm[s.k] = Array(MAX + 1).fill(0);
  const C = save.charm;
  const best = k => { for (let t = MAX; t >= 1; t--) if (C[k][t] > 0) return t; return 0; };
  const M = SS.MODS;
  M.dmg.push(() => 1 + 0.12 * best('atk'));
  M.money.push(() => 1 + 0.12 * best('gold'));
  M.taken.push(() => 1 - 0.04 * best('guard'));
  M.hp.push(() => 1 + 0.08 * best('guard'));
  const mergeable = () => SLOTS.some(s => C[s.k].some((n, t) => t >= 1 && t < MAX && n >= 3));

  function give(k, tier, n = 1) { C[k][tier] = (C[k][tier] || 0) + n; SS.persist(); SS.refreshUI(); paintTeam(); }
  const rnd = () => SLOTS[Math.floor(Math.random() * SLOTS.length)].k;

  // ---------------- drops
  SS.HOOKS.bossWin.push(b => {
    const first = save.stage >= (save.best || 1);   // hooks run before the stage advances
    if (!first && Math.random() > 0.25) return;
    const tier = Math.max(1, Math.min(4, 1 + Math.floor((save.stage - 1) / 15))), k = rnd();
    // no chest popup after bosses (the skill-card choice is already the boss reward moment): the charm is added
    // quietly with a short toast; the Takım button shows when a merge is possible
    setTimeout(() => { give(k, tier); SS.toast(`+${SLOTS.find(s => s.k === k).name} ${tier}`); }, 3200);
  });
  SS.HOOKS.tower && SS.HOOKS.tower.push(f => {
    const tier = Math.max(1, Math.min(6, 1 + Math.floor(f / 8))), k = rnd(), n = f % 10 === 0 ? 2 : 1;
    if (f % 5 !== 0) return;   // every 5th floor
    setTimeout(() => chest([{ icon: SLOTS.find(s => s.k === k).icon, label: `${n} × ${SLOTS.find(s => s.k === k).name} ${tier}`, apply: () => give(k, tier, n) }], `Kule ${f}. kat sandığı`), 1200);
  });

  // ---------------- chest moment (shared)
  let busy = false;
  function chest(items, title = 'Sandık') {
    if (busy) { items.forEach(i => i.apply && i.apply()); return; }
    busy = true; SS.R.paused = true;
    const ov = SS.el(`<div class="ch-ov"><div class="ch-box"><b class="ch-title">${title}</b><div class="ch-chest"><img src="assets/ui/chest.png" alt=""></div><div class="ch-items"></div><button class="btn green ch-ok">AL</button><small class="ch-hint">Dokun: aç</small></div></div>`);
    document.getElementById('ui').appendChild(ov);
    const ch = ov.querySelector('.ch-chest'), img = ch.querySelector('img'), list = ov.querySelector('.ch-items'), okb = ov.querySelector('.ch-ok');
    let opened = false;
    const open = () => {
      if (opened) return; opened = true; ov.querySelector('.ch-hint').remove();
      ch.classList.add('shake'); SS.sfx('tick', 0); setTimeout(() => SS.sfx('tick', 0, undefined, 4), 180); setTimeout(() => SS.sfx('tick', 0, undefined, 7), 360);
      setTimeout(() => {
        ch.classList.remove('shake'); ch.classList.add('burst'); img.src = 'assets/ui/chest_open.png'; SS.sfx('gold', 0); SS.sfx('bonus', 0);
        items.forEach((it, i) => setTimeout(() => {
          const row = SS.el(`<div class="ch-item"><img src="assets/ui/${it.icon}.png" alt=""><span>${it.label}</span></div>`);
          list.appendChild(row); SS.sfx('accept', 0, undefined, i * 2); if (it.apply) it.apply();
          if (i === items.length - 1) okb.classList.add('show');
        }, 250 + i * 260));
      }, 620);
    };
    ch.onclick = open; setTimeout(open, 1400);   // opens by itself if nobody taps (idle play)
    const close = () => { ov.classList.add('out'); setTimeout(() => ov.remove(), 220); busy = false; SS.R.paused = false; if (SS.flow) SS.flow.mark(); };
    okb.onclick = close; setTimeout(() => { if (ov.isConnected && okb.classList.contains('show')) close(); }, 7000);
  }
  SS.chest = chest;

  // ---------------- panel (from the Takım panel)
  function open() {
    SS.openPanel('Tılsımlar', 'purple', body => {
      body.appendChild(SS.el('<p class="big-note">Her yuvada en iyi tılsımın otomatik takılır. Aynı seviyeden <b>3 tılsım</b> birleşip bir üst seviyeye çıkar. Bosslardan (ilk geçiş) ve Kule\'nin her 5. katından düşer.</p>'));
      for (const s of SLOTS) {
        const b = best(s.k), counts = C[s.k];
        const tiers = counts.map((n, t) => t >= 1 && n > 0 ? `<span class="cm-t ${t === b ? 'on' : ''}"><i>${t}</i>×${n}</span>` : '').join('');
        const canMerge = counts.findIndex((n, t) => t >= 1 && t < MAX && n >= 3);
        const r = SS.el(`<div class="row-card cm-row ${s.col}"><div class="ico tile"><img src="assets/ui/${s.icon}.png" alt="">${b ? `<span class="hl-lv">Sv.${b}</span>` : ''}</div>
          <div class="info"><h4>${s.name}</h4><p>${b ? 'Takılı: <b>' + s.fx(b) + '</b>' : 'Henüz yok'}</p><div class="cm-tiers">${tiers || '<small>Bosslardan ve Kule sandıklarından düşer</small>'}</div></div>
          <button class="btn ${canMerge > 0 ? 'green' : 'grey off'}">BİRLEŞTİR</button></div>`);
        if (canMerge > 0) r.querySelector('.btn').onclick = () => {
          counts[canMerge] -= 3; counts[canMerge + 1]++; SS.persist(); SS.refreshUI();
          SS.sfx('skill', 0); SS.sfx('buy', 0, undefined, canMerge * 2); SS.toast(`${s.name} ${canMerge + 1}!`); open();
        };
        body.appendChild(r);
      }
    });
  }
  // entry row at the top of the Takım panel
  function paintTeam() { const b = document.querySelector('[data-open="team"]'); if (b && mergeable()) b.classList.add('notify'); }
  new MutationObserver(() => {
    if (document.getElementById('pTitle').dataset.k !== 'Takım') return;
    const body = document.getElementById('pBody'); if (body.querySelector('.cm-entry')) return;
    const n = SLOTS.reduce((a, s) => a + best(s.k), 0);
    const e = SS.el(`<button class="row-card cm-entry"><div class="ico tile"><img src="assets/ui/ic_amulet.png" alt=""></div><div class="info"><h4>Tılsımlar ${mergeable() ? '<span class="cm-new">birleştir!</span>' : ''}</h4><p>${SLOTS.map(s => `${s.name.split(' ')[0]} ${best(s.k)}`).join(' · ')}</p></div><span class="btn purple">AÇ</span></button>`);
    e.onclick = () => { SS.sfx('click'); open(); };
    body.insertBefore(e, body.children[1] || null);
  }).observe(document.getElementById('pBody'), { childList: true });
  SS.charms = { open, give, best, SLOTS, chest };
})();
