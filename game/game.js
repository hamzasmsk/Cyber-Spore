/* Swarm Squad — side-scrolling run-and-gun for phones (HTML5 canvas, no dependencies). Art: Kenney (CC0). */
'use strict';
(() => {

// ================================================================ utilities
const $ = id => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const approach = (v, t, d) => v < t ? Math.min(t, v + d) : Math.max(t, v - d);
const pick = a => a[Math.floor(Math.random() * a.length)];
const TAU = Math.PI * 2;
const sign = v => v < 0 ? -1 : 1;
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const INK = '#1b2033';
const FONT = n => `800 ${n}px "Baloo 2", system-ui, sans-serif`;

const T = 64, ROWS = 12, VIEW_H = 576, GRAV = 2300, MAXFALL = 1150, CH_SC = 0.8;

// ================================================================ canvas
const cv = $('c');
let ctx = cv.getContext('2d');  // swapped briefly when drawing UI icons
let W = 0, H = 0, DPR = 1, SC = 1, VW = 1000, VH = 576, vignette = null;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  cv.width = Math.floor(W * DPR); cv.height = Math.floor(H * DPR);
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  SC = H > W ? cv.width / 580 : cv.height / 600;   // portrait: fixed world width, landscape: fixed height
  VW = cv.width / SC; VH = cv.height / SC;
  vignette = document.createElement('canvas');
  vignette.width = Math.max(1, Math.floor(W / 2)); vignette.height = Math.max(1, Math.floor(H / 2));
  const g = vignette.getContext('2d'), w = vignette.width, h = vignette.height;
  const gr = g.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.5, w / 2, h / 2, Math.max(w, h) * 0.78);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(15,20,45,0.38)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  requestAnimationFrame(layoutControls);
}
window.addEventListener('resize', resize);

// ================================================================ atlas
const AF = window.ATLAS.frames;
const atlasImg = new Image();
const atlasReady = new Promise(r => { atlasImg.onload = r; atlasImg.onerror = r; });
atlasImg.src = 'assets/atlas.png';
const tintCache = new Map();
function tinted(name, color, alpha = 1) {
  const key = name + color + alpha;
  let c = tintCache.get(key);
  if (c) return c;
  const f = AF[name];
  c = document.createElement('canvas');
  if (!f) { c.width = c.height = 1; tintCache.set(key, c); console.warn('missing frame', name); return c; }
  c.width = f[2]; c.height = f[3];
  const g = c.getContext('2d');
  g.drawImage(atlasImg, f[0], f[1], f[2], f[3], 0, 0, f[2], f[3]);
  g.globalCompositeOperation = alpha >= 1 ? 'source-in' : 'source-atop';
  g.globalAlpha = alpha; g.fillStyle = color; g.fillRect(0, 0, f[2], f[3]);
  tintCache.set(key, c);
  return c;
}
// draw frame: anchor (ax, ay) in 0..1 of the frame, uniform scale sc, optional flip/rotation/stretch
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

// ================================================================ save
const SAVE_KEY = 'swarmsquad_v2';
const DEF_SAVE = { coins: 0, stars: {}, unlocked: 0, hero: 'beige', heroes: { beige: true }, up: {}, sound: true, autofire: false };
const save = (() => { let s = null; try { s = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { s = null; } return Object.assign(JSON.parse(JSON.stringify(DEF_SAVE)), s && typeof s === 'object' ? s : {}); })();
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* blocked storage */ } }
const upLv = id => save.up[id] || 0;
const totalStars = () => Object.values(save.stars).reduce((a, b) => a + b, 0);

// ================================================================ data
const WORLDS = [
  { name: 'Yeşil Tepeler', terrain: 'grass', bgColor: 'color_hills', bgFade: 'fade_hills', sky: ['#7fc8ff', '#d8f0ff'], tint: null, ambient: 'pollen',
    decor: ['p_bush', 'p_grass', 'p_grass', 'p_rock', 'p_fence', 'p_mushroom_red'], pool: ['slime', 'mouse', 'bee', 'slime', 'frog'], boss: 'brood', bossName: 'KULUÇKA ANA',
    pattern: ['walk', 'slam', 'walk', 'summon'], blend: '' },
  { name: 'Mantar Ormanı', terrain: 'dirt', bgColor: 'color_mushrooms', bgFade: 'fade_mushrooms', sky: ['#ffbf8a', '#fff0dc'], tint: null, ambient: 'spores',
    decor: ['p_mushroom_red', 'p_mushroom_brown', 'p_mushroom_brown', 'p_rock', 'p_bush'], pool: ['slime', 'mouse', 'snail', 'frog', 'bee'], boss: 'golem', bossName: 'KAYA DEVİ',
    pattern: ['walk', 'slam', 'volley', 'slam', 'summon'], blend: '' },
  { name: 'Kızıl Çöl', terrain: 'sand', bgColor: 'color_desert', bgFade: 'fade_desert', sky: ['#ffc46b', '#fff2d2'], tint: null, ambient: 'dust',
    decor: ['p_cactus', 'p_cactus', 'p_rock'], pool: ['fireslime', 'worm', 'barnacle', 'fly', 'mouse', 'frog'], boss: 'hydra', bossName: 'ÇÖL GÖZÜ',
    pattern: ['volley', 'walk', 'slam', 'summon'], blend: '' },
  { name: 'Buz Diyarı', terrain: 'snow', bgColor: 'color_trees', bgFade: 'fade_trees', sky: ['#9fd4ff', '#f0f9ff'], tint: ['#e6f6ff', 0.55], ambient: 'snow',
    decor: ['p_snow', 'p_rock', 'p_snow'], pool: ['spikeslime', 'ladybug', 'fly', 'snail', 'barnacle', 'bee'], boss: 'prism', bossName: 'BUZ KUTUSU',
    pattern: ['volley', 'slam', 'walk', 'slam', 'summon'], blend: 'screen' },
  { name: 'Mor Mağaralar', terrain: 'purple', bgColor: 'color_mushrooms', bgFade: 'fade_mushrooms', sky: ['#22163f', '#5b3f8f'], tint: ['#4a2a86', 0.6], ambient: 'embers',
    decor: ['p_grass_purple', 'p_grass_purple', 'p_torch_on_a', 'p_rock'], pool: ['blockslime', 'fireslime', 'spikeslime', 'ladybug', 'fly', 'barnacle', 'frog'], boss: 'core', bossName: 'ALTIN KABUS',
    pattern: ['volley', 'slam', 'summon', 'slam', 'volley'], blend: 'multiply' },
];
const STAGES_PER_WORLD = 5, TOTAL_STAGES = WORLDS.length * STAGES_PER_WORLD;
const stageLabel = g => `${Math.floor(g / 5) + 1}-${g % 5 + 1}`;

const EDEF = {
  slime:      { f: ['slime_normal_walk_a', 'slime_normal_walk_b'], kind: 'walker', hp: 28, spd: 70, w: 46, h: 34, dmg: 12, coins: 1, col: '#a55cf0', stomp: true, flat: 'slime_normal_flat' },
  fireslime:  { f: ['slime_fire_walk_a', 'slime_fire_walk_b'], kind: 'walker', hp: 38, spd: 95, w: 46, h: 36, dmg: 16, coins: 2, col: '#ff5a3c', stomp: true },
  spikeslime: { f: ['slime_spike_walk_a', 'slime_spike_walk_b'], kind: 'walker', hp: 46, spd: 80, w: 46, h: 40, dmg: 16, coins: 2, col: '#2fd27a', stomp: false },
  blockslime: { f: ['slime_block_walk_a', 'slime_block_walk_b'], kind: 'walker', hp: 120, spd: 55, w: 56, h: 56, dmg: 20, coins: 4, col: '#2fd27a', sc: 1.15, stomp: true },
  mouse:      { f: ['mouse_walk_a', 'mouse_walk_b'], kind: 'walker', hp: 18, spd: 175, w: 46, h: 30, dmg: 10, coins: 1, col: '#c4c8d4', stomp: true },
  snail:      { f: ['snail_walk_a', 'snail_walk_b'], kind: 'walker', hp: 75, spd: 40, w: 52, h: 44, dmg: 14, coins: 3, col: '#c08bff', sc: 1.1, stomp: true },
  ladybug:    { f: ['ladybug_walk_a', 'ladybug_walk_b'], kind: 'walker', hp: 40, spd: 110, w: 48, h: 34, dmg: 12, coins: 2, col: '#ec3b4f', stomp: true },
  worm:       { f: ['worm_normal_move_a', 'worm_normal_move_b'], kind: 'walker', hp: 30, spd: 60, w: 56, h: 22, dmg: 10, coins: 1, col: '#4aa8ff', stomp: true },
  frog:       { f: ['frog_idle', 'frog_jump'], kind: 'hopper', hp: 36, spd: 0, w: 46, h: 44, dmg: 14, coins: 2, col: '#33c14d', stomp: true },
  bee:        { f: ['bee_a', 'bee_b'], kind: 'flyer', hp: 22, spd: 150, w: 44, h: 36, dmg: 12, coins: 2, col: '#ffcf3a', stomp: true },
  fly:        { f: ['fly_a', 'fly_b'], kind: 'flyer', hp: 16, spd: 200, w: 40, h: 34, dmg: 10, coins: 1, col: '#5d6680', stomp: true },
  barnacle:   { f: ['barnacle_attack_rest', 'barnacle_attack_a', 'barnacle_attack_b'], kind: 'shooter', hp: 50, w: 46, h: 52, dmg: 14, coins: 3, col: '#8d50ea', stomp: false },
  saw:        { f: ['saw_a', 'saw_b'], kind: 'hazard', hp: 1e9, spd: 120, w: 50, h: 50, dmg: 18, coins: 0, col: '#aab3c8', stomp: false },
};
const WPN = {
  blaster: { name: 'Blaster', rate: 5, dmg: 10, spd: 1150, spread: 0.035, pellets: 1, ammo: 0, len: 30, body: '#6b7686', acc: '#ffcf3a', tracer: '#ffe066', life: 0.7, snd: 'shoot' },
  shotgun: { name: 'Pompalı', rate: 1.7, dmg: 9, spd: 1000, spread: 0.2, pellets: 6, ammo: 30, len: 36, body: '#b06a3a', acc: '#5b3a22', tracer: '#ffb066', life: 0.32, snd: 'shotgun' },
  mg:      { name: 'Makineli', rate: 13, dmg: 7, spd: 1250, spread: 0.08, pellets: 1, ammo: 160, len: 40, body: '#3f8fe0', acc: '#2a4e7a', tracer: '#9fe1ff', life: 0.65, snd: 'shoot' },
  laser:   { name: 'Lazer', rate: 3.2, dmg: 26, spd: 1900, spread: 0, pellets: 1, pierce: 6, ammo: 36, len: 42, body: '#e8edf5', acc: '#ff4dc4', tracer: '#ff6ad5', life: 0.6, snd: 'laser' },
  rocket:  { name: 'Roketatar', rate: 1.3, dmg: 45, spd: 720, spread: 0.02, pellets: 1, explode: 120, ammo: 12, len: 44, body: '#5a6b44', acc: '#ec3b4f', tracer: '#ff9a3b', life: 1.4, snd: 'rocket' },
};
const SPECIALS = ['shotgun', 'mg', 'laser', 'rocket'];
const HEROES = {
  beige:  { name: 'Kaptan',  cost: 0,    hp: 100, spd: 1,    dmg: 1,    perk: 'Dengeli ve güvenilir lider.' },
  green:  { name: 'Çevik',   cost: 600,  hp: 90,  spd: 1.15, dmg: 1,    tj: true, perk: 'Üçlü zıplama + hızlı koşu' },
  pink:   { name: 'Doktor',  cost: 1200, hp: 120, spd: 1,    dmg: 0.95, regen: 1.5, perk: 'Savaşırken canını yeniler' },
  purple: { name: 'Bombacı', cost: 2000, hp: 105, spd: 1,    dmg: 1,    start: 'rocket', perk: 'Her bölüme roketatarla başlar' },
  yellow: { name: 'Nişancı', cost: 3200, hp: 95,  spd: 1.05, dmg: 1.35, perk: '+35% silah hasarı' },
};
const UPG = [
  { id: 'dmg',    name: 'Silah Gücü',     desc: '+15% hasar',          icon: 'ic_power',  bg: '#ec3b4f', max: 10, base: 80 },
  { id: 'rate',   name: 'Atış Hızı',      desc: '+10% atış hızı',      icon: 'ic_rate',   bg: '#ff9a3b', max: 8,  base: 100 },
  { id: 'hp',     name: 'Zırhlı Kıyafet', desc: '+20 maks. can',       icon: 'heart',     bg: '#ffd6dc', max: 10, base: 80 },
  { id: 'team',   name: 'Takım Gücü',     desc: '+25% takım hasarı',   icon: 'ic_team',   bg: '#33c14d', max: 5,  base: 150 },
  { id: 'magnet', name: 'Altın Mıknatısı', desc: '+40% toplama alanı',  icon: 'ic_magnet', bg: '#2d8cf0', max: 4,  base: 120 },
];
const upCost = (u, l) => Math.round(u.base * Math.pow(1.6, l) / 10) * 10;
const REVIVE_COST = 100;

// ================================================================ audio (synth + noise; no files)
let AC = null, master = null, noiseBuf = null;
function audioInit() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    master = AC.createGain(); master.gain.value = 0.8; master.connect(AC.destination);
    noiseBuf = AC.createBuffer(1, AC.sampleRate * 0.8, AC.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch (e) { AC = null; }
}
function tone(type, f0, f1, dur, vol, delay = 0) {
  const t = AC.currentTime + delay, o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol, freq, delay = 0) {
  const t = AC.currentTime + delay, s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
  s.buffer = noiseBuf; f.type = 'lowpass'; f.frequency.value = freq;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + 0.02);
}
const sndLast = {};
function sfx(n, gap = 0.03) {
  if (!AC || !save.sound) return;
  const now = AC.currentTime;
  if (sndLast[n] && now - sndLast[n] < gap) return;
  sndLast[n] = now;
  switch (n) {
    case 'shoot': tone('square', 820, 260, 0.06, 0.035); noise(0.05, 0.05, 3500); break;
    case 'shotgun': noise(0.22, 0.16, 1400); tone('square', 200, 60, 0.15, 0.05); break;
    case 'laser': tone('sawtooth', 1600, 200, 0.18, 0.05); break;
    case 'rocket': noise(0.3, 0.08, 900); tone('sawtooth', 180, 90, 0.25, 0.04); break;
    case 'team': tone('square', 1000, 400, 0.04, 0.015); break;
    case 'hit': tone('triangle', 420, 160, 0.05, 0.05); break;
    case 'kill': tone('square', 300, 70, 0.12, 0.05); noise(0.12, 0.08, 1800); break;
    case 'explode': noise(0.7, 0.35, 700); tone('sine', 120, 35, 0.6, 0.25); break;
    case 'jump': tone('sine', 380, 760, 0.12, 0.06); break;
    case 'land': noise(0.06, 0.06, 500); break;
    case 'dash': noise(0.18, 0.08, 2500); tone('sine', 300, 900, 0.15, 0.04); break;
    case 'coin': tone('square', 1320, 1320, 0.05, 0.03); tone('square', 1980, 1980, 0.08, 0.03, 0.05); break;
    case 'pickup': tone('triangle', 600, 1200, 0.15, 0.08); tone('triangle', 900, 1800, 0.15, 0.06, 0.08); break;
    case 'hurt': tone('sawtooth', 260, 70, 0.22, 0.12); noise(0.12, 0.1, 1200); break;
    case 'stomp': tone('square', 200, 500, 0.1, 0.07); break;
    case 'spring': tone('sine', 200, 1200, 0.25, 0.08); break;
    case 'throw': noise(0.12, 0.05, 2000); break;
    case 'break': noise(0.2, 0.15, 1100); tone('triangle', 240, 90, 0.12, 0.06); break;
    case 'rescue': [523, 659, 784, 1046].forEach((f, i) => tone('triangle', f, f, 0.14, 0.08, i * 0.08)); break;
    case 'clear': [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => tone('square', f, f, 0.16, 0.05, i * 0.11)); break;
    case 'fail': [392, 330, 262, 196].forEach((f, i) => tone('triangle', f, f * 0.98, 0.22, 0.08, i * 0.16)); break;
    case 'boss': tone('sawtooth', 110, 40, 1.1, 0.2); noise(0.9, 0.12, 400); break;
    case 'click': tone('triangle', 700, 950, 0.06, 0.06); break;
    case 'alarm': tone('square', 880, 880, 0.1, 0.05); tone('square', 660, 660, 0.1, 0.05, 0.14); break;
  }
}
const vibrate = ms => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* not supported */ } };

