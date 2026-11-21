/* Swarm Squad — idle squad shooter for phones (portrait). HTML5 canvas, no dependencies. Art: Kenney (CC0). */
'use strict';
(() => {

// ================================================================ utilities
const $ = id => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const pick = a => a[Math.floor(Math.random() * a.length)];
const TAU = Math.PI * 2;
const INK = '#1b2033';
const FONT = n => `800 ${n}px "Baloo 2", system-ui, sans-serif`;
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// big numbers: 1.2K, 3.4M, 5.6B, 7.8T, then aa, ab, ... az, ba ...
const SUF = ['', 'K', 'M', 'B', 'T'];
function fmt(n) {
  if (!isFinite(n)) return '∞';
  if (n < 1000) return n < 10 ? String(Math.round(n * 10) / 10) : String(Math.floor(n));
  const e = Math.floor(Math.log10(n) / 3);
  let s;
  if (e < SUF.length) s = SUF[e];
  else { const k = e - SUF.length; s = String.fromCharCode(97 + Math.floor(k / 26) % 26) + String.fromCharCode(97 + k % 26); }
  const v = n / Math.pow(1000, e);
  return (v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : String(Math.floor(v))) + s;
}

// ================================================================ canvas & field geometry
const cv = $('c');
let ctx = cv.getContext('2d');
let W = 390, H = 844, DPR = 1, U = 1;
const F = {};   // field geometry (CSS px)
let fieldBg = null;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  cv.width = Math.floor(W * DPR); cv.height = Math.floor(H * DPR);
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  U = clamp(Math.min(W, H * 0.56) / 390, 0.8, 1.7);
  F.A = { x: W + 80 * U, y: H * 0.22 };           // enemies come from the right
  F.B = { x: -80 * U, y: H * 0.64 };              // path leaves at the bottom left
  const dx = F.A.x - F.B.x, dy = F.A.y - F.B.y, L = Math.hypot(dx, dy);
  F.dir = { x: dx / L, y: dy / L }; F.perp = { x: -F.dir.y, y: F.dir.x }; F.len = L;
  F.pathW = Math.min(W * 0.66, 290 * U);
  F.S = { x: lerp(F.B.x, F.A.x, 0.36), y: lerp(F.B.y, F.A.y, 0.36) };   // squad anchor
  F.front = { x: F.S.x + F.dir.x * 175 * U, y: F.S.y + F.dir.y * 175 * U };
  const r = $('money').parentNode.getBoundingClientRect();
  F.wallet = { x: r.left + 16, y: r.top + r.height / 2 };
  if (atlasImg.naturalWidth) { buildField(); setupHeroes(); }
}
window.addEventListener('resize', resize);
const along = (p, a, b) => ({ x: p.x + F.dir.x * a + F.perp.x * b, y: p.y + F.dir.y * a + F.perp.y * b });

// ================================================================ atlas
const AF = window.ATLAS.frames;
const atlasImg = new Image();
const atlasReady = new Promise(r => { atlasImg.onload = r; atlasImg.onerror = r; });
atlasImg.src = 'assets/atlas.png';
const tintCache = new Map();
function tinted(name, color) {
  const key = name + color; let c = tintCache.get(key); if (c) return c;
  const f = AF[name]; c = document.createElement('canvas');
  if (!f) { c.width = c.height = 1; tintCache.set(key, c); return c; }
  c.width = f[2]; c.height = f[3];
  const g = c.getContext('2d'); g.drawImage(atlasImg, f[0], f[1], f[2], f[3], 0, 0, f[2], f[3]);
  g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, f[2], f[3]);
  tintCache.set(key, c); return c;
}
function spr(name, x, y, sc = 1, ax = 0.5, ay = 0.5, flip = false, rot = 0, sx = 1, sy = 1) {
  const f = AF[name]; if (!f) return;
  const w = f[2] * sc * sx, h = f[3] * sc * sy;
  if (!flip && !rot) { ctx.drawImage(atlasImg, f[0], f[1], f[2], f[3], x - w * ax, y - h * ay, w, h); return; }
  ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot); if (flip) ctx.scale(-1, 1);
  ctx.drawImage(atlasImg, f[0], f[1], f[2], f[3], -w * ax, -h * ay, w, h); ctx.restore();
}
function sprT(name, color, x, y, sc = 1, ax = 0.5, ay = 0.5, flip = false, rot = 0, sx = 1, sy = 1) {
  const c = tinted(name, color), w = c.width * sc * sx, h = c.height * sc * sy;
  ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot); if (flip) ctx.scale(-1, 1);
  ctx.drawImage(c, -w * ax, -h * ay, w, h); ctx.restore();
}
function rrect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

