/* Shuriken Squad feature: Zayıf Nokta (weak spot) — the player's own move in boss fights.
   Every few seconds a blinking target appears on the boss for a moment. A tap on it lands a heavy blow
   (5% of the boss's health, at least 8 throws' worth) with a hit-stop and a burst; tapping in a row builds a
   small streak. Fully optional: an idle player still wins on stats, an active one wins faster. Taps elsewhere
   keep moving the squad as before (the weak spot only takes taps that land on it). */
'use strict';
(() => {
  const SS = window.SS;
  if (!SS) return;
  const R = SS.R, save = SS.save;
  let spot = null, wait = 2.5, streak = 0;
  const ok = () => R.boss && R.boss.arrive >= 1 && !R.boss.leaving && !R.paused && !(R.sq && R.sq.ko > 0);
  function place() {
    const b = R.boss, h = SS.bossH(b);
    spot = { ox: (Math.random() - 0.5) * h * 0.55, oy: -h * (0.3 + Math.random() * 0.4), life: 1.7, max: 1.7 };
    if (!save.wsSeen) { save.wsSeen = 1; SS.persist(); SS.toast('Boss üzerindeki hedefe dokun: büyük hasar!'); }
  }
  SS.HOOKS.bossStart.push(() => { spot = null; wait = 2.5; streak = 0; });
  SS.HOOKS.update.push(dt => {
    if (!ok()) { spot = null; return; }
    if (spot) { spot.life -= dt; if (spot.life <= 0) { spot = null; streak = 0; wait = 3 + Math.random() * 2; } return; }
    wait -= dt; if (wait <= 0) place();
  });
  // a blinking pixel reticle: four corner brackets around a dot, shrinking as time runs out
  SS.HOOKS.render.push(() => {
    if (!spot || !R.boss) return;
    const P = SS.P, x = SS.snap(R.boss.x + spot.ox), y = SS.snap(R.boss.y - (R.boss.z || 0) + spot.oy);
    const k = spot.life / spot.max, r = Math.round(7 + 5 * k) * P, on = Math.floor(R.t * 10) % 2;
    const col = on ? '#e0394c' : '#ffe18d', L = 4 * P;
    const bar = (bx, by, w, h) => { SS.prect(bx - P, by - P, w + 2 * P, h + 2 * P, SS.INK); };
    const bars = [];
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const cx = x + sx * r, cy = y + sy * r;
      bars.push([sx < 0 ? cx : cx - L + P, cy, L, P], [cx, sy < 0 ? cy : cy - L + P, P, L]);
    }
    for (const q of bars) bar(...q);
    for (const q of bars) SS.prect(q[0], q[1], q[2], q[3], col);
    SS.prect(x - 2 * P, y - 2 * P, 4 * P, 4 * P, SS.INK); SS.prect(x - P, y - P, 2 * P, 2 * P, col);
  });
  function hit() {
    const b = R.boss, x = b.x + spot.ox, y = b.y - (b.z || 0) + spot.oy;
    spot = null; streak++; wait = 2.6 + Math.random() * 1.6;
    const dmg = Math.max(b.maxHp * 0.05 * (1 + 0.1 * Math.min(5, streak - 1)), SS.dmgPerShot() * 8);
    SS.damage(b, dmg, true, true);
    SS.vfx('burst', 'gold', x, y, 1, 0.3); SS.vfx('ring', 'fire', x, y, 0.8, 0.3);
    R.shake = Math.max(R.shake, 6); R.stop = Math.max(R.stop || 0, 0.06); R.flash = Math.max(R.flash || 0, 0.12);
    SS.addText(x, y - 14 * SS.P, streak > 1 ? `ZAYIF NOKTA x${streak}` : 'ZAYIF NOKTA', 'crit');
    SS.sfx('elite', 0); SS.sfx('hit', 0);
    if (SS.vibrate) SS.vibrate(30);
    if (SS.analytics) SS.analytics.send('addDesignEvent', 'Boss:WeakSpot', streak);
  }
  document.getElementById('c').addEventListener('pointerdown', e => {
    if (!spot || !ok()) return;
    const b = R.boss, x = b.x + spot.ox, y = b.y - (b.z || 0) + spot.oy;
    if (Math.hypot(e.clientX - x, e.clientY - y) > 34 * SS.U) return;
    e.stopImmediatePropagation(); e.preventDefault(); hit();
  }, true);
  SS.weakspot = { get spot() { return spot; }, hit: () => spot && hit() };
})();
