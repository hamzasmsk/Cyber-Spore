/* Shuriken Squad — "Meydan" hub: the Görev button opens one panel with tabs (Görevler · Arena · Kule · Başarım · Sıralama).
   Each feature builds its own tab; this file only draws the tab bar. Load before missions/tower/achievements. */
'use strict';
(() => {
  const SS = window.SS;
  if (!SS) return;
  const TABS = [
    { k: 'missions', icon: 'ic_missions', label: 'Görevler', open: () => SS.missions && SS.missions.open(), badge: () => 0 },
    { k: 'surv', icon: 'ic_death', label: 'Arena', open: () => SS.survival && SS.survival.open(), badge: () => (SS.survival && SS.survival.free() ? 1 : 0) },
    { k: 'tower', icon: 'ic_towerach', label: 'Kule', open: () => SS.tower && SS.tower.open(), badge: () => (SS.tower ? SS.tower.attempts() : 0) },
    { k: 'ach', icon: 'cup', label: 'Başarım', open: () => SS.ach && SS.ach.open(), badge: () => (SS.ach ? SS.ach.ready() : 0) },
    { k: 'rank', icon: 'ic_rank', label: 'Sıralama', open: () => SS.ranking && SS.ranking.open(), badge: () => 0 },
  ];
  function tabs(body, active) {
    const list = TABS.filter(x => !SS.unlocked || SS.unlocked(x.k));
    if (list.length < 2) return;
    const t = SS.el(`<div class="dex-tabs hub-tabs">${list.map(x => { const b = x.badge(); return `<button class="btn ${x.k === active ? 'purple' : 'grey'}" data-k="${x.k}"><img src="assets/ui/${x.icon}.png" alt=""><span>${x.label}</span>${b ? `<i>${b}</i>` : ''}</button>`; }).join('')}</div>`);
    t.querySelectorAll('button').forEach(b => b.onclick = () => { if (b.dataset.k === active) return; SS.sfx('tick', 0); TABS.find(x => x.k === b.dataset.k).open(); });
    body.appendChild(t);
  }
  SS.hub = { tabs };
})();