// ================================================================ data
const BIOMES = [
  { name: 'Yeşil Tepeler', ground: '#5fbf62', ground2: '#4fae54', path: '#e4d3a2', edge: '#9b7a4a', decor: ['p_bush', 'p_rock', 'p_mushroom_red', 'p_fence', 'p_grass'], pool: ['slime', 'mouse', 'bee', 'frog'], boss: 'brood', bossName: 'Kuluçka Ana', motes: '255,250,200' },
  { name: 'Mantar Ormanı', ground: '#d98a4e', ground2: '#c97b42', path: '#f6d3a6', edge: '#8a5530', decor: ['p_mushroom_red', 'p_mushroom_brown', 'p_rock', 'p_bush'], pool: ['snail', 'slime', 'ladybug', 'bee'], boss: 'golem', bossName: 'Kaya Devi', motes: '255,210,160' },
  { name: 'Kızıl Çöl', ground: '#f0b96a', ground2: '#e3a957', path: '#fbe3b4', edge: '#b9813f', decor: ['p_cactus', 'p_rock', 'p_cactus'], pool: ['fireslime', 'worm', 'mouse', 'fly'], boss: 'hydra', bossName: 'Çöl Gözü', motes: '255,235,190' },
  { name: 'Buz Diyarı', ground: '#e3eef8', ground2: '#d2e2f1', path: '#b9d3ea', edge: '#7d9cbd', decor: ['p_snow', 'p_rock', 'p_snow'], pool: ['spikeslime', 'ladybug', 'fly', 'snail'], boss: 'prism', bossName: 'Buz Kutusu', motes: '255,255,255' },
  { name: 'Lav Vadisi', ground: '#3b2a3f', ground2: '#2f2133', path: '#c98a8f', edge: '#22172a', decor: ['p_rock', 'p_rock', 'p_grass_purple', 'p_grass_purple', 'p_torch_on_a'], pool: ['fireslime', 'blockslime', 'spikeslime', 'fly'], boss: 'core', bossName: 'Altın Kabus', motes: '255,160,90', lava: true },
];
const EDEF = {
  slime:      { f: ['slime_normal_walk_a', 'slime_normal_walk_b'], col: '#a55cf0' },
  fireslime:  { f: ['slime_fire_walk_a', 'slime_fire_walk_b'], col: '#ff5a3c' },
  spikeslime: { f: ['slime_spike_walk_a', 'slime_spike_walk_b'], col: '#2fd27a' },
  blockslime: { f: ['slime_block_walk_a', 'slime_block_walk_b'], col: '#2fd27a', sc: 1.15, hp: 2 },
  mouse:      { f: ['mouse_walk_a', 'mouse_walk_b'], col: '#c4c8d4', spd: 1.5, hp: 0.7 },
  snail:      { f: ['snail_walk_a', 'snail_walk_b'], col: '#c08bff', spd: 0.6, hp: 1.6, sc: 1.1 },
  ladybug:    { f: ['ladybug_walk_a', 'ladybug_walk_b'], col: '#ec3b4f', spd: 1.2 },
  worm:       { f: ['worm_normal_move_a', 'worm_normal_move_b'], col: '#4aa8ff', spd: 0.8 },
  frog:       { f: ['frog_idle', 'frog_jump'], col: '#33c14d', hop: true },
  bee:        { f: ['bee_a', 'bee_b'], col: '#ffcf3a', fly: true, spd: 1.2, hp: 0.8 },
  fly:        { f: ['fly_a', 'fly_b'], col: '#5d6680', fly: true, spd: 1.4, hp: 0.7 },
};
const GUNS = [
  { name: 'Tabanca',        mult: 1,   cost: 0,    len: 26, body: '#6b7686', acc: '#ffcf3a', bullet: '#ffe066', w: 6,  shots: 1 },
  { name: 'Hafif Makineli', mult: 2.5, cost: 5,    len: 32, body: '#3f8fe0', acc: '#2a4e7a', bullet: '#9fe1ff', w: 6,  shots: 1, mag: true },
  { name: 'Pompalı',        mult: 6,   cost: 15,   len: 36, body: '#b06a3a', acc: '#5b3a22', bullet: '#ffb066', w: 7,  shots: 3 },
  { name: 'Keskin Nişancı', mult: 15,  cost: 40,   len: 46, body: '#5a6b44', acc: '#2e3824', bullet: '#d6ff7a', w: 9,  shots: 1, scope: true },
  { name: 'Minigun',        mult: 40,  cost: 100,  len: 42, body: '#8d9ab0', acc: '#3a4250', bullet: '#ffe066', w: 7,  shots: 2, barrels: true },
  { name: 'Lazer',          mult: 110, cost: 250,  len: 44, body: '#e8edf5', acc: '#ff4dc4', bullet: '#ff6ad5', w: 10, shots: 1, glow: true },
  { name: 'Roketatar',      mult: 300, cost: 600,  len: 48, body: '#5a6b44', acc: '#ec3b4f', bullet: '#ff9a3b', w: 11, shots: 1, rocket: true },
  { name: 'Plazma Topu',    mult: 900, cost: 1500, len: 48, body: '#6a3fd0', acc: '#7fe3ff', bullet: '#b8f3ff', w: 13, shots: 1, glow: true },
];
const TEAM = [
  { color: 'beige',  name: 'Kaptan',  cost: 0 },
  { color: 'green',  name: 'Çevik',   cost: 300 },
  { color: 'pink',   name: 'Doktor',  cost: 30000 },
  { color: 'purple', name: 'Bombacı', cost: 3e6 },
  { color: 'yellow', name: 'Nişancı', cost: 3e8 },
];
// formation: [across the path, along the path]
const SLOTS = [[0, 0], [-0.75, -0.25], [0.75, -0.25], [-0.38, 0.7], [0.38, 0.7]];
const SUBS = 5, KILLS_PER_SUB = 8, BOSS_TIME = 30;

// ================================================================ save
const SAVE_KEY = 'swarmsquad_idle_v1';
const DEF = { money: 0, gems: 0, stage: 1, sub: 1, kills: 0, bossReady: false, lv: { power: 0, speed: 0, money: 0 }, gun: 0, team: 1, rebirths: 0, rp: 0, auto: true, sound: true, t: 0, rate: 0, best: 1 };
const save = (() => { let s = null; try { s = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { s = null; }
  const d = JSON.parse(JSON.stringify(DEF)); if (s && typeof s === 'object') { Object.assign(d, s); d.lv = Object.assign({ power: 0, speed: 0, money: 0 }, s.lv || {}); } return d; })();
function persist() { save.t = Date.now(); try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* storage blocked */ } }

// ================================================================ economy
const rebirthMul = () => 1 + save.rp * 0.3;
const stat = {
  power: l => 6 * Math.pow(1.18, l),
  speed: l => Math.min(12, 1.4 + 0.08 * l),
  money: l => Math.pow(1.13, l),
};
const COST = { power: l => 8 * Math.pow(1.2, l), speed: l => 12 * Math.pow(1.24, l), money: l => 15 * Math.pow(1.22, l) };
const dmgPerShot = () => stat.power(save.lv.power) * GUNS[save.gun].mult * rebirthMul();
const fireRate = () => stat.speed(save.lv.speed);
const moneyMul = () => stat.money(save.lv.money) * rebirthMul();
const stageIdx = () => (save.stage - 1) * SUBS + (save.sub - 1);
const enemyHp = () => 10 * Math.pow(1.3, stageIdx());
const bossHp = () => 10 * Math.pow(1.3, (save.stage - 1) * SUBS + SUBS - 1) * 18;
const biome = () => BIOMES[(save.stage - 1) % BIOMES.length];
const rebirthGain = () => save.stage >= 6 ? Math.floor((save.stage - 1) * 1.5) : 0;

// ================================================================ audio
let AC = null, master = null, noiseBuf = null;
function audioInit() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    master = AC.createGain(); master.gain.value = 0.7; master.connect(AC.destination);
    noiseBuf = AC.createBuffer(1, AC.sampleRate * 0.6, AC.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch (e) { AC = null; }
}
function tone(type, f0, f1, dur, vol, delay = 0) {
  const t = AC.currentTime + delay, o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol, freq) {
  const t = AC.currentTime, s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
  s.buffer = noiseBuf; f.type = 'lowpass'; f.frequency.value = freq;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + 0.02);
}
const sndLast = {};
function sfx(n, gap = 0.03) {
  if (!AC || !save.sound) return;
  const now = AC.currentTime; if (sndLast[n] && now - sndLast[n] < gap) return; sndLast[n] = now;
  switch (n) {
    case 'shoot': tone('square', 760, 240, 0.05, 0.025); noise(0.04, 0.035, 3000); break;
    case 'hit': tone('triangle', 420, 160, 0.04, 0.03); break;
    case 'kill': tone('square', 300, 80, 0.1, 0.04); noise(0.1, 0.05, 1600); break;
    case 'coin': tone('square', 1320, 1320, 0.04, 0.02); tone('square', 1980, 1980, 0.06, 0.02, 0.04); break;
    case 'buy': tone('triangle', 600, 1200, 0.12, 0.08); break;
    case 'no': tone('square', 200, 150, 0.12, 0.05); break;
    case 'boom': noise(0.5, 0.25, 700); tone('sine', 120, 35, 0.45, 0.2); break;
    case 'boss': tone('sawtooth', 110, 40, 1, 0.18); noise(0.8, 0.1, 400); break;
    case 'win': [523, 659, 784, 1046, 1318].forEach((f, i) => tone('square', f, f, 0.15, 0.05, i * 0.1)); break;
    case 'fail': [392, 330, 262].forEach((f, i) => tone('triangle', f, f, 0.2, 0.07, i * 0.15)); break;
    case 'click': tone('triangle', 700, 950, 0.05, 0.05); break;
  }
}

