/* Shuriken Squad — "Meydan" hub: the Görev button opens one panel with tabs (Görevler · Kule · Başarımlar).
   Each feature builds its own tab; this file only draws the tab bar. Load before missions/tower/achievements. */
'use strict';
(() => {
  const SS = window.SS;
  if (!SS) return;
  const TABS = [
    { k: 'missions', label: 'Görevler', open: () => SS.missions && SS.missions.open(), badge: () => 0 },
    { k: 'surv', label: 'Arena', open: () => SS.survival && SS.survival.open(), badge: () => (SS.survival && SS.survival.free() ? 1 : 0) },
    { k: 'tower', label: 'Kule', open: () => SS.tower && SS.tower.open(), badge: () => (SS.tower ? SS.tower.attempts() : 0) },
    { k: 'ach', label: 'Başarım', open: () => SS.ach && SS.ach.open(), badge: () => (SS.ach ? SS.ach.ready() : 0) },
  ];
  function tabs(body, active) {
    const list = TABS.filter(x => !SS.unlocked || SS.unlocked(x.k));
    if (list.length < 2) return;
    const t = SS.el(`<div class="dex-tabs hub-tabs">${list.map(x => { const b = x.badge(); return `<button class="btn ${x.k === active ? 'purple' : 'grey'}" data-k="${x.k}">${x.label}${b ? `<i>${b}</i>` : ''}</button>`; }).join('')}</div>`);
    t.querySelectorAll('button').forEach(b => b.onclick = () => { if (b.dataset.k === active) return; SS.sfx('tick', 0); TABS.find(x => x.k === b.dataset.k).open(); });
    body.appendChild(t);
  }
  SS.hub = { tabs };
})();
