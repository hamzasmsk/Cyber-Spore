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
  DPR = Math.min(window.devicePixelRatio || 1, 3);
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
// walkable area for the squad (feet position): clear of the top HUD, the bottom cards and the screen edges
function heroBox() {
  const y0 = 140 + 92 * U, y1 = Math.max(y0 + 60, H - 165);
  return { x0: 34 * U, x1: W - 34 * U, y0, y1 };
}
// area enemies may stand in (a bit looser at the top so they stay visible under the HUD)
function enemyBox() { return { x0: 74 * U, x1: W - 74 * U, y0: 150 + 50 * U, y1: Math.max(300, H - 190) }; }   // inside the side button columns
// the squad keeps out from under the side button columns (rects re-read twice a second; plugins may add buttons)
let sideRects = [], sideT = 0;
function avoidSides(p, half) {
  for (const r of sideRects) {
    if (p.y < r.top || p.y - 90 * U > r.bottom) continue;
    if (r.left < W / 2) p.x = Math.max(p.x, r.right + half); else p.x = Math.min(p.x, r.left - half);
  }
  return p;
}
const clampBox = (p, b) => ({ x: clamp(p.x, b.x0, b.x1), y: clamp(p.y, b.y0, b.y1) });
const STAND = 240;   // enemies stop this far (x U) from the squad leader

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
  if (f[4]) sc *= f[4];
  const w = f[2] * sc * sx, h = f[3] * sc * sy;
  if (!flip && !rot) { ctx.drawImage(atlasImg, f[0], f[1], f[2], f[3], x - w * ax, y - h * ay, w, h); return; }
  ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot); if (flip) ctx.scale(-1, 1);
  ctx.drawImage(atlasImg, f[0], f[1], f[2], f[3], -w * ax, -h * ay, w, h); ctx.restore();
}
function sprT(name, color, x, y, sc = 1, ax = 0.5, ay = 0.5, flip = false, rot = 0, sx = 1, sy = 1) {
  const f0 = AF[name]; if (f0 && f0[4]) sc *= f0[4];
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
const MODS = { dmg: [], rate: [], money: [] };   // feature plugins push functions returning a multiplier
const modMul = k => MODS[k].reduce((m, f) => m * (f() || 1), 1);
const dmgPerShot = () => stat.power(save.lv.power) * GUNS[save.gun].mult * rebirthMul() * modMul('dmg');
const fireRate = () => stat.speed(save.lv.speed) * modMul('rate');
const moneyMul = () => stat.money(save.lv.money) * rebirthMul() * modMul('money');
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
    case 'hurt': tone('sawtooth', 240, 90, 0.18, 0.07); noise(0.12, 0.08, 900); break;
    case 'lob': tone('triangle', 260, 520, 0.14, 0.04); break;
    case 'click': tone('triangle', 700, 950, 0.05, 0.05); break;
  }
}

// ================================================================ runtime state
const R = { en: [], bul: [], eb: [], parts: [], txt: [], bills: [], boss: null, spawnT: 0.5, t: 0, shake: 0, flash: 0, hurt: 0, earned: 0, earnT: 0, retryT: 0, heroes: [], motes: [], nextId: 1, walletPop: 0, leavingBoss: null, lobGap: 0, sq: null, joy: null, hint: 1 };
// the squad: leader position (feet), velocity, health
const sqMaxHp = () => Math.round((100 + 12 * (save.stage - 1)) * (1 + 0.1 * (save.team - 1)));
const hpBase = () => 100 + 12 * (save.stage - 1);   // damage of enemy attacks scales with this
function slotPos(i, p) { const s = SLOTS[i]; return along(p, s[1] * 82 * U, s[0] * F.pathW * 0.4); }
function setupHeroes() {
  const hb = heroBox();
  if (!R.sq) { const mh = sqMaxHp(); R.sq = { x: F.S.x, y: F.S.y, vx: 0, vy: 0, hp: mh, maxHp: mh, lag: mh, ko: 0, inv: 0, hit: 0, calm: 9, face: 1, moving: false, dustT: 0 }; }
  const p = clampBox(R.sq, hb); R.sq.x = p.x; R.sq.y = p.y;
  const old = R.heroes;
  R.heroes = TEAM.slice(0, save.team).map((h, i) => {
    if (old[i]) { const o = old[i]; if (i === 0) { o.x = p.x; o.y = p.y; } return o; }
    const pos = clampBox(slotPos(i, R.sq), followBox());
    if (old.length) puff(pos.x, pos.y - 30 * U, 0.6);
    return { color: h.color, x: pos.x, y: pos.y, fireT: rand(0, 0.6), recoil: 0, ang: -0.6, muzzle: 0, ph: rand(0, 6), i, face: 1, walk: 0, moving: false, spd: 0 };
  });
}
function followBox() { const b = heroBox(); return { x0: 22 * U, x1: W - 22 * U, y0: b.y0 - 24 * U, y1: b.y1 + 30 * U }; }

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
      if (it.f === 'p_torch_on_a' && !save.eco) { g.globalCompositeOperation = 'lighter'; const gl = tinted('fx_glow', '#ff9a3b'); g.globalAlpha = 0.5; g.drawImage(gl, it.x - 50 * it.s, it.y - 90 * it.s, 100 * it.s, 100 * it.s); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
      spr(it.f, it.x, it.y + 4, it.s, 0.5, 1, it.flip);
    });
  ctx = keep;
}

