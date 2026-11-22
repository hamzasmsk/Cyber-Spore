/* Swarm Squad feature: "Kostüm" — character skins for the squad leader, bought with gems.
   The equipped skin swaps the leader's sprite (game.js: heroId(0) = save.skin || TEAM[0].id) and gives a small bonus. */
(() => {
'use strict';
function boot() {
  const SS = window.SS; if (!SS || SS._skinsB) return; SS._skinsB = true;
  const save = SS.save;
  const DEF_ID = 'NinjaBlue';
  const SKINS = [
    { id: 'NinjaBlue',   name: 'Kaptan (varsayılan)', cost: 0,   desc: 'Sade görünüm' },
    { id: 'SamuraiBlue', name: 'Samuray',        cost: 25,  bonus: { rate: 1.03 },  desc: '+%3 atış hızı' },
    { id: 'MaskFrog',    name: 'Kurbağa',        cost: 50,  bonus: { money: 1.05 }, desc: '+%5 altın' },
    { id: 'Skeleton',    name: 'İskelet',        cost: 80,  bonus: { dmg: 1.06 },   desc: '+%6 hasar' },
    { id: 'RedNinja3',   name: 'Kızıl Gölge',    cost: 120, bonus: { rate: 1.06 },  desc: '+%6 atış hızı' },
    { id: 'KnightGold',  name: 'Altın Şövalye',  cost: 180, bonus: { money: 1.10 }, desc: '+%10 altın' },
    { id: 'Master',      name: 'Usta',           cost: 260, bonus: { dmg: 1.08, money: 1.05 }, desc: '+%8 hasar · +%5 altın' },
  ];
  const byId = id => SKINS.find(s => s.id === id);

  // save: { owned: { <heroId>: true } }; older saves had bullet/hat keys, which are simply dropped
  if (!save.skins || typeof save.skins !== 'object') save.skins = {};
  const K = save.skins;
  if (!K.owned || typeof K.owned !== 'object') K.owned = {};
  delete K.bullet; delete K.hat;
  K.owned[DEF_ID] = true;
  // other features (Ninja Yolu, festivals) add their costumes to SKINS after this file runs, so ownership is never
  // pruned here (a paid costume must survive a reload) and the equipped one is only checked once every script ran
  const check = () => { if (save.skin && (!byId(save.skin) || !K.owned[save.skin] || save.skin === DEF_ID)) { delete save.skin; if (SS.R.heroes.length) SS.setupHeroes(); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', check); else setTimeout(check, 0);

  const cur = () => byId(save.skin) || SKINS[0];
  const bonus = k => (cur().bonus || {})[k] || 1;
  SS.MODS.dmg.push(() => bonus('dmg'));
  SS.MODS.rate.push(() => bonus('rate'));
  SS.MODS.money.push(() => bonus('money'));

  function equip(id) {
    if (id === DEF_ID) delete save.skin; else save.skin = id;
    SS.setupHeroes();
    const l = SS.leader; if (l) SS.puff(l.x, l.y, 1);
  }

  SS.addSideButton({ side: 'left', label: 'Kostüm', icon: 'assets/ui/ic_skins.png', color: 'purple', id: 'skinBtn', onClick: () => open() });

  function open() {
    SS.openPanel('Kostüm', 'purple', body => {
      const root = SS.el('<div class="fb-skins"></div>'); body.appendChild(root);
      root.appendChild(SS.el('<p class="big-note">Kaptanın görünümünü değiştir. Kostümler elmasla açılır, takılı olanın bonusu geçerlidir.</p>'));
      const eqId = cur().id;
      SKINS.forEach(it => {
        const owned = !!K.owned[it.id], eq = eqId === it.id;
        const row = SS.el(`<div class="row-card fb-skin ${eq ? 'cur' : ''}"><div class="ico face"><img src="assets/ui/face_${it.id}.png" alt=""></div>
          <div class="info"><h4>${it.name}</h4><p>${it.desc}</p></div>
          ${eq ? '<button class="btn grey off">TAKILI</button>' : owned ? '<button class="btn green">TAK</button>' : it.event ? '<button class="btn grey off">Festival</button>' : it.pass ? '<button class="btn purple pass">Ninja Yolu</button>' : `<button class="btn yellow ${save.gems < it.cost ? 'cant' : ''}"><img src="assets/ui/gem.png" alt="">${it.cost}</button>`}</div>`);
        const b = row.querySelector('.btn');
        if (!eq && !owned && it.event) { row.querySelector('p').textContent = it.desc + ' · ' + it.event; }
        else if (!eq && !owned && it.pass) {
          const now = SS.pass && SS.pass.theme().skins.includes(it.id);
          if (now) { b.onclick = () => { SS.sfx('click'); SS.pass.open(); }; row.querySelector('p').textContent = it.desc + ' · bu sezon Ninja Yolu ödülü'; }
          else { b.className = 'btn grey off'; b.textContent = 'Sezonu bekle'; row.querySelector('p').textContent = it.desc + ' · başka bir sezonun Ninja Yolu ödülü'; }
        }
        else if (!eq) b.onclick = () => {
          if (!owned) {
            if (save.gems < it.cost) { SS.sfx('no'); SS.toast('Yeterli elmas yok'); return; }
            save.gems -= it.cost; K.owned[it.id] = true; SS.sfx('buy'); SS.toast(`${it.name} açıldı!`);
          } else SS.sfx('accept');
          equip(it.id); SS.persist(); SS.refreshUI(); open();
        };
        root.appendChild(row);
      });
      // shot trails (Ninja Yolu cosmetics): tint the ghost / speed-line trail and the glow of every projectile
      const T = SS.pass && SS.pass.TRAILS; if (!T) return;
      const cos = save.cos = save.cos || {}; cos.trails = cos.trails || {};
      root.appendChild(SS.el('<h3 class="fb-sec"><img src="assets/ui/ic_magic.png" alt="">Atış İzleri</h3>'));
      [['', { name: 'Standart İz', col: '#fce2ca' }]].concat(Object.entries(T)).forEach(([id, t]) => {
        const owned = !id || cos.trails[id], eq = (cos.trail || '') === id;
        const row = SS.el(`<div class="row-card ${eq ? 'cur' : ''}"><div class="ico"><i class="fb-trail" style="background:${t.col}"></i></div>
          <div class="info"><h4>${t.name}</h4><p>${id ? 'Mermilerin izi ve parıltısı' : 'Varsayılan'}</p></div>
          ${eq ? '<button class="btn grey off">TAKILI</button>' : owned ? '<button class="btn green">TAK</button>' : SS.pass.theme().trails.includes(id) ? '<button class="btn purple">Ninja Yolu</button>' : '<button class="btn grey off">Sezonu bekle</button>'}</div>`);
        const b = row.querySelector('.btn');
        if (!eq) b.onclick = () => { if (!owned) { SS.sfx('click'); if (SS.pass) SS.pass.open(); return; } if (id) cos.trail = id; else delete cos.trail; SS.sfx('accept'); SS.persist(); open(); };
        root.appendChild(row);
      });
    });
  }
  SS.skins = { open, equip, SKINS, byId };
}
if (window.SS) boot(); else window.addEventListener('load', boot);
})();