// ================================================================ level generation (deterministic per stage)
function genLevel(g, demo = false) {
  const wi = Math.floor(g / 5), si = g % 5, WD = WORLDS[wi], boss = si === 4 && !demo;
  const rnd = mulberry32(7331 + g * 104729 + (demo ? 99 : 0)), R = rnd, RI = (a, b) => a + Math.floor(R() * (b - a + 1)), RP = a => a[Math.floor(R() * a.length)];
  const pool = WD.pool.slice(0, Math.min(WD.pool.length, 2 + si + (wi > 0 ? 1 : 0)));
  const len = demo ? 400 : boss ? 44 + wi * 4 : 62 + si * 9 + wi * 8;
  const arena = boss ? 24 : 0;
  const cols = len + arena + 2;
  const L = { g, wi, si, boss, demo, WD, cols, grid: new Uint8Array(cols * ROWS), ground: new Int8Array(cols).fill(-1),
    spawns: [], cages: [], crates: [], crateMap: new Map(), coins: [], decor: [], zones: [], springs: [], spikes: [], cp: null,
    flagX: 0, flagY: 0, flagHidden: boss, hpMul: 1 + g * 0.12 };
  let c = 0, gy = 9;
  const setCell = (cc, r, v) => { if (cc >= 0 && cc < cols && r >= 0 && r < ROWS) L.grid[r * cols + cc] = v; };
  const column = top => { L.ground[c] = top; for (let r = top; r < ROWS; r++) setCell(c, r, 1); c++; };
  const flat = n => { for (let i = 0; i < n && c < cols; i++) column(gy); };
  const enemy = (cc, n) => {
    for (let i = 0; i < n; i++) {
      const t = RP(pool), d = EDEF[t], x = (cc + i * 1.4) * T + T / 2;
      const top = L.ground[clamp(Math.floor(x / T), 0, cols - 1)];
      const y = (top >= 0 ? top : gy) * T;
      L.spawns.push({ t, x, y: d.kind === 'flyer' ? y - T * RI(2, 3) : y });
    }
  };
  const coinLine = (cc, row, n) => { for (let i = 0; i < n; i++) L.coins.push({ x: (cc + i) * T + T / 2, y: row * T + T / 2 }); };
  const coinArc = (cc, n) => { const k = n * 2 + 1; for (let i = 0; i < k; i++) { const t = i / (k - 1); L.coins.push({ x: (cc - 0.5 + t * (n + 1)) * T, y: gy * T - T * 1.1 - Math.sin(t * Math.PI) * T * 1.6 }); } };
  const crate = (cc, r, kind) => { setCell(cc, r, 3); const o = { c: cc, r, kind, hp: kind === 'gift' ? 40 : kind === 'coin' ? 20 : 25, hitT: 0 }; L.crates.push(o); L.crateMap.set(cc + ',' + r, o); };

  flat(12);
  if (demo) { flat(cols); return L; }
  const nCages = boss ? 1 : Math.min(3, 1 + (si >= 2 ? 1 : 0) + (wi >= 1 ? 1 : 0));
  const cageAt = []; for (let i = 0; i < nCages; i++) cageAt.push(Math.floor(16 + (len - 34) * (i + 0.5) / nCages));
  const nZones = 0;
  const zoneAt = []; for (let i = 0; i < nZones; i++) zoneAt.push(Math.floor(24 + (len - 44) * (i + 0.65) / nZones));
  let ci = 0, zi = 0, cpDone = boss;
  while (c < len - 14) {
    if (!cpDone && c > len / 2) { cpDone = true; L.cp = { x: c * T + T, y: gy * T, on: false }; flat(4); continue; }
    if (ci < cageAt.length && c >= cageAt[ci]) { const x0 = c; flat(7); L.cages.push({ x: (x0 + 3) * T + T / 2, y: gy * T, prog: 0, hp: 30, maxHp: 30, hitT: 0, freed: false, color: 'green' }); enemy(x0 + 5, 1 + (si > 1 ? 1 : 0)); ci++; continue; }
    if (zi < zoneAt.length && c >= zoneAt[zi]) { const x0 = c; flat(18); L.zones.push({ x0: x0 * T, gy, waves: makeWaves(pool, R, si, wi), state: 0, wave: -1, t: 0 }); zi++; continue; }
    const r = R();
    if (r < 0.14 && gy > 6) { gy--; flat(RI(3, 6)); enemy(c - 2, RI(0, 1)); }
    else if (r < 0.28 && gy < 9) { gy++; flat(RI(3, 6)); enemy(c - 2, RI(0, 2)); }
    else if (r < 0.40 && g >= 2) { const n = RI(2, wi >= 3 ? 3 : 2); coinArc(c, n); c += n; flat(RI(4, 6)); }
    else if (r < 0.54) {
      const x0 = c; flat(RI(7, 9));
      const pr = gy - 3, px = x0 + RI(1, 2), pw = RI(3, 4);
      for (let i = 0; i < pw; i++) setCell(px + i, pr, 2);
      coinLine(px, pr - 1, pw);
      if (R() < 0.35) crate(px + 1, pr - 1, R() < 0.5 ? 'gift' : 'wood');
      enemy(x0 + 3, RI(1, 2));
    } else if (r < 0.66) {
      const x0 = c; flat(RI(6, 7)); const n = RI(1, 3);
      for (let i = 0; i < n; i++) crate(x0 + 2 + i, gy - 1, R() < 0.22 ? 'gift' : R() < 0.3 ? 'coin' : 'wood');
      if (n >= 2 && R() < 0.5) crate(x0 + 2, gy - 2, 'wood');
      enemy(x0 + 5, 1);
    } else if (r < 0.74 && g >= 1) {
      const x0 = c; flat(7); L.spikes.push({ x: (x0 + 2) * T, y: gy * T, w: 2 * T }); coinArc(x0 + 2, 2);
      if (wi >= 4) L.spawns.push({ t: 'saw', x: (x0 + 5) * T, y: gy * T });
    } else if (r < 0.80) {
      const x0 = c; flat(6); L.springs.push({ x: (x0 + 2) * T + T / 2, y: gy * T, t: 0 }); coinLine(x0 + 1, gy - 6, 3);
    } else { const x0 = c; flat(RI(6, 10)); enemy(x0 + 2, RI(1, 3)); if (R() < 0.5) coinLine(x0 + 3, gy - 2, 3); }
  }
  if (boss) {
    flat(len - c);
    const bx = c; flat(cols - c);
    L.zones.push({ x0: bx * T, gy, boss: true, state: 0 });
    L.flagX = (cols - 4) * T; L.flagY = gy * T;
  } else {
    flat(cols - c);
    L.flagX = (len - 5) * T; L.flagY = gy * T;
  }
  // decoration on free ground
  for (let cc = 1; cc < cols - 1; cc++) {
    const top = L.ground[cc];
    if (top < 0 || R() > 0.33) continue;
    if (top > 0 && L.grid[(top - 1) * cols + cc] !== 0) continue;
    if (L.spikes.some(s => cc * T >= s.x - T && cc * T <= s.x + s.w)) continue;
    L.decor.push({ f: RP(WD.decor), x: cc * T + R() * T, y: top * T, flip: R() < 0.5 });
  }
  return L;
}
function makeWaves(pool, R, si, wi) {
  const waves = [], n = 2 + (wi >= 2 ? 1 : 0);
  for (let i = 0; i < n; i++) {
    const k = 3 + si + wi + i, w = [];
    for (let j = 0; j < k; j++) w.push(pool[Math.floor(R() * pool.length)]);
    waves.push(w);
  }
  return waves;
}

// ================================================================ physics on the tile grid
function cellAt(c, r) { const L = G.L; if (c < 0 || c >= L.cols) return 1; if (r < 0 || r >= ROWS) return 0; return L.grid[r * L.cols + c]; }
const solid = v => v === 1 || v === 3;
function moveBody(e, dt, grav = 1) {
  e.hitWall = false;
  e.x += e.vx * dt;
  const top = e.y - e.h + 2, bot = e.y - 2;
  const r0 = Math.floor(top / T), r1 = Math.floor(bot / T);
  if (e.vx > 0) {
    const c = Math.floor((e.x + e.w / 2) / T);
    for (let r = r0; r <= r1; r++) if (solid(cellAt(c, r))) { e.x = c * T - e.w / 2 - 0.01; e.vx = 0; e.hitWall = true; break; }
  } else if (e.vx < 0) {
    const c = Math.floor((e.x - e.w / 2) / T);
    for (let r = r0; r <= r1; r++) if (solid(cellAt(c, r))) { e.x = (c + 1) * T + e.w / 2 + 0.01; e.vx = 0; e.hitWall = true; break; }
  }
  const prevY = e.y;
  if (grav) e.vy = Math.min(e.vy + GRAV * grav * dt, MAXFALL);
  e.y += e.vy * dt;
  e.onGround = false;
  const c0 = Math.floor((e.x - e.w / 2 + 2) / T), c1 = Math.floor((e.x + e.w / 2 - 2) / T);
  if (e.vy >= 0) {
    const r = Math.floor(e.y / T);
    for (let c = c0; c <= c1; c++) {
      const v = cellAt(c, r);
      if (solid(v) || (v === 2 && prevY <= r * T + 1)) { e.y = r * T; e.vy = 0; e.onGround = true; break; }
    }
  } else {
    const r = Math.floor((e.y - e.h) / T);
    for (let c = c0; c <= c1; c++) if (solid(cellAt(c, r))) { e.y = (r + 1) * T + e.h; e.vy = 0; break; }
  }
}
const overlap = (a, b) => Math.abs(a.x - b.x) < (a.w + b.w) / 2 && a.y - a.h < b.y && b.y - b.h < a.y;

// ================================================================ game state
let state = 'loading', G = null, nextId = 1;
const input = { jump: false };
let prevIn = Object.assign({}, input);
const pressed = k => input[k] && !prevIn[k];

function newPlayer(L) {
  const h = HEROES[save.hero] || HEROES.beige;
  const maxHp = h.hp + upLv('hp') * 20;
  return {
    x: 3 * T, y: 9 * T, vx: 0, vy: 0, w: 38, h: 72, face: 1, onGround: false, coyote: 0, jbuf: 0, jumps: 0,
    hp: maxHp, maxHp, inv: 0, dashT: 0, dashCd: 0, fireT: 0, recoil: 0, muzzleT: 0, aim: 0, animT: 0, sq: 0,
    color: save.hero, hero: h, spd: h.spd, dmgMul: h.dmg * (1 + upLv('dmg') * 0.15), rateMul: 1 + upLv('rate') * 0.1,
    airJumps: h.tj ? 2 : 1, nadeMul: 1,
    regen: h.regen || 0, magnet: 110 * (1 + upLv('magnet') * 0.4), teamMul: 1 + upLv('team') * 0.25,
    cur: h.start ? 'special' : 'blaster', special: h.start || null, ammo: h.start ? WPN[h.start].ammo : 0, board: false, safe: { x: 3 * T, y: 9 * T }, ghostT: 0, wasGround: true, dustT: 0,
  };
}
function newGame(L) {
  const p = newPlayer(L);
  const others = Object.keys(HEROES).filter(k => k !== p.color);
  L.cages.forEach((cg, i) => { cg.color = others[i % others.length]; });
  return {
    L, p, t: 0, en: [], bul: [], ebul: [], parts: [], txt: [], pick: [], nades: [], squad: [], hist: [{ x: p.x, y: p.y, face: 1 }],
    coins: 0, kills: 0, rescued: 0, deaths: 0, cam: { x: 0, y: 192 }, lock: null, zone: null, boss: null, shake: 0, kick: 0, flash: 0, hitstop: 0,
    mode: 'play', modeT: 0, wipe: { r: 0, dir: 1, t: 0 }, spawnIdx: 0, ambient: [], revived: false, demoT: 0,
  };
}

// ================================================================ particles & fx helpers
function part(o) { if (G.parts.length < 600) G.parts.push(o); return o; }
function puff(x, y, s = 0.6, col = '#ffffff', life = 0.5) { part({ k: 'puff', x, y, s, col, life, max: life, rot: rand(0, TAU), vy: -20, vx: rand(-20, 20) }); }
function dust(x, y, n = 3) { for (let i = 0; i < n; i++) part({ k: 'puff', x: x + rand(-14, 14), y: y - 6, s: rand(0.18, 0.3), col: '#f3ead7', life: 0.45, max: 0.45, rot: rand(0, TAU), vx: rand(-50, 50), vy: rand(-40, -10) }); }
function sparks(x, y, col = '#ffe066', n = 4, sp = 280) { for (let i = 0; i < n; i++) { const a = rand(0, TAU), s = rand(sp * 0.3, sp); part({ k: 'line', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.12, 0.28), max: 0.28, col }); } }
function confetti(x, y, col, n = 8, sp = 320) { for (let i = 0; i < n; i++) { const a = rand(-Math.PI, 0), s = rand(sp * 0.3, sp); part({ k: 'chunk', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.5, 0.9), max: 0.9, col, r: rand(4, 8), rot: rand(0, TAU), vr: rand(-12, 12), grav: 1 }); } }
function debris(x, y, col, n = 6) { for (let i = 0; i < n; i++) part({ k: 'plank', x: x + rand(-18, 18), y: y + rand(-18, 18), vx: rand(-260, 260), vy: rand(-620, -220), life: 1.1, max: 1.1, col, w: rand(10, 22), h: rand(6, 10), rot: rand(0, TAU), vr: rand(-14, 14), grav: 1 }); }
function hitFlashTxt(x, y, v, crit = false, col = null) { if (G.txt.length < 60) G.txt.push({ x: x + rand(-8, 8), y, v, life: 0.7, max: 0.7, crit, col }); }
function banner(text, sub = '', warn = false) {
  const b = $('banner'); b.innerHTML = text + (sub ? `<small>${sub}</small>` : '');
  b.classList.toggle('warn', warn); b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
}
function toast(text) { const t = $('toast'); t.textContent = text; t.classList.remove('show'); void t.offsetWidth; t.classList.add('show'); }
function shake(v) { G.shake = Math.max(G.shake, v); }