// ================================================================ runtime state
const R = { en: [], bul: [], parts: [], txt: [], bills: [], boss: null, spawnT: 0.5, t: 0, shake: 0, flash: 0, earned: 0, earnT: 0, retryT: 0, heroes: [], motes: [], nextId: 1, walletPop: 0, leavingBoss: null };
function setupHeroes() {
  R.heroes = TEAM.slice(0, save.team).map((h, i) => {
    const s = SLOTS[i], pos = along(F.S, s[1] * 82 * U, s[0] * F.pathW * 0.4);
    return { color: h.color, x: pos.x, y: pos.y, fireT: rand(0, 0.6), recoil: 0, ang: -0.6, muzzle: 0, ph: rand(0, 6), i };
  });
}

// ================================================================ field rendering (pre-rendered per biome)
function buildField() {
  const b = biome();
  fieldBg = document.createElement('canvas'); fieldBg.width = cv.width; fieldBg.height = cv.height;
  const g = fieldBg.getContext('2d'); const keep = ctx; ctx = g;
  g.setTransform(DPR, 0, 0, DPR, 0, 0);
  const rnd = mulberry32(save.stage * 31 + 7), rr = (a, c) => a + rnd() * (c - a);
  g.fillStyle = b.ground; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 60; i++) { g.fillStyle = b.ground2; g.globalAlpha = 0.6; g.beginPath(); g.ellipse(rnd() * W, rnd() * H, rr(20, 60) * U, rr(10, 30) * U, 0.6, 0, TAU); g.fill(); }
  g.globalAlpha = 1;
  if (b.lava) {   // glowing cracks
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (let i = 0; i < 16; i++) {
      let x = rnd() * W, y = rnd() * H; g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 5; k++) { x += (rnd() - 0.5) * 70 * U; y += (rnd() - 0.3) * 50 * U; g.lineTo(x, y); }
      g.strokeStyle = '#ff7a2f'; g.lineWidth = 5 * U; g.stroke(); g.strokeStyle = '#ffd27a'; g.lineWidth = 2 * U; g.stroke();
    }
  }
  // path band
  const hw = F.pathW / 2, ext = 200 * U;
  const p1 = along(F.B, -ext, -hw), p2 = along(F.A, ext, -hw), p3 = along(F.A, ext, hw), p4 = along(F.B, -ext, hw);
  g.beginPath(); g.moveTo(p1.x, p1.y); g.lineTo(p2.x, p2.y); g.lineTo(p3.x, p3.y); g.lineTo(p4.x, p4.y); g.closePath();
  g.fillStyle = b.path; g.fill();
  g.lineWidth = 10 * U; g.strokeStyle = b.edge; g.stroke();
  g.lineWidth = 3 * U; g.strokeStyle = 'rgba(255,255,255,0.35)'; g.stroke();
  for (let i = 0; i < 40; i++) {   // pebbles on the path
    const t = rnd() * (F.len + 2 * ext) - ext, o = (rnd() - 0.5) * F.pathW * 0.85, q = along(F.B, t, o);
    g.fillStyle = 'rgba(0,0,0,0.08)'; g.beginPath(); g.ellipse(q.x, q.y, rr(3, 8) * U, rr(2, 5) * U, 0, 0, TAU); g.fill();
  }
  // decor along both edges and scattered on the ground (drawn top to bottom)
  const items = [];
  for (const side of [-1, 1]) for (let t = -ext; t < F.len + ext; t += rr(50, 90) * U) {
    const q = along(F.B, t, side * (hw + rr(26, 90) * U));
    items.push({ f: b.decor[Math.floor(rnd() * b.decor.length)], x: q.x, y: q.y, s: rr(0.9, 1.3) * U, flip: rnd() < 0.5 });
  }
  for (let i = 0; i < 30; i++) items.push({ f: b.decor[Math.floor(rnd() * b.decor.length)], x: rnd() * W, y: rnd() * H, s: rr(0.8, 1.2) * U, flip: rnd() < 0.5 });
  items.filter(it => { const dx = it.x - F.B.x, dy = it.y - F.B.y; return Math.abs(dx * F.perp.x + dy * F.perp.y) > hw + 16 * U; })
    .sort((a, c) => a.y - c.y).forEach(it => {
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.beginPath(); g.ellipse(it.x, it.y + 2, 22 * it.s, 6 * it.s, 0, 0, TAU); g.fill();
      if (it.f === 'p_torch_on_a') { g.globalCompositeOperation = 'lighter'; const gl = tinted('fx_glow', '#ff9a3b'); g.globalAlpha = 0.5; g.drawImage(gl, it.x - 50 * it.s, it.y - 90 * it.s, 100 * it.s, 100 * it.s); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
      spr(it.f, it.x, it.y + 4, it.s, 0.5, 1, it.flip);
    });
  ctx = keep;
}

