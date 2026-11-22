/* Shuriken Squad feature: Fener Festivali — a weekend event (Friday 00:00 → Monday 00:00, local time).
   While it runs, enemies drop lanterns (Fener): a few % of kills, every elite, treasure monsters and bosses.
   Lanterns buy limited items in the festival shop, including the festival-only costume. Lanterns never expire,
   item stocks refill each festival. Lives as a tab in the Ödül panel; the Ödül button shows a lantern badge. */
'use strict';
(() => {
  const SS = window.SS;
  if (!SS) { console.warn('events: SS missing'); return; }
  const save = SS.save;
  if (!save.ev || typeof save.ev !== 'object') save.ev = { fen: 0, key: '', bought: {}, seen: '' };
  const E = save.ev;
  const ICON = 'assets/ui/mon_LanternRed.png';
  // festival window: this weekend (Fri-Sun); key = the Friday's date
  function window_() {
    const d = new Date(), day = d.getDay();   // 0 Sun ... 5 Fri 6 Sat
    if (day !== 5 && day !== 6 && day !== 0) return null;
    const fri = new Date(d.getFullYear(), d.getMonth(), d.getDate() - (day === 0 ? 2 : day - 5));
    const end = new Date(fri.getFullYear(), fri.getMonth(), fri.getDate() + 3);
    return { key: fri.toDateString(), end: end.getTime() };
  }
  const active = () => !!window_() || !!SS.forceEvent;
  const cur = () => window_() || { key: 'test', end: Date.now() + 864e5 };
  function sync() { const w = cur(); if (E.key !== w.key) { E.key = w.key; E.bought = {}; } }
  const ITEMS = [
    { id: 'skin', name: 'Fener Prensesi', txt: 'Festivale özel kostüm · +%6 hasar · +%6 altın', img: 'face_Princess', cost: 400, stock: 1, give: () => { const K = save.skins; K.owned.Princess = true; SS.banner('YENİ KOSTÜM!', 'Fener Prensesi'); } },
    { id: 'star', name: 'Yıldız Taşı', txt: 'Silah yıldızı için', img: 'ic_luck', cost: 60, stock: 3, give: () => { save.inv.star = (save.inv.star || 0) + 1; } },
    { id: 'scroll', name: '2 Parşömen', txt: 'Rastgele bir ninjaya', img: 'ic_book', cost: 40, stock: 5, give: () => SS.giveScroll(2) },
    { id: 'storm', name: 'Fırtına Tılsımı', txt: 'Fırtınayı hemen doldurur', img: 'ic_explosion', cost: 30, stock: 5, give: () => { save.inv.storm = (save.inv.storm || 0) + 1; } },
    { id: 'ticket', name: 'Boss Bileti', txt: '+15 sn ya da +1 Kule hakkı', img: 'ic_shield', cost: 30, stock: 5, give: () => { save.inv.ticket = (save.inv.ticket || 0) + 1; } },
    { id: 'gems', name: '40 Elmas', txt: '', img: 'gem_big', cost: 80, stock: 3, give: () => { save.gems += 40; } },
  ];
  if (SS.skins && !SS.skins.byId('Princess')) SS.skins.SKINS.push({ id: 'Princess', name: 'Fener Prensesi', cost: 0, event: 'Fener Festivali mağazası', bonus: { dmg: 1.06, money: 1.06 }, desc: '+%6 hasar · +%6 altın' });

  function drop(n, x, y) {
    if (!active()) return;
    E.fen += n; SS.addText(x, y, '+' + n, 'fen');
  }
  SS.HOOKS.kill.push(e => {
    if (!active() || !e) return;
    const n = e.treasure ? 5 : e.elite ? 1 : Math.random() < 0.05 ? 1 : 0;
    if (n) drop(n, e.x, e.y - 30 * SS.P);
  });
  SS.HOOKS.bossWin.push(b => { if (b) drop(5, b.x, b.y - 60 * SS.P); });
  SS.HOOKS.tower.push(() => { const L = SS.leader; if (L) drop(5, L.x, L.y - 30 * SS.P); });

  const left = () => { const ms = cur().end - Date.now(), h = Math.floor(ms / 3.6e6); return h >= 24 ? `${Math.floor(h / 24)}g ${h % 24}sa` : `${h}sa ${Math.floor(ms % 3.6e6 / 6e4)}dk`; };
  function tabs(body, k) {
    if (!active()) return;
    const t = SS.el(`<div class="dex-tabs"><button class="btn ${k === 'daily' ? 'green' : 'grey'}" data-k="daily">Günlük</button><button class="btn ${k === 'ev' ? 'red' : 'grey'}" data-k="ev">Festival</button></div>`);
    t.querySelectorAll('button').forEach(b => b.onclick = () => { if (b.dataset.k === k) return; SS.sfx('tick', 0); if (b.dataset.k === 'ev') open(); else SS.daily.open(); });
    body.appendChild(t);
  }
  function open() {
    sync();
    const sc = document.getElementById('pTitle').textContent === 'Fener Festivali' ? document.getElementById('pBody').scrollTop : 0;
    SS.openPanel('Fener Festivali', 'red', body => {
      tabs(body, 'ev');
      body.appendChild(SS.el(`<div class="ev-head"><img src="${ICON}" alt=""><div><b>${E.fen} fener</b><span>Bitişe ${left()} · düşmanlar, elitler, hazine ve bosslar fener düşürür</span></div></div>`));
      for (const it of ITEMS) {
        const got = E.bought[it.id] || 0, out = got >= it.stock || (it.id === 'skin' && save.skins && save.skins.owned && save.skins.owned.Princess), can = !out && E.fen >= it.cost;
        const r = SS.el(`<div class="row-card ev-row ${it.id === 'skin' ? 'mz-hero' : ''}"><div class="ico ${it.id === 'skin' ? 'face' : 'tile'}"><img src="assets/ui/${it.img}.png" alt=""></div>
          <div class="info"><h4>${it.name}</h4><p>${it.txt}${it.txt ? ' · ' : ''}${out ? 'Tükendi' : `Kalan ${it.stock - got}`}</p></div>
          <button class="btn ${out ? 'grey off' : can ? 'red' : 'grey off'}"><img src="${ICON}" alt="">${it.cost}</button></div>`);
        if (can) r.querySelector('.btn').onclick = () => {
          E.fen -= it.cost; E.bought[it.id] = got + 1; save.inv = save.inv || {}; it.give();
          SS.sfx('buy', 0); SS.sfx('bonus', 0); SS.persist(); SS.refreshUI(); open();
        };
        body.appendChild(r);
      }
      body.appendChild(SS.el('<p class="big-note">Her hafta sonu (Cuma–Pazar) gelir. Fenerler kaybolmaz; mağaza stokları her festivalde yenilenir.</p>'));
    });
    if (sc) document.getElementById('pBody').scrollTop = sc;
  }
  // lantern badge on the Ödül button + one banner when a festival starts
  function paint() { const b = document.getElementById('dailyBtn'); if (b) b.classList.toggle('ev-on', active()); }
  setInterval(paint, 30000); setTimeout(paint, 0);
  setTimeout(() => { if (active()) { sync(); if (E.seen !== E.key) { E.seen = E.key; SS.persist(); SS.banner('FENER FESTİVALİ!', 'Hafta sonu boyunca fener topla · Ödül → Festival'); } } }, 4000);
  SS.events = { open, active, tabs, ITEMS };
})();