function explode(x, y, radius, dmg, byPlayer = true) {
  part({ k: 'expl', x, y, s: radius / 48, life: 0.5, max: 0.5, rot: rand(0, TAU) });
  part({ k: 'glow', x, y, s: radius / 22, life: 0.25, max: 0.25, col: '#ffb43a' });
  for (let i = 0; i < 5; i++) puff(x + rand(-radius * 0.4, radius * 0.4), y + rand(-radius * 0.4, radius * 0.2), rand(0.4, 0.8), '#5b5560', rand(0.6, 1));
  sparks(x, y, '#ffcf3a', 12, 520);
  shake(16); G.flash = Math.max(G.flash, 0.35); G.hitstop = Math.max(G.hitstop, 0.05);
  sfx('explode', 0.05); vibrate(50);
  if (!byPlayer) return;
  for (const e of G.en) {
    if (e.dead || e.def.kind === 'hazard') continue;
    const d = Math.hypot(e.x - x, e.y - e.h / 2 - y);
    if (d < radius + e.w / 2) damageEnemy(e, dmg * (1 - d / (radius * 1.6)), sign(e.x - x) * 420, -420);
  }
  if (G.boss && !G.boss.dead) { const b = G.boss, d = Math.hypot(b.x - x, b.y - b.h / 2 - y); if (d < radius + b.w / 2) damageBoss(dmg * 0.8); }
  const c0 = Math.floor((x - radius) / T), c1 = Math.floor((x + radius) / T), r0 = Math.floor((y - radius) / T), r1 = Math.floor((y + radius) / T);
  for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) { const o = G.L.crateMap.get(c + ',' + r); if (o) damageCrate(o, 999); }
}

// ================================================================ crates & pickups
function damageCrate(o, dmg) {
  o.hp -= dmg; o.hitT = 0.12;
  if (o.hp > 0) { sfx('hit', 0.05); return; }
  const L = G.L, cx = o.c * T + T / 2, cy = o.r * T + T / 2;
  L.grid[o.r * L.cols + o.c] = 0; L.crateMap.delete(o.c + ',' + o.r); L.crates.splice(L.crates.indexOf(o), 1);
  debris(cx, cy, o.kind === 'gift' ? '#ffcf3a' : '#c47a45', 8); puff(cx, cy, 0.6, '#f3ead7');
  sfx('break');
  if (o.kind === 'coin') for (let i = 0; i < 7; i++) drop('coin', cx, cy);
  else if (o.kind === 'gift') {
    if (!G.p.board && Math.random() < 0.3) drop('board', cx, cy);
    else drop('weapon', cx, cy, pick(SPECIALS));
  } else {
    const r = Math.random();
    if (r < 0.5) for (let i = 0; i < randi(2, 4); i++) drop('coin', cx, cy);
    else if (r < 0.66) drop('heart', cx, cy);
    else if (r < 0.78) drop('coin', cx, cy);
    else drop('coin', cx, cy);
  }
}
function drop(kind, x, y, w = null) {
  G.pick.push({ kind, w, x, y, vx: kind === 'coin' ? rand(-180, 180) : rand(-60, 60), vy: rand(-620, -380), bw: 22, bh: 22, t: 0, v: kind === 'coin' ? 1 + Math.floor(G.L.g / 6) : 0, ph: rand(0, TAU) });
}
function collect(o) {
  const p = G.p;
  if (o.kind === 'coin') { G.coins += o.v || 1; sfx('coin', 0.04); part({ k: 'spark', x: o.x, y: o.y - 10, s: 0.5, life: 0.2, max: 0.2, col: '#ffe066', rot: rand(0, TAU) }); }
  else if (o.kind === 'heart') { p.hp = Math.min(p.maxHp, p.hp + 30); sfx('pickup'); hitFlashTxt(p.x, p.y - 90, '+30', false, '#53e07f'); }
  else if (o.kind === 'nade') { p.nades = Math.min(p.nadeMax, p.nades + 1); sfx('pickup'); toast('+1 El Bombası'); }
  else if (o.kind === 'weapon') {
    if (p.special === o.w) p.ammo += WPN[o.w].ammo; else { p.special = o.w; p.ammo = WPN[o.w].ammo; }
    p.cur = 'special'; sfx('pickup'); toast(WPN[o.w].name.toUpperCase() + '!'); updateSwapIcon();
  } else if (o.kind === 'board') { p.board = true; sfx('pickup'); toast('KAYKAY! Çift zıplama + hız'); }
  for (let i = 0; i < 4; i++) part({ k: 'line', x: o.x, y: o.y - 10, vx: rand(-150, 150), vy: rand(-250, -50), life: 0.25, max: 0.25, col: '#ffffff' });
}

// ================================================================ enemies
function spawnEnemy(t, x, y, extra = {}) {
  const d = EDEF[t], L = G.L;
  const e = Object.assign({ id: nextId++, t, def: d, x, y, vx: 0, vy: 0, w: d.w, h: d.h, hp: d.hp * L.hpMul, face: -1, onGround: false,
    flash: 0, sq: 0, animT: rand(0, 1), age: 0, hopT: rand(0.6, 1.6), shootT: rand(1, 2.4), swoop: 0, swoopT: rand(2, 4), kx: 0, zone: null }, extra);
  e.maxHp = e.hp;
  G.en.push(e);
  return e;
}
function damageEnemy(e, dmg, kx = 0, ky = 0, crit = false) {
  if (e.dead) return;
  if (e.def.kind === 'hazard') { sparks(e.x, e.y - e.h / 2, '#ffffff', 3); return; }
  e.hp -= dmg; e.flash = 0.1; e.sq = 0.25;
  e.kx += kx; if (ky) e.vy = Math.min(e.vy, ky);
  hitFlashTxt(e.x, e.y - e.h - 6, Math.round(dmg), crit);
  if (e.hp <= 0) killEnemy(e); else sfx('hit', 0.05);
}
function killEnemy(e) {
  e.dead = true; G.kills++;
  const cx = e.x, cy = e.y - e.h / 2;
  puff(cx, cy, 0.7, '#ffffff', 0.45); confetti(cx, cy, e.def.col, 9);
  part({ k: 'ring', x: cx, y: cy, s: 0.25, S: 0.9, life: 0.25, max: 0.25, col: '#ffffff' });
  if (e.def.flat) part({ k: 'corpse', f: 'en_' + e.def.flat, x: e.x, y: e.y, flip: e.face > 0, life: 0.6, max: 0.6 });
  for (let i = 0; i < e.def.coins; i++) drop('coin', cx, cy);
  if (Math.random() < 0.05) drop('heart', cx, cy);
  sfx('kill', 0.04); G.hitstop = Math.max(G.hitstop, 0.025); shake(3);
}
function hurtPlayer(dmg, fromX) {
  const p = G.p;
  if (p.inv > 0 || p.dashT > 0 || G.mode !== 'play' || G.demo) return;
  if (p.board) {
    p.board = false; p.inv = 1; debris(p.x, p.y - 10, '#4aa8ff', 6); sfx('break'); toast('Kaykay kırıldı!');
    p.vy = -450; p.vx = sign(p.x - fromX) * 300; return;
  }
  p.hp -= dmg; p.inv = 1.1; p.vy = -460; p.vx = sign(p.x - fromX) * 360;
  hitFlashTxt(p.x, p.y - 90, '-' + Math.round(dmg), false, '#ff4d63');
  shake(10); G.hitstop = 0.07; G.hurtFlash = 0.5; sfx('hurt', 0.1); vibrate(60);
  confetti(p.x, p.y - 40, '#ff4d63', 6, 220);
  if (p.hp <= 0) { p.hp = 0; playerDie(); }
}
function playerDie() {
  const p = G.p;
  G.mode = 'dead'; G.modeT = 0; G.deaths++;
  p.vy = -900; p.vx = -p.face * 120; p.dead = true;
  sfx('fail'); shake(18);
}

// ================================================================ boss
function spawnBoss(z) {
  const WD = G.L.WD, wi = G.L.wi;
  const b = { id: nextId++, key: WD.boss, x: G.lock.x0 + VW - 260, y: -60, vx: 0, vy: 0, w: 150, h: 210, face: -1, onGround: false,
    hp: 1400 * (1 + wi * 0.9), st: 'intro', t: 0, i: -1, flash: 0, sq: 0, shots: 0, shotT: 0, dead: false, animT: 0 };
  b.maxHp = b.hp;
  G.boss = b;
  $('bossName').textContent = WD.bossName;
  $('bossImg').src = 'assets/ui/boss_' + WD.boss + '.png';
  $('bossBox').classList.remove('hidden'); $('track').classList.add('hidden'); $('stageLbl').classList.add('hidden');
  sfx('boss', 0); banner(WD.bossName, 'BOSS SAVAŞI', true); vibrate([80, 60, 80]);
}
function damageBoss(dmg, crit = false) {
  const b = G.boss; if (!b || b.dead || b.st === 'intro') return;
  b.hp -= dmg; b.flash = 0.04;
  hitFlashTxt(b.x + rand(-40, 40), b.y - b.h - 10, Math.round(dmg), crit);
  sfx('hit', 0.06);
  if (b.hp <= 0) { b.hp = 0; b.dead = true; b.st = 'dying'; b.t = 1.8; b.boomT = 0; G.ebul.length = 0; sfx('boss', 0); }
}
function bossNext(b) {
  const pat = G.L.WD.pattern;
  b.i++; b.st = pat[b.i % pat.length];
  const enr = b.hp < b.maxHp * 0.4 ? 0.7 : 1;
  if (b.st === 'walk') b.t = 1.6 * enr;
  if (b.st === 'slam') { b.vy = -1100; b.vx = clamp((G.p.x + 340 - b.x) * 1.1, -560, 560); b.onGround = false; b.st = 'slamAir'; sfx('jump'); }
  if (b.st === 'volley') { b.shots = 4 + G.L.wi; b.shotT = 0.2; }
  if (b.st === 'summon') { b.t = 0.9; const n = 2 + Math.floor(G.L.wi / 2); for (let i = 0; i < n; i++) { const e = spawnEnemy(pick(G.L.WD.pool.filter(k => EDEF[k].kind !== 'shooter')), G.lock.x0 + rand(120, VW - 120), G.cam.y - 40); e.vy = 200; e.zone = 'boss'; } sfx('alarm'); }
  if (b.st === 'charge') { b.t = 0.75; b.face = sign(G.p.x - b.x); sfx('alarm'); }
}
function updateBoss(dt) {
  const b = G.boss; if (!b) return;
  const p = G.p, x0 = G.lock.x0 + b.w / 2 + 10, x1 = G.lock.x0 + VW - b.w / 2 - 10;
  b.animT += dt; if (b.flash > 0) b.flash -= dt; b.sq = Math.max(0, b.sq - dt * 3);
  if (b.st === 'dying') {
    b.t -= dt; b.boomT -= dt; b.vx = 0;
    if (b.boomT <= 0) { b.boomT = 0.14; explode(b.x + rand(-70, 70), b.y - rand(30, 200), 70, 0, false); }
    if (b.t <= 0) {
      explode(b.x, b.y - 100, 200, 0, false); G.flash = 1;
      for (let i = 0; i < 25; i++) drop('coin', b.x, b.y - 100);
      confetti(b.x, b.y - 100, '#ffcf3a', 30, 600);
      G.boss = null; G.kills++; G.L.flagHidden = false;
      G.L.flagX = Math.min(G.L.flagX, G.lock.x0 + VW - 120);
      puff(G.L.flagX, G.L.flagY - 40, 1, '#ffffff', 0.7);
      G.lock = null; if (G.zone) G.zone.state = 2;
      $('bossBox').classList.add('hidden'); $('track').classList.remove('hidden'); $('stageLbl').classList.remove('hidden');
      banner('ZAFER!', 'Bayrağa koş!'); sfx('clear', 0);
    }
    return;
  }
  const wasGround = b.onGround;
  if (b.st === 'intro') { moveBody(b, dt); if (b.onGround) { shake(20); dust(b.x, b.y, 10); sfx('explode'); b.st = 'rest'; b.t = 0.8; } return; }
  if (b.st === 'walk') { b.face = sign(p.x - b.x); const far = Math.abs(p.x - b.x) > 330; b.vx = approach(b.vx, far ? b.face * 120 * (b.hp < b.maxHp * 0.4 ? 1.5 : 1) : -b.face * 60, 900 * dt); b.t -= dt; if (b.t <= 0) bossNext(b); }
  else if (b.st === 'slamAir') { if (b.onGround && !wasGround) { b.vx = 0; shake(20); dust(b.x, b.y, 12); sfx('explode'); b.sq = 0.4;
      for (const s of [-1, 1]) G.ebul.push({ k: 'wave', x: b.x + s * 80, y: b.y, vx: s * 430, vy: 0, r: 28, dmg: 18, life: 2.4, col: '#ffffff' });
      b.st = 'rest'; b.t = 0.7; } }
  else if (b.st === 'volley') { b.vx = 0; b.shotT -= dt; if (b.shotT <= 0) { b.shotT = 0.22; b.shots--; b.sq = 0.2;
      const dx = p.x - b.x; G.ebul.push({ k: 'goo', x: b.x, y: b.y - b.h * 0.7, vx: clamp(dx * 0.9, -600, 600) + rand(-120, 120), vy: rand(-760, -560), r: 12, dmg: 14, life: 4, col: '#9b5cf0', grav: 1 });
      sfx('throw'); if (b.shots <= 0) { b.st = 'rest'; b.t = 0.6; } } }
  else if (b.st === 'summon') { b.vx = 0; b.t -= dt; if (b.t <= 0) bossNext(b); }
  else if (b.st === 'charge') { if (b.t > 0) { b.t -= dt; b.vx = 0; b.jit = rand(-4, 4); if (b.t <= 0) { b.vx = b.face * 780; sfx('dash'); } }
    else { if (Math.random() < 0.5) dust(b.x - b.face * 60, b.y, 1); if (b.x <= x0 + 2 || b.x >= x1 - 2) { b.vx = 0; shake(14); sfx('explode'); b.st = 'rest'; b.t = 1.0; b.sq = 0.4; } } }
  else if (b.st === 'rest') { b.vx = approach(b.vx, 0, 1500 * dt); b.t -= dt; if (b.t <= 0) bossNext(b); }
  moveBody(b, dt);
  b.x = clamp(b.x, x0, x1);
  // contact
  if (G.mode === 'play' && overlap(b, { x: p.x, y: p.y, w: p.w - 6, h: p.h - 6 })) {
    if (p.vy > 150 && p.y - (b.y - b.h) < 40) { p.vy = -820; damageBoss(25 * p.dmgMul); sfx('stomp'); dust(p.x, p.y, 4); }
    else hurtPlayer(22, b.x);
  }
}