// ================================================================ combat
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
// spawn far from the squad: ahead on the path if possible, else the farthest free spot on screen
function spawnPoint(lane) {
  const eb = enemyBox(), sq = R.sq;
  let p = clampBox(along(sq, rand(380, 470) * U, lane * F.pathW), eb);
  if (dist(p, sq) < 320 * U) {
    let best = p, bd = dist(p, sq);
    for (let i = 0; i < 10; i++) {
      const c = { x: rand(eb.x0, eb.x1), y: rand(eb.y0, eb.y1) }, d = dist(c, sq) + (c.x - sq.x) * 0.15 - (c.y - sq.y) * 0.1;
      if (d > bd) { bd = d; best = c; }
    }
    p = best;
  }
  return p;
}
// where an enemy wants to stand: STAND px from the leader at its lane, facing the squad
function enemyGoal(e) {
  const eb = enemyBox(), sq = R.sq, st = STAND * U;
  let g = clampBox(along(sq, st, e.lane * F.pathW * 0.8), eb);
  if (dist(g, sq) < st * 0.85) {   // squad is near the top/right edge: hold position on the radial line instead
    const dx = e.x - sq.x, dy = e.y - sq.y, d = Math.hypot(dx, dy) || 1;
    g = clampBox({ x: sq.x + dx / d * st, y: sq.y + dy / d * st }, eb);
  }
  return g;
}
const RANGED = { fireslime: 1, spikeslime: 1, blockslime: 1, bee: 1, fly: 1, frog: 1, worm: 1, ladybug: 1 };
function spawnEnemy() {
  const b = biome(), type = pick(b.pool), d = EDEF[type];
  const lane = rand(-0.38, 0.38);
  const p = spawnPoint(lane);
  puff(p.x, p.y - 20 * U, 0.45);
  const hp = enemyHp() * (d.hp || 1);
  R.en.push({ id: R.nextId++, type, d, x: p.x, y: p.y, lane, hp, maxHp: hp, sp: 75 * U * (d.spd || 1), flash: 0, anim: rand(0, 1), knock: 0, kx: 1, ky: 0, kb: 0, age: 0, sc: (d.sc || 1) * 1.2 * U, hopT: rand(0, 1),
    ranged: !!RANGED[type], stopped: false, atk: rand(1.4, 2.6), wind: 0 });
}
function startBoss() {
  if (R.boss || !save.bossReady) return;
  const b = biome();
  for (const e of R.en) { e.dead = true; puff(e.x, e.y - 20 * U, 0.5); }
  R.eb.length = 0;
  const p = along(F.A, 40 * U, 0), hp = bossHp();
  R.boss = { x: p.x, y: p.y, hp, maxHp: hp, t: BOSS_TIME, flash: 0, anim: 0, key: b.boss, name: b.bossName, arrive: 0, leaving: 0, atkT: 1.6, seq: 0, tele: 0, teleK: '', burst: [] };
  $('bossImg').src = `assets/ui/boss_${b.boss}.png`;
  $('bossHud').classList.remove('hidden');
  banner('BOSS!', b.bossName); sfx('boss', 0); R.shake = 12; uiKey = '';
}
function bossWin() {
  const b = R.boss; R.boss = null; R.eb.length = 0;
  runHooks('bossWin', b);
  for (let i = 0; i < 6; i++) setTimeout(() => boom(b.x + rand(-60, 60) * U, b.y - rand(20, 160) * U, 1.2), i * 90);
  const gems = 2 + Math.floor(save.stage / 3), cash = enemyHp() * 25 * moneyMul();
  save.gems += gems; addMoney(cash, b.x, b.y - 80 * U, 24);
  save.stage++; save.sub = 1; save.kills = 0; save.bossReady = false; save.best = Math.max(save.best, save.stage);
  $('bossHud').classList.add('hidden');
  banner('ZAFER!', `+${gems} elmas · Bölüm ${save.stage}-1`); sfx('win', 0);
  persist(); setTimeout(buildField, 700);
}
function bossFail() {
  const b = R.boss; if (!b) return;
  b.leaving = 0.01; R.boss = null; R.leavingBoss = b; R.eb.length = 0;
  $('bossHud').classList.add('hidden');
  banner('BOSS KAÇTI!', 'Güçlen ve tekrar dene'); sfx('fail', 0);
  R.retryT = 10;
}
function damage(target, dmg, crit, isBoss) {
  target.hp -= dmg; target.flash = 0.07;
  if (!isBoss) { const dx = target.x - R.sq.x, dy = target.y - R.sq.y, d = Math.hypot(dx, dy) || 1; target.kx = dx / d; target.ky = dy / d; target.knock = 10 * U; }
  addText(target.x + rand(-24, 24) * U, target.y - (isBoss ? 150 : 50) * U + rand(-10, 10) * U, fmt(dmg), crit ? 'crit' : 'dmg');
  if (target.hp <= 0) { if (isBoss) bossWin(); else kill(target); }
}
function kill(e) {
  e.dead = true;
  runHooks('kill', e);
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
// particles: eco mode (save.eco) halves them and drops glow sprites
function part(p) { if (save.eco && (p.k === 'glow' || (p.k !== 'expl' && Math.random() < 0.5))) return; if (R.parts.length < 400) R.parts.push(p); }
function puff(x, y, s) { part({ k: 'puff', x, y, s: s * U, life: 0.45, max: 0.45, rot: rand(0, TAU) }); }
function confetti(x, y, col, n) { for (let i = 0; i < n; i++) { const a = rand(-Math.PI, 0), s = rand(80, 300) * U; part({ k: 'chunk', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.4, 0.8), max: 0.8, col, r: rand(4, 8) * U, rot: rand(0, TAU) }); } }
function boom(x, y, s) { R.parts.push({ k: 'expl', x, y, s: s * U, life: 0.5, max: 0.5, rot: rand(0, TAU) }); part({ k: 'glow', x, y, s: s * 2.4 * U, life: 0.25, max: 0.25, col: '#ffb43a' }); R.shake = Math.max(R.shake, 8); R.flash = Math.max(R.flash, 0.2); sfx('boom', 0.08); }
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
  const hx = h.x + 12 * U * (h.face || 1), hy = h.y - 48 * U;
  h.ang = Math.atan2(aimY(tgt) - hy, tgt.x - hx); h.recoil = 1; h.muzzle = 0.06;
  const crit = Math.random() < 0.1, total = dmgPerShot() * (crit ? 3 : 1);
  for (let k = 0; k < g.shots; k++) {
    const a = h.ang + (g.shots > 1 ? (k - (g.shots - 1) / 2) * 0.09 : 0);
    const mx = hx + Math.cos(h.ang) * g.len * U, my = hy + Math.sin(h.ang) * g.len * U;
    R.bul.push({ x: mx, y: my, a, sp: (g.rocket ? 900 : 1700) * U, tgt, dmg: total / g.shots, crit, col: g.bullet, w: g.w * U, rocket: g.rocket, life: 0.9 });
  }
  if (!g.rocket) part({ k: 'casing', x: hx, y: hy, vx: rand(-120, -40) * U, vy: rand(-260, -160) * U, life: 0.6, max: 0.6, rot: 0 });
  sfx('shoot', 0.06);
}

