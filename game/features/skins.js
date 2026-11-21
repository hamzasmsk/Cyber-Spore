/* Swarm Squad feature: "Kostüm" — bullet colors and hats bought with gems; equipped items give a small bonus. */
(() => {
'use strict';
function boot() {
  const SS = window.SS; if (!SS || SS._skinsB) return; SS._skinsB = true;
  const save = SS.save;
  if (!save.skins || typeof save.skins !== 'object') save.skins = {};
  const K = save.skins;
  if (!K.owned || typeof K.owned !== 'object') K.owned = {};
  K.owned.b_def = true; K.owned.h_none = true;
  if (!K.bullet) K.bullet = 'b_def';
  if (!K.hat) K.hat = 'h_none';

  const RAINBOW = ['#ff4d63', '#ff9a3b', '#ffe066', '#8ef05f', '#6fd0ff', '#b98cff', '#ff6ad5'];
  const BULLETS = [
    { id: 'b_def',  name: 'Standart',       cost: 0,   col: null,      desc: 'Silahın kendi mermisi' },
    { id: 'b_gold', name: 'Altın Mermi',    cost: 30,  col: '#ffd23a', bonus: { dmg: 1.05 },   desc: '+%5 hasar' },
    { id: 'b_neon', name: 'Neon',           cost: 45,  col: '#3dfcff', bonus: { rate: 1.04 },  desc: '+%4 atış hızı' },
    { id: 'b_fire', name: 'Ateş',           cost: 60,  col: '#ff5a2a', bonus: { dmg: 1.08 },   desc: '+%8 hasar' },
    { id: 'b_toxic',name: 'Zehir',          cost: 80,  col: '#7dff3a', bonus: { money: 1.08 }, desc: '+%8 altın' },
    { id: 'b_rain', name: 'Gökkuşağı',      cost: 150, col: 'rainbow', bonus: { dmg: 1.12 },   desc: '+%12 hasar' },
  ];
  const HATS = [
    { id: 'h_none',   name: 'Şapkasız',       cost: 0,   desc: 'Sade görünüm' },
    { id: 'h_party',  name: 'Parti Şapkası',  cost: 15,  desc: 'Sadece görünüm' },
    { id: 'h_cap',    name: 'Kep',            cost: 25,  bonus: { rate: 1.03 },  desc: '+%3 atış hızı' },
    { id: 'h_cowboy', name: 'Kovboy Şapkası', cost: 50,  bonus: { money: 1.05 }, desc: '+%5 altın' },
    { id: 'h_wizard', name: 'Büyücü Şapkası', cost: 90,  bonus: { dmg: 1.06 },   desc: '+%6 hasar' },
    { id: 'h_crown',  name: 'Taç',            cost: 200, bonus: { money: 1.10, dmg: 1.05 }, desc: '+%10 altın · +%5 hasar' },
  ];
  const byId = id => BULLETS.find(b => b.id === id) || HATS.find(h => h.id === id);
  const curB = () => BULLETS.find(b => b.id === K.bullet) || BULLETS[0];
  const curH = () => HATS.find(h => h.id === K.hat) || HATS[0];
  const bonus = k => ((curB().bonus || {})[k] || 1) * ((curH().bonus || {})[k] || 1);
  SS.MODS.dmg.push(() => bonus('dmg'));
  SS.MODS.rate.push(() => bonus('rate'));
  SS.MODS.money.push(() => bonus('money'));

  // ---- bullet color: GUNS[].bullet is read at fire time and for the muzzle flash, so we
  //      override it per frame and restore the originals for the default skin.
  const ORIG = SS.GUNS.map(g => g.bullet);
  let rainI = 0, rainT = 0;
  SS.HOOKS.update.push(dt => {
    const b = curB();
    let col = b.col;
    if (col === 'rainbow') { rainT += dt; if (rainT > 0.07) { rainT = 0; rainI = (rainI + 1) % RAINBOW.length; } col = RAINBOW[rainI]; }
    SS.GUNS.forEach((g, i) => { g.bullet = col || ORIG[i]; });
  });

  // ---- hats (canvas shapes). (x, y) = bottom-center of the hat, s = scale (1 ~ hero at U=1)
  const INK = '#1b2033';
  function path(c, pts) { c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.closePath(); }
  function drawHat(c, id, x, y, s, t = 0) {
    if (id === 'h_none') return;
    c.save(); c.translate(x, y); c.scale(s, s);
    c.lineJoin = 'round'; c.lineCap = 'round'; c.strokeStyle = INK; c.lineWidth = 3;
    if (id === 'h_party') {
      c.rotate(-0.12);
      path(c, [-15, 0, 15, 0, 0, -40]); c.fillStyle = '#ff6ad5'; c.fill();
      c.save(); c.clip(); c.fillStyle = '#ffe066'; for (let k = -2; k < 4; k++) { c.beginPath(); c.moveTo(-30, -k * 12 - 4); c.lineTo(30, -k * 12 - 14); c.lineTo(30, -k * 12 - 9); c.lineTo(-30, -k * 12 + 1); c.fill(); } c.restore();
      path(c, [-15, 0, 15, 0, 0, -40]); c.stroke();
      c.fillStyle = '#6fd0ff'; c.beginPath(); c.arc(0, -42, 6, 0, Math.PI * 2); c.fill(); c.stroke();
    } else if (id === 'h_cap') {
      c.fillStyle = '#ec3b4f';
      c.beginPath(); c.moveTo(-18, 0); c.bezierCurveTo(-18, -26, 18, -26, 18, 0); c.closePath(); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(10, -2); c.quadraticCurveTo(30, -4, 34, 2); c.lineTo(10, 3); c.closePath(); c.fillStyle = '#a8172b'; c.fill(); c.stroke();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(0, -19, 3, 0, Math.PI * 2); c.fill(); c.stroke();
      c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(-7, -11, 6, 3, -0.5, 0, Math.PI * 2); c.fill();
    } else if (id === 'h_cowboy') {
      c.fillStyle = '#b06a3a';
      c.beginPath(); c.ellipse(0, -2, 30, 7, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(-15, -4); c.lineTo(-13, -26); c.quadraticCurveTo(0, -20, 13, -26); c.lineTo(15, -4); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#5b3a22'; c.fillRect(-14.5, -10, 29, 5); c.strokeRect(-14.5, -10, 29, 5);
    } else if (id === 'h_wizard') {
      c.fillStyle = '#6a3fd0';
      c.beginPath(); c.ellipse(0, -2, 26, 6, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(-16, -4); c.quadraticCurveTo(-4, -30, 4, -48); c.quadraticCurveTo(14, -50, 20, -40); c.quadraticCurveTo(10, -40, 9, -30); c.lineTo(16, -4); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#ffe066';
      const star = (sx, sy, r) => { c.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.45 : r; c.lineTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr); } c.closePath(); c.fill(); };
      star(-3, -16, 5); star(6, -30, 3.5 + Math.sin(t * 5) * 0.8);
    } else if (id === 'h_crown') {
      path(c, [-18, 0, 18, 0, 20, -24, 10, -12, 0, -28, -10, -12, -20, -24]);
      const g = c.createLinearGradient(0, -28, 0, 0); g.addColorStop(0, '#fff1a0'); g.addColorStop(1, '#f3a712'); c.fillStyle = g; c.fill(); c.stroke();
      c.fillStyle = '#ec3b4f'; c.beginPath(); c.arc(0, -7, 4, 0, Math.PI * 2); c.fill(); c.stroke();
      c.fillStyle = '#6fd0ff'; c.beginPath(); c.arc(-11, -6, 3, 0, Math.PI * 2); c.arc(11, -6, 3, 0, Math.PI * 2); c.fill();
      c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.5 + 0.5 * Math.sin(t * 4); c.fillStyle = '#fff';
      c.beginPath(); c.arc(-20, -24, 2.5, 0, Math.PI * 2); c.arc(20, -24, 2.5, 0, Math.PI * 2); c.arc(0, -28, 2.5, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }
  // head top of the hero sprite (sc 0.74*U, bottom-anchored) ~ y - 70*U; mirrors the core renderer's bob/facing.
  function drawHatFlip(c, id, x, y, s, t, flip) {
    if (!flip) return drawHat(c, id, x, y, s, t);
    c.save(); c.translate(x, 0); c.scale(-1, 1); drawHat(c, id, 0, y, s, t); c.restore();
  }
  SS.HOOKS.render.push(ctx => {
    const id = K.hat; if (id === 'h_none') return;
    const U = SS.U, t = SS.R.t, sq = SS.R.sq || {};
    for (const h of SS.R.heroes) {
      if (h.dead || h.gone) continue;
      const bob = h.moving ? -Math.abs(Math.sin((h.walk || 0) * Math.PI)) * 4 * U : Math.sin(t * 4 + (h.ph || 0)) * 1.5 * U;
      const squash = 1 - (h.recoil || 0) * 0.04, face = h.face || 1;
      ctx.globalAlpha = sq.ko > 0 ? 0.35 : 1;
      drawHatFlip(ctx, id, h.x, h.y + 2 + bob - 71 * U * squash, 0.95 * U, t + (h.i || 0), face < 0);
    }
    ctx.globalAlpha = 1;
  });

  // ---- side button & panel
  SS.addSideButton({ side: 'left', label: 'Kostüm', icon: 'assets/ui/helmet_pink.png', color: 'pink', id: 'skinBtn', onClick: () => open() });
  let tab = 'b';
  function icon(item) {
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 100;
    const c = cv.getContext('2d');
    if (item.id[0] === 'h') {
      const im = new Image(); im.src = 'assets/ui/hero_beige.png';
      const draw = () => { c.clearRect(0, 0, 128, 100); c.drawImage(im, 64 - 40 * 0.95, 100 - 97 * 0.95 + 26, 81 * 0.95, 97 * 0.95); drawHat(c, item.id, 64, 46, 1.05, 0.4); };
      if (im.complete) draw(); else im.onload = draw;
      if (item.id === 'h_none') { c.globalAlpha = 1; }
    } else {
      const cols = item.col === 'rainbow' ? RAINBOW : [item.col || SS.GUNS[save.gun] && ORIG[save.gun] || '#ffe066'];
      c.lineCap = 'round'; c.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 3; k++) {
        const y = 28 + k * 22, col = cols[(k * 2) % cols.length];
        c.strokeStyle = col; c.globalAlpha = 0.55; c.lineWidth = 16; c.beginPath(); c.moveTo(14, y + 8); c.lineTo(110, y - 8); c.stroke();
        c.globalAlpha = 1; c.strokeStyle = '#fff'; c.lineWidth = 6; c.beginPath(); c.moveTo(60, y); c.lineTo(110, y - 8); c.stroke();
      }
    }
    return cv;
  }
  function open() {
    SS.openPanel('Kostüm', 'pink', body => {
      const root = SS.el('<div class="fb-skins"></div>'); body.appendChild(root);
      const tabs = SS.el(`<div class="fb-tabs"><button class="fb-tab ${tab === 'b' ? 'on' : ''}" data-t="b">Mermi</button><button class="fb-tab ${tab === 'h' ? 'on' : ''}" data-t="h">Şapka</button></div>`);
      root.appendChild(tabs);
      tabs.querySelectorAll('.fb-tab').forEach(b => b.onclick = () => { SS.sfx('click'); tab = b.dataset.t; open(); });
      root.appendChild(SS.el('<p class="big-note">Kostümler elmasla açılır. Takılı olanın bonusu geçerlidir.</p>'));
      const list = tab === 'b' ? BULLETS : HATS, eqKey = tab === 'b' ? 'bullet' : 'hat';
      list.forEach(it => {
        const owned = !!K.owned[it.id], eq = K[eqKey] === it.id;
        const row = SS.el(`<div class="row-card fb-skin ${eq ? 'cur' : ''}"><div class="ico"></div>
          <div class="info"><h4>${it.name}</h4><p>${it.desc}</p></div>
          ${eq ? '<button class="btn grey off">TAKILI</button>' : owned ? '<button class="btn green">TAK</button>' : `<button class="btn yellow ${save.gems < it.cost ? 'cant' : ''}"><img src="assets/ui/gem_blue.png" alt="">${it.cost}</button>`}</div>`);
        row.querySelector('.ico').appendChild(icon(it));
        const b = row.querySelector('.btn');
        if (!eq) b.onclick = () => {
          if (!owned) {
            if (save.gems < it.cost) { SS.sfx('no'); SS.toast('Yeterli elmas yok'); return; }
            save.gems -= it.cost; K.owned[it.id] = true; SS.sfx('buy'); SS.toast(`${it.name} açıldı!`);
          } else SS.sfx('click');
          K[eqKey] = it.id; SS.persist(); SS.refreshUI(); open();
        };
        root.appendChild(row);
      });
    });
  }
  SS.skins = { open, drawHat, BULLETS, HATS, byId };
}
if (window.SS) boot(); else window.addEventListener('load', boot);
})();