// ================================================================ player update
// targets the auto-aim can shoot: enemies, the boss, crates and cages
function aimTargets() {
  const out = [], L = G.L, p = G.p;
  for (const e of G.en) if (!e.dead && e.def.kind !== 'hazard') out.push(e);
  if (G.boss && !G.boss.dead && G.boss.st !== 'intro') out.push(G.boss);
  for (const o of L.crates) { const x = o.c * T + T / 2; if (x > p.x - 200 && x < p.x + 700) out.push({ x, y: o.r * T + T, h: T, crate: o }); }
  for (const cg of L.cages) if (!cg.freed && cg.x > p.x - 100 && cg.x < p.x + 700) out.push({ x: cg.x, y: cg.y, h: 100, cage: cg });
  return out;
}
function updatePlayer(dt) {
  const p = G.p, L = G.L;
  if (G.mode === 'dead') { p.vy += GRAV * dt; p.y += p.vy * dt; p.x += p.vx * dt; return; }
  if (G.mode === 'clear') { p.vx = approach(p.vx, 0, 2000 * dt); moveBody(p, dt); if (p.onGround && Math.random() < 0.03) p.vy = -500; return; }
  p.animT += dt;
  if (p.inv > 0) p.inv -= dt;
  if (p.regen) p.hp = Math.min(p.maxHp, p.hp + p.regen * dt);
  // --- auto-aim: closest thing worth shooting, preferring what is in front
  let target = null, best = 1e9, threatFront = false, threatBack = null;
  for (const e of aimTargets()) {
    const dx = e.x - p.x, dy = (e.y - e.h / 2) - (p.y - 40);
    const isFoe = !e.crate && !e.cage;
    if (isFoe && dx < -10 && dx > -260 && Math.abs(dy) < 200) threatBack = e;
    if (dx < -10 || dx > 720 || Math.abs(dy) > 420) continue;
    if (isFoe && dx < (e === G.boss ? 900 : 330)) threatFront = true;
    if ((e.crate || e.cage) && dx < 150) threatFront = true;
    const d = dx + Math.abs(dy) * 1.2; if (d < best) { best = d; target = e; }
  }
  // --- auto-run: keep going right, stop to fight when something is close in front
  let face = 1;
  if (!target && threatBack) { target = threatBack; face = -1; }
  const run = !threatFront && !threatBack && !(G.lock && G.boss);
  p.face = face;
  const maxSp = 270 * p.spd * (p.board ? 1.3 : 1);
  p.vx = approach(p.vx, run ? maxSp : 0, (p.onGround ? 2600 : 1800) * dt);
  // --- tap to jump, tap again in the air to double jump
  if (pressed('jump')) p.jbuf = 0.14; else p.jbuf -= dt;
  if (p.onGround) { p.coyote = 0.1; p.jumps = 0; } else p.coyote -= dt;
  if (p.jbuf > 0) {
    if (p.coyote > 0) { p.vy = -840; p.coyote = 0; p.jbuf = 0; p.sq = -0.2; sfx('jump'); dust(p.x, p.y, 3); }
    else if (p.jumps < p.airJumps + (p.board ? 1 : 0)) { p.vy = -780; p.jumps++; p.jbuf = 0; sfx('jump'); part({ k: 'ring', x: p.x, y: p.y, s: 0.2, S: 0.7, life: 0.25, max: 0.25, col: '#9fe1ff' }); }
  }
  if (!input.jump && p.vy < -380 && !p.spring) p.vy = -380;
  if (p.vy >= 0) p.spring = false;
  moveBody(p, dt);
  if (p.onGround && !p.wasGround) { p.sq = 0.22; dust(p.x, p.y, 4); sfx('land', 0.1); }
  p.wasGround = p.onGround;
  p.sq = approach(p.sq, 0, dt * 1.6);
  if (p.onGround && Math.abs(p.vx) > 120) { p.dustT -= dt; if (p.dustT <= 0) { p.dustT = 0.16; dust(p.x - 10, p.y, 1); } }
  const lx0 = G.lock ? G.lock.x0 : 0, lx1 = G.lock ? G.lock.x0 + VW : L.cols * T;
  p.x = clamp(p.x, lx0 + p.w / 2, lx1 - p.w / 2);
  if (p.onGround) {
    const cl = Math.floor((p.x - p.w / 2) / T), cr = Math.floor((p.x + p.w / 2) / T), rr = Math.floor(p.y / T);
    if (solid(cellAt(cl, rr)) && solid(cellAt(cr, rr))) { p.safe.x = p.x; p.safe.y = p.y; }
  }
  if (p.y > ROWS * T + 160) {
    p.x = p.safe.x - 40; p.y = p.safe.y - 2; p.vx = 0; p.vy = 0; p.inv = 0;
    hurtPlayer(20, p.x + 1); if (G.mode === 'play') { p.inv = 1.4; p.vy = -300; p.vx = 0; }
  }
  for (const s of L.springs) {
    if (s.t > 0) s.t -= dt;
    if (p.vy > 0 && Math.abs(p.x - s.x) < 34 && p.y >= s.y - 34 && p.y <= s.y + 4) { p.vy = -1450; p.spring = true; p.jumps = 0; s.t = 0.3; sfx('spring'); dust(s.x, s.y, 3); }
  }
  for (const s of L.spikes) if (p.x + p.w / 2 > s.x + 6 && p.x - p.w / 2 < s.x + s.w - 6 && p.y >= s.y - 22 && p.y <= s.y + 2) hurtPlayer(15, p.x - 1);
  if (L.cp && !L.cp.on && p.x > L.cp.x) { L.cp.on = true; sfx('pickup'); toast('Kontrol noktası!'); confetti(L.cp.x, L.cp.y - 80, '#ec3b4f', 10); }
  // --- aim & auto-fire
  let aim = 0;
  if (target) aim = clamp(Math.atan2((target.y - target.h / 2) - (p.y - 40), Math.abs(target.x - p.x)), -1.1, 1.1);
  p.aim = lerp(p.aim, aim, Math.min(1, dt * 14));
  p.fireT -= dt; if (p.recoil > 0) p.recoil = Math.max(0, p.recoil - dt * 9); if (p.muzzleT > 0) p.muzzleT -= dt;
  const wkey = p.special ? p.special : 'blaster';
  if (target && p.fireT <= 0) fireWeapon(wkey);
}
function gunPose(p) {
  const ang = p.face > 0 ? p.aim : Math.PI - p.aim;
  const hx = p.x + p.face * 12, hy = p.y - 34;
  return { ang, hx, hy };
}
function fireWeapon(key) {
  const p = G.p, w = WPN[key];
  p.fireT = 1 / (w.rate * p.rateMul);
  const { ang, hx, hy } = gunPose(p);
  const mx = hx + Math.cos(ang) * w.len, my = hy + Math.sin(ang) * w.len;
  for (let i = 0; i < w.pellets; i++) {
    const a = ang + rand(-w.spread, w.spread) + (w.pellets > 1 ? (i / (w.pellets - 1) - 0.5) * w.spread * 1.4 : 0);
    const sp = w.spd * (w.pellets > 1 ? rand(0.85, 1.1) : 1);
    G.bul.push({ x: mx, y: my, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, ang: a, dmg: w.dmg * p.dmgMul * (1 + G.L.g * 0.03), life: w.life, pierce: w.pierce || 0, hits: [], key, tracer: w.tracer, team: false });
  }
  p.recoil = 1; p.muzzleT = 0.05; G.kick = -p.face * (key === 'shotgun' || key === 'rocket' ? 8 : 3);
  if (key === 'shotgun' || key === 'rocket') { p.vx -= p.face * 120; shake(4); }
  if (key !== 'laser') part({ k: 'casing', x: hx, y: hy - 4, vx: -p.face * rand(80, 180), vy: rand(-380, -260), life: 0.8, max: 0.8, rot: 0, vr: rand(-20, 20), grav: 1, bounced: false });
  sfx(w.snd, key === 'mg' ? 0.06 : 0.05);
  if (key !== 'blaster') {
    p.ammo--;
    if (p.ammo <= 0) { p.special = null; p.cur = 'blaster'; toast('Cephane bitti'); }
    updateSwapIcon();
  }
}

// ================================================================ squad (rescued teammates)
function updateSquad(dt) {
  const p = G.p, h = G.hist, last = h[h.length - 1];
  if (Math.hypot(p.x - last.x, p.y - last.y) > 5) { h.push({ x: p.x, y: p.y, face: p.face }); if (h.length > 200) h.shift(); }
  G.squad.forEach((m, i) => {
    const idx = Math.max(0, h.length - 1 - (i + 1) * 13), s = h[idx];
    const px = m.x, py = m.y;
    if (m.join > 0) { m.join -= dt; m.x = lerp(m.x, s.x, dt * 3); m.y = lerp(m.y, s.y, dt * 3); }
    else { m.x = lerp(m.x, s.x, Math.min(1, dt * 12)); m.y = lerp(m.y, s.y, Math.min(1, dt * 12)); }
    m.moving = Math.abs(m.x - px) > 0.6; m.air = Math.abs(m.y - py) > 0.8;
    if (Math.abs(m.x - px) > 0.3) m.face = sign(m.x - px);
    m.animT += dt; m.fireT -= dt; if (m.recoil > 0) m.recoil -= dt * 8;
    let tgt = null, bd = 560;
    const tgs = G.boss && !G.boss.dead && G.boss.st !== 'intro' ? G.en.concat([G.boss]) : G.en;
    for (const e of tgs) { if (e.dead || (e.def && e.def.kind === 'hazard')) continue; const d = Math.hypot(e.x - m.x, e.y - m.y); if (d < bd) { bd = d; tgt = e; } }
    m.tgt = tgt;
    if (tgt) {
      m.face = sign(tgt.x - m.x);
      m.ang = Math.atan2((tgt.y - tgt.h / 2) - (m.y - 34), tgt.x - m.x);
      if (m.fireT <= 0) {
        m.fireT = 0.42; m.recoil = 1;
        const a = m.ang, sp = 1100;
        G.bul.push({ x: m.x + Math.cos(a) * 30, y: m.y - 34 + Math.sin(a) * 30, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, ang: a, dmg: 5.5 * p.teamMul * (1 + G.L.g * 0.03), life: 0.6, pierce: 0, hits: [], key: 'blaster', tracer: '#bff3ff', team: true });
        sfx('team', 0.08);
      }
    } else m.ang = m.face > 0 ? 0 : Math.PI;
  });
}