// ================================================================ squad: input, movement, health
const keys = {};
const KEYMAP = { KeyW: 'u', ArrowUp: 'u', KeyS: 'd', ArrowDown: 'd', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r' };
const typing = e => e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
window.addEventListener('keydown', e => { const k = KEYMAP[e.code]; if (!k || typing(e)) return; keys[k] = true; e.preventDefault(); });
window.addEventListener('keyup', e => { const k = KEYMAP[e.code]; if (k) keys[k] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; R.joy = null; });
const JOY_R = 56;   // joystick radius (CSS px)
const panelOpen = () => !$('panel').classList.contains('hidden');
cv.addEventListener('pointerdown', e => {
  if (R.joy || panelOpen() || e.clientY < 130 || e.clientY > H - 150) return;
  e.preventDefault(); audioInit();
  R.joy = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY, t: 0 };
  try { cv.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointer */ }
});
window.addEventListener('pointermove', e => {
  const j = R.joy; if (!j || e.pointerId !== j.id) return;
  j.x = e.clientX; j.y = e.clientY;
  const dx = j.x - j.ox, dy = j.y - j.oy, d = Math.hypot(dx, dy), m = JOY_R * 1.25;
  if (d > m) { j.ox = j.x - dx / d * m; j.oy = j.y - dy / d * m; }   // floating base follows the finger
});
const joyEnd = e => { if (R.joy && e.pointerId === R.joy.id) R.joy = null; };
window.addEventListener('pointerup', joyEnd); window.addEventListener('pointercancel', joyEnd);
function moveInput() {
  let x = 0, y = 0;
  const j = R.joy;
  if (j) { const dx = j.x - j.ox, dy = j.y - j.oy, d = Math.hypot(dx, dy); if (d > JOY_R * 0.12) { const m = Math.min(1, d / JOY_R); x = dx / d * m; y = dy / d * m; } }
  const kx = (keys.r ? 1 : 0) - (keys.l ? 1 : 0), ky = (keys.d ? 1 : 0) - (keys.u ? 1 : 0);
  if (kx || ky) { const d = Math.hypot(kx, ky); x = kx / d; y = ky / d; }
  return { x, y };
}
function hurtSquad(dmg, x, y) {
  const sq = R.sq;
  if (!sq || sq.ko > 0 || sq.inv > 0) return false;
  dmg = Math.max(1, Math.round(dmg));
  sq.hp -= dmg; sq.inv = 0.7; sq.hit = 0.3; sq.calm = 0;
  R.shake = Math.max(R.shake, 10); R.hurt = 0.45;
  const L = R.heroes[0];
  addText(clamp((L ? L.x : x) + rand(-10, 10) * U, 40 * U, W - 40 * U), (L ? L.y : y) - 140 * U, '-' + dmg, 'hurt');
  if (x !== undefined) confetti(x, y, '#ff4d63', 5);
  sfx('hurt', 0.08);
  runHooks('hurt', dmg);
  if (sq.hp <= 0) knockout();
  return true;
}
function knockout() {
  const sq = R.sq;
  sq.hp = 0; sq.ko = 3; sq.vx = sq.vy = 0; R.joy = null;
  R.eb.length = 0;
  for (const e of R.en) e.kb = 240 * U;   // enemies get pushed back
  for (const h of R.heroes) puff(h.x, h.y - 20 * U, 0.8);
  R.shake = 16;
  if (R.boss) bossFail();
  else {
    banner('NAKAVT!', save.bossReady ? 'Takım toparlanıyor…' : 'Aşama ilerlemesi sıfırlandı');
    if (!save.bossReady) save.kills = 0;
    sfx('fail', 0);
  }
  uiKey = '';
  runHooks('ko');
}
function updateSquad(dt) {
  const sq = R.sq; if (!sq) return;
  sq.maxHp = sqMaxHp();
  if (sq.inv > 0) sq.inv -= dt; if (sq.hit > 0) sq.hit -= dt; sq.calm += dt;
  if (sq.ko > 0) {
    sq.ko -= dt; sq.hp = sq.maxHp * clamp(1 - sq.ko / 3, 0, 1);
    if (sq.ko <= 0) { sq.ko = 0; sq.hp = sq.maxHp; sq.inv = 1.5; for (const h of R.heroes) puff(h.x, h.y - 20 * U, 0.6); }
  } else if (sq.calm > 2.5 && sq.hp < sq.maxHp) sq.hp = Math.min(sq.maxHp, sq.hp + sq.maxHp * 0.05 * dt);
  sq.hp = Math.min(sq.hp, sq.maxHp);
  sq.lag = sq.lag > sq.hp ? Math.max(sq.hp, sq.lag - sq.maxHp * 0.5 * dt) : sq.hp;
  const inp = sq.ko > 0 ? { x: 0, y: 0 } : moveInput(), SPD = 230 * U;
  const k = Math.min(1, dt * 12);
  sq.vx = lerp(sq.vx, inp.x * SPD, k); sq.vy = lerp(sq.vy, inp.y * SPD, k);
  if (Math.abs(sq.vx) < 1 && !inp.x) sq.vx = 0; if (Math.abs(sq.vy) < 1 && !inp.y) sq.vy = 0;
  const hb = heroBox();
  sideT -= dt;
  if (sideT <= 0) { sideT = 0.5; sideRects = Array.from(document.querySelectorAll('#ui .side')).map(el => el.getBoundingClientRect()).filter(r => r.width > 0 && r.height > 0); }
  sq.x = clamp(sq.x + sq.vx * dt, hb.x0, hb.x1); sq.y = clamp(sq.y + sq.vy * dt, hb.y0, hb.y1);
  avoidSides(sq, 28 * U);
  sq.moving = Math.hypot(sq.vx, sq.vy) > 25 * U;
  if (sq.moving) R.hint = Math.max(0, R.hint - dt * 2);
  if (Math.abs(sq.vx) > 20 * U) sq.face = sq.vx > 0 ? 1 : -1;
  // boss body blocks the squad
  const b = R.boss;
  if (b && b.arrive >= 1 && sq.ko <= 0) {
    const dx = sq.x - b.x, dy = (sq.y - b.y) / 0.6, d = Math.hypot(dx, dy), rr = 120 * U;
    if (d < rr) { const n = d || 1; sq.x = clamp(b.x + dx / n * rr, hb.x0, hb.x1); sq.y = clamp(b.y + dy / n * rr * 0.6, hb.y0, hb.y1); hurtSquad(hpBase() * 0.12, sq.x, sq.y - 30 * U); }
  }
  const fb = followBox();
  for (const h of R.heroes) {
    const ox = h.x, oy = h.y;
    if (h.i === 0) { h.x = sq.x; h.y = sq.y; }
    else if (sq.ko <= 0) { const t = avoidSides(clampBox(slotPos(h.i, sq), fb), 22 * U), f = Math.min(1, dt * 7); h.x = lerp(h.x, t.x, f); h.y = lerp(h.y, t.y, f); }
    const sp = Math.hypot(h.x - ox, h.y - oy) / Math.max(dt, 1e-4);
    h.spd = lerp(h.spd || 0, sp, Math.min(1, dt * 10));
    h.moving = h.spd > 30 * U;
    if (h.moving) {
      h.walk += dt * (6 + h.spd / (40 * U));
      if (Math.abs(h.x - ox) > 0.3 * U) h.face = h.x > ox ? 1 : -1;
      h.dust = (h.dust || 0) - dt;
      if (h.dust <= 0) { h.dust = 0.16; part({ k: 'puff', x: h.x - h.face * 12 * U, y: h.y - 4 * U, s: 0.22 * U, life: 0.4, max: 0.4, rot: rand(0, TAU), dust: 1 }); }
    } else if (sq.face && h.i === 0) h.face = sq.face;
  }
}

