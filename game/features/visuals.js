/* Shuriken Squad — atmosphere & polish layer (draws through HOOKS.light, under the HUD-like overlays).
   1. Light map: a low-resolution darkness layer per region (scaled up without smoothing, so light falls off in
      clean pixel steps). Light sources cut holes in it: the squad, glowing projectiles, fireballs, boss, explosions,
      treasure and lanterns. Bambu Vadisi is sunny (barely any dark), Kül Diyarı is a dark ash land lit by fire.
   2. Cloud shadows drift over the ground (darker blobs in the same light map).
   3. Weather events: rain, snowstorm, ash rain or fireflies come and go per region.
   4. Boss entrance: cinema bars slide in, a short slow-down and a ground shake.
   5. Pixel death: a killed enemy bursts into a handful of pixels in its own colours.
   Eco mode turns 1–3 off. */
'use strict';
(() => {
  const SS = window.SS;
  if (!SS) return;
  const save = SS.save, R = SS.R;
  // region: [darkness alpha, darkness colour, cloud shadows?, weather kinds]
  const LOOK = {
    forest: [0.06, '19,27,27', true, ['fireflies', 'rain']],
    grass: [0.24, '14,24,30', true, ['rain', 'fireflies']],
    sand: [0.04, '60,30,14', true, ['dust']],
    snow: [0.1, '20,34,52', true, ['snow']],
    ash: [0.5, '20,8,14', false, ['ash']],
  };
  const LIGHT_COL = { fire: '#ff9554', magic: '#d3a2c0', ice: '#8feff1', gold: '#ffe18d', leaf: '#adbc3a', ink: '#8d977f' };
  const lc = document.createElement('canvas'), lx = lc.getContext('2d');
  const DS = 4;   // light map pixels are 4x4 CSS px
  let clouds = [], weather = null, nextWeather = 25 + Math.random() * 30, drops = [], cine = 0;
  R.flashes = [];   // explosions push short light flashes here (game.js boom)

  function lightPass(ctx) {
    if (save.eco) return;
    const W = SS.W, H = SS.H, b = SS.biome(), look = LOOK[b.ground] || LOOK.forest;
    const w = Math.ceil(W / DS), h = Math.ceil(H / DS);
    if (lc.width !== w || lc.height !== h) { lc.width = w; lc.height = h; }
    lx.globalCompositeOperation = 'source-over'; lx.clearRect(0, 0, w, h);
    const night = weather && (weather.k === 'fireflies' || weather.k === 'rain') ? 0.12 * weather.fade : weather && weather.k === 'snow' ? 0.06 * weather.fade : 0;
    lx.fillStyle = `rgba(${look[1]},${look[0] + night})`; lx.fillRect(0, 0, w, h);
    // cloud shadows: soft dark blobs drifting down and sideways
    if (look[2]) {
      while (clouds.length < 3) clouds.push({ x: Math.random() * W, y: -200 - Math.random() * H, r: 120 + Math.random() * 120, a: 0.08 + Math.random() * 0.05 });
      for (const c of clouds) {
        lx.fillStyle = `rgba(${look[1]},${c.a})`; lx.beginPath(); lx.ellipse(c.x / DS, c.y / DS, c.r / DS, c.r * 0.55 / DS, 0, 0, Math.PI * 2); lx.fill();
        lx.beginPath(); lx.ellipse((c.x + c.r * 0.5) / DS, (c.y + c.r * 0.2) / DS, c.r * 0.6 / DS, c.r * 0.4 / DS, 0, 0, Math.PI * 2); lx.fill();
      }
    }
    // light sources cut the darkness
    lx.globalCompositeOperation = 'destination-out';
    const hole = (x, y, r, k = 1) => { const g = lx.createRadialGradient(x / DS, y / DS, 0, x / DS, y / DS, r / DS); g.addColorStop(0, `rgba(0,0,0,${k})`); g.addColorStop(0.55, `rgba(0,0,0,${k * 0.6})`); g.addColorStop(1, 'rgba(0,0,0,0)'); lx.fillStyle = g; lx.fillRect((x - r) / DS, (y - r) / DS, 2 * r / DS, 2 * r / DS); };
    const U = SS.U, P = SS.P;
    for (const h of R.heroes) hole(h.x, h.y - 8 * P, (h.i === 0 ? 95 : 60) * U, h.i === 0 ? 0.9 : 0.6);
    let n = 0;
    for (const q of R.bul) { if (n++ > 24) break; if (q.pg || q.g.glow === 'fire' || q.g.glow === 'magic' || q.g.glow === 'ice' || q.special) hole(q.x, q.y, 38 * U, 0.75); }
    for (const p of R.eb) if (p.k === 'orb' || (p.k === 'lob' && p.spr === 'Fireball')) hole(p.x || p.tx, p.y || p.ty, 34 * U, 0.6);
    if (R.boss) hole(R.boss.x, R.boss.y - SS.bossH(R.boss) * 0.5, 120 * U, 0.55);
    for (const e of R.en) if (e.treasure || e.type === 'LanternRed' || e.type === 'Flam') hole(e.x, e.y - 8 * P, 55 * U, 0.8);
    for (const f of R.flashes) hole(f.x, f.y, f.r * U * (0.6 + 0.4 * f.life / f.max), f.life / f.max);
    lx.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = false;
    const k = ctx.canvas.width / W; ctx.drawImage(lc, 0, 0, w * DS * k, h * DS * k); ctx.restore();
    // a warm additive tint where fire lights the ash land
    if (b.ground === 'ash') { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.07; for (const h of R.heroes.slice(0, 1)) SS.spr('vx_glow40_fire', h.x, h.y - 8 * P, 2, 0.5, 0.5); ctx.restore(); }
  }

  // ---------------- weather
  function startWeather() {
    const look = LOOK[SS.biome().ground] || LOOK.forest, k = look[3][Math.floor(Math.random() * look[3].length)];
    weather = { k, t: 0, T: 22 + Math.random() * 14, fade: 0 };
  }
  function weatherPass(ctx) {
    if (!weather || save.eco) return;
    const W = SS.W, H = SS.H, P = SS.P, U = SS.U, f = weather.fade, k = weather.k;
    const want = { rain: 70, snow: 60, ash: 40, fireflies: 14, dust: 30 }[k] * f;
    while (drops.length < want) drops.push({ x: Math.random() * W, y: Math.random() * H, s: 0.6 + Math.random() * 0.6, ph: Math.random() * 6 });
    if (drops.length > want + 2) drops.length = Math.max(0, Math.floor(want));
    ctx.save();
    for (const d of drops) {
      if (k === 'rain') { ctx.globalAlpha = 0.45 * f; for (let i = 0; i < 4; i++) SS.prect(d.x - i * P * 0.5, d.y - i * P * 2, P / 2, P * 2, '#b8dce5'); }
      else if (k === 'snow') { ctx.globalAlpha = 0.85 * f; SS.prect(d.x, d.y, P * (d.s > 0.9 ? 1 : 0.5), P * (d.s > 0.9 ? 1 : 0.5), '#ffffff'); }
      else if (k === 'ash') { ctx.globalAlpha = 0.7 * f; SS.prect(d.x, d.y, P / 2, P / 2, d.s > 1 ? '#ff9554' : '#8e7c73'); }
      else if (k === 'dust') { ctx.globalAlpha = 0.35 * f; SS.prect(d.x, d.y, P, P / 2, '#e9c99a'); }
      else if (k === 'fireflies') { const on = Math.sin(R.t * 3 + d.ph) > 0.2; ctx.globalAlpha = (on ? 0.95 : 0.25) * f; SS.prect(d.x, d.y, P / 2, P / 2, '#ffe18d'); if (on) { ctx.globalAlpha = 0.25 * f; SS.prect(d.x - P / 2, d.y - P / 2, P * 1.5, P * 1.5, '#ffe18d'); } }
    }
    ctx.restore();
  }
  function updWeather(dt) {
    const W = SS.W, H = SS.H, U = SS.U;
    if (!weather) { nextWeather -= dt; if (nextWeather <= 0 && !R.boss) startWeather(); }
    else {
      weather.t += dt; weather.fade = Math.min(1, weather.t / 3, Math.max(0, (weather.T - weather.t) / 3));
      if (weather.t >= weather.T) { weather = null; drops.length = 0; nextWeather = 50 + Math.random() * 70; }
    }
    if (weather) for (const d of drops) {
      if (weather.k === 'rain') { d.y += 620 * U * dt * d.s; d.x -= 90 * U * dt; if (d.y > H) { if (Math.random() < 0.3) SS.part({ k: 'anim', a: 'fx_smoke', x: d.x, y: H - 180 - Math.random() * (H - 360), s: 0.5, life: 0.2, max: 0.2, ay: 1, alpha: 0.3 }); d.y = -10; d.x = Math.random() * (W + 60); } }
      else if (weather.k === 'snow') { d.y += 70 * U * dt * d.s; d.x += Math.sin(R.t * 1.4 + d.ph) * 25 * U * dt - 30 * U * dt; }
      else if (weather.k === 'ash') { d.y -= 30 * U * dt * d.s; d.x += Math.sin(R.t + d.ph) * 18 * U * dt; }
      else if (weather.k === 'dust') { d.x += 160 * U * dt * d.s; d.y += Math.sin(R.t * 2 + d.ph) * 10 * U * dt; }
      else if (weather.k === 'fireflies') { d.x += Math.sin(R.t * 0.8 + d.ph) * 22 * U * dt; d.y += Math.cos(R.t * 0.6 + d.ph * 1.3) * 18 * U * dt; }
      if (d.x < -20) d.x = W + 10; if (d.x > W + 20) d.x = -10; if (d.y < -20) d.y = H + 10; if (d.y > H + 20) d.y = -10;
    }
    // clouds drift with the march and the wind
    for (const c of clouds) { c.y += (R.phase === 'advance' ? R.advSpd : 14) * dt + 6 * dt; c.x += 12 * dt; if (c.y - c.r > H) { c.y = -c.r * 2 - Math.random() * 300; c.x = Math.random() * W; } }
    for (const f of R.flashes) f.life -= dt; R.flashes = R.flashes.filter(f => f.life > 0);
    if (cine > 0) cine -= dt;
  }

  // ---------------- boss entrance: cinema bars + slow-down
  SS.HOOKS.bossStart.push(() => { cine = 1.8; R.stop = Math.max(R.stop, 0.5); R.shake = Math.max(R.shake, 6); if (weather) weather.T = Math.min(weather.T, weather.t + 2); });
  function cinePass(ctx) {
    if (cine <= 0) return;
    // the HUD and the card tray sit on top of the canvas, so the bars grow from under them into the field
    const W = SS.W, H = SS.H, k = Math.min(1, (1.8 - cine) / 0.25, cine / 0.4), top = 150 + Math.round(44 * k), bot = 176 + Math.round(44 * k);
    ctx.save(); ctx.globalAlpha = 0.9 * k; SS.prect(0, 0, W, top, SS.INK); SS.prect(0, H - bot, W, bot, SS.INK); ctx.restore();
  }

  // ---------------- pixel death
  const palette = new Map();
  let pick = null;
  function colorsOf(name) {
    if (palette.has(name)) return palette.get(name);
    const f = SS.AF[name]; if (!f) return null;
    if (!pick) { pick = document.createElement('canvas').getContext('2d', { willReadFrequently: true }); pick.canvas.width = SS.atlasImg.width; pick.canvas.height = SS.atlasImg.height; pick.drawImage(SS.atlasImg, 0, 0); }
    const d = pick.getImageData(f[0], f[1], f[2], f[3]).data, cols = [];
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200 && (d[i] + d[i + 1] + d[i + 2]) > 90) cols.push(`rgb(${d[i]},${d[i + 1]},${d[i + 2]})`);
    const out = cols.length ? cols : ['#fce2ca']; palette.set(name, out); return out;
  }
  let bitsList = [];
  SS.HOOKS.kill.push(e => {
    if (!e || save.eco || bitsList.length > 90) return;
    let cols; try { cols = colorsOf(`m_${e.type}_d0`); } catch (err) { cols = null; } if (!cols) return;
    const P = SS.P, U = SS.U, n = e.elite ? 14 : 9;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4, sp = (90 + Math.random() * 170) * U;
      bitsList.push({ x: e.x + (Math.random() - 0.5) * 10 * P * (e.sc || 1), y: e.y - Math.random() * 14 * P * (e.sc || 1), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, c: cols[Math.floor(Math.random() * cols.length)], life: 0.45 + Math.random() * 0.35, g: i === 0 });
    }
  });
  function bitsPass(ctx, dt) {
    const P = SS.P, U = SS.U;
    for (const b of bitsList) { b.life -= dt; b.x += b.vx * dt; b.y += b.vy * dt; b.vy += 900 * U * dt; b.vx *= 0.97; }
    bitsList = bitsList.filter(b => b.life > 0);
    ctx.save();
    for (const b of bitsList) { ctx.globalAlpha = Math.min(1, b.life * 3); SS.prect(b.x, b.y, P, P, b.g ? '#ffffff' : b.c); }
    ctx.restore();
  }

  let lastT = performance.now();
  SS.HOOKS.update.push(dt => { updWeather(dt); });
  SS.HOOKS.light.push(ctx => {
    const now = performance.now(), dt = Math.min(0.05, (now - lastT) / 1000) * (R.paused ? 0 : 1); lastT = now;
    bitsPass(ctx, dt);
    lightPass(ctx);
    weatherPass(ctx);
    cinePass(ctx);
  });
  SS.visuals = { weather: k => { weather = { k: k || 'rain', t: 0, T: 25, fade: 0 }; }, get current() { return weather && weather.k; } };
})();