// ================================================================ main update
function update(dt) {
  if (G.hitstop > 0) { G.hitstop -= dt; return; }
  G.t += dt; G.modeT += dt;
  const L = G.L, p = G.p;
  if (G.demo) demoInput();
  updatePlayer(dt);
  updateSquad(dt);
  // activate placed enemies ahead of the camera
  while (G.spawnIdx < L.spawns.length && L.spawns[G.spawnIdx].x < G.cam.x + VW + 160) { const s = L.spawns[G.spawnIdx++]; spawnEnemy(s.t, s.x, s.y); }
  updateZones(dt);
  // enemies
  for (const e of G.en) {
    if (e.dead) continue;
    updateEnemy(e, dt);
    if (G.mode === 'play' && !e.dead && overlap(e, { x: p.x, y: p.y, w: p.w - 8, h: p.h - 8 })) {
      if (e.def.stomp && p.vy > 120 && p.y - (e.y - e.h) < 26) { p.vy = -640; p.jumps = 0; damageEnemy(e, 40 * p.dmgMul); sfx('stomp'); dust(p.x, p.y, 3); }
      else hurtPlayer(e.def.dmg * (1 + G.L.g * 0.05), e.x);
    }
  }
  if (G.boss) updateBoss(dt);
  // bullets
  for (const b of G.bul) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.key === 'rocket') { b.smokeT = (b.smokeT || 0) - dt; if (b.smokeT <= 0) { b.smokeT = 0.03; puff(b.x - Math.cos(b.ang) * 20, b.y - Math.sin(b.ang) * 20, 0.2, '#d8d8e0', 0.4); } }
    if (b.life <= 0) { b.dead = true; continue; }
    const c = Math.floor(b.x / T), r = Math.floor(b.y / T), v = cellAt(c, r);
    if (solid(v)) {
      b.dead = true; sparks(b.x, b.y, b.tracer, 3, 200);
      if (v === 3) { const o = G.L.crateMap.get(c + ',' + r); if (o) damageCrate(o, b.dmg); }
      if (b.key === 'rocket') explode(b.x, b.y, WPN.rocket.explode, b.dmg);
      continue;
    }
    let hitCage = false;
    for (const cg of L.cages) {
      if (cg.freed || b.team && false) continue;
      if (Math.abs(b.x - cg.x) < 46 && b.y > cg.y - 112 && b.y < cg.y) {
        cg.hp -= b.dmg; cg.hitT = 0.12; sparks(b.x, b.y, '#ffffff', 3, 200); sfx('hit', 0.05);
        if (cg.hp <= 0) freeCage(cg);
        b.dead = true; hitCage = true; break;
      }
    }
    if (hitCage) continue;
    const tgs = G.boss && !G.boss.dead && G.boss.st !== 'intro' ? [G.boss] : [];
    for (const e of G.en.concat(tgs)) {
      if (e.dead || b.hits.indexOf(e.id) >= 0) continue;
      if (Math.abs(e.x - b.x) < e.w / 2 + 4 && b.y > e.y - e.h - 4 && b.y < e.y + 4) {
        b.hits.push(e.id);
        const crit = !b.team && Math.random() < 0.08;
        const dmg = b.dmg * (crit ? 2 : 1);
        part({ k: 'spark', x: b.x, y: b.y, s: crit ? 0.8 : 0.5, life: 0.1, max: 0.1, col: '#ffffff', rot: rand(0, TAU) });
        if (e === G.boss) damageBoss(dmg, crit); else damageEnemy(e, dmg, sign(b.vx) * (b.key === 'shotgun' ? 160 : 70), 0, crit);
        if (b.key === 'rocket') { explode(b.x, b.y, WPN.rocket.explode, b.dmg); b.dead = true; break; }
        if (b.pierce-- <= 0) { b.dead = true; break; }
      }
    }
  }
  // enemy projectiles
  for (const b of G.ebul) {
    b.life -= dt;
    if (b.k === 'wave') {
      b.x += b.vx * dt; if (Math.random() < 0.6) dust(b.x, b.y, 1);
      if (solid(cellAt(Math.floor(b.x / T), Math.floor((b.y - 10) / T)))) b.dead = true;
      if (G.mode === 'play' && Math.abs(b.x - p.x) < 34 && p.y > b.y - 40) hurtPlayer(b.dmg, b.x - b.vx);
    } else {
      b.vy += GRAV * 0.5 * (b.grav || 0) * dt; b.x += b.vx * dt; b.y += b.vy * dt;
      if (solid(cellAt(Math.floor(b.x / T), Math.floor(b.y / T)))) { b.dead = true; puff(b.x, b.y, 0.35, b.col, 0.35); confetti(b.x, b.y, b.col, 4, 160); }
      if (G.mode === 'play' && Math.abs(b.x - p.x) < p.w / 2 + b.r && b.y > p.y - p.h - b.r && b.y < p.y + b.r) { b.dead = true; hurtPlayer(b.dmg, b.x - b.vx); }
    }
    if (b.life <= 0) b.dead = true;
  }
  // grenades
  for (const n of G.nades) {
    const vx0 = n.vx, vy0 = n.vy;
    moveBody(n, dt);
    if (n.hitWall) n.vx = -vx0 * 0.5;
    if (n.onGround && vy0 > 200) { n.vy = -vy0 * 0.42; n.bounces++; sfx('land', 0.08); }
    if (n.onGround) n.vx = approach(n.vx, 0, 900 * dt);
    n.rot += n.vx * dt * 0.05; n.fuse -= dt;
    let hitE = false; for (const e of G.en) if (!e.dead && e.def.kind !== 'hazard' && overlap(e, n)) hitE = true;
    if (G.boss && !G.boss.dead && overlap(G.boss, n)) hitE = true;
    if (n.fuse <= 0 || (hitE && n.fuse < 1.0)) { n.dead = true; explode(n.x, n.y - 10, 130 * p.nadeMul, 85 * p.dmgMul * p.nadeMul); }
  }
  // pickups
  for (const o of G.pick) {
    o.t += dt;
    const dx = p.x - o.x, dy = (p.y - 40) - o.y, d = Math.hypot(dx, dy);
    if ((o.kind === 'coin' && o.t > 0.35 && d < p.magnet) || o.fly) { o.fly = true; o.x += dx / d * 900 * dt; o.y += dy / d * 900 * dt; }
    else { const vy0 = o.vy; const box = { x: o.x, y: o.y + o.bh / 2, w: o.bw, h: o.bh, vx: o.vx, vy: o.vy }; moveBody(box, dt); o.x = box.x; o.y = box.y - o.bh / 2; o.vx = box.vx * 0.98; o.vy = box.vy; if (box.onGround) { o.vx *= 0.85; if (vy0 > 220) o.vy = -vy0 * 0.35; } }
    if (G.mode === 'play' && Math.abs(dx) < 34 && Math.abs(dy) < 52) { o.dead = true; collect(o); }
    if (o.y > ROWS * T + 100 || (o.kind === 'coin' && o.t > 14)) o.dead = true;
  }
  // static level coins (with magnet)
  for (const c of L.coins) {
    if (c.taken) continue;
    const dx = p.x - c.x, dy = (p.y - 40) - c.y, d = Math.hypot(dx, dy);
    if (c.fly || d < p.magnet * 0.7) { c.fly = true; c.x += dx / d * 800 * dt; c.y += dy / d * 800 * dt; }
    if (G.mode === 'play' && Math.abs(dx) < 34 && Math.abs(dy) < 50) { c.taken = true; collect({ kind: 'coin', x: c.x, y: c.y, v: 1 }); }
  }
  for (const cg of L.cages) if (cg.hitT > 0) cg.hitT -= dt;
  // particles
  for (const q of G.parts) {
    q.life -= dt;
    if (q.grav) q.vy += GRAV * 0.6 * dt;
    if (q.vx !== undefined) { q.x += q.vx * dt; q.y += (q.vy || 0) * dt; }
    if (q.vr) q.rot += q.vr * dt;
    if (q.k === 'casing' && !q.bounced && solid(cellAt(Math.floor(q.x / T), Math.floor(q.y / T)))) { q.bounced = true; q.vy = -q.vy * 0.4; q.vx *= 0.5; q.y -= 4; }
    if ((q.k === 'chunk' || q.k === 'plank') && q.vy > 0 && solid(cellAt(Math.floor(q.x / T), Math.floor(q.y / T)))) { q.vy = -q.vy * 0.3; q.vx *= 0.6; q.y = Math.floor(q.y / T) * T - 1; }
    if (q.k === 'puff') { q.vx *= 0.94; q.vy *= 0.94; }
  }
  for (const t of G.txt) { t.life -= dt; t.y -= 50 * dt; }
  G.en = G.en.filter(e => !e.dead && e.y < ROWS * T + 200 && e.x > G.cam.x - 900);
  G.bul = G.bul.filter(b => !b.dead);
  G.ebul = G.ebul.filter(b => !b.dead);
  G.nades = G.nades.filter(n => !n.dead);
  G.pick = G.pick.filter(o => !o.dead);
  G.parts = G.parts.filter(q => q.life > 0);
  G.txt = G.txt.filter(t => t.life > 0);
  // finish flag
  if (G.mode === 'play' && !L.flagHidden && !G.demo && p.x > L.flagX - 10) stageClear();
  if (G.mode === 'dead' && G.modeT > 1.2 && !G.reviveAsked) { G.reviveAsked = true; askRevive(); }
  if (G.mode === 'clear' && G.modeT > 0.2 && Math.random() < 0.15) { const fx = L.flagX + rand(-200, 200); confetti(fx, G.cam.y + rand(60, 200), pick(['#ffcf3a', '#ec3b4f', '#33c14d', '#2d8cf0', '#c08bff']), 6, 420); }
  if (G.mode === 'clear' && G.modeT > 2.4 && !G.wipe.closing) { G.wipe.closing = true; G.wipe.dir = -1; G.wipe.t = 0; G.wipe.cb = showResult; }
  updateCamera(dt);
  if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 45);
  G.kick = approach(G.kick, 0, dt * 60);
  if (G.flash > 0) G.flash = Math.max(0, G.flash - dt * 3);
  if (G.hurtFlash > 0) G.hurtFlash = Math.max(0, G.hurtFlash - dt * 1.5);
}
function updateEnemy(e, dt) {
  const p = G.p, d = e.def;
  e.age += dt; e.animT += dt; if (e.flash > 0) e.flash -= dt; e.sq = Math.max(0, e.sq - dt * 2);
  e.kx = approach(e.kx, 0, 1400 * dt);
  const dx = p.x - e.x, near = Math.abs(dx) < 720 && Math.abs(p.y - e.y) < 300;
  if (d.kind === 'walker' || d.kind === 'hazard') {
    if (near && d.kind === 'walker') e.face = sign(dx);
    let sp = d.spd;
    if (e.onGround) {
      const ahead = Math.floor((e.x + e.face * (e.w / 2 + 6)) / T), foot = Math.floor((e.y + 6) / T), v = cellAt(ahead, foot);
      if (!solid(v) && v !== 2) { if (near && d.kind === 'walker') sp = 0; else e.face *= -1; }
    }
    e.vx = e.face * sp + e.kx;
    moveBody(e, dt);
    if (e.hitWall) { if (e.onGround && near && d.kind === 'walker' && Math.random() < 0.5) e.vy = -620; else e.face *= -1; }
  } else if (d.kind === 'hopper') {
    if (e.onGround) { e.vx = approach(e.vx, 0, 1800 * dt) + e.kx * 0.2; e.hopT -= dt; if (e.hopT <= 0 && near) { e.hopT = rand(1.1, 1.7); e.face = sign(dx); e.vx = e.face * 260; e.vy = -700; } }
    else e.vx += e.kx * dt;
    moveBody(e, dt);
  } else if (d.kind === 'flyer') {
    if (e.swoop > 0) { e.swoop -= dt; }
    else {
      const tx = p.x + Math.sin(G.t * 0.8 + e.id) * 160, ty = p.y - 150 + Math.sin(G.t * 2.4 + e.id) * 40;
      e.vx = approach(e.vx, clamp((tx - e.x) * 2, -d.spd, d.spd), 600 * dt);
      e.vy = approach(e.vy, clamp((ty - e.y) * 2, -d.spd, d.spd), 600 * dt);
      e.swoopT -= dt;
      if (e.swoopT <= 0 && near && Math.abs(dx) < 380) { e.swoopT = rand(2.5, 4); e.swoop = 0.65; const a = Math.atan2(p.y - 30 - e.y, dx); e.vx = Math.cos(a) * 460; e.vy = Math.sin(a) * 460; }
    }
    e.face = sign(e.vx || dx);
    e.vx += e.kx * dt * 6;
    moveBody(e, dt, 0);
  } else if (d.kind === 'shooter') {
    e.face = sign(dx);
    moveBody(e, dt);
    e.shootT -= dt;
    if (e.shootT <= 0 && near && Math.abs(dx) < 640) {
      e.shootT = rand(1.8, 2.6); e.atk = 0.4;
      G.ebul.push({ k: 'goo', x: e.x, y: e.y - e.h + 8, vx: clamp(dx * 1.05, -520, 520), vy: -560, r: 10, dmg: d.dmg, life: 4, col: '#b27cff', grav: 1 });
      sfx('throw', 0.1);
    }
    if (e.atk > 0) e.atk -= dt;
  }
}
function freeCage(cg) {
  cg.freed = true;
  G.rescued++;
  debris(cg.x, cg.y - 50, '#8a93a6', 10); puff(cg.x, cg.y - 50, 0.9, '#ffffff', 0.6);
  confetti(cg.x, cg.y - 60, '#ffcf3a', 16, 420);
  sfx('rescue', 0); vibrate(30);
  if (G.squad.length < 3) {
    G.squad.push({ color: cg.color, x: cg.x, y: cg.y, face: 1, fireT: 0.6, animT: 0, recoil: 0, ang: 0, join: 0.8 });
    banner('KURTARILDI!', '+1 TAKIM ARKADAŞI');
  } else { G.coins += 40; banner('KURTARILDI!', '+40 ALTIN'); }
}
function updateZones(dt) {
  const p = G.p;
  for (const z of G.L.zones) {
    if (z.state === 0 && p.x > z.x0 + (z.boss ? 260 : VW * 0.42)) {
      z.state = 1; G.zone = z;
      G.lock = { x0: clamp(z.boss ? z.x0 - 40 : G.cam.x, 0, G.L.cols * T - VW) };
      if (z.boss) spawnBoss(z);
      else { banner('SAVAŞ!', 'Tüm düşmanları yok et', true); sfx('alarm'); z.t = 0.8; }
    }
    if (z.state === 1 && !z.boss) {
      const alive = G.en.some(e => e.zone === z && !e.dead);
      if (!alive) {
        z.t -= dt;
        if (z.t <= 0) {
          z.wave++;
          if (z.wave >= z.waves.length) { z.state = 2; G.lock = null; G.zone = null; banner('İLERİ!', 'Bölge temizlendi'); sfx('pickup'); }
          else {
            z.t = 0.9;
            z.waves[z.wave].forEach((t, i) => {
              const fl = EDEF[t].kind === 'flyer';
              const x = G.lock.x0 + (i % 2 ? VW - 90 - rand(0, 160) : 90 + rand(0, 160));
              const e = spawnEnemy(t, x, fl ? G.cam.y + 120 : G.cam.y - 60 - i * 30, { zone: z });
              e.vy = fl ? 0 : 150; puff(x, fl ? G.cam.y + 120 : G.cam.y + 30, 0.5, '#ffffff', 0.4);
            });
          }
        }
      }
    }
  }
}
function updateCamera(dt) {
  const p = G.p, c = G.cam, L = G.L;
  let tx = p.x - VW * 0.3;
  if (G.lock) tx = G.lock.x0;
  tx = clamp(tx, 0, L.cols * T - VW);
  c.x += (tx - c.x) * Math.min(1, dt * (G.lock ? 5 : 6));
  const ty = Math.min(p.y - VH * (G.demo && H > W ? 0.56 : 0.62), ROWS * T + 3 * T - VH);
  if (G.mode !== 'dead') c.y += (ty - c.y) * Math.min(1, dt * 4);
}
function stageClear() {
  G.mode = 'clear'; G.modeT = 0;
  const p = G.p; p.vx = 0;
  sfx('clear', 0); banner('BÖLÜM TAMAM!', stageLabel(G.L.g) + ' · ' + G.L.WD.name);
  for (let i = 0; i < 4; i++) confetti(G.L.flagX, G.L.flagY - 120, pick(['#ffcf3a', '#ec3b4f', '#33c14d', '#2d8cf0']), 14, 520);
}
function demoInput() {
  const p = G.p;
  input.jump = p.onGround && Math.random() < 0.006;
  G.demoT -= 1 / 60;
  if (G.demoT <= 0 && G.en.length < 3) { G.demoT = rand(1.4, 2.6); const t = pick(['slime', 'mouse', 'snail', 'bee', 'frog']); spawnEnemy(t, G.cam.x + VW + 80, EDEF[t].kind === 'flyer' ? 9 * T - 200 : 9 * T); }
  p.hp = p.maxHp;
}