// ================================================================ combat
function spawnEnemy() {
  const b = biome(), type = pick(b.pool), d = EDEF[type];
  const lane = rand(-0.38, 0.38);
  let p = along(F.front, rand(90, 170) * U, lane * F.pathW);
  if (p.x > W - 30 * U) p = { x: W - 30 * U - rand(0, 30) * U, y: p.y };
  puff(p.x, p.y - 20 * U, 0.45);
  const hp = enemyHp() * (d.hp || 1);
  R.en.push({ id: R.nextId++, type, d, x: p.x, y: p.y, lane, hp, maxHp: hp, sp: 75 * U * (d.spd || 1), flash: 0, anim: rand(0, 1), knock: 0, age: 0, sc: (d.sc || 1) * 1.4 * U, hopT: rand(0, 1) });
}
function startBoss() {
  if (R.boss || !save.bossReady) return;
  const b = biome();
  for (const e of R.en) { e.dead = true; puff(e.x, e.y - 20 * U, 0.5); }
  const p = along(F.A, 40 * U, 0), hp = bossHp();
  R.boss = { x: p.x, y: p.y, hp, maxHp: hp, t: BOSS_TIME, flash: 0, anim: 0, key: b.boss, name: b.bossName, arrive: 0, leaving: 0 };
  $('bossImg').src = `assets/ui/boss_${b.boss}.png`;
  $('bossHud').classList.remove('hidden');
  banner('BOSS!', b.bossName); sfx('boss', 0); R.shake = 12; uiKey = '';
}
function bossWin() {
  const b = R.boss; R.boss = null;
  for (let i = 0; i < 6; i++) setTimeout(() => boom(b.x + rand(-60, 60) * U, b.y - rand(20, 160) * U, 1.2), i * 90);
  const gems = 2 + Math.floor(save.stage / 3), cash = enemyHp() * 25 * moneyMul();
  save.gems += gems; addMoney(cash, b.x, b.y - 80 * U, 24);
  save.stage++; save.sub = 1; save.kills = 0; save.bossReady = false; save.best = Math.max(save.best, save.stage);
  $('bossHud').classList.add('hidden');
  banner('ZAFER!', `+${gems} elmas · Bölüm ${save.stage}-1`); sfx('win', 0);
  persist(); setTimeout(buildField, 700);
}
function bossFail() {
  const b = R.boss; b.leaving = 0.01; R.boss = null; R.leavingBoss = b;
  $('bossHud').classList.add('hidden');
  banner('BOSS KAÇTI!', 'Güçlen ve tekrar dene'); sfx('fail', 0);
  R.retryT = 10;
}
function damage(target, dmg, crit, isBoss) {
  target.hp -= dmg; target.flash = 0.07;
  if (!isBoss) target.knock = 10 * U;
  addText(target.x + rand(-24, 24) * U, target.y - (isBoss ? 150 : 50) * U + rand(-10, 10) * U, fmt(dmg), crit ? 'crit' : 'dmg');
  if (target.hp <= 0) { if (isBoss) bossWin(); else kill(target); }
}
function kill(e) {
  e.dead = true;
  puff(e.x, e.y - 20 * U, 0.7); confetti(e.x, e.y - 20 * U, e.d.col, 8);
  addMoney(e.maxHp * 0.55 * moneyMul(), e.x, e.y - 30 * U, 4);
  sfx('kill', 0.05);
  if (!R.boss && !save.bossReady) {
    save.kills++;
    if (save.kills >= KILLS_PER_SUB) {
      if (save.sub < SUBS) { save.sub++; save.kills = 0; toast(`Aşama ${save.stage}-${save.sub}`); }
      else { save.kills = KILLS_PER_SUB; save.bossReady = true; if (save.auto) R.retryT = 0.6; else toast('Boss hazır!'); }
    }
  }
}
function addMoney(v, x, y, bills) {
  save.money += v; R.earned += v;
  addText(x, y - 20 * U, fmt(v), 'money');
  for (let i = 0; i < bills && R.bills.length < 90; i++) {
    const a = rand(-Math.PI, 0);
    R.bills.push({ x, y, vx: Math.cos(a) * rand(80, 220) * U, vy: Math.sin(a) * rand(120, 260) * U, t: 0, rot: rand(0, TAU), vr: rand(-8, 8) });
  }
  sfx('coin', 0.06);
}
function addText(x, y, s, kind) { if (R.txt.length > 70) R.txt.shift(); R.txt.push({ x, y, s, kind, life: kind === 'money' ? 1.1 : 0.8, max: kind === 'money' ? 1.1 : 0.8 }); }
function puff(x, y, s) { R.parts.push({ k: 'puff', x, y, s: s * U, life: 0.45, max: 0.45, rot: rand(0, TAU) }); }
function confetti(x, y, col, n) { for (let i = 0; i < n; i++) { const a = rand(-Math.PI, 0), s = rand(80, 300) * U; R.parts.push({ k: 'chunk', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.4, 0.8), max: 0.8, col, r: rand(4, 8) * U, rot: rand(0, TAU) }); } }
function boom(x, y, s) { R.parts.push({ k: 'expl', x, y, s: s * U, life: 0.5, max: 0.5, rot: rand(0, TAU) }); R.parts.push({ k: 'glow', x, y, s: s * 2.4 * U, life: 0.25, max: 0.25, col: '#ffb43a' }); R.shake = Math.max(R.shake, 8); R.flash = Math.max(R.flash, 0.2); sfx('boom', 0.08); }
function nearestTarget(h) {
  if (R.boss && R.boss.arrive >= 1) return R.boss;
  let best = null, bd = 1e9;
  for (const e of R.en) {
    if (e.dead || e.x > W + 20 || e.y < 100) continue;
    const d = Math.hypot(e.x - h.x, e.y - h.y); if (d < bd) { bd = d; best = e; }
  }
  return best;
}
function aimY(t) { return t === R.boss ? t.y - 110 * U : t.y - 28 * U; }
function fire(h, tgt) {
  const g = GUNS[save.gun];
  const hx = h.x + 12 * U, hy = h.y - 48 * U;
  h.ang = Math.atan2(aimY(tgt) - hy, tgt.x - hx); h.recoil = 1; h.muzzle = 0.06;
  const crit = Math.random() < 0.1, total = dmgPerShot() * (crit ? 3 : 1);
  for (let k = 0; k < g.shots; k++) {
    const a = h.ang + (g.shots > 1 ? (k - (g.shots - 1) / 2) * 0.09 : 0);
    const mx = hx + Math.cos(h.ang) * g.len * U, my = hy + Math.sin(h.ang) * g.len * U;
    R.bul.push({ x: mx, y: my, a, sp: (g.rocket ? 900 : 1700) * U, tgt, dmg: total / g.shots, crit, col: g.bullet, w: g.w * U, rocket: g.rocket, life: 0.9 });
  }
  if (!g.rocket) R.parts.push({ k: 'casing', x: hx, y: hy, vx: rand(-120, -40) * U, vy: rand(-260, -160) * U, life: 0.6, max: 0.6, rot: 0 });
  sfx('shoot', 0.06);
}