// ================================================================ enemy & boss attacks
function lob(e) {
  const L = R.heroes[0]; if (!L) return;
  const tx = L.x + rand(-14, 14) * U + R.sq.vx * 0.25, ty = L.y + rand(-8, 8) * U + R.sq.vy * 0.25;
  R.eb.push({ k: 'lob', sx: e.x, sy: e.y - 30 * U * (e.sc / (1.2 * U)), tx, ty, t: 0, T: 1.3, col: e.d.col, r: 11 * U, dmg: hpBase() * 0.09 });
  sfx('lob', 0.1);
}
function orb(x, y, a, sp, col, dmg, r = 12) { R.eb.push({ k: 'orb', x, y, vx: Math.cos(a) * sp * U, vy: Math.sin(a) * sp * U, r: r * U, col, dmg, life: 7 }); }
const BOSS_COL = { brood: '#b26bff', golem: '#ff9a3b', hydra: '#ff5a3c', prism: '#7fe3ff', core: '#ffcf3a' };
function bossAttack(b, kind) {
  const L = R.heroes[0]; if (!L) return;
  const col = BOSS_COL[b.key] || '#ff4d63', cx = b.x, cy = b.y - 110 * U, dmg = hpBase() * 0.1, rage = b.hp < b.maxHp * 0.5;
  if (kind === 'fan') {
    const a0 = Math.atan2(L.y - 30 * U - cy, L.x - cx), n = rage ? 7 : 5;
    for (let i = 0; i < n; i++) orb(cx, cy, a0 + (i - (n - 1) / 2) * 0.2, 240, col, dmg);
    b.burst.push({ t: 0.45, k: 'aim' });
    sfx('lob', 0);
  } else if (kind === 'aim') {
    orb(cx, cy, Math.atan2(L.y - 30 * U - cy, L.x - cx), 320, col, dmg, 14);
  } else if (kind === 'ring') {
    const n = rage ? 18 : 14, off = rand(0, TAU);
    for (let i = 0; i < n; i++) orb(cx, cy, off + i / n * TAU, 160, col, dmg);
    if (rage) b.burst.push({ t: 0.5, k: 'ring2', off: off + Math.PI / n });
    sfx('lob', 0);
  } else if (kind === 'ring2') {
    const n = 18; for (let i = 0; i < n; i++) orb(cx, cy, b.burstOff + i / n * TAU, 160, col, dmg);
  } else if (kind === 'slam') {
    R.eb.push({ k: 'wave', x: b.x, y: b.y, r: 50 * U, sp: 300 * U, max: 560 * U, w: 14 * U, col, dmg: hpBase() * 0.16, gaps: b.gaps, hit: false });
    R.shake = 16; sfx('boom', 0); puff(b.x - 60 * U, b.y, 1); puff(b.x + 60 * U, b.y, 1);
  }
}
const angIn = (a, c, w) => { let d = a - c; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return Math.abs(d) < w; };
function updateBossAI(b, dt) {
  for (const q of b.burst) { q.t -= dt; if (q.t <= 0) { if (q.k === 'ring2') b.burstOff = q.off; bossAttack(b, q.k); } }
  b.burst = b.burst.filter(q => q.t > 0);
  if (b.tele > 0) { b.tele -= dt; if (b.tele <= 0) bossAttack(b, b.teleK); return; }
  b.atkT -= dt;
  if (b.atkT <= 0) {
    const rage = b.hp < b.maxHp * 0.5, seq = ['fan', 'ring', 'slam', 'fan', 'ring', 'slam'];
    const k = seq[b.seq++ % seq.length];
    b.teleK = k; b.tele = k === 'slam' ? 0.8 : 0.45;
    if (k === 'slam') { const L = R.heroes[0], a = L ? Math.atan2((L.y - b.y) / 0.6, L.x - b.x) : 2.4; b.gaps = [a + rand(0.6, 1.0) * (Math.random() < 0.5 ? -1 : 1), a + Math.PI * rand(0.8, 1.2)]; }
    b.atkT = (rage ? 1.7 : 2.3) + b.tele;
  }
}
function updateEnemyShots(dt) {
  const sq = R.sq, hs = R.heroes;
  for (const p of R.eb) {
    if (p.k === 'lob') {
      p.t += dt;
      if (p.t >= p.T) {
        p.dead = true; puff(p.tx, p.ty - 6 * U, 0.6); confetti(p.tx, p.ty - 6 * U, p.col, 4);
        for (const h of hs) { const dx = h.x - p.tx, dy = (h.y - p.ty) / 0.6; if (Math.hypot(dx, dy) < 40 * U) { hurtSquad(p.dmg, p.tx, p.ty - 20 * U); break; } }
      }
    } else if (p.k === 'orb') {
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.life <= 0 || p.x < -60 || p.x > W + 60 || p.y < -60 || p.y > H + 60) p.dead = true;
      else for (const h of hs) if (Math.hypot(h.x - p.x, h.y - 32 * U - p.y) < p.r + 18 * U) { if (hurtSquad(p.dmg, p.x, p.y)) { p.dead = true; part({ k: 'spark', x: p.x, y: p.y, s: 0.8 * U, life: 0.15, max: 0.15, rot: rand(0, TAU) }); } break; }
    } else if (p.k === 'wave') {
      p.r += p.sp * dt; if (p.r > p.max) p.dead = true;
      if (!p.hit) for (const h of hs) {
        const dx = h.x - p.x, dy = (h.y - p.y) / 0.6, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
        if (Math.abs(d - p.r) < p.w + 8 * U && !p.gaps.some(g => angIn(a, g, 0.4))) { p.hit = true; hurtSquad(p.dmg, h.x, h.y - 10 * U); break; }
      }
    }
  }
  R.eb = R.eb.filter(p => !p.dead);
  if (sq.ko > 0) R.eb.length = 0;
}