// ================================================================ rendering
const layerCache = new Map();
function bgLayer(name, tint) {
  const key = name + (tint ? tint[0] : '');
  let c = layerCache.get(key); if (c) return c;
  const f = AF[name];
  c = document.createElement('canvas'); c.width = f[2]; c.height = f[3];
  const g = c.getContext('2d');
  g.drawImage(atlasImg, f[0], f[1], f[2], f[3], 0, 0, f[2], f[3]);
  if (tint) { g.globalCompositeOperation = 'source-atop'; g.globalAlpha = tint[1]; g.fillStyle = tint[0]; g.fillRect(0, 0, f[2], f[3]); }
  layerCache.set(key, c); return c;
}
function drawBackdrop(WD, camx, camy, t) {
  const cw = cv.width, ch = cv.height;
  const hz = (9 * T - camy) * SC;   // ground line in canvas px
  const gr = ctx.createLinearGradient(0, Math.min(0, hz - 900 * SC), 0, hz);
  gr.addColorStop(0, WD.sky[0]); gr.addColorStop(1, WD.sky[1]);
  ctx.fillStyle = gr; ctx.fillRect(0, 0, cw, ch);
  const layer = (img, f, h, y, drift = 0) => {
    const w = h * img.width / img.height;
    let ox = -((camx * SC * f + drift) % w); if (ox > 0) ox -= w;
    for (let x = ox; x < cw; x += w - 1) ctx.drawImage(img, x, y, w, h);
  };
  ctx.globalAlpha = WD.terrain === 'purple' ? 0.25 : 0.9;
  layer(bgLayer('bg_clouds', null), 0.05, 400 * SC, hz - 560 * SC, t * 10 * DPR);
  ctx.globalAlpha = 1;
  layer(bgLayer('bg_' + WD.bgFade, WD.tint), 0.15, 540 * SC, hz - 470 * SC);
  layer(bgLayer('bg_' + WD.bgColor, WD.tint), 0.32, 470 * SC, hz - 330 * SC);
}
function drawTerrain(x0, x1, y0, y1) {
  const L = G.L, b = L.WD.terrain, cols = L.cols;
  const g = (c, r) => c < 0 || c >= cols ? 1 : r < 0 ? 0 : r >= ROWS ? (L.ground[c] >= 0 ? 1 : 0) : L.grid[r * cols + c];
  const hasH = !!AF[`t_${b}_h_middle`];
  const c0 = Math.max(0, Math.floor(x0 / T)), c1 = Math.min(cols - 1, Math.floor(x1 / T)), r0 = Math.max(0, Math.floor(y0 / T));
  const rMax = Math.floor(y1 / T);
  for (let c = c0; c <= c1; c++) if (L.ground[c] < 0) {   // bottomless pit
    const top = 9.6 * T, gr = ctx.createLinearGradient(0, top, 0, top + 4 * T);
    gr.addColorStop(0, '#3a2c52'); gr.addColorStop(1, '#120d1f');
    ctx.fillStyle = gr; ctx.fillRect(c * T, top, T + 0.6, y1 - top);
  }
  for (let r = r0; r <= rMax; r++) for (let c = c0; c <= c1; c++) {
    const v = g(c, r);
    if (v === 1) {
      const up = g(c, r - 1) === 1, l = g(c - 1, r) === 1, rt = g(c + 1, r) === 1;
      const piece = !up ? (!l ? 'top_left' : !rt ? 'top_right' : 'top') : (!l ? 'left' : !rt ? 'right' : 'center');
      const f = AF[`t_${b}_${piece}`];
      ctx.drawImage(atlasImg, f[0], f[1], f[2], f[3], c * T, r * T, T + 0.6, T + 0.6);
    } else if (v === 2) {
      const l = g(c - 1, r) === 2, rt = g(c + 1, r) === 2;
      const piece = hasH ? (!l ? 'h_left' : !rt ? 'h_right' : 'h_middle') : (!l ? 'top_left' : !rt ? 'top_right' : 'top');
      const f = AF[`t_${b}_${piece}`];
      ctx.drawImage(atlasImg, f[0], f[1], f[2], f[3], c * T, r * T, T + 0.6, T + 0.6);
    }
  }
}
function drawGun(key, x, y, ang, recoil, sc = 1) {
  const w = WPN[key], L = w.len;
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); if (Math.cos(ang) < 0) ctx.scale(1, -1); ctx.scale(sc, sc);
  ctx.translate(-recoil * 7, 0);
  ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.lineJoin = 'round';
  ctx.fillStyle = w.acc; rrect(2, 1, 9, 13, 3); ctx.fill(); ctx.stroke();                       // grip
  if (key === 'mg') { rrect(L * 0.42, 4, 8, 14, 2); ctx.fill(); ctx.stroke(); }                  // magazine
  ctx.fillStyle = '#3a4250'; rrect(L - 8, -4, 14, 8, 2); ctx.fill(); ctx.stroke();              // barrel
  if (key === 'shotgun') { rrect(L - 8, 2, 14, 6, 2); ctx.fill(); ctx.stroke(); }
  ctx.fillStyle = w.body; rrect(-4, -7, L, 14, 6); ctx.fill(); ctx.stroke();                    // body
  ctx.fillStyle = 'rgba(255,255,255,0.4)'; rrect(0, -5, L - 12, 3, 1.5); ctx.fill();
  ctx.fillStyle = w.acc; ctx.fillRect(L * 0.25, -2, L * 0.3, 4);                                 // accent stripe
  if (key === 'rocket') { ctx.fillStyle = w.acc; rrect(L - 2, -9, 10, 18, 4); ctx.fill(); ctx.stroke(); }
  if (key === 'laser') { ctx.fillStyle = w.acc; ctx.beginPath(); ctx.arc(L * 0.6, 0, 4, 0, TAU); ctx.fill(); }
  ctx.restore();
}
function heroPose(o, moving, air, hurt) {
  if (hurt) return 'hit';
  if (air) return 'jump';
  if (moving) return Math.floor(o.animT * 9) % 2 ? 'walk_a' : 'walk_b';
  return 'idle';
}
function drawBoard(x, y, t) {
  ctx.save(); ctx.translate(x, y);
  ctx.globalCompositeOperation = 'lighter';
  sprT('fx_glow', '#4ad7ff', 0, 4, 0.9, 0.5, 0.5, false, 0, 1.6, 0.5);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#2d8cf0'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  rrect(-34, -6, 68, 12, 6); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffcf3a'; ctx.fillRect(-20, -3, 40, 3);
  ctx.restore();
  if (Math.random() < 0.5) part({ k: 'line', x: x + rand(-20, 20), y: y + 8, vx: rand(-30, 30), vy: rand(80, 160), life: 0.15, max: 0.15, col: '#7fe3ff' });
}
function drawCage(cg, t) {
  const x = cg.x + (cg.hitT > 0 ? rand(-3, 3) : 0), y = cg.y, w = 92, h = 112;
  if (cg.freed) return;
  spr(`ch_${cg.color}_${Math.floor(t * 2 + x) % 4 === 0 ? 'hit' : 'idle'}`, x, y - 2, 0.62, 0.5, 1, Math.sin(t + x) < 0);
  ctx.lineWidth = 3; ctx.strokeStyle = INK;
  ctx.fillStyle = '#8a93a6';
  for (let i = 0; i < 6; i++) { const bx = x - w / 2 + 6 + i * (w - 18) / 5; rrect(bx, y - h + 8, 6, h - 14, 3); ctx.fill(); ctx.stroke(); }
  ctx.fillStyle = '#5d6680'; rrect(x - w / 2, y - h, w, 16, 6); ctx.fill(); ctx.stroke(); rrect(x - w / 2, y - 12, w, 12, 5); ctx.fill(); ctx.stroke();
  spr('p_lock_yellow', x, y - h / 2 + 6, 0.42);
  // help bubble / rescue ring
  if (cg.hp < cg.maxHp) {
    ctx.fillStyle = INK; rrect(x - 36, y - h - 26, 72, 12, 6); ctx.fill();
    ctx.fillStyle = '#ffcf3a'; rrect(x - 33, y - h - 23, 66 * Math.max(0, cg.hp / cg.maxHp), 6, 3); ctx.fill();
  } else {
    const by = y - h - 30 + Math.sin(t * 4) * 4;
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
    rrect(x - 44, by - 18, 88, 32, 12); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 6, by + 13); ctx.lineTo(x, by + 24); ctx.lineTo(x + 6, by + 13); ctx.fill();
    ctx.fillStyle = '#ec3b4f'; ctx.font = FONT(18); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('YARDIM!', x, by - 1);
  }
}
function drawEnemy(e, t) {
  const d = e.def, sc = d.sc || 1;
  let fi = Math.floor(e.animT * (d.kind === 'flyer' ? 14 : 7)) % 2;
  let f = d.f[fi];
  if (d.kind === 'hopper') f = e.onGround ? d.f[0] : d.f[1];
  if (d.kind === 'shooter') f = e.atk > 0 ? d.f[1 + (Math.floor(e.animT * 10) % 2)] : d.f[0];
  f = 'en_' + f;
  const pop = e.age < 0.25 ? 0.4 + e.age / 0.25 * 0.6 : 1;
  const sx = (1 + e.sq) * pop, sy = (1 - e.sq * 0.8) * pop;
  const rot = d.kind === 'hazard' ? e.animT * 8 * -e.face : 0;
  ctx.fillStyle = 'rgba(20,30,40,0.22)'; ctx.beginPath(); ctx.ellipse(e.x, d.kind === 'flyer' ? e.y + 40 : e.y, e.w * 0.45, 6, 0, 0, TAU); ctx.fill();
  if (d.kind === 'hazard') spr(f, e.x, e.y - 32 * sc, sc, 0.5, 0.5, false, rot);
  else spr(f, e.x, e.y + 2, sc, 0.5, 1, e.face > 0, 0, sx, sy);
  if (e.flash > 0) { ctx.globalAlpha = Math.min(1, e.flash / 0.1) * 0.9; sprT(f, '#ffffff', e.x, e.y + 2, sc, 0.5, 1, e.face > 0, 0, sx, sy); ctx.globalAlpha = 1; }
  if (e.maxHp >= 60 && e.hp < e.maxHp && d.kind !== 'hazard') {
    const w = 46, yy = e.y - e.h - 16;
    ctx.fillStyle = INK; rrect(e.x - w / 2 - 2, yy - 2, w + 4, 9, 4); ctx.fill();
    ctx.fillStyle = '#ff4d63'; rrect(e.x - w / 2, yy, w * Math.max(0, e.hp / e.maxHp), 5, 2.5); ctx.fill();
  }
}
function drawBoss(b, t) {
  const sc = 1, jit = b.st === 'charge' && b.t > 0 ? b.jit || 0 : 0;
  const breathe = Math.sin(t * 3) * 0.025;
  const sx = 1 + b.sq + breathe, sy = 1 - b.sq * 0.7 - breathe;
  ctx.fillStyle = 'rgba(20,30,40,0.25)'; ctx.beginPath(); ctx.ellipse(b.x, b.y, 100, 14, 0, 0, TAU); ctx.fill();
  if (b.st === 'charge' && b.t > 0) { ctx.globalCompositeOperation = 'lighter'; sprT('fx_glow', '#ff3b3b', b.x, b.y - 110, 4, 0.5, 0.5); ctx.globalCompositeOperation = 'source-over'; }
  spr('boss_' + b.key, b.x + jit, b.y + 4, sc, 0.5, 1, b.face > 0, Math.sin(t * 2) * 0.03, sx, sy);
  if (b.flash > 0) { ctx.globalAlpha = 0.35; sprT('boss_' + b.key, '#ffffff', b.x + jit, b.y + 4, sc, 0.5, 1, b.face > 0, Math.sin(t * 2) * 0.03, sx, sy); ctx.globalAlpha = 1; }
}
function drawPlayerChar(color, x, y, pose, flip, sx, sy, alpha = 1) {
  if (alpha < 1) ctx.globalAlpha = alpha;
  spr(`ch_${color}_${pose}`, x, y + 2, CH_SC, 0.5, 1, flip, 0, sx, sy);
  ctx.globalAlpha = 1;
}
function render(now) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (!G || !atlasImg.naturalWidth) { ctx.fillStyle = INK; ctx.fillRect(0, 0, cv.width, cv.height); return; }
  const L = G.L, p = G.p, t = G.t;
  const sxk = G.shake ? rand(-G.shake, G.shake) : 0, syk = G.shake ? rand(-G.shake, G.shake) : 0;
  const camx = G.cam.x + G.kick * 0.3, camy = G.cam.y;
  drawBackdrop(L.WD, camx, camy, t);
  ctx.setTransform(SC, 0, 0, SC, -camx * SC + sxk * DPR, -camy * SC + syk * DPR);
  const x0 = camx - 80, x1 = camx + VW + 80, y0 = camy - 40;
  // decor behind
  for (const d of L.decor) {
    if (d.x < x0 || d.x > x1) continue;
    let f = d.f;
    if (f === 'p_torch_on_a') { f = Math.floor(t * 8 + d.x) % 2 ? 'p_torch_on_a' : 'p_torch_on_b'; ctx.globalCompositeOperation = 'lighter'; sprT('fx_glow', '#ff9a3b', d.x, d.y - 40, 2.4 + Math.sin(t * 9 + d.x) * 0.15); ctx.globalCompositeOperation = 'source-over'; }
    spr(f, d.x, d.y + 2, 1, 0.5, 1, d.flip, f === 'p_grass' || f === 'p_grass_purple' ? Math.sin(t * 2 + d.x) * 0.05 : 0);
  }
  if (L.cp) spr(L.cp.on ? (Math.floor(t * 6) % 2 ? 'p_flag_red_a' : 'p_flag_red_b') : 'p_flag_off', L.cp.x, L.cp.y + 2, 1.4, 0.5, 1);
  drawTerrain(x0, x1, y0, camy + VH + 10);
  for (const s of L.spikes) for (let x = s.x; x < s.x + s.w; x += T) spr('p_spikes', x + T / 2, s.y + 2, 1, 0.5, 1);
  for (const s of L.springs) spr(s.t > 0 ? 'p_spring_out' : 'p_spring', s.x, s.y + 2, 1, 0.5, 1);
  for (const o of L.crates) {
    const jx = o.hitT > 0 ? rand(-3, 3) : 0; if (o.hitT > 0) o.hitT -= 1 / 60;
    spr(o.kind === 'gift' ? 'p_block_exclamation' : o.kind === 'coin' ? 'p_block_coin' : 'p_block_planks', o.c * T + T / 2 + jx, o.r * T + T / 2, 1);
    if (o.kind === 'gift') { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35 + Math.sin(t * 5) * 0.15; sprT('fx_glow', '#ffcf3a', o.c * T + T / 2, o.r * T + T / 2, 1.6); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
  }
  // flag
  if (!L.flagHidden && !L.demo) {
    spr(Math.floor(t * 6) % 2 ? 'p_flag_green_a' : 'p_flag_green_b', L.flagX, L.flagY + 2, 1.8, 0.35, 1);
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5; sprT('fx_light', '#fff3a8', L.flagX, L.flagY - 70, 1.4); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  // level coins
  for (const c of L.coins) {
    if (c.taken || c.x < x0 || c.x > x1) continue;
    const s = Math.abs(Math.cos(t * 4 + c.x * 0.01));
    spr(s > 0.3 ? 'p_coin_gold' : 'p_coin_gold_side', c.x, c.y + Math.sin(t * 3 + c.x) * 3, 0.62, 0.5, 0.5, false, 0, Math.max(0.25, s), 1);
  }
  for (const cg of L.cages) if (cg.x > x0 - 100 && cg.x < x1 + 100) drawCage(cg, t);
  // pickups
  for (const o of G.pick) {
    const bob = o.fly ? 0 : Math.sin(t * 5 + o.ph) * 3;
    if (o.kind === 'coin') { const s = Math.abs(Math.cos(t * 6 + o.ph)); spr(s > 0.3 ? 'p_coin_gold' : 'p_coin_gold_side', o.x, o.y + bob, 0.55, 0.5, 0.5, false, 0, Math.max(0.25, s), 1); }
    else if (o.kind === 'heart') spr('p_heart', o.x, o.y + bob, 0.7);
    else if (o.kind === 'nade') spr('p_bomb', o.x, o.y + bob, 0.6);
    else {
      ctx.globalCompositeOperation = 'lighter'; sprT('fx_glow', o.kind === 'board' ? '#4ad7ff' : '#ffcf3a', o.x, o.y + bob, 1.4 + Math.sin(t * 6) * 0.1); ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(o.x, o.y + bob, 26, 0, TAU); ctx.fill(); ctx.stroke();
      if (o.kind === 'weapon') drawGun(o.w, o.x - 14, o.y + bob + 2, 0, 0, 0.75); else drawBoard(o.x, o.y + bob + 4, t);
    }
  }
  // enemies, boss
  for (const e of G.en) if (e.x > x0 - 60 && e.x < x1 + 60) drawEnemy(e, t);
  if (G.boss) drawBoss(G.boss, t);
  // particles that sit behind characters
  for (const q of G.parts) if (q.k === 'ghost') { ctx.globalAlpha = q.life / q.max * 0.5; sprT(q.f, '#9fe1ff', q.x, q.y + 2, CH_SC, 0.5, 1, q.flip); ctx.globalAlpha = 1; }
  else if (q.k === 'corpse') { ctx.globalAlpha = Math.min(1, q.life / q.max * 2); spr(q.f, q.x, q.y + 2, 1, 0.5, 1, q.flip); ctx.globalAlpha = 1; }
  // squad
  for (const m of G.squad) {
    drawPlayerChar(m.color, m.x, m.y, heroPose(m, m.moving, m.air, false), m.face < 0, 1, 1);
    const a = m.ang;
    drawGun('blaster', m.x + Math.cos(a) * 8, m.y - 34 + Math.sin(a) * 4, a, Math.max(0, m.recoil), 0.8);
  }
  // player
  {
    const hurt = p.inv > 0.75 && !p.dashT, blink = p.inv > 0 && p.inv < 0.75 && Math.floor(t * 18) % 2 === 0;
    const pose = G.mode === 'dead' ? 'hit' : G.mode === 'clear' ? (p.onGround ? 'front' : 'jump') : p.dashT > 0 ? 'jump' : heroPose(p, Math.abs(p.vx) > 40, !p.onGround, hurt);
    const sx = 1 + p.sq * 0.8, sy = 1 - p.sq;
    if (p.board) drawBoard(p.x, p.y - 2, t);
    if (!blink) {
      drawPlayerChar(p.color, p.x, p.y - (p.board ? 10 : 0), pose, p.face < 0, sx, sy);
      if (G.mode === 'play' || G.mode === 'clear') {
        const gp = gunPose(p), key = p.cur === 'special' && p.special ? p.special : 'blaster';
        drawGun(key, gp.hx, gp.hy - (p.board ? 10 : 0), gp.ang, p.recoil);
        if (p.muzzleT > 0) {
          const L2 = WPN[key].len + 10, mx = gp.hx + Math.cos(gp.ang) * L2, my = gp.hy - (p.board ? 10 : 0) + Math.sin(gp.ang) * L2;
          ctx.globalCompositeOperation = 'lighter';
          sprT('fx_glow', '#ffcf3a', mx, my, 1.3);
          sprT('fx_muzzle', '#ffe066', mx + Math.cos(gp.ang) * 10, my + Math.sin(gp.ang) * 10, 0.55, 0.5, 0.5, false, gp.ang + Math.PI / 2);
          ctx.globalCompositeOperation = 'source-over';
          spr('fx_burst', mx, my, 0.45, 0.5, 0.5, false, rand(0, TAU));
        }
      }
    }
  }
  // grenades
  for (const n of G.nades) { spr(n.fuse < 0.5 && Math.floor(t * 16) % 2 ? 'p_bomb_active' : 'p_bomb', n.x, n.y - 10, 0.55, 0.5, 0.5, false, n.rot); }
  // bullets
  ctx.lineCap = 'round';
  for (const b of G.bul) {
    if (b.key === 'rocket') {
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.ang);
      ctx.globalCompositeOperation = 'lighter'; sprT('fx_glow', '#ff9a3b', -18, 0, 0.9); ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#e8edf5'; ctx.strokeStyle = INK; ctx.lineWidth = 3; rrect(-14, -6, 28, 12, 6); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ec3b4f'; ctx.beginPath(); ctx.moveTo(14, -6); ctx.lineTo(24, 0); ctx.lineTo(14, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore(); continue;
    }
    const tl = b.key === 'laser' ? 0.05 : 0.022;
    const tx = b.x - b.vx * tl, ty = b.y - b.vy * tl;
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = b.tracer; ctx.globalAlpha = 0.45; ctx.lineWidth = b.key === 'laser' ? 14 : b.team ? 7 : 10;
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.globalAlpha = 1; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = b.key === 'laser' ? 5 : b.team ? 3 : 4;
    ctx.beginPath(); ctx.moveTo(tx + (b.x - tx) * 0.4, ty + (b.y - ty) * 0.4); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }
  for (const b of G.ebul) {
    if (b.k === 'wave') { ctx.globalAlpha = 0.9; sprT('fx_puff_2', '#ffffff', b.x, b.y - 22, 0.55, 0.5, 0.5, false, t * 8); ctx.globalAlpha = 1;
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(b.x, b.y, 30, Math.PI * (b.vx > 0 ? 1.5 : 1), Math.PI * (b.vx > 0 ? 2 : 1.5)); ctx.stroke(); continue; }
    ctx.fillStyle = b.col; ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.35, b.r * 0.3, 0, TAU); ctx.fill();
  }
  // particles
  for (const q of G.parts) {
    const a = Math.max(0, q.life / q.max);
    switch (q.k) {
      case 'puff': ctx.globalAlpha = a * 0.9; sprT(`fx_puff_${Math.floor((1 - a) * 5.99)}`, q.col, q.x, q.y, q.s * (1.2 - a * 0.4), 0.5, 0.5, false, q.rot); ctx.globalAlpha = 1; break;
      case 'line': ctx.strokeStyle = q.col; ctx.globalAlpha = a; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - q.vx * 0.04, q.y - q.vy * 0.04); ctx.stroke(); ctx.globalAlpha = 1; break;
      case 'chunk': ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.globalAlpha = Math.min(1, a * 2); ctx.fillStyle = q.col; ctx.strokeStyle = INK; ctx.lineWidth = 2; rrect(-q.r / 2, -q.r / 2, q.r, q.r, 2); ctx.fill(); ctx.stroke(); ctx.restore(); ctx.globalAlpha = 1; break;
      case 'plank': ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.globalAlpha = Math.min(1, a * 2); ctx.fillStyle = q.col; ctx.strokeStyle = INK; ctx.lineWidth = 2; rrect(-q.w / 2, -q.h / 2, q.w, q.h, 2); ctx.fill(); ctx.stroke(); ctx.restore(); ctx.globalAlpha = 1; break;
      case 'casing': ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.globalAlpha = Math.min(1, a * 2); ctx.fillStyle = '#ffcf3a'; ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.fillRect(-4, -2, 8, 4); ctx.strokeRect(-4, -2, 8, 4); ctx.restore(); ctx.globalAlpha = 1; break;
      case 'spark': ctx.globalCompositeOperation = 'lighter'; sprT('fx_spark', q.col, q.x, q.y, q.s * (0.6 + a), 0.5, 0.5, false, q.rot); ctx.globalCompositeOperation = 'source-over'; break;
      case 'glow': ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a; sprT('fx_glow', q.col, q.x, q.y, q.s); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; break;
      case 'ring': ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a; sprT('fx_ring', q.col, q.x, q.y, q.s + (q.S - q.s) * (1 - a)); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; break;
      case 'expl': spr(`fx_expl_${Math.min(8, Math.floor((1 - a) * 9))}`, q.x, q.y, q.s, 0.5, 0.5, false, q.rot); break;
    }
  }
  // floating numbers
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  for (const tx of G.txt) {
    const age = tx.max - tx.life, pop = age < 0.1 ? 1.5 - age * 5 : 1;
    ctx.globalAlpha = Math.min(1, tx.life * 4);
    ctx.font = FONT(Math.round((tx.crit ? 30 : tx.col ? 26 : 22) * pop));
    ctx.lineWidth = 6; ctx.strokeStyle = INK;
    const s = tx.crit ? tx.v + '!' : String(tx.v);
    ctx.strokeText(s, tx.x, tx.y);
    ctx.fillStyle = tx.col || (tx.crit ? '#ffcf3a' : '#ffffff');
    ctx.fillText(s, tx.x, tx.y);
  }
  ctx.globalAlpha = 1;
  // lock zone edge markers
  if (G.lock && G.mode === 'play') {
    for (const ex of [G.lock.x0 + 14, G.lock.x0 + VW - 14]) {
      ctx.fillStyle = `rgba(236,59,79,${0.35 + Math.sin(t * 8) * 0.15})`;
      ctx.fillRect(ex - 5, camy, 10, VH);
    }
  }
  // ---- screen space
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawAmbient(L.WD, t);
  if (vignette) ctx.drawImage(vignette, 0, 0, cv.width, cv.height);
  if (G.hurtFlash > 0 || (p.hp / p.maxHp < 0.3 && G.mode === 'play' && !G.demo)) {
    const k = Math.max(G.hurtFlash || 0, p.hp / p.maxHp < 0.3 ? 0.35 + Math.sin(t * 6) * 0.12 : 0);
    const g = ctx.createRadialGradient(cv.width / 2, cv.height / 2, Math.min(cv.width, cv.height) * 0.35, cv.width / 2, cv.height / 2, Math.max(cv.width, cv.height) * 0.7);
    g.addColorStop(0, 'rgba(255,40,60,0)'); g.addColorStop(1, `rgba(255,40,60,${k})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, cv.width, cv.height);
  }
  if (G.flash > 0) { ctx.fillStyle = `rgba(255,250,230,${G.flash * 0.6})`; ctx.fillRect(0, 0, cv.width, cv.height); }
  drawWipe(now);
}
function drawAmbient(WD, t) {
  const A = G.ambient, kind = WD.ambient, cw = cv.width, ch = cv.height;
  if (A.length < 36) A.push({ x: Math.random(), y: Math.random(), s: rand(0.5, 1.4), ph: rand(0, TAU) });
  const col = { pollen: '255,240,170', spores: '255,190,120', dust: '255,225,170', snow: '255,255,255', embers: '255,150,70' }[kind];
  ctx.fillStyle = `rgba(${col},0.75)`;
  for (const a of A) {
    if (kind === 'snow') { a.y += 0.0015 * a.s; a.x += Math.sin(t + a.ph) * 0.0006; }
    else if (kind === 'embers' || kind === 'spores') { a.y -= 0.0009 * a.s; a.x += Math.sin(t * 1.5 + a.ph) * 0.0005; }
    else if (kind === 'dust') { a.x -= 0.0016 * a.s; a.y += Math.sin(t + a.ph) * 0.0003; }
    else { a.x += Math.sin(t * 0.7 + a.ph) * 0.0004; a.y += Math.cos(t * 0.6 + a.ph) * 0.0003; }
    a.x = (a.x + 1) % 1; a.y = (a.y + 1) % 1;
    const px = ((a.x - G.cam.x * SC / cw * 0.25 * a.s) % 1 + 1) % 1;
    ctx.beginPath(); ctx.arc(px * cw, a.y * ch, (kind === 'snow' ? 3 : 2) * a.s * DPR, 0, TAU); ctx.fill();
  }
}
function drawWipe() {
  const w = G.wipe; if (!w) return;
  if (w.dir === 0) return;
  w.t += 1 / 60;
  const k = clamp(w.t / 0.55, 0, 1), e = k * k * (3 - 2 * k);
  const maxR = Math.hypot(cv.width, cv.height);
  const r = w.dir > 0 ? e * maxR : (1 - e) * maxR;
  const px = (G.p.x - G.cam.x) * SC, py = (G.p.y - 40 - G.cam.y) * SC;
  ctx.fillStyle = INK; ctx.beginPath(); ctx.rect(0, 0, cv.width, cv.height); ctx.arc(px, py, Math.max(0.1, r), 0, TAU, true); ctx.fill();
  if (k >= 1) { const cb = w.cb; w.dir = 0; w.cb = null; if (cb) cb(); }
}

// ================================================================ HUD
const hudEl = { hp: $('hpFill'), hpT: $('hpTxt'), team: $('teamTxt'), board: $('boardTag'), coin: $('coinTxt'), fill: $('trackFill'), me: $('trackMe'), boss: $('bossFill') };
let hudKey = '';
function updateHud() {
  if (!G || G.demo || state === 'menu') return;
  const p = G.p, L = G.L;
  const prog = clamp(p.x / Math.max(1, L.flagX), 0, 1);
  const key = [Math.ceil(p.hp), p.maxHp, G.squad.length, p.board, G.coins, Math.round(prog * 200), G.boss ? Math.ceil(G.boss.hp) : -1, p.ammo, p.special].join('|');
  if (key === hudKey) return; hudKey = key;
  hudEl.hp.style.width = (p.hp / p.maxHp * 100) + '%';
  hudEl.hpT.textContent = Math.ceil(p.hp) + ' / ' + p.maxHp;
  hudEl.team.textContent = G.squad.length;
  hudEl.board.classList.toggle('hidden', !p.board);
  hudEl.coin.textContent = G.coins;
  hudEl.fill.style.width = (prog * 100) + '%'; hudEl.me.style.left = (prog * 100) + '%';
  if (G.boss) hudEl.boss.style.width = (G.boss.hp / G.boss.maxHp * 100) + '%';
  updateSwapIcon();
  document.querySelectorAll('#trackIcons img').forEach((im, i) => { const cg = L.cages[i]; if (cg) im.classList.toggle('done', cg.freed); });
}
function setupHud() {
  const L = G.L;
  $('stageLbl').textContent = stageLabel(L.g) + ' · ' + L.WD.name;
  $('hudHelmet').src = $('trackMe').src = `assets/ui/helmet_${G.p.color}.png`;
  const ti = $('trackIcons'); ti.innerHTML = '';
  L.cages.forEach(cg => { const im = document.createElement('img'); im.src = 'assets/ui/chain.png'; im.style.left = (cg.x / L.flagX * 100) + '%'; ti.appendChild(im); });
  const fl = document.createElement('img'); fl.src = L.boss ? `assets/ui/boss_${L.WD.boss}.png` : 'assets/ui/flag_green_a.png'; fl.style.left = '100%'; fl.style.width = '28px'; ti.appendChild(fl);
  $('bossBox').classList.add('hidden'); $('track').classList.remove('hidden'); $('stageLbl').classList.remove('hidden');
  hudKey = ''; updateSwapIcon();
}
function updateSwapIcon() {
  const p = G && G.p, tag = $('wpnTag');
  if (!tag) return;
  tag.classList.toggle('hidden', !(p && p.special));
  if (p && p.special) $('wpnTxt').textContent = WPN[p.special].name + ' ' + p.ammo;
}

// ================================================================ screens & UI
const SCREENS = ['menu', 'map', 'stagePop', 'heroes', 'shop', 'pause', 'revive', 'result', 'loading'];
let curScreen = 'loading';
function show(id) {
  curScreen = id;
  for (const s of SCREENS) $(s).classList.toggle('hidden', s !== id);
  document.querySelectorAll('.coinTotal').forEach(e => { e.textContent = save.coins; });
  document.querySelectorAll('.starTotal2').forEach(e => { e.textContent = totalStars(); });
  if (id === 'menu') renderMenu();
  if (id === 'map') renderMap();
  if (id === 'heroes') renderHeroes();
  if (id === 'shop') renderShop();
}
function el(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; }
const starImgs = (n, cls = '') => [0, 1, 2].map(i => `<img src="assets/ui/star.png" class="${i < n ? '' : 'off'} ${cls}" alt="">`).join('');
const nextStage = () => Math.min(save.unlocked, TOTAL_STAGES - 1);
function renderMenu() {
  $('playStage').textContent = 'BÖLÜM ' + stageLabel(nextStage());
  $('starTotal').textContent = totalStars();
  $('soundIco').src = 'assets/ui/' + (save.sound ? 'ic_sound_on' : 'ic_sound_off') + '.png';
}
// world art for HTML: transparent-sky hills over the world's own sky gradient (+ tint for snow / cave worlds)
const worldBg = WD => `${WD.tint ? `linear-gradient(${WD.tint[0]}99,${WD.tint[0]}99),` : ''}url(assets/ui/bg_${WD.bgColor}.png),linear-gradient(${WD.sky[0]},${WD.sky[1]})`;
const NODE_POS = [[13, 66], [31, 40], [50, 64], [68, 38], [86, 56]];
function renderMap() {
  const box = $('mapScroll'); box.innerHTML = '';
  let curNode = null;
  WORLDS.forEach((WD, wi) => {
    const locked = wi * 5 > save.unlocked;
    const ws = [0, 1, 2, 3, 4].reduce((a, s) => a + (save.stars[wi * 5 + s] || 0), 0);
    const sec = el(`<div class="world ${locked ? 'locked' : ''}" style="background-image:${worldBg(WD)}">
      <div class="world-title">${wi + 1}. ${WD.name}<small>${ws} / 15 yıldız</small></div>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points="${NODE_POS.map(p => p.join(',')).join(' ')}" fill="none" stroke="#1b2033" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
      <polyline points="${NODE_POS.map(p => p.join(',')).join(' ')}" fill="none" stroke="#fff" stroke-width="4" stroke-dasharray="10 10" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg></div>`);
    NODE_POS.forEach(([x, y], si) => {
      const g = wi * 5 + si, isBoss = si === 4, open = g <= save.unlocked, st = save.stars[g] || 0, cur = g === nextStage() && open;
      const n = el(`<button class="node ${isBoss ? 'boss' : ''} ${open ? '' : 'locked'} ${cur ? 'cur' : ''}" style="left:${x}%;top:${y}%">
        ${isBoss ? `<img class="bface" src="assets/ui/boss_${WD.boss}.png" alt="">` : open ? `<span>${si + 1}</span>` : '<img class="lock" src="assets/ui/ic_lock.png" alt="">'}
        ${open && st ? `<div class="nstars">${starImgs(st)}</div>` : ''}
        ${cur ? `<img class="me" src="assets/ui/helmet_${save.hero}.png" alt="">` : ''}</button>`);
      n.onclick = () => { sfx('click'); if (open) openStagePop(g); else toastMenu('Önce önceki bölümü bitir'); };
      if (cur) curNode = n;
      sec.appendChild(n);
    });
    box.appendChild(sec);
  });
  requestAnimationFrame(() => { if (curNode) box.scrollLeft = Math.max(0, curNode.parentNode.offsetLeft + curNode.offsetLeft - box.clientWidth / 2); });
}
function toastMenu(t) { toast(t); }
let popStage = 0;
function openStagePop(g) {
  popStage = g;
  const WD = WORLDS[Math.floor(g / 5)], boss = g % 5 === 4;
  $('spTitle').textContent = 'BÖLÜM ' + stageLabel(g);
  $('spName').textContent = WD.name + (boss ? ' · BOSS' : '');
  $('spStars').innerHTML = starImgs(save.stars[g] || 0);
  $('spScene').style.backgroundImage = worldBg(WD);
  const bi = $('spBoss'); bi.classList.toggle('hidden', false); bi.src = boss ? `assets/ui/boss_${WD.boss}.png` : `assets/ui/hero_${save.hero}.png`;
  const L = genLevel(g);
  $('spCages').textContent = L.cages.length + ' esiri kurtar';
  show('stagePop');
}
$('spGo').onclick = () => { sfx('click'); startStage(popStage); };
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => { sfx('click'); show('map'); }));
document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => { audioInit(); sfx('click'); show(b.dataset.go); }));
$('playBtn').onclick = () => { audioInit(); sfx('click'); startStage(nextStage()); };
$('soundBtn').onclick = () => { audioInit(); save.sound = !save.sound; persist(); renderMenu(); sfx('click'); };

let heroSel = save.hero;
function renderHeroes() {
  const grid = $('heroGrid'); grid.innerHTML = '';
  Object.keys(HEROES).forEach(k => {
    const h = HEROES[k], owned = !!save.heroes[k];
    const t = el(`<button class="htile ${k === heroSel ? 'sel' : ''} ${owned ? '' : 'locked'}"><img src="assets/ui/hero_${k}.png" alt="">
      ${owned ? (save.hero === k ? '<span class="using">SEÇİLİ</span>' : '') : `<span class="price"><img src="assets/ui/coin_gold.png" alt="">${h.cost}</span>`}</button>`);
    t.onclick = () => { sfx('click'); heroSel = k; renderHeroes(); };
    grid.appendChild(t);
  });
  const h = HEROES[heroSel], owned = !!save.heroes[heroSel];
  $('hvImg').src = `assets/ui/hero_${heroSel}.png`;
  $('hvName').textContent = h.name;
  $('hvPerk').textContent = h.perk;
  $('hvHp').style.width = (h.hp / 130 * 100) + '%';
  $('hvSpd').style.width = (h.spd / 1.2 * 100) + '%';
  $('hvDmg').style.width = (h.dmg / 1.4 * 100) + '%';
  const b = $('hvBtn');
  b.className = 'btn ' + (save.hero === heroSel ? 'grey' : owned ? 'green' : 'yellow');
  b.innerHTML = save.hero === heroSel ? 'SEÇİLİ' : owned ? 'SEÇ' : `<img src="assets/ui/coin_gold.png" alt="">${h.cost}`;
  b.classList.toggle('off', save.hero === heroSel || (!owned && save.coins < h.cost));
  b.onclick = () => {
    if (!owned) { if (save.coins < h.cost) return; save.coins -= h.cost; save.heroes[heroSel] = true; sfx('pickup'); }
    else sfx('click');
    save.hero = heroSel; persist(); show('heroes');
    if (G && G.demo) startDemo();
  };
}
function renderShop() {
  const grid = $('shopGrid'); grid.innerHTML = '';
  for (const u of UPG) {
    const lv = upLv(u.id), maxed = lv >= u.max, cost = upCost(u, lv);
    let pipsH = '<div class="pips">'; for (let i = 0; i < u.max; i++) pipsH += `<i class="${i < lv ? 'on' : ''}"></i>`; pipsH += '</div>';
    const card = el(`<div class="ucard"><div class="top"><div class="badge-ic" style="background:${u.bg}"><img src="assets/ui/${u.icon === 'heart' || u.icon === 'bomb' ? u.icon : u.icon}.png" alt=""></div>
      <div><h4>${u.name}</h4><p>${u.desc} · Sv ${lv}/${u.max}</p></div></div>${pipsH}
      <button class="btn ${maxed ? 'grey' : 'yellow'}">${maxed ? 'MAKS' : `<img src="assets/ui/coin_gold.png" alt="">${cost}`}</button></div>`);
    const b = card.querySelector('button');
    if (maxed || save.coins < cost) b.classList.add('off');
    b.onclick = () => { if (maxed || save.coins < cost) return; save.coins -= cost; save.up[u.id] = lv + 1; persist(); sfx('pickup'); show('shop'); };
    grid.appendChild(card);
  }
}

// ---------------- game flow
function tryFullscreen() {
  try {
    if (!matchMedia('(pointer:coarse)').matches || document.fullscreenElement) return;
    const de = document.documentElement;
    const r = de.requestFullscreen ? de.requestFullscreen({ navigationUI: 'hide' }) : null;
    if (r && r.then) r.catch(() => {});
  } catch (e) { /* not allowed here */ }
}
function startStage(g) {
  audioInit(); tryFullscreen();
  G = newGame(genLevel(g)); G.demo = false;
  G.cam.x = 0; G.cam.y = G.p.y - VH * 0.62;
  const hint = $('tapHint'); hint.classList.remove('gone');
  state = 'play'; show(null);
  $('hud').classList.remove('hidden');
  setupHud();
  G.wipe = { dir: 1, t: 0 };
  banner(stageLabel(g), G.L.WD.name + (G.L.boss ? ' · BOSS' : ''));
  for (const k in input) input[k] = false;
  requestAnimationFrame(layoutControls);
}
function startDemo() {
  const g = clamp(save.unlocked, 0, TOTAL_STAGES - 1);
  G = newGame(genLevel(Math.floor(g / 5) * 5, true)); G.demo = true;
  ['green', 'pink'].filter(c => c !== save.hero).slice(0, 2).forEach((c, i) => G.squad.push({ color: c, x: G.p.x - 60 * (i + 1), y: G.p.y, face: 1, fireT: 1, animT: 0, recoil: 0, ang: 0, join: 0 }));
  G.wipe = { dir: 0 }; G.cam.y = G.p.y - VH * (H > W ? 0.56 : 0.62);
  $('hud').classList.add('hidden');
}
function pauseGame() { if (state !== 'play' || G.mode !== 'play') return; state = 'pause'; syncToggles(); show('pause'); }
function resumeGame() { state = 'play'; show(null); last = performance.now(); }
function syncToggles() { $('tSound').classList.toggle('on', save.sound); }
$('pauseBtn').addEventListener('click', e => { e.stopPropagation(); sfx('click'); pauseGame(); });
$('resumeBtn').onclick = () => { sfx('click'); resumeGame(); };
$('restartBtn').onclick = () => { sfx('click'); startStage(G.L.g); };
$('quitBtn').onclick = () => { sfx('click'); toMenu('map'); };
$('tSound').onclick = () => { save.sound = !save.sound; persist(); syncToggles(); sfx('click'); };
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });
function toMenu(screen = 'menu') { state = 'menu'; startDemo(); show(screen); }

let reviveTimer = 0;
function askRevive() {
  if (G.revived || save.coins + G.coins < REVIVE_COST) { showResult(); return; }
  state = 'revive'; show('revive'); reviveTimer = 5; $('revCost').textContent = REVIVE_COST;
}
$('revYes').onclick = () => {
  if (state !== 'revive') return;
  let cost = REVIVE_COST; const fromRun = Math.min(G.coins, cost); G.coins -= fromRun; cost -= fromRun; save.coins -= cost; persist();
  const p = G.p; G.revived = true; G.reviveAsked = false; p.dead = false; p.hp = p.maxHp; p.inv = 2.5;
  p.x = p.safe.x; p.y = p.safe.y - 4; p.vx = 0; p.vy = -300;
  G.mode = 'play'; G.ebul.length = 0;
  for (const e of G.en) if (Math.abs(e.x - p.x) < 300) e.kx = sign(e.x - p.x) * 900;
  explode(p.x, p.y - 40, 160, 60);
  state = 'play'; show(null); sfx('rescue', 0); last = performance.now();
};
$('revNo').onclick = () => { if (state === 'revive') showResult(); };

function showResult() {
  const L = G.L, win = G.mode === 'clear';
  state = 'result';
  $('hud').classList.add('hidden');
  let stars = 0;
  if (win) {
    stars = 1 + (G.rescued >= L.cages.length ? 1 : 0) + (G.p.hp / G.p.maxHp >= 0.5 && G.deaths === 0 ? 1 : 0);
    save.stars[L.g] = Math.max(save.stars[L.g] || 0, stars);
    save.unlocked = Math.max(save.unlocked, Math.min(TOTAL_STAGES - 1, L.g + 1));
  }
  const bonus = win ? 25 + L.g * 6 : 0;
  const earned = G.coins + bonus;
  save.coins += earned; persist();
  const t = $('resTitle'); t.textContent = win ? 'BÖLÜM TAMAM!' : 'YENİLDİN'; t.className = 'ribbon ' + (win ? 'green' : 'red');
  $('resStars').innerHTML = [0, 1, 2].map(i => `<img src="assets/ui/star.png" class="anim ${i < stars ? '' : 'off'}" style="animation-delay:${0.25 + i * 0.25}s" alt="">`).join('');
  $('resCoins').textContent = '+' + earned;
  $('resKills').textContent = G.kills;
  $('resCages').textContent = G.rescued + '/' + L.cages.length;
  const nb = $('resNext');
  nb.classList.toggle('hidden', !win || L.g >= TOTAL_STAGES - 1);
  show('result');
  if (win) [0, 1, 2].forEach(i => { if (i < stars) setTimeout(() => sfx('coin', 0), 300 + i * 250); });
}
$('resNext').onclick = () => { sfx('click'); startStage(Math.min(TOTAL_STAGES - 1, G.L.g + 1)); };
$('resRetry').onclick = () => { sfx('click'); startStage(G.L.g); };
$('resMap').onclick = () => { sfx('click'); toMenu('map'); };

// ================================================================ input: keyboard + multi-touch hit testing
const KEYMAP = { ArrowUp: 'jump', KeyW: 'jump', Space: 'jump', KeyJ: 'jump' };
const keyState = {}, touchState = {};
window.addEventListener('keydown', e => {
  if (KEYMAP[e.code]) { keyState[KEYMAP[e.code]] = true; e.preventDefault(); }
  if (e.code === 'Escape' || e.code === 'KeyP') { if (state === 'play') pauseGame(); else if (state === 'pause') resumeGame(); }
});
window.addEventListener('keyup', e => { if (KEYMAP[e.code]) keyState[KEYMAP[e.code]] = false; });
// one-tap control: touching anywhere (except HUD buttons) is "jump"; holding gives a higher jump
const touches = new Set();
function layoutControls() { /* no on-screen buttons in one-tap mode */ }
window.addEventListener('pointerdown', e => {
  if (state !== 'play' || e.target.closest('button')) return;
  audioInit(); touches.add(e.pointerId); touchState.jump = true;
  const h = $('tapHint'); if (h) h.classList.add('gone');
});
const endTouch = e => { if (touches.delete(e.pointerId)) touchState.jump = touches.size > 0; };
window.addEventListener('pointerup', endTouch);
window.addEventListener('pointercancel', endTouch);
function readInput() {
  prevIn = Object.assign({}, input);
  if (G && G.demo) return;
  for (const k in input) input[k] = !!(keyState[k] || touchState[k]);
}

// ================================================================ loop
let last = performance.now();
function frame(now) {
  const dt = Math.min(1 / 30, (now - last) / 1000); last = now;
  readInput();
  if (G && (state === 'play' || state === 'menu')) update(dt);
  if (state === 'revive') { reviveTimer -= dt; $('revCount').textContent = Math.max(0, Math.ceil(reviveTimer)); $('revCount').style.setProperty('--p', (reviveTimer / 5 * 100) + '%'); if (reviveTimer <= 0) showResult(); }
  const dark = curScreen === 'map' || curScreen === 'heroes' || curScreen === 'shop';
  if (!dark) render(now);
  updateHud();
  requestAnimationFrame(frame);
}
resize();
requestAnimationFrame(frame);
const fontReady = document.fonts && document.fonts.load ? document.fonts.load('800 20px "Baloo 2"').catch(() => {}) : Promise.resolve();
Promise.all([atlasReady, Promise.race([fontReady, new Promise(r => setTimeout(r, 1500))])]).then(() => { toMenu('menu'); });

window.SwarmSquad = { get G() { return G; }, get state() { return state; }, startStage, save, input, genLevel };
})();