// ================================================================ update
function update(dt) {
  R.t += dt;
  if (!R.boss) {
    R.spawnT -= dt;
    const alive = R.en.filter(e => !e.dead).length;
    if (R.spawnT <= 0 && alive < 10) { R.spawnT = rand(0.5, 1.0); const n = Math.random() < 0.4 ? 3 : Math.random() < 0.5 ? 2 : 1; for (let i = 0; i < n; i++) spawnEnemy(); }
  }
  if (!R.boss && save.bossReady && save.auto) { R.retryT -= dt; if (R.retryT <= 0) { R.retryT = 10; startBoss(); } }
  for (const e of R.en) {
    if (e.dead) continue;
    e.age += dt; e.anim += dt; if (e.flash > 0) e.flash -= dt;
    const goal = along(F.front, 0, e.lane * F.pathW * 0.8);
    const dx = goal.x - e.x, dy = goal.y - e.y, d = Math.hypot(dx, dy);
    let sp = e.sp;
    if (e.d.hop) { e.hopT -= dt; if (e.hopT > 0.5) sp = 0; if (e.hopT <= 0) e.hopT = 1.1; }
    if (d > 4) { const m = Math.min(d, sp * dt); e.x += dx / d * m; e.y += dy / d * m; }
    if (e.knock > 0) { e.x += F.dir.x * e.knock; e.y += F.dir.y * e.knock; e.knock *= 0.5; if (e.knock < 0.3) e.knock = 0; }
  }
  const b = R.boss;
  if (b) {
    b.anim += dt; if (b.flash > 0) b.flash -= dt;
    if (b.arrive < 1) { b.arrive = Math.min(1, b.arrive + dt / 1.4); const p = along(F.A, lerp(40, -260, b.arrive) * U, 0); b.x = p.x; b.y = p.y; if (b.arrive >= 1) R.shake = 14; }
    else { b.t -= dt; if (b.t <= 0) bossFail(); }
  }
  if (R.leavingBoss) { const lb = R.leavingBoss; lb.leaving += dt; lb.x += F.dir.x * 300 * U * dt; lb.y += F.dir.y * 300 * U * dt; if (lb.leaving > 2) R.leavingBoss = null; }
  const rate = fireRate();
  for (const h of R.heroes) {
    h.fireT -= dt; if (h.recoil > 0) h.recoil = Math.max(0, h.recoil - dt * 9); if (h.muzzle > 0) h.muzzle -= dt;
    const tgt = nearestTarget(h);
    if (tgt) h.ang = lerp(h.ang, Math.atan2(aimY(tgt) - (h.y - 48 * U), tgt.x - h.x), Math.min(1, dt * 12));
    if (tgt && h.fireT <= 0) { h.fireT = 1 / rate; fire(h, tgt); }
  }
  for (const q of R.bul) {
    q.life -= dt;
    const t = q.tgt, alive = t && !t.dead && (t === R.boss || R.en.includes(t));
    if (alive) { const want = Math.atan2(aimY(t) - q.y, t.x - q.x); let da = want - q.a; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU; q.a += da * Math.min(1, dt * 18); }
    q.x += Math.cos(q.a) * q.sp * dt; q.y += Math.sin(q.a) * q.sp * dt;
    if (q.rocket && Math.random() < 0.6) R.parts.push({ k: 'puff', x: q.x, y: q.y, s: 0.18 * U, life: 0.35, max: 0.35, rot: rand(0, TAU) });
    if (alive) {
      const rr = t === R.boss ? 70 * U : 26 * U;
      if (Math.hypot(t.x - q.x, aimY(t) - q.y) < rr) {
        q.dead = true;
        R.parts.push({ k: 'glow', x: q.x, y: q.y, s: (q.crit ? 2.2 : 1.4) * U * (t === R.boss ? 0.6 : 1), life: 0.16, max: 0.16, col: q.col });
        R.parts.push({ k: 'spark', x: q.x, y: q.y, s: (q.crit ? 1 : 0.6) * U, life: 0.12, max: 0.12, rot: rand(0, TAU) });
        if (q.rocket) boom(q.x, q.y, 1);
        damage(t, q.dmg, q.crit, t === R.boss);
      }
    }
    if (q.life <= 0 || q.x > W + 100 || q.y < -100) q.dead = true;
  }
  for (const p of R.parts) { p.life -= dt; if (p.vx !== undefined) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 900 * U * dt; p.rot += 8 * dt; } }
  for (const t of R.txt) { t.life -= dt; t.y -= (t.kind === 'money' ? 46 : 34) * U * dt; }
  for (const m of R.bills) {
    m.t += dt; m.rot += m.vr * dt;
    if (m.t < 0.35) { m.x += m.vx * dt; m.y += m.vy * dt; m.vy += 500 * U * dt; }
    else { const dx = F.wallet.x - m.x, dy = F.wallet.y - m.y, d = Math.hypot(dx, dy), sp = (900 + m.t * 900) * U; if (d < 20) { m.dead = true; R.walletPop = 0.15; } else { const k = Math.min(d, sp * dt); m.x += dx / d * k; m.y += dy / d * k; } }
  }
  R.en = R.en.filter(e => !e.dead); R.bul = R.bul.filter(q => !q.dead); R.parts = R.parts.filter(p => p.life > 0);
  R.txt = R.txt.filter(t => t.life > 0); R.bills = R.bills.filter(m => !m.dead);
  if (R.shake > 0) R.shake = Math.max(0, R.shake - dt * 40);
  if (R.flash > 0) R.flash = Math.max(0, R.flash - dt * 2);
  if (R.walletPop > 0) R.walletPop -= dt;
  R.earnT += dt; if (R.earnT >= 10) { save.rate = lerp(save.rate || 0, R.earned / R.earnT, 0.5); R.earned = 0; R.earnT = 0; }
}