// ================================================================ update
const HOOKS = { update: [], render: [], kill: [], bossWin: [], buy: [], stage: [], hurt: [], ko: [] };
const runHooks = (k, ...a) => { for (const f of HOOKS[k]) { try { f(...a); } catch (err) { console.error('hook', k, err); } } };
function update(dt) {
  R.t += dt;
  updateSquad(dt);
  const ko = R.sq.ko > 0;
  if (R.lobGap > 0) R.lobGap -= dt;
  if (!R.boss && !ko) {
    R.spawnT -= dt;
    const alive = R.en.filter(e => !e.dead).length;
    if (R.spawnT <= 0 && alive < 10) { R.spawnT = rand(0.5, 1.0); const n = Math.random() < 0.4 ? 3 : Math.random() < 0.5 ? 2 : 1; for (let i = 0; i < n; i++) spawnEnemy(); }
  }
  if (!R.boss && save.bossReady && save.auto) { R.retryT -= dt; if (R.retryT <= 0) { R.retryT = 10; startBoss(); } }
  for (const e of R.en) {
    if (e.dead) continue;
    e.age += dt; e.anim += dt; if (e.flash > 0) e.flash -= dt;
    const goal = enemyGoal(e);
    const dx = goal.x - e.x, dy = goal.y - e.y, d = Math.hypot(dx, dy);
    let sp = e.sp;
    if (e.d.hop) { e.hopT -= dt; if (e.hopT > 0.5) sp = 0; if (e.hopT <= 0) e.hopT = 1.1; }
    if (e.stopped ? d > 30 * U : d > 6 * U) { e.stopped = false; const m = Math.min(d, sp * dt); e.x += dx / d * m; e.y += dy / d * m; }
    else e.stopped = true;
    if (e.knock > 0) { e.x += e.kx * e.knock; e.y += e.ky * e.knock; e.knock *= 0.5; if (e.knock < 0.3) e.knock = 0; }
    if (e.kb > 0) {   // pushed back after a knockout
      const ax = e.x - R.sq.x, ay = e.y - R.sq.y, n = Math.hypot(ax, ay) || 1, m = Math.min(e.kb, 700 * U * dt);
      const p = clampBox({ x: e.x + ax / n * m, y: e.y + ay / n * m }, enemyBox()); e.x = p.x; e.y = p.y; e.kb -= m;
    }
    for (const o of R.en) {   // don't stack on top of each other
      if (o === e || o.dead) continue;
      const sx = e.x - o.x, sy = e.y - o.y, sd = Math.hypot(sx, sy);
      if (sd < 56 * U && sd > 0.01) { const push = (56 * U - sd) * 0.5 * Math.min(1, dt * 8); e.x += sx / sd * push; e.y += sy / sd * push; }
    }
    // ranged enemies that reached their spot lob slow projectiles at the squad
    if (e.ranged && e.stopped && !ko) {
      if (e.wind > 0) { e.wind -= dt; if (e.wind <= 0) { lob(e); e.atk = rand(3, 4); } }
      else { e.atk -= dt; if (e.atk <= 0 && R.lobGap <= 0 && R.eb.length < 3 + Math.floor(save.stage / 2)) { e.wind = 0.4; R.lobGap = 0.8; } }
    }
  }
  const b = R.boss;
  if (b) {
    b.anim += dt; if (b.flash > 0) b.flash -= dt;
    if (b.arrive < 1) { b.arrive = Math.min(1, b.arrive + dt / 1.4); const p = along(F.A, lerp(40, -330, b.arrive) * U, 0); b.x = p.x; b.y = p.y; if (b.arrive >= 1) R.shake = 14; }
    else { b.t -= dt; if (b.t <= 0) bossFail(); else if (!ko) updateBossAI(b, dt); }
  }
  if (R.leavingBoss) { const lb = R.leavingBoss; lb.leaving += dt; lb.x += F.dir.x * 300 * U * dt; lb.y += F.dir.y * 300 * U * dt; if (lb.leaving > 2) R.leavingBoss = null; }
  const rate = fireRate();
  for (const h of R.heroes) {
    h.fireT -= dt; if (h.recoil > 0) h.recoil = Math.max(0, h.recoil - dt * 9); if (h.muzzle > 0) h.muzzle -= dt;
    const tgt = ko ? null : nearestTarget(h);
    if (tgt) { const want = Math.atan2(aimY(tgt) - (h.y - 48 * U), tgt.x - h.x); let da = want - h.ang; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU; h.ang += da * Math.min(1, dt * 12); }
    if (tgt && h.fireT <= 0) { h.fireT = 1 / rate; fire(h, tgt); }
  }
  for (const q of R.bul) {
    q.life -= dt;
    const t = q.tgt, alive = t && !t.dead && (t === R.boss || R.en.includes(t));
    if (alive) { const want = Math.atan2(aimY(t) - q.y, t.x - q.x); let da = want - q.a; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU; q.a += da * Math.min(1, dt * 18); }
    q.x += Math.cos(q.a) * q.sp * dt; q.y += Math.sin(q.a) * q.sp * dt;
    if (q.rocket && Math.random() < 0.6) part({ k: 'puff', x: q.x, y: q.y, s: 0.18 * U, life: 0.35, max: 0.35, rot: rand(0, TAU) });
    if (alive) {
      const rr = t === R.boss ? 70 * U : 26 * U;
      if (Math.hypot(t.x - q.x, aimY(t) - q.y) < rr) {
        q.dead = true;
        part({ k: 'glow', x: q.x, y: q.y, s: (q.crit ? 2.2 : 1.4) * U * (t === R.boss ? 0.6 : 1), life: 0.16, max: 0.16, col: q.col });
        part({ k: 'spark', x: q.x, y: q.y, s: (q.crit ? 1 : 0.6) * U, life: 0.12, max: 0.12, rot: rand(0, TAU) });
        if (q.rocket) boom(q.x, q.y, 1);
        damage(t, q.dmg, q.crit, t === R.boss);
      }
    }
    if (q.life <= 0 || q.x > W + 100 || q.x < -100 || q.y < -100 || q.y > H + 100) q.dead = true;
  }
  updateEnemyShots(dt);
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
  if (R.hurt > 0) R.hurt = Math.max(0, R.hurt - dt);
  if (R.joy) R.joy.t += dt;
  if (R.walletPop > 0) R.walletPop -= dt;
  runHooks('update', dt);
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
  drawGround(t);
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
      // idle bob while holding position, squash-and-stretch wind-up before a lob
      let esx = 1, esy = 1;
      if (o.stopped && !o.d.fly) { const w = Math.sin(t * 5 + o.id) * 0.05; esx = 1 + w; esy = 1 - w; }
      if (o.wind > 0) { const k = 1 - o.wind / 0.4; esx = 1 + 0.25 * k; esy = 1 - 0.25 * k; }
      const flip = o.x < R.sq.x - 10 * U;   // enemy art faces left; turn toward the squad
      ctx.fillStyle = 'rgba(20,20,30,0.22)'; ctx.beginPath(); ctx.ellipse(o.x, o.y, 24 * o.sc, 7 * o.sc, 0, 0, TAU); ctx.fill();
      spr('en_' + fr, o.x, o.y + bob, o.sc * pop, 0.5, 1, flip, 0, esx, esy);
      if (o.flash > 0) { ctx.globalAlpha = 0.8; sprT('en_' + fr, '#ffffff', o.x, o.y + bob, o.sc * pop, 0.5, 1, flip, 0, esx, esy); ctx.globalAlpha = 1; }
      if (o.wind > 0) { ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 40); sprT('en_' + fr, o.d.col, o.x, o.y + bob, o.sc * pop, 0.5, 1, flip, 0, esx, esy); ctx.globalAlpha = 1; }
      if (o.hp < o.maxHp) { const w = 44 * U, yy = o.y + bob - 70 * o.sc; ctx.fillStyle = INK; rrect(o.x - w / 2 - 2, yy - 2, w + 4, 9 * U, 4); ctx.fill(); ctx.fillStyle = '#ff4d63'; rrect(o.x - w / 2, yy, w * Math.max(0, o.hp / o.maxHp), 5 * U, 2.5); ctx.fill(); }
    } else if (it.k === 1) {
      const sc = 0.68 * U, br = Math.sin(t * 3) * 0.03;
      ctx.globalAlpha = o.leaving ? Math.max(0, 1 - o.leaving / 2) : 1;
      ctx.fillStyle = 'rgba(20,20,30,0.25)'; ctx.beginPath(); ctx.ellipse(o.x, o.y, 90 * U, 20 * U, 0, 0, TAU); ctx.fill();
      spr('boss_' + o.key, o.x, o.y + 6 * U, sc, 0.5, 1, false, Math.sin(t * 2) * 0.03, 1 + br, 1 - br);
      if (o.flash > 0) { ctx.globalAlpha = 0.2; sprT('boss_' + o.key, '#ffffff', o.x, o.y + 6 * U, sc, 0.5, 1, false, Math.sin(t * 2) * 0.03, 1 + br, 1 - br); }
      ctx.globalAlpha = 1;
    } else {
      const sq = R.sq, ko = sq.ko > 0, face = o.face || 1;
      const bob = o.moving ? -Math.abs(Math.sin(o.walk * Math.PI)) * 4 * U : Math.sin(t * 4 + o.ph) * 1.5 * U, sc = 0.74 * U;
      ctx.fillStyle = 'rgba(20,20,30,0.3)'; ctx.beginPath(); ctx.ellipse(o.x, o.y, (o.moving ? 23 : 26) * U, 8 * U, 0, 0, TAU); ctx.fill();
      const fr = ko ? 'duck' : sq.hit > 0 ? 'hit' : o.moving ? (Math.floor(o.walk) % 2 ? 'walk_b' : 'walk_a') : 'idle';
      const blink = sq.inv > 0 && !ko && Math.floor(t * 16) % 2 === 0;
      ctx.globalAlpha = ko ? 0.35 + 0.2 * Math.sin(t * 10) : blink ? 0.45 : 1;
      spr(`ch_${o.color}_${fr}`, o.x, o.y + 2 + bob, sc, 0.5, 1, face < 0, 0, 1 + o.recoil * 0.03, 1 - o.recoil * 0.04);
      if (sq.hit > 0 && !ko) { ctx.globalAlpha = Math.min(1, sq.hit / 0.3) * 0.85; sprT(`ch_${o.color}_${fr}`, '#ffffff', o.x, o.y + 2 + bob, sc, 0.5, 1, face < 0); }
      ctx.globalAlpha = 1;
      if (!ko) {
        const hx = o.x + 12 * U * face, hy = o.y - 48 * U + bob;
        drawGun(save.gun, hx, hy, o.ang, o.recoil, 1.0 * U);
        if (o.muzzle > 0) {
          const L = GUNS[save.gun].len * U + 8 * U, mx = hx + Math.cos(o.ang) * L, my = hy + Math.sin(o.ang) * L;
          if (!save.eco) { ctx.globalCompositeOperation = 'lighter'; sprT('fx_glow', GUNS[save.gun].bullet, mx, my, 1.1 * U); ctx.globalCompositeOperation = 'source-over'; }
          spr('fx_burst', mx, my, 0.4 * U, 0.5, 0.5, false, rand(0, TAU));
        }
      }
    }
  }
  drawShots(t);
  drawSquadHp(t);
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
    if (p.k === 'puff') { ctx.globalAlpha = a * (p.dust ? 0.75 : 0.9); sprT(`fx_puff_${Math.min(5, Math.floor((1 - a) * 6))}`, p.dust ? '#f4ead2' : '#ffffff', p.x, p.y, p.s * (1.2 - a * 0.4), 0.5, 0.5, false, p.rot); ctx.globalAlpha = 1; }
    else if (p.k === 'chunk') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.globalAlpha = Math.min(1, a * 2); ctx.fillStyle = p.col; ctx.strokeStyle = INK; ctx.lineWidth = 2; rrect(-p.r / 2, -p.r / 2, p.r, p.r, 2); ctx.fill(); ctx.stroke(); ctx.restore(); ctx.globalAlpha = 1; }
    else if (p.k === 'casing') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.globalAlpha = a; ctx.fillStyle = '#ffcf3a'; ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.fillRect(-4 * U, -2 * U, 8 * U, 4 * U); ctx.strokeRect(-4 * U, -2 * U, 8 * U, 4 * U); ctx.restore(); ctx.globalAlpha = 1; }
    else if (p.k === 'glow') { if (save.eco) continue; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a; sprT('fx_glow', p.col, p.x, p.y, p.s); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
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
    const size = Math.round((tx.kind === 'crit' ? 30 : tx.kind === 'money' ? 26 : tx.kind === 'hurt' ? 26 : 22) * U * pop);
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
    ctx.fillStyle = tx.kind === 'money' ? '#8cff5a' : tx.kind === 'crit' ? '#ffcf3a' : tx.kind === 'hurt' ? '#ff5a6e' : '#ffffff';
    ctx.fillText(s, x, tx.y);
  }
  ctx.globalAlpha = 1;
  runHooks('render', ctx);
  const b = biome();
  if (R.motes.length < 28) R.motes.push({ x: Math.random() * W, y: Math.random() * H, s: rand(1, 2.6), ph: rand(0, 6) });
  ctx.fillStyle = `rgba(${b.motes},0.7)`;
  for (const m of R.motes) { m.y -= 8 * m.s / 60; m.x += Math.sin(t + m.ph) * 0.3; if (m.y < 0) m.y = H; ctx.beginPath(); ctx.arc(m.x, m.y, m.s * U, 0, TAU); ctx.fill(); }
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (R.flash > 0) { ctx.fillStyle = `rgba(255,250,230,${R.flash})`; ctx.fillRect(0, 0, W, H); }
  if (R.hurt > 0) {   // red vignette when the squad is hit
    const gr = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.7);
    gr.addColorStop(0, 'rgba(236,59,79,0)'); gr.addColorStop(1, `rgba(236,59,79,${Math.min(0.55, R.hurt * 1.3)})`);
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
  }
  drawJoystick(t);
}
// ground layer: squad marker ring, lob landing markers, boss shockwaves and slam telegraph
function drawGround(t) {
  const sq = R.sq, L = R.heroes[0];
  if (L && sq.ko <= 0) {
    ctx.save(); ctx.translate(L.x, L.y); ctx.scale(1, 0.42);
    ctx.lineWidth = 5 * U; ctx.strokeStyle = 'rgba(27,32,51,0.55)'; ctx.beginPath(); ctx.arc(0, 0, 40 * U, 0, TAU); ctx.stroke();
    ctx.lineWidth = 3 * U; ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.setLineDash([12 * U, 8 * U]); ctx.lineDashOffset = -t * 30 * U;
    ctx.beginPath(); ctx.arc(0, 0, 40 * U, 0, TAU); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
  }
  for (const p of R.eb) {
    if (p.k === 'lob') {
      const u = p.t / p.T, r = 40 * U * (0.55 + 0.45 * u);
      ctx.save(); ctx.translate(p.tx, p.ty); ctx.scale(1, 0.6);
      ctx.fillStyle = `rgba(236,59,79,${0.12 + 0.22 * u})`; ctx.beginPath(); ctx.arc(0, 0, 40 * U, 0, TAU); ctx.fill();
      ctx.lineWidth = 3 * U; ctx.strokeStyle = `rgba(255,77,99,${0.5 + 0.5 * Math.sin(t * 18)})`; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
      ctx.restore();
      const gx = lerp(p.sx, p.tx, u), gy = lerp(p.sy + 30 * U, p.ty, u);   // projectile shadow on the ground
      ctx.fillStyle = 'rgba(20,20,30,0.25)'; ctx.beginPath(); ctx.ellipse(gx, gy, p.r, p.r * 0.4, 0, 0, TAU); ctx.fill();
    } else if (p.k === 'wave') {
      ctx.save(); ctx.translate(p.x, p.y); ctx.scale(1, 0.6); ctx.lineCap = 'round';
      const a = Math.max(0, 1 - p.r / p.max) * 0.6 + 0.4;
      for (const [lw, col] of [[p.w * 2 + 8 * U, INK], [p.w * 2, p.col], [p.w * 0.6, '#ffffff']]) {
        ctx.lineWidth = lw; ctx.strokeStyle = col; ctx.globalAlpha = a;
        arcsWithGaps(p.r, p.gaps, 0.4); ctx.stroke();
      }
      ctx.restore(); ctx.globalAlpha = 1;
    }
  }
  const b = R.boss;
  if (b && b.tele > 0 && b.teleK === 'slam') {   // telegraph: pulsing danger zone with safe gaps
    ctx.save(); ctx.translate(b.x, b.y); ctx.scale(1, 0.6);
    ctx.lineWidth = 6 * U; ctx.strokeStyle = `rgba(236,59,79,${0.4 + 0.4 * Math.sin(t * 20)})`; ctx.setLineDash([16 * U, 10 * U]);
    for (const rr of [140, 260, 380]) { arcsWithGaps(rr * U, b.gaps, 0.4); ctx.stroke(); }
    ctx.setLineDash([]); ctx.restore();
  }
}
function arcsWithGaps(r, gaps, gw) {
  const g = gaps.map(a => ((a % TAU) + TAU) % TAU).sort((a, c) => a - c);
  ctx.beginPath();
  for (let i = 0; i < g.length; i++) {
    const s0 = g[i] + gw; let e0 = (i + 1 < g.length ? g[i + 1] : g[0] + TAU) - gw;
    if (e0 <= s0) continue;
    ctx.moveTo(Math.cos(s0) * r, Math.sin(s0) * r); ctx.arc(0, 0, r, s0, e0);
  }
}
// airborne enemy projectiles: chunky outlined orbs
function drawBall(x, y, r, col, t) {
  if (!save.eco) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.55; sprT('fx_glow', col, x, y, r * 4.5 / 64); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
  ctx.lineWidth = 3 * U; ctx.strokeStyle = INK; ctx.fillStyle = col;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.32, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2 * U; ctx.beginPath(); ctx.arc(x, y, r * 0.62, t * 8, t * 8 + 1.6); ctx.stroke();
}
function drawShots(t) {
  for (const p of R.eb) {
    if (p.k === 'lob') {
      const u = p.t / p.T, x = lerp(p.sx, p.tx, u), y = lerp(p.sy, p.ty - 14 * U, u) - Math.sin(Math.PI * u) * 130 * U;
      drawBall(x, y, p.r, p.col, t);
    } else if (p.k === 'orb') drawBall(p.x, p.y, p.r, p.col, t);
  }
}
function drawSquadHp(t) {
  const sq = R.sq, L = R.heroes[0]; if (!L) return;
  const w = 70 * U, h = 10 * U, x = clamp(L.x - w / 2, 18 * U, W - w - 6 * U), y = L.y - 116 * U;
  ctx.fillStyle = INK; rrect(x - 3 * U, y - 3 * U, w + 6 * U, h + 6 * U, 6 * U); ctx.fill();
  const f = clamp(sq.hp / sq.maxHp, 0, 1), fl = clamp(sq.lag / sq.maxHp, 0, 1);
  ctx.fillStyle = '#3a4362'; rrect(x, y, w, h, 4 * U); ctx.fill();
  if (fl > f) { ctx.fillStyle = '#ffffff'; rrect(x, y, w * fl, h, 4 * U); ctx.fill(); }
  if (f > 0.02) {
    ctx.fillStyle = sq.ko > 0 ? '#8e97ad' : f > 0.5 ? '#5fd35a' : f > 0.25 ? '#ffcf3a' : '#ff4d63';
    rrect(x, y, w * f, h, 4 * U); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; rrect(x + 2 * U, y + 1.5 * U, Math.max(0, w * f - 4 * U), h * 0.3, 2 * U); ctx.fill();
  }
  // heart badge
  const hx = x - 8 * U, hy = y + h / 2, hs = 9 * U * (sq.hit > 0 ? 1.25 : 1);
  ctx.save(); ctx.translate(hx, hy); ctx.beginPath();
  ctx.moveTo(0, hs * 0.9); ctx.bezierCurveTo(-hs * 1.4, -hs * 0.1, -hs * 0.7, -hs * 1.2, 0, -hs * 0.45); ctx.bezierCurveTo(hs * 0.7, -hs * 1.2, hs * 1.4, -hs * 0.1, 0, hs * 0.9);
  ctx.fillStyle = '#ff4d63'; ctx.fill(); ctx.lineWidth = 2.5 * U; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore();
  if (sq.ko > 0) {
    ctx.font = FONT(Math.round(24 * U)); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    ctx.lineWidth = 6 * U; ctx.strokeStyle = INK; const s = 'NAKAVT ' + Math.ceil(sq.ko);
    const tx = clamp(L.x, 70 * U, W - 70 * U);
    ctx.strokeText(s, tx, y - 20 * U); ctx.fillStyle = '#ffcf3a'; ctx.fillText(s, tx, y - 20 * U);
  }
}
// floating virtual joystick (screen space) + first-time hint
function drawJoystick(t) {
  const j = R.joy;
  if (j) {
    const a = Math.min(1, j.t * 8);
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(27,32,51,0.32)'; ctx.beginPath(); ctx.arc(j.ox, j.oy, JOY_R, 0, TAU); ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.arc(j.ox, j.oy, JOY_R - 5, 0, TAU); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let i = 0; i < 4; i++) {   // direction notches
      const an = i * Math.PI / 2, cx = j.ox + Math.cos(an) * (JOY_R - 15), cy = j.oy + Math.sin(an) * (JOY_R - 15);
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(an); ctx.beginPath(); ctx.moveTo(5, 0); ctx.lineTo(-3, -5); ctx.lineTo(-3, 5); ctx.closePath(); ctx.fill(); ctx.restore();
    }
    let dx = j.x - j.ox, dy = j.y - j.oy; const d = Math.hypot(dx, dy), m = JOY_R * 0.62;
    if (d > m) { dx = dx / d * m; dy = dy / d * m; }
    const kx = j.ox + dx, ky = j.oy + dy, kr = 26;
    ctx.fillStyle = 'rgba(20,20,30,0.3)'; ctx.beginPath(); ctx.ellipse(kx, ky + 6, kr, kr * 0.8, 0, 0, TAU); ctx.fill();
    const gr = ctx.createLinearGradient(0, ky - kr, 0, ky + kr); gr.addColorStop(0, '#bff3e8'); gr.addColorStop(1, '#7fd9c8');
    ctx.fillStyle = '#4fb3a1'; ctx.beginPath(); ctx.arc(kx, ky + 3, kr, 0, TAU); ctx.fill();
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(kx, ky, kr - 1, 0, TAU); ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.beginPath(); ctx.arc(kx, ky + 1.5, kr + 1, 0, TAU); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.ellipse(kx - 7, ky - 10, 9, 5, -0.4, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  } else if (R.hint > 0 && R.sq && !panelOpen()) {
    const L = R.heroes[0]; if (!L) return;
    const x = W / 2, y = Math.min(H - 190, L.y + 70 * U), a = Math.min(1, R.hint) * (0.75 + 0.25 * Math.sin(t * 4));
    ctx.globalAlpha = a; ctx.font = FONT(Math.round(17 * U)); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    const s = 'Sürükle ve hareket et!';
    ctx.lineWidth = 5 * U; ctx.strokeStyle = INK; ctx.strokeText(s, x, y); ctx.fillStyle = '#ffffff'; ctx.fillText(s, x, y);
    ctx.globalAlpha = 1;
  }
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
  const si = $('soundIco'); if (si) si.src = 'assets/ui/' + (save.sound ? 'ic_sound_on' : 'ic_sound_off') + '.png';
}
function buy(k) {
  const lv = save.lv[k], cost = COST[k](lv);
  if (k === 'speed' && fireRate() >= 12) return false;
  if (save.money < cost) { sfx('no', 0.2); return false; }
  save.money -= cost; save.lv[k]++; sfx('buy', 0.05); runHooks('buy', k);
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
      R.en.length = 0; R.eb.length = 0; R.boss = null; $('bossHud').classList.add('hidden');
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

// ---------------- plugin API used by features/*.js
function addSideButton({ side = 'left', label, icon, color = 'blue', onClick, id }) {
  const b = el(`<button class="sbtn ${color}" ${id ? `id="${id}"` : ''}><img src="${icon}" alt=""><span>${label}</span></button>`);
  b.addEventListener('click', () => { audioInit(); sfx('click'); onClick(); });
  document.querySelector('.side.' + side).appendChild(b);
  return b;
}
window.SS = {
  save, R, F, GUNS, TEAM, BIOMES, MODS, HOOKS, fmt, sfx, toast, banner, el, openPanel, closePanel, persist, addMoney, addSideButton,
  spr, sprT, rrect, biome, dmgPerShot, fireRate, moneyMul, enemyHp, buy, startBoss, setupHeroes,
  hurtSquad, knockout, sqMaxHp, heroBox, part, puff, confetti, boom, addText, along,
  get squad() { return R.sq; }, get leader() { return R.heroes[0]; },
  get U() { return U; }, get W() { return W; }, get H() { return H; }, get DPR() { return DPR; },
  refreshUI() { uiKey = ''; },
};
window.SwarmSquad = { save, R, buy, startBoss, fmt };
})();