// ================================================================ drawing
function drawGun(gi, x, y, ang, recoil, sc) {
  const g = GUNS[gi], L = g.len;
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); if (Math.cos(ang) < 0) ctx.scale(1, -1); ctx.scale(sc, sc); ctx.translate(-recoil * 6, 0);
  ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.lineJoin = 'round';
  ctx.fillStyle = g.acc; rrect(2, 1, 9, 13, 3); ctx.fill(); ctx.stroke();
  if (g.mag) { rrect(L * 0.42, 4, 8, 14, 2); ctx.fill(); ctx.stroke(); }
  if (g.barrels) { ctx.fillStyle = '#3a4250'; for (const o of [-5, 0, 5]) { rrect(L - 10, o - 2, 18, 4, 2); ctx.fill(); ctx.stroke(); } }
  else { ctx.fillStyle = '#3a4250'; rrect(L - 8, -4, 14, 8, 2); ctx.fill(); ctx.stroke(); }
  ctx.fillStyle = g.body; rrect(-4, -7, L, 14, 6); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.4)'; rrect(0, -5, L - 12, 3, 1.5); ctx.fill();
  ctx.fillStyle = g.acc; ctx.fillRect(L * 0.22, -2, L * 0.3, 4);
  if (g.scope) { ctx.fillStyle = INK; rrect(L * 0.3, -14, 16, 7, 3); ctx.fill(); }
  if (g.rocket) { ctx.fillStyle = g.acc; rrect(L - 2, -9, 11, 18, 4); ctx.fill(); ctx.stroke(); }
  if (g.glow) { ctx.fillStyle = g.acc; ctx.beginPath(); ctx.arc(L * 0.62, 0, 4, 0, TAU); ctx.fill(); }
  ctx.restore();
}
function drawGunIcon(canvas, gi) {
  const g2 = canvas.getContext('2d'); g2.clearRect(0, 0, canvas.width, canvas.height);
  const keep = ctx; ctx = g2; try { drawGun(gi, canvas.width * 0.18, canvas.height * 0.52, 0, 0, canvas.width / (GUNS[gi].len + 24)); } finally { ctx = keep; }
}
function render() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const sx = R.shake ? rand(-R.shake, R.shake) : 0, sy = R.shake ? rand(-R.shake, R.shake) : 0;
  if (fieldBg) ctx.drawImage(fieldBg, sx - 4, sy - 4, W + 8, H + 8); else { ctx.fillStyle = '#5fbf62'; ctx.fillRect(0, 0, W, H); }
  ctx.translate(sx, sy);
  const t = R.t;
  const list = [];
  for (const e of R.en) list.push({ y: e.y, k: 0, o: e });
  if (R.boss) list.push({ y: R.boss.y, k: 1, o: R.boss });
  if (R.leavingBoss) list.push({ y: R.leavingBoss.y, k: 1, o: R.leavingBoss });
  for (const h of R.heroes) list.push({ y: h.y, k: 2, o: h });
  list.sort((a, b) => a.y - b.y);
  for (const it of list) {
    const o = it.o;
    if (it.k === 0) {
      const fr = o.d.hop ? (o.hopT > 0.5 ? o.d.f[0] : o.d.f[1]) : o.d.f[Math.floor(o.anim * (o.d.fly ? 12 : 6)) % 2];
      const pop = o.age < 0.25 ? 0.5 + o.age * 2 : 1, bob = o.d.fly ? Math.sin(t * 6 + o.id) * 6 * U - 30 * U : 0;
      ctx.fillStyle = 'rgba(20,20,30,0.22)'; ctx.beginPath(); ctx.ellipse(o.x, o.y, 24 * o.sc, 7 * o.sc, 0, 0, TAU); ctx.fill();
      spr('en_' + fr, o.x, o.y + bob, o.sc * pop, 0.5, 1);
      if (o.flash > 0) { ctx.globalAlpha = 0.8; sprT('en_' + fr, '#ffffff', o.x, o.y + bob, o.sc * pop, 0.5, 1); ctx.globalAlpha = 1; }
      if (o.hp < o.maxHp) { const w = 44 * U, yy = o.y + bob - 70 * o.sc; ctx.fillStyle = INK; rrect(o.x - w / 2 - 2, yy - 2, w + 4, 9 * U, 4); ctx.fill(); ctx.fillStyle = '#ff4d63'; rrect(o.x - w / 2, yy, w * Math.max(0, o.hp / o.maxHp), 5 * U, 2.5); ctx.fill(); }
    } else if (it.k === 1) {
      const sc = 0.8 * U, br = Math.sin(t * 3) * 0.03;
      ctx.globalAlpha = o.leaving ? Math.max(0, 1 - o.leaving / 2) : 1;
      ctx.fillStyle = 'rgba(20,20,30,0.25)'; ctx.beginPath(); ctx.ellipse(o.x, o.y, 90 * U, 20 * U, 0, 0, TAU); ctx.fill();
      spr('boss_' + o.key, o.x, o.y + 6 * U, sc, 0.5, 1, false, Math.sin(t * 2) * 0.03, 1 + br, 1 - br);
      if (o.flash > 0) { ctx.globalAlpha = 0.2; sprT('boss_' + o.key, '#ffffff', o.x, o.y + 6 * U, sc, 0.5, 1, false, Math.sin(t * 2) * 0.03, 1 + br, 1 - br); }
      ctx.globalAlpha = 1;
    } else {
      const bob = Math.sin(t * 4 + o.ph) * 1.5 * U, sc = 0.74 * U;
      ctx.fillStyle = 'rgba(20,20,30,0.25)'; ctx.beginPath(); ctx.ellipse(o.x, o.y, 26 * U, 8 * U, 0, 0, TAU); ctx.fill();
      spr(`ch_${o.color}_idle`, o.x, o.y + 2 + bob, sc, 0.5, 1, false, 0, 1 + o.recoil * 0.03, 1 - o.recoil * 0.04);
      const hx = o.x + 12 * U, hy = o.y - 48 * U + bob;
      drawGun(save.gun, hx, hy, o.ang, o.recoil, 1.0 * U);
      if (o.muzzle > 0) {
        const L = GUNS[save.gun].len * U + 8 * U, mx = hx + Math.cos(o.ang) * L, my = hy + Math.sin(o.ang) * L;
        ctx.globalCompositeOperation = 'lighter'; sprT('fx_glow', GUNS[save.gun].bullet, mx, my, 1.1 * U); ctx.globalCompositeOperation = 'source-over';
        spr('fx_burst', mx, my, 0.4 * U, 0.5, 0.5, false, rand(0, TAU));
      }
    }
  }
  ctx.lineCap = 'round';
  for (const q of R.bul) {
    const L = (q.rocket ? 26 : 46) * U, tx = q.x - Math.cos(q.a) * L, ty = q.y - Math.sin(q.a) * L;
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = q.col; ctx.globalAlpha = 0.5; ctx.lineWidth = q.w * 2.2; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(q.x, q.y); ctx.stroke();
    ctx.globalAlpha = 1; ctx.lineWidth = q.w * 0.8; ctx.strokeStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(lerp(tx, q.x, 0.4), lerp(ty, q.y, 0.4)); ctx.lineTo(q.x, q.y); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }
  for (const p of R.parts) {
    const a = Math.max(0, p.life / p.max);
    if (p.k === 'puff') { ctx.globalAlpha = a * 0.9; sprT(`fx_puff_${Math.min(5, Math.floor((1 - a) * 6))}`, '#ffffff', p.x, p.y, p.s * (1.2 - a * 0.4), 0.5, 0.5, false, p.rot); ctx.globalAlpha = 1; }
    else if (p.k === 'chunk') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.globalAlpha = Math.min(1, a * 2); ctx.fillStyle = p.col; ctx.strokeStyle = INK; ctx.lineWidth = 2; rrect(-p.r / 2, -p.r / 2, p.r, p.r, 2); ctx.fill(); ctx.stroke(); ctx.restore(); ctx.globalAlpha = 1; }
    else if (p.k === 'casing') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.globalAlpha = a; ctx.fillStyle = '#ffcf3a'; ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.fillRect(-4 * U, -2 * U, 8 * U, 4 * U); ctx.strokeRect(-4 * U, -2 * U, 8 * U, 4 * U); ctx.restore(); ctx.globalAlpha = 1; }
    else if (p.k === 'glow') { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a; sprT('fx_glow', p.col, p.x, p.y, p.s); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    else if (p.k === 'spark') { ctx.globalCompositeOperation = 'lighter'; sprT('fx_spark', '#ffffff', p.x, p.y, p.s * (0.6 + a), 0.5, 0.5, false, p.rot); ctx.globalCompositeOperation = 'source-over'; }
    else if (p.k === 'expl') spr(`fx_expl_${Math.min(8, Math.floor((1 - a) * 9))}`, p.x, p.y, p.s, 0.5, 0.5, false, p.rot);
  }
  for (const m of R.bills) {
    ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(m.rot); ctx.scale(U, U);
    ctx.fillStyle = '#6fd35a'; ctx.strokeStyle = INK; ctx.lineWidth = 2; rrect(-10, -6, 20, 12, 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#3f9a36'; ctx.beginPath(); ctx.arc(0, 0, 3.2, 0, TAU); ctx.fill();
    ctx.restore();
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  for (const tx of R.txt) {
    const age = tx.max - tx.life, pop = age < 0.1 ? 1.4 - age * 4 : 1;
    const size = Math.round((tx.kind === 'crit' ? 30 : tx.kind === 'money' ? 26 : 22) * U * pop);
    ctx.globalAlpha = Math.min(1, tx.life * 4);
    ctx.font = FONT(size);
    const s = tx.kind === 'crit' ? tx.s + '!' : tx.s;
    let x = tx.x;
    if (tx.kind === 'money') {
      const w = ctx.measureText(s).width; x += 12 * U;
      ctx.save(); ctx.translate(tx.x - w / 2 - 4 * U, tx.y); ctx.scale(U, U); ctx.fillStyle = '#6fd35a'; ctx.strokeStyle = INK; ctx.lineWidth = 2; rrect(-11, -7, 22, 14, 3); ctx.fill(); ctx.stroke(); ctx.restore();
    }
    ctx.lineWidth = 6 * U; ctx.strokeStyle = INK;
    ctx.strokeText(s, x, tx.y);
    ctx.fillStyle = tx.kind === 'money' ? '#8cff5a' : tx.kind === 'crit' ? '#ffcf3a' : '#ffffff';
    ctx.fillText(s, x, tx.y);
  }
  ctx.globalAlpha = 1;
  const b = biome();
  if (R.motes.length < 28) R.motes.push({ x: Math.random() * W, y: Math.random() * H, s: rand(1, 2.6), ph: rand(0, 6) });
  ctx.fillStyle = `rgba(${b.motes},0.7)`;
  for (const m of R.motes) { m.y -= 8 * m.s / 60; m.x += Math.sin(t + m.ph) * 0.3; if (m.y < 0) m.y = H; ctx.beginPath(); ctx.arc(m.x, m.y, m.s * U, 0, TAU); ctx.fill(); }
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (R.flash > 0) { ctx.fillStyle = `rgba(255,250,230,${R.flash})`; ctx.fillRect(0, 0, W, H); }
}

// ================================================================ HUD & UI
const cards = Array.from(document.querySelectorAll('.ucard'));
let uiKey = '';
function updateUI() {
  const key = [Math.floor(save.money), save.gems, save.stage, save.sub, save.kills, save.bossReady, !!R.boss, R.boss ? Math.ceil(R.boss.hp) : 0, R.boss ? Math.ceil(R.boss.t) : 0, save.lv.power, save.lv.speed, save.lv.money, save.gun, save.team, save.auto, save.sound].join('|');
  if (key === uiKey) return; uiKey = key;
  $('money').textContent = fmt(save.money);
  $('gems').textContent = fmt(save.gems);
  $('stageLbl').textContent = `Bölüm ${save.stage}-${save.sub}`;
  const pct = save.bossReady ? 100 : Math.round(save.kills / KILLS_PER_SUB * 100);
  $('subFill').style.width = pct + '%'; $('subPct').textContent = save.bossReady ? 'BOSS HAZIR' : pct + '%';
  const nodes = $('nodes');
  if (!nodes.children.length) { for (let i = 1; i <= SUBS; i++) { const n = document.createElement('div'); n.className = 'node' + (i === SUBS ? ' boss' : ''); if (i === SUBS) n.innerHTML = '<img alt="">'; nodes.appendChild(n); } }
  Array.from(nodes.children).forEach((n, i) => {
    n.classList.toggle('done', i + 1 < save.sub);
    n.classList.toggle('cur', i + 1 === save.sub && i + 1 < SUBS);
    if (i + 1 === SUBS) n.querySelector('img').src = `assets/ui/boss_${biome().boss}.png`;
  });
  for (const c of cards) {
    const k = c.dataset.up, lv = save.lv[k], cost = COST[k](lv), maxed = k === 'speed' && fireRate() >= 12;
    c.querySelector('.lv').textContent = lv;
    c.querySelector('.val').textContent = k === 'power' ? fmt(dmgPerShot()) : k === 'speed' ? fireRate().toFixed(2) + '/sn' : 'x' + fmt(moneyMul());
    c.querySelector('.cost b').textContent = maxed ? 'MAKS' : fmt(cost);
    c.classList.toggle('cant', maxed || save.money < cost);
  }
  const bb = $('bossBtn');
  bb.classList.toggle('ready', save.bossReady && !R.boss); bb.classList.toggle('locked', !save.bossReady);
  $('bossBtnImg').src = `assets/ui/boss_${biome().boss}.png`;
  $('autoBtn').classList.toggle('on', save.auto);
  if (R.boss) {
    $('bossFill').style.width = Math.max(0, R.boss.hp / R.boss.maxHp * 100) + '%';
    $('bossHpTxt').textContent = fmt(Math.max(0, R.boss.hp));
    const bt = $('bossTime'); bt.textContent = Math.max(0, Math.ceil(R.boss.t)); bt.classList.toggle('low', R.boss.t < 8);
  }
  drawGunIcon(document.querySelector('.gunico'), save.gun);
  $('soundIco').src = 'assets/ui/' + (save.sound ? 'ic_sound_on' : 'ic_sound_off') + '.png';
}
function buy(k) {
  const lv = save.lv[k], cost = COST[k](lv);
  if (k === 'speed' && fireRate() >= 12) return false;
  if (save.money < cost) { sfx('no', 0.2); return false; }
  save.money -= cost; save.lv[k]++; sfx('buy', 0.05);
  return true;
}
cards.forEach(c => {
  let timer = null, rep = null;
  const stop = () => { clearTimeout(timer); clearInterval(rep); timer = rep = null; };
  c.addEventListener('pointerdown', e => { e.preventDefault(); audioInit(); buy(c.dataset.up); stop(); timer = setTimeout(() => { rep = setInterval(() => { if (!buy(c.dataset.up)) stop(); }, 90); }, 380); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => c.addEventListener(ev, stop));
  c.addEventListener('contextmenu', e => e.preventDefault());
});
$('bossBtn').onclick = () => { audioInit(); if (save.bossReady && !R.boss) startBoss(); else if (!save.bossReady) toast(`Önce ${SUBS} aşamayı bitir`); };
$('autoBtn').onclick = () => { audioInit(); save.auto = !save.auto; sfx('click'); toast(save.auto ? 'Otomatik boss: AÇIK' : 'Otomatik boss: KAPALI'); uiKey = ''; persist(); };
$('soundBtn').onclick = () => { audioInit(); save.sound = !save.sound; sfx('click'); uiKey = ''; persist(); };
function banner(text, sub = '') { const b = $('banner'); b.innerHTML = text + (sub ? `<small>${sub}</small>` : ''); b.classList.remove('show'); void b.offsetWidth; b.classList.add('show'); }
function toast(text) { const t = $('toast'); t.textContent = text; t.classList.remove('show'); void t.offsetWidth; t.classList.add('show'); }

// ---------------- panels (guns, team, rebirth, offline)
function el(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; }
function openPanel(title, color, build) {
  $('pTitle').textContent = title; $('pTitle').className = 'ribbon ' + (color || '');
  const body = $('pBody'); body.innerHTML = ''; build(body);
  $('panel').classList.remove('hidden');
}
function closePanel() { $('panel').classList.add('hidden'); }
$('pClose').onclick = () => { sfx('click'); closePanel(); };
$('panel').addEventListener('pointerdown', e => { if (e.target.id === 'panel') closePanel(); });
const PANELS = {
  guns: () => openPanel('Silahlar', 'blue', body => {
    body.appendChild(el('<p class="big-note">Daha güçlü silahlar elmasla açılır. Elmaslar bosslardan düşer.</p>'));
    GUNS.forEach((g, i) => {
      const owned = i <= save.gun, next = i === save.gun + 1;
      const row = el(`<div class="row-card ${i === save.gun ? 'cur' : ''} ${owned || next ? '' : 'lock'}"><div class="ico"><canvas width="128" height="80"></canvas></div>
        <div class="info"><h4>${g.name}</h4><p>Hasar x${fmt(g.mult)}${g.shots > 1 ? ` · ${g.shots} mermi` : ''}</p></div>
        ${i === save.gun ? '<button class="btn grey off">TAKILI</button>' : owned ? '<button class="btn grey off">AÇILDI</button>' : next ? `<button class="btn yellow"><img src="assets/ui/gem_blue.png" alt="">${g.cost}</button>` : '<button class="btn grey off">KİLİTLİ</button>'}</div>`);
      drawGunIcon(row.querySelector('canvas'), i);
      if (next) row.querySelector('.btn').onclick = () => { if (save.gems < g.cost) { sfx('no'); toast('Yeterli elmas yok'); return; } save.gems -= g.cost; save.gun = i; sfx('buy', 0); persist(); uiKey = ''; PANELS.guns(); };
      body.appendChild(row);
    });
  }),
  team: () => openPanel('Takım', 'green', body => {
    body.appendChild(el('<p class="big-note">Her yeni astronot takıma bir silah daha ekler.</p>'));
    TEAM.forEach((h, i) => {
      const owned = i < save.team, next = i === save.team;
      const row = el(`<div class="row-card ${owned || next ? '' : 'lock'}"><div class="ico"><img src="assets/ui/hero_${h.color}.png" alt=""></div>
        <div class="info"><h4>${h.name}</h4><p>${owned ? 'Takımda, ateş ediyor' : 'Takıma katılmayı bekliyor'}</p></div>
        ${owned ? '<button class="btn grey off">TAKIMDA</button>' : next ? `<button class="btn yellow"><img src="assets/ui/coin_gold.png" alt="">${fmt(h.cost)}</button>` : '<button class="btn grey off">KİLİTLİ</button>'}</div>`);
      if (next) row.querySelector('.btn').onclick = () => { if (save.money < h.cost) { sfx('no'); toast('Yeterli altın yok'); return; } save.money -= h.cost; save.team++; setupHeroes(); sfx('buy', 0); persist(); uiKey = ''; PANELS.team(); };
      body.appendChild(row);
    });
  }),
  rebirth: () => openPanel('Yeniden Doğuş', 'purple', body => {
    const gain = rebirthGain();
    body.appendChild(el(`<div class="big-num">x${(1 + save.rp * 0.3).toFixed(1)}</div>`));
    body.appendChild(el('<p class="big-note">Kalıcı hasar ve para bonusun. Her doğuş puanı +%30 ekler.</p>'));
    body.appendChild(el(`<div class="row-card"><div class="ico"><img src="assets/ui/ic_star.png" alt=""></div><div class="info"><h4>+${gain} doğuş puanı</h4>
      <p>${save.stage >= 6 ? 'Bölüm, seviyeler ve altın sıfırlanır. Elmas, silahlar ve takım kalır.' : '6. bölüme ulaşınca açılır.'}</p></div></div>`));
    const btn = el(`<button class="btn purple ${gain > 0 ? '' : 'off'}">YENİDEN DOĞ</button>`);
    btn.onclick = () => {
      if (gain <= 0) return;
      save.rp += gain; save.rebirths++; save.stage = 1; save.sub = 1; save.kills = 0; save.bossReady = false; save.money = 0; save.lv = { power: 0, speed: 0, money: 0 };
      R.en.length = 0; R.boss = null; $('bossHud').classList.add('hidden');
      persist(); buildField(); closePanel(); banner('YENİDEN DOĞDUN!', `Bonus x${(1 + save.rp * 0.3).toFixed(1)}`); sfx('win', 0); uiKey = '';
    };
    body.appendChild(btn);
  }),
};
document.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => { audioInit(); sfx('click'); PANELS[b.dataset.open](); }));
function offlineReward() {
  if (!save.t) return;
  const away = (Date.now() - save.t) / 1000;
  if (away < 60 || !save.rate) return;
  const gain = Math.min(away, 8 * 3600) * save.rate * 0.4;
  if (gain < 1) return;
  const h = Math.floor(away / 3600), m = Math.floor(away % 3600 / 60);
  openPanel('Hoş geldin!', 'green', body => {
    body.appendChild(el(`<p class="big-note">Sen yokken (${h ? h + ' sa ' : ''}${m} dk) takımın savaşmaya devam etti:</p>`));
    body.appendChild(el(`<div class="big-num">+${fmt(gain)}</div>`));
    const btn = el('<button class="btn yellow"><img src="assets/ui/coin_gold.png" alt="">TOPLA</button>');
    btn.onclick = () => { audioInit(); addMoney(gain, W / 2, H / 2, 20); closePanel(); persist(); };
    body.appendChild(btn);
  });
}

// ================================================================ loop
let last = performance.now(), saveT = 0;
function frame(now) {
  const dt = Math.min(1 / 20, (now - last) / 1000); last = now;
  update(dt); render(); updateUI();
  $('money').parentNode.style.transform = R.walletPop > 0 ? 'scale(1.12)' : '';
  saveT += dt; if (saveT > 5) { saveT = 0; persist(); }
  requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange', () => { if (document.hidden) persist(); else last = performance.now(); });
window.addEventListener('pagehide', persist);
const fontReady = document.fonts && document.fonts.load ? document.fonts.load('800 20px "Baloo 2"').catch(() => {}) : Promise.resolve();
Promise.all([atlasReady, Promise.race([fontReady, new Promise(r => setTimeout(r, 1500))])]).then(() => {
  resize();
  $('loading').classList.add('hidden');
  if (save.bossReady && save.auto) R.retryT = 2;
  offlineReward();
  requestAnimationFrame(frame);
});
window.addEventListener('pointerdown', audioInit, { once: true });

window.SwarmSquad = { save, R, buy, startBoss, fmt };
})();
