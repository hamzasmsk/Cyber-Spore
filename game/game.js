/* Shuriken Squad — idle ninja-squad shooter for phones (portrait). HTML5 canvas, no dependencies.
   Art, sound and music: "Ninja Adventure" pack by Pixel-boy & AAA (CC0).
   Rendering: the world is drawn into a LOW-RESOLUTION canvas (2 canvas pixels per art pixel) that the browser
   scales up by a whole number with image-rendering:pixelated. That keeps every sprite pixel-perfect and makes
   each frame ~16x cheaper to fill than drawing at full device resolution. */
'use strict';
(() => {

// ================================================================ utilities
const $ = id => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const pick = a => a[Math.floor(Math.random() * a.length)];
const TAU = Math.PI * 2;
const INK = '#131b1b';
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
const ctx = cv.getContext('2d', { alpha: false });
let W = 390, H = 844, DPR = 1, U = 1;
let K = 4, L = 1, P = 2, BW = 0, BH = 0;   // K device px per canvas px, L = CSS px per canvas px, P = CSS px per art px
const F = {};
function resize() {
  DPR = window.devicePixelRatio || 1;
  W = window.innerWidth; H = window.innerHeight;
  U = clamp(Math.min(W, H * 0.56) / 390, 0.8, 1.7);
  K = Math.max(1, Math.round(1.25 * U * DPR)); L = K / DPR; P = 2 * L;
  BW = Math.ceil(W / L); BH = Math.ceil(H / L);
  cv.width = BW; cv.height = BH;
  cv.style.width = BW * L + 'px'; cv.style.height = BH * L + 'px';
  ctx.imageSmoothingEnabled = false;
  F.A = { x: W / 2, y: -60 }; F.B = { x: W / 2, y: H + 60 };
  const dx = F.A.x - F.B.x, dy = F.A.y - F.B.y, Ln = Math.hypot(dx, dy);
  F.dir = { x: dx / Ln, y: dy / Ln }; F.perp = { x: -F.dir.y, y: F.dir.x }; F.len = Ln;
  F.pathW = Math.min(W * 0.66, 290 * U);
  F.S = { x: lerp(F.B.x, F.A.x, 0.36), y: lerp(F.B.y, F.A.y, 0.36) };
  const r = $('money').parentNode.getBoundingClientRect();
  F.wallet = { x: r.left + 16, y: r.top + r.height / 2 };
  chunks.clear();
  if (atlasImg.naturalWidth) setupHeroes();
}
window.addEventListener('resize', resize);
const along = (p, a, b) => ({ x: p.x + F.dir.x * a + F.perp.x * b, y: p.y + F.dir.y * a + F.perp.y * b });
function heroBox() { const y0 = 140 + 92 * U, y1 = Math.max(y0 + 60, H - 165); return { x0: 34 * U, x1: W - 34 * U, y0, y1 }; }
function enemyBox() { return { x0: 74 * U, x1: W - 74 * U, y0: 150 + 40 * U, y1: Math.max(300, H - 190) }; }
let sideRects = [], sideT = 0;
function avoidSides(p, half) {
  for (const r of sideRects) {
    if (p.y < r.top || p.y - 60 * U > r.bottom) continue;
    if (r.left < W / 2) p.x = Math.max(p.x, r.right + half); else p.x = Math.min(p.x, r.left - half);
  }
  return p;
}
const clampBox = (p, b) => ({ x: clamp(p.x, b.x0, b.x1), y: clamp(p.y, b.y0, b.y1) });
const STAND = 240;

// ================================================================ atlas (pixel-perfect drawing)
const AF = window.ATLAS.frames, AN = window.ATLAS.anim;
const atlasImg = new Image();
const atlasReady = new Promise(r => { atlasImg.onload = r; atlasImg.onerror = r; });
atlasImg.src = 'assets/atlas.png';
const snap = v => Math.round(v / L) * L;
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
// draw frame `name` at (x, y) in CSS px; sc = art scale (multiples of 0.5 stay pixel-perfect)
function spr(name, x, y, sc = 1, ax = 0.5, ay = 1, flip = false, rot = 0, tint = null) {
  const f = AF[name]; if (!f) return;
  const k = P * sc, w = f[2] * k, h = f[3] * k;
  const src = tint ? tinted(name, tint) : atlasImg, sx = tint ? 0 : f[0], sy = tint ? 0 : f[1];
  if (!flip && !rot) { ctx.drawImage(src, sx, sy, f[2], f[3], snap(x - w * ax), snap(y - h * ay), w, h); return; }
  ctx.save(); ctx.translate(snap(x), snap(y)); if (rot) ctx.rotate(rot); if (flip) ctx.scale(-1, 1);
  ctx.drawImage(src, sx, sy, f[2], f[3], -w * ax, -h * ay, w, h); ctx.restore();
}
const sprT = (name, color, x, y, sc, ax, ay, flip, rot) => spr(name, x, y, sc, ax, ay, flip, rot, color);
const frameH = name => (AF[name] ? AF[name][3] : 16) * P;
function rrect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function prect(x, y, w, h, col) { ctx.fillStyle = col; const X = snap(x), Y = snap(y); ctx.fillRect(X, Y, snap(x + w) - X, snap(y + h) - Y); }
// bitmap numbers from the pack's 8x8 font (outlined glyphs baked in colours w, y, r, o)
function textW(s, sc) { let w = 0; for (const ch of s) { const f = AF[`gw_${ch.charCodeAt(0)}`]; w += (f ? f[2] - 1 : 3) * P * sc; } return w + P * sc; }
function btext(s, x, y, col = 'w', sc = 1) {
  let cx = x - textW(s, sc) / 2;
  for (const ch of s) { const n = `g${col}_${ch.charCodeAt(0)}`, f = AF[n]; if (f) { spr(n, cx, y, sc, 0, 0.5); cx += (f[2] - 1) * P * sc; } else cx += 3 * P * sc; }
}

// ================================================================ data
const BIOMES = [
  { name: 'Bambu Vadisi', ground: 'forest', tint: '#ffcb8d', edge: ['big_green', 'trio_light', 'trio_round', 'tree_light', 'tree_round', 'tree_light2'],
    small: ['bush0', 'bush1', 'bush2', 'bush3', 'flower_sun', 'flower_white', 'flower_red', 'clover', 'stump_small', 'rock_brown_s'],
    pool: ['Slime3', 'Mushroom', 'Snake2', 'Butterfly'], bosses: ['GiantSlime2', 'GiantFrog'], amb: 'q_Leaf', bits: 'q_Grass', orb: 'EnergyBall' },
  { name: 'Kara Orman', ground: 'grass', tint: '#b8dce5', edge: ['trio_pine', 'tree_pine', 'tree_dark', 'tree_pine', 'trio_dead'],
    small: ['bush4', 'bush5', 'bush6', 'bush7', 'leafy', 'leafy2', 'stump_dark', 'clover', 'bush8'],
    pool: ['Bamboo', 'KappaGreen', 'Racoon', 'SpiderRed', 'BlueBat'], bosses: ['GiantBamboo', 'GiantRacoon'], amb: 'q_Leaf', bits: 'q_Leaf', orb: 'PlantSpike' },
  { name: 'Kızıl Kanyon', ground: 'sand', tint: '#ffbc75', edge: ['palm', 'palm2', 'rocks_brown', 'rock_brown', 'big_orange'],
    small: ['drybush', 'rock_brown_s', 'crystal_o', 'bush9', 'stump_small'],
    pool: ['Lizard', 'Mole', 'Reptile2', 'YellowsBat', 'Skull'], bosses: ['DemonCyclop', 'GiantRacoonGold'], amb: null, bits: 'q_Rock', orb: 'Fireball' },
  { name: 'Buz Geçidi', ground: 'snow', tint: '#79b8ce', edge: ['trio_snowpine', 'trio_snow', 'tree_snowpine', 'tree_snowpine2', 'tree_snowround', 'big_white'],
    small: ['snowrock', 'snowball', 'icespike', 'crystal_t', 'tealrock', 'boulder_snow'],
    pool: ['Slime', 'AxolotBlue', 'Octopus2', 'Eye', 'SkullBlue'], bosses: ['GiantSpirit', 'TenguBlue'], amb: 'q_Snow', bits: 'q_Snow', orb: 'IceSpike' },
  { name: 'Kül Diyarı', ground: 'ash', tint: '#a5608b', edge: ['trio_dead', 'tree_dead', 'rocks_grey', 'rock_grey', 'big_pink'],
    small: ['rock_grey_s', 'tealspike', 'crystal_p', 'stump_dark', 'drybush'],
    pool: ['Flam', 'Spirit2', 'Cyclope', 'Beast2', 'LanternRed'], bosses: ['GiantFlam', 'TenguRed'], amb: 'q_Fire', bits: 'q_RockGray', orb: 'Fireball' },
];
const BOSSES = {
  GiantSlime2: { name: 'Dev Balçık', col: '#74a334' }, GiantFrog: { name: 'Bataklık Kralı', col: '#74a334' },
  GiantBamboo: { name: 'Bambu Canavarı', col: '#56864c' }, GiantRacoon: { name: 'Kızıl Ayı', col: '#d14b34' },
  DemonCyclop: { name: 'Tek Göz', col: '#e0394c' }, GiantRacoonGold: { name: 'Altın Ayı', col: '#d78b4a' },
  GiantSpirit: { name: 'Buz Ruhu', col: '#79b8ce' }, TenguBlue: { name: 'Mavi Tengu', col: '#548789' },
  GiantFlam: { name: 'Alev Devi', col: '#ef914f' }, TenguRed: { name: 'Kızıl Tengu', col: '#e0394c' },
};
const EDEF = {
  Slime3: { spd: 0.9 }, Mushroom: {}, Snake2: { spd: 1.2, ranged: 1 }, Butterfly: { fly: 1, spd: 1.3, hp: 0.8, ranged: 1 },
  Bamboo: { ranged: 1 }, KappaGreen: { hp: 1.3 }, Racoon: { spd: 1.3, hp: 0.8 }, SpiderRed: { spd: 1.4, hp: 0.7, ranged: 1 }, BlueBat: { fly: 1, spd: 1.4, hp: 0.7 },
  Lizard: { spd: 1.2 }, Mole: { hp: 1.4, spd: 0.8 }, Reptile2: { ranged: 1 }, YellowsBat: { fly: 1, spd: 1.4, hp: 0.7, ranged: 1 }, Skull: { ranged: 1 },
  Slime: {}, AxolotBlue: { spd: 1.2 }, Octopus2: { ranged: 1 }, Eye: { fly: 1, ranged: 1, hp: 0.8 }, SkullBlue: { hp: 1.5, spd: 0.8 },
  Flam: { ranged: 1, spd: 1.2 }, Spirit2: { fly: 1, hp: 0.8, ranged: 1 }, Cyclope: { hp: 1.3 }, Beast2: { hp: 2, spd: 0.7 }, LanternRed: { ranged: 1 },
};
// thrown weapons: ori = direction the art points; trail / hit choose the effects; sc = art scale (0.5 steps)
const GUNS = [
  { name: 'Shuriken',     mult: 1,   cost: 0,    spr: 'Shuriken',      spin: 1, sc: 1,   shots: 1, sp: 900,  trail: 'ghost', hit: 'spark' },
  { name: 'Kunai',        mult: 2.5, cost: 5,    spr: 'Kunai',         ori: 0,  sc: 1,   shots: 1, sp: 1100, trail: 'ghost', hit: 'cut' },
  { name: 'Üçlü Ok',      mult: 6,   cost: 15,   spr: 'Arrow',         ori: 0,  sc: 1,   shots: 3, sp: 1100, trail: 'ghost', hit: 'cut', bits: 'q_Wood' },
  { name: 'Büyük Kunai',  mult: 15,  cost: 40,   spr: 'BigKunai',      ori: 0,  sc: 0.5, shots: 1, sp: 1000, trail: 'ghost', hit: 'claw' },
  { name: 'Büyü Yıldızı', mult: 40,  cost: 100,  spr: 'ShurikenMagic', spin: 1, sc: 1,   shots: 2, sp: 950,  trail: 'spark', hit: 'star' },
  { name: 'Buz Mızrağı',  mult: 110, cost: 250,  spr: 'IceSpike',      ori: 0,  sc: 1,   shots: 1, sp: 1000, trail: 'snow',  hit: 'ice' },
  { name: 'Ateş Topu',    mult: 300, cost: 600,  spr: 'Fireball',      ori: -Math.PI / 4, sc: 1, shots: 1, sp: 760, trail: 'fire', hit: 'fire', boom: 1 },
  { name: 'Ruh Küresi',   mult: 900, cost: 1500, spr: 'BigEnergyBall', ori: -Math.PI / 2, sc: 1, shots: 1, sp: 700, trail: 'aura', hit: 'thunder', boom: 1 },
];
const ORI = { EnergyBall: -Math.PI / 2, PlantSpike: 0, Fireball: -Math.PI / 4, IceSpike: 0 };
const TEAM = [
  { id: 'NinjaBlue',   name: 'Kaptan',  cost: 0 },
  { id: 'NinjaRed',    name: 'Kızıl',   cost: 300 },
  { id: 'NinjaYellow', name: 'Altın',   cost: 30000 },
  { id: 'NinjaBomb',   name: 'Bombacı', cost: 3e6 },
  { id: 'NinjaMasked', name: 'Maske',   cost: 3e8 },
];
const SLOTS = [[0, 0], [-0.75, -0.25], [0.75, -0.25], [-0.38, 0.7], [0.38, 0.7]];
const SUBS = 5, KILLS_PER_SUB = 8, BOSS_TIME = 30;

// ================================================================ save
const SAVE_KEY = 'swarmsquad_idle_v1';
const DEF = { money: 0, gems: 0, stage: 1, sub: 1, kills: 0, bossReady: false, lv: { power: 0, speed: 0, money: 0 }, gun: 0, team: 1, rebirths: 0, rp: 0, auto: true, sound: true, music: true, t: 0, rate: 0, best: 1 };
const save = (() => { let s = null; try { s = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { s = null; }
  const d = JSON.parse(JSON.stringify(DEF)); if (s && typeof s === 'object') { Object.assign(d, s); d.lv = Object.assign({ power: 0, speed: 0, money: 0 }, s.lv || {}); } return d; })();
function persist() { save.t = Date.now(); try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* storage blocked */ } }

// ================================================================ economy
const rebirthMul = () => 1 + save.rp * 0.3;
const stat = { power: l => 6 * Math.pow(1.18, l), speed: l => Math.min(12, 1.4 + 0.08 * l), money: l => Math.pow(1.13, l) };
const COST = { power: l => 8 * Math.pow(1.2, l), speed: l => 12 * Math.pow(1.24, l), money: l => 15 * Math.pow(1.22, l) };
const MODS = { dmg: [], rate: [], money: [] };
const modMul = k => MODS[k].reduce((m, f) => m * (f() || 1), 1);
const dmgPerShot = () => stat.power(save.lv.power) * GUNS[save.gun].mult * rebirthMul() * modMul('dmg');
const fireRate = () => stat.speed(save.lv.speed) * modMul('rate');
const moneyMul = () => stat.money(save.lv.money) * rebirthMul() * modMul('money');
const stageIdx = () => (save.stage - 1) * SUBS + (save.sub - 1);
const enemyHp = () => 10 * Math.pow(1.3, stageIdx());
const bossHp = () => 10 * Math.pow(1.3, (save.stage - 1) * SUBS + SUBS - 1) * 18;
const biome = () => BIOMES[(save.stage - 1) % BIOMES.length];
const bossKey = () => { const b = biome(); return b.bosses[Math.floor((save.stage - 1) / BIOMES.length) % b.bosses.length]; };
const rebirthGain = () => save.stage >= 6 ? Math.floor((save.stage - 1) * 1.5) : 0;
const heroId = i => (i === 0 && save.skin) ? save.skin : TEAM[i].id;

// ================================================================ audio: soft sampled effects + calm music per biome
let AC = null, master = null, bus = null;
const SND = {};
function audioInit() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); musicUpdate(); return; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    master = AC.createGain(); master.gain.value = 0.55;
    const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6500; lp.Q.value = 0.5;
    const comp = AC.createDynamicsCompressor(); comp.threshold.value = -22; comp.knee.value = 18; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.2;
    bus = AC.createGain(); bus.connect(lp); lp.connect(comp); comp.connect(master); master.connect(AC.destination);
    const D = window.SFXDATA || {};
    for (const k in D) {
      const bin = atob(D[k]), buf = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      try { AC.decodeAudioData(buf.buffer, b => { SND[k] = b; }, () => {}); } catch (e) { /* unsupported */ }
    }
  } catch (e) { AC = null; }
  musicUpdate();
}
const SFXMAP = {
  shoot: ['throw', 0.14, 0.12, 0.1], hit: ['hit', 0.14, 0.15, 0.08], kill: ['kill', 0.3, 0.12, 0.06],
  coin: ['coin', 0.12, 0.1, 0.1], buy: ['buy', 0.3, 0.04, 0.05], no: ['no', 0.25, 0, 0.2], boom: ['boom', 0.28, 0.1, 0.14],
  boss: ['boss', 0.5, 0, 0.5], win: ['win', 0.45, 0, 0.5], fail: ['fail', 0.4, 0, 0.5], hurt: ['hurt', 0.26, 0.1, 0.12],
  lob: ['lob', 0.14, 0.12, 0.15], click: ['click', 0.3, 0.05, 0.05], magic: ['magic', 0.3, 0.05, 0.1],
  gold: ['gold', 0.3, 0.05, 0.2], bonus: ['bonus', 0.35, 0, 0.2], accept: ['accept', 0.35, 0, 0.1],
};
const sndLast = {};
function sfx(n, gap) {
  if (!AC || !save.sound) return;
  const m = SFXMAP[n]; if (!m) return;
  const now = AC.currentTime; if (sndLast[n] && now - sndLast[n] < (gap === 0 ? 0 : Math.max(gap || 0, m[3]))) return; sndLast[n] = now;
  const b = SND[m[0]]; if (!b) return;
  const s = AC.createBufferSource(), g = AC.createGain();
  s.buffer = b; s.playbackRate.value = 1 + (Math.random() * 2 - 1) * m[2]; g.gain.value = m[1];
  s.connect(g); g.connect(bus); s.start();
}
const tracks = {};
let musicKey = null;
function musicUpdate() {
  const want = (save.music !== false && AC && !document.hidden) ? biome().ground : null;
  if (want !== musicKey) {
    musicKey = want;
    if (want && !tracks[want]) { const a = new Audio('assets/music/' + want + '.mp3'); a.loop = true; a.volume = 0; a.preload = 'auto'; tracks[want] = a; }
  }
}
function musicTick(dt) {
  musicUpdate();
  for (const k in tracks) {
    const a = tracks[k], target = k === musicKey ? (R.boss ? 0.24 : 0.3) : 0;
    a.volume = clamp(a.volume + clamp(target - a.volume, -dt * 0.25, dt * 0.25), 0, 1);
    if (target > 0 && a.paused) a.play().catch(() => {});
    if (target === 0 && a.volume <= 0.001 && !a.paused) a.pause();
  }
}

// ================================================================ runtime state
const R = { en: [], bul: [], eb: [], parts: [], txt: [], coins: [], boss: null, t: 0, shake: 0, flash: 0, hurt: 0, earned: 0, earnT: 0, retryT: 0,
  heroes: [], amb: [], nextId: 1, walletPop: 0, leavingBoss: null, lobGap: 0, sq: null, joy: null,
  cam: 0, phase: 'advance', advLeft: 120, advSpd: 110, toSpawn: 0, spawnT: 0, bioEdge: -1e9, oldBio: 0, manual: false, ctrlT: 0, hintT: 0 };
const sqMaxHp = () => Math.round((100 + 12 * (save.stage - 1)) * (1 + 0.1 * (save.team - 1)));
const hpBase = () => 100 + 12 * (save.stage - 1);
function slotPos(i, p) { const s = SLOTS[i]; return along(p, s[1] * 70 * U, s[0] * F.pathW * 0.4); }
function setupHeroes() {
  const hb = heroBox();
  if (!R.sq) { const mh = sqMaxHp(); R.sq = { x: F.S.x, y: F.S.y, vx: 0, vy: 0, hp: mh, maxHp: mh, lag: mh, ko: 0, inv: 0, hit: 0, calm: 9 }; }
  const p = clampBox(R.sq, hb); R.sq.x = p.x; R.sq.y = p.y;
  const old = R.heroes;
  R.heroes = TEAM.slice(0, save.team).map((h, i) => {
    if (old[i]) { const o = old[i]; o.id = heroId(i); if (i === 0) { o.x = p.x; o.y = p.y; } return o; }
    const pos = clampBox(slotPos(i, R.sq), followBox());
    if (old.length) puff(pos.x, pos.y, 1);
    return { id: heroId(i), x: pos.x, y: pos.y, fireT: rand(0, 0.6), atk: 0, ang: -Math.PI / 2, dir: 'u', ph: rand(0, 6), i, walk: 0, moving: false, spd: 0 };
  });
}
function followBox() { const b = heroBox(); return { x0: 22 * U, x1: W - 22 * U, y0: b.y0 - 24 * U, y1: b.y1 + 30 * U }; }
const dirOf = (dx, dy) => Math.abs(dy) > Math.abs(dx) * 0.8 ? (dy > 0 ? 'd' : 'u') : (dx > 0 ? 'r' : 'l');

// ================================================================ scrolling ground: endless tile map in cached chunks
// World row r sits at screen y = r*T + R.cam; R.cam grows while the squad advances, so the ground slides down.
const CH = 10;   // tile rows per chunk
const chunks = new Map();
const chunkBio = c => c < R.bioEdge ? (save.stage - 1) % BIOMES.length : R.oldBio;
function makeChunk(c) {
  const bi = chunkBio(c), b = BIOMES[bi], gk = b.ground, T = 16 * P;
  const rnd = mulberry32(c * 7919 + bi * 104729 + 17), rr = (a, z) => a + rnd() * (z - a), rp = a => a[Math.floor(rnd() * a.length)];
  const g = document.createElement('canvas'); g.width = BW; g.height = Math.ceil(CH * T / L);
  const x2 = g.getContext('2d'); x2.imageSmoothingEnabled = false;
  const px0 = W / 2 - 1.5 * T, gx0 = px0 - Math.ceil(px0 / T) * T, cols = Math.ceil((W - gx0) / T) + 1, pc = Math.round((px0 - gx0) / T), ts = T / L;
  for (let r = 0; r < CH; r++) for (let q = 0; q < cols; q++) {
    const k = q - pc;
    let n;
    if (k === 0) n = 'pl'; else if (k === 2) n = 'pr';
    else if (k === 1) n = rnd() < 0.06 ? rp(['pc2', 'pc3']) : 'pc';
    else n = rnd() < 0.16 ? rp(['d1', 'd2', 'd3', 'd4']) : 'fill';
    const f = AF[`t_${gk}_${n}`];
    x2.drawImage(atlasImg, f[0], f[1], 16, 16, Math.round((gx0 + q * T) / L), Math.round(r * ts), ts, ts);
  }
  const deco = [], hgt = CH * T;
  for (const side of [-1, 1]) {
    let y = rr(0, 60) * U;
    while (y < hgt) {
      const n = rp(b.edge), f = AF['d_' + n], w = f[2] * P;
      deco.push({ n: 'd_' + n, x: side < 0 ? rr(-0.45, -0.2) * w + w / 2 : W - rr(-0.45, -0.2) * w - w / 2, y: y + f[3] * P, flip: rnd() < 0.5 });
      y += f[3] * P * rr(0.85, 1.25) + rr(10, 60) * U;
    }
  }
  for (let i = 0; i < 7; i++) { const x = rr(30, W - 30); if (Math.abs(x - W / 2) < 2.2 * T) continue; deco.push({ n: 'd_' + rp(b.small), x, y: rr(0, hgt), flip: rnd() < 0.5 }); }
  deco.sort((a, z) => a.y - z.y);
  return { cv: g, deco, bi };
}
function drawGroundTiles() {
  const CHT = CH * 16 * P, c0 = Math.floor(-R.cam / CHT), c1 = Math.floor((H - R.cam) / CHT);
  for (let c = c0; c <= c1; c++) {
    let ch = chunks.get(c);
    if (!ch || ch.bi !== chunkBio(c)) { ch = makeChunk(c); chunks.set(c, ch); }
    ctx.drawImage(ch.cv, 0, snap(c * CHT + R.cam), ch.cv.width * L, ch.cv.height * L);
  }
  for (const [c] of chunks) if (c < c0 - 2 || c > c1 + 2) chunks.delete(c);
  for (let c = c0 - 1; c <= c1; c++) {   // decor (tree crowns may hang over chunk edges)
    const ch = chunks.get(c); if (!ch) continue;
    const y0 = c * CHT + R.cam;
    for (const d of ch.deco) { const y = y0 + d.y; if (y < -10 || y - 300 > H) continue; spr(d.n, d.x, y, 1, 0.5, 1, d.flip); }
  }
}

// ================================================================ waves: advance (scroll) → fight → advance ...
function startAdvance(dist, spd) { R.phase = 'advance'; R.advLeft = dist; R.advSpd = spd; }
function startWave() {
  R.phase = 'fight';
  R.toSpawn = 3 + Math.floor(Math.random() * 3) + (save.stage > 3 ? 1 : 0);
  R.spawnT = 0.1;
}
function newBiomeAhead() {   // the next region starts just above the screen and scrolls in during the advance
  const CHT = CH * 16 * P;
  R.oldBio = chunkBio(Math.floor((H - R.cam) / CHT));
  R.bioEdge = Math.floor(-R.cam / CHT);
  const edgeY = R.bioEdge * CHT + R.cam;
  startAdvance(Math.max(200 * U, H * 0.8 - edgeY), 240 * U);
}

// ================================================================ combat
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function enemyGoal(e) {
  const eb = enemyBox(), sq = R.sq, st = STAND * U;
  let g = clampBox(along(sq, st, e.lane * F.pathW * 0.8), eb);
  if (dist(g, sq) < st * 0.85) {
    const dx = e.x - sq.x, dy = e.y - sq.y, d = Math.hypot(dx, dy) || 1;
    g = clampBox({ x: sq.x + dx / d * st, y: sq.y + dy / d * st }, eb);
  }
  return g;
}
function spawnEnemy() {
  const b = biome(), type = pick(b.pool), d = EDEF[type];
  const lane = rand(-0.4, 0.4);
  const x = clamp(W / 2 + lane * F.pathW * 1.1, 60 * U, W - 60 * U), y = 120 + rand(-20, 20) * U;
  const hp = enemyHp() * (d.hp || 1);
  R.en.push({ id: R.nextId++, type, d, x, y, lane, hp, maxHp: hp, sp: 80 * U * (d.spd || 1), flash: 0, anim: rand(0, 1), knock: 0, kx: 0, ky: 0, kb: 0, age: 0,
    ranged: !!d.ranged, stopped: false, atk: rand(1.4, 2.6), wind: 0, dir: 'd' });
}
function startBoss() {
  if (R.boss || !save.bossReady) return;
  const key = bossKey(), bd = BOSSES[key];
  for (const e of R.en) { e.dead = true; puff(e.x, e.y, 1); }
  R.eb.length = 0; R.phase = 'fight'; R.toSpawn = 0;
  const p = along(F.A, 40 * U, 0), hp = bossHp();
  R.boss = { x: p.x, y: p.y, hp, maxHp: hp, t: BOSS_TIME, flash: 0, anim: 0, key, name: bd.name, col: bd.col, arrive: 0, leaving: 0, atkT: 1.6, seq: 0, tele: 0, teleK: '', burst: [] };
  $('bossImg').src = `assets/ui/boss_${key}.png`;
  $('bossHud').classList.remove('hidden');
  banner('BOSS!', bd.name); sfx('boss', 0); R.shake = 5; uiKey = '';
}
const bossH = b => frameH(`b_${b.key}_0`);
function bossWin() {
  const b = R.boss; R.boss = null; R.eb.length = 0;
  runHooks('bossWin', b);
  for (let i = 0; i < 6; i++) setTimeout(() => boom(b.x + rand(-50, 50) * U, b.y - rand(10, bossH(b) * 0.8), 1), i * 110);
  const gems = 2 + Math.floor(save.stage / 3), cash = enemyHp() * 25 * moneyMul();
  save.gems += gems; addMoney(cash, b.x, b.y - bossH(b) / 2, 16);
  save.stage++; save.sub = 1; save.kills = 0; save.bossReady = false; save.best = Math.max(save.best, save.stage);
  $('bossHud').classList.add('hidden');
  banner('ZAFER!', `+${gems} elmas · ${biome().name}`); sfx('win', 0);
  persist();
  setTimeout(() => { newBiomeAhead(); musicUpdate(); }, 1100);
  R.phase = 'wait';
}
function bossFail() {
  const b = R.boss; if (!b) return;
  b.leaving = 0.01; R.boss = null; R.leavingBoss = b; R.eb.length = 0;
  $('bossHud').classList.add('hidden');
  banner('BOSS KAÇTI!', 'Güçlen ve tekrar dene'); sfx('fail', 0);
  R.retryT = 12; startAdvance(160 * U, 110 * U);
}
function damage(target, dmg, crit, isBoss) {
  target.hp -= dmg; target.flash = 0.08;
  if (!isBoss) { const dx = target.x - R.sq.x, dy = target.y - R.sq.y, d = Math.hypot(dx, dy) || 1; target.kx = dx / d; target.ky = dy / d; target.knock = 6 * U; }
  const top = isBoss ? bossH(target) : 18 * P;
  addText(target.x + rand(-14, 14) * U, target.y - top - 2 * U + rand(-6, 6) * U, fmt(dmg), crit ? 'crit' : 'dmg');
  if (target.hp <= 0) { if (isBoss) bossWin(); else kill(target); }
}
function kill(e) {
  e.dead = true;
  runHooks('kill', e);
  puff(e.x, e.y, 2); bits(e.x, e.y - 8 * P, biome().bits, 4);
  addMoney(e.maxHp * 0.55 * moneyMul(), e.x, e.y - 10 * P, 3);
  sfx('kill');
  if (!R.boss && !save.bossReady) {
    save.kills++;
    if (save.kills >= KILLS_PER_SUB) {
      if (save.sub < SUBS) { save.sub++; save.kills = 0; toast(`Aşama ${save.stage}-${save.sub}`); runHooks('stage'); }
      else { save.kills = KILLS_PER_SUB; save.bossReady = true; R.retryT = 0; if (!save.auto) toast('Boss hazır!'); }
    }
  }
}
function addMoney(v, x, y, n) {
  save.money += v; R.earned += v;
  addText(x, y - 12 * U, fmt(v), 'money');
  for (let i = 0; i < n && R.coins.length < 60; i++) {
    const a = rand(-Math.PI * 0.85, -Math.PI * 0.15);
    R.coins.push({ x, y, vx: Math.cos(a) * rand(60, 170) * U, vy: Math.sin(a) * rand(140, 260) * U, t: 0, ph: rand(0, 4) });
  }
  sfx('coin');
}
function addText(x, y, s, kind) { if (kind === 'dmg' && R.txt.length > 18) return; if (R.txt.length > 50) R.txt.shift(); R.txt.push({ x, y, s, kind, life: kind === 'money' ? 1.0 : 0.7, max: kind === 'money' ? 1.0 : 0.7 }); }
// particles: anim = pack fx sheet played once; bit = physical chip with gravity; float = drifting trail mote
function part(p) { if (save.eco && p.k !== 'anim' && Math.random() < 0.6) return; if (R.parts.length < 260) R.parts.push(p); }
function puff(x, y, s = 1) { part({ k: 'anim', a: 'fx_smoke', x, y: y + 2 * P, s: s * 0.5, life: 0.4, max: 0.4, ay: 1, alpha: 0.85 }); }
function fx(a, x, y, s = 0.5, life = 0.25, ay = 0.5) { part({ k: 'anim', a, x, y, s, life, max: life, ay }); }
function bits(x, y, set, n) {
  const m = AN[set] || 1;
  for (let i = 0; i < n; i++) { const a = rand(-Math.PI * 0.9, -Math.PI * 0.1), s = rand(70, 200) * U; part({ k: 'bit', f: `${set}_${Math.floor(Math.random() * m)}`, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.45, 0.8), max: 0.8, flip: Math.random() < 0.5 }); }
}
function confetti(x, y, col, n) { bits(x, y, biome().bits, Math.min(8, n)); }
function boom(x, y, s = 1) {
  fx('fx_circle', x, y, s, 0.32);
  part({ k: 'anim', a: 'fx_smoke', x, y: y + 6 * P * s, s, life: 0.5, max: 0.5, ay: 1, alpha: 0.85 });
  bits(x, y, 'q_Fire', 4);
  R.shake = Math.max(R.shake, 4); sfx('boom');
}
function hitFx(q, t) {
  const g = q.g, x = q.x, y = q.y;
  switch (g.hit) {
    case 'cut': fx('fx_cut', x, y); break;
    case 'claw': fx('fx_claw', x, y); break;
    case 'star': fx('fx_spark', x, y, 1, 0.2); fx('fx_circlew', x, y, 0.5, 0.2); break;
    case 'ice': fx('fx_ice', x, y, 0.5, 0.4); bits(x, y, 'q_Snow', 3); break;
    case 'fire': fx('fx_flam', x, y, 0.5, 0.3); break;
    case 'thunder': fx('fx_thunder', x, y, 0.5, 0.3); fx('fx_circlew', x, y, 1, 0.25); break;
    default: fx('fx_spark', x, y);
  }
  if (g.bits) bits(x, y, g.bits, 2);
  if (q.crit) fx('fx_cut', x + 4 * U, y - 4 * U, 1, 0.22);
  if (g.boom) boom(x, y, t === R.boss ? 1 : 0.5); else sfx('hit');
}
function nearestTarget(h) {
  if (R.boss && R.boss.arrive >= 1) return R.boss;
  let best = null, bd = 1e9;
  for (const e of R.en) { if (e.dead || e.y < 140) continue; const d = Math.hypot(e.x - h.x, e.y - h.y); if (d < bd) { bd = d; best = e; } }
  return best;
}
const aimY = t => t === R.boss ? t.y - bossH(t) * 0.5 : t.y - 8 * P - (t.d && t.d.fly ? 5 * P : 0);
function fire(h, tgt) {
  const g = GUNS[save.gun];
  const hx = h.x, hy = h.y - 9 * P;
  h.ang = Math.atan2(aimY(tgt) - hy, tgt.x - hx); h.atk = 0.14; h.dir = dirOf(Math.cos(h.ang), Math.sin(h.ang));
  const crit = Math.random() < 0.1, total = dmgPerShot() * (crit ? 3 : 1);
  for (let k = 0; k < g.shots; k++) {
    const a = h.ang + (g.shots > 1 ? (k - (g.shots - 1) / 2) * 0.12 : 0);
    R.bul.push({ x: hx, y: hy, a, sp: g.sp * U, tgt, dmg: total / g.shots, crit, g, age: rand(0, 1), life: 1.2, trail: [], tt: 0 });
  }
  sfx('shoot');
}

// ================================================================ squad: input, AI steering, health
const keys = {};
const KEYMAP = { KeyW: 'u', ArrowUp: 'u', KeyS: 'd', ArrowDown: 'd', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r' };
const typing = e => e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
window.addEventListener('keydown', e => { const k = KEYMAP[e.code]; if (!k || typing(e)) return; keys[k] = true; e.preventDefault(); });
window.addEventListener('keyup', e => { const k = KEYMAP[e.code]; if (k) keys[k] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; R.joy = null; });
const JOY_R = 52;
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
  if (d > m) { j.ox = j.x - dx / d * m; j.oy = j.y - dy / d * m; }
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
// autopilot: drift to a calm spot under the enemies, step out of lob landing zones, sidestep incoming orbs,
// keep clear of the boss body and walk into the safe gap of a boss shockwave
function aiSteer() {
  const sq = R.sq, b = R.boss;
  let tx = F.S.x + Math.sin(R.t * 0.45) * 36 * U, ty = F.S.y;
  if (R.phase === 'fight' && R.en.length) { let cx = 0; for (const e of R.en) cx += e.x; tx = lerp(tx, cx / R.en.length, 0.35); }
  if (b && b.arrive >= 1 && b.gaps && ((b.tele > 0 && b.teleK === 'slam') || R.eb.some(p => p.k === 'wave'))) {
    const a = Math.atan2((sq.y - b.y) / 0.6, sq.x - b.x), d = Math.max(170 * U, Math.hypot(sq.x - b.x, (sq.y - b.y) / 0.6));
    let best = b.gaps[0], bd = 9;
    for (const g of b.gaps) { let dd = Math.abs(((g - a) % TAU + TAU + Math.PI) % TAU - Math.PI); if (dd < bd) { bd = dd; best = g; } }
    tx = b.x + Math.cos(best) * d; ty = b.y + Math.sin(best) * d * 0.6;
  }
  let vx = tx - sq.x, vy = ty - sq.y; const dd = Math.hypot(vx, vy), k = 1 / Math.max(dd, 70 * U);
  vx *= k; vy *= k;
  for (const p of R.eb) {
    if (p.k === 'lob') {
      const dx = sq.x - p.tx, dy = sq.y - p.ty, d = Math.hypot(dx, dy) || 1, r0 = 80 * U;
      if (d < r0) { const w = (1 - d / r0) * 3.2; vx += dx / d * w; vy += dy / d * w; }
    } else if (p.k === 'orb') {
      const rx = sq.x - p.x, ry = sq.y - 8 * P - p.y, v2 = p.vx * p.vx + p.vy * p.vy || 1;
      const tc = clamp((rx * p.vx + ry * p.vy) / v2, 0, 0.9), cx = rx - p.vx * tc, cy = ry - p.vy * tc, cd = Math.hypot(cx, cy) || 1, r0 = 52 * U;
      if (cd < r0) { const w = (1 - cd / r0) * 2.6; vx += cx / cd * w; vy += cy / cd * w; }
    }
  }
  if (b && b.arrive >= 1) { const dx = sq.x - b.x, dy = (sq.y - b.y) / 0.6, d = Math.hypot(dx, dy) || 1; if (d < 150 * U) { vx += dx / d * 1.5; vy += dy / d * 1.5; } }
  const m = Math.hypot(vx, vy); if (m > 1) { vx /= m; vy /= m; }
  return { x: vx * 0.85, y: vy * 0.85 };
}
function hurtSquad(dmg, x, y) {
  const sq = R.sq;
  if (!sq || sq.ko > 0 || sq.inv > 0) return false;
  dmg = Math.max(1, Math.round(dmg));
  sq.hp -= dmg; sq.inv = 0.7; sq.hit = 0.25; sq.calm = 0;
  R.shake = Math.max(R.shake, 4); R.hurt = 0.35;
  const L0 = R.heroes[0];
  addText(clamp((L0 ? L0.x : x) + rand(-10, 10) * U, 40 * U, W - 40 * U), (L0 ? L0.y : y) - 30 * P, '-' + dmg, 'hurt');
  fx('fx_cut', x || 0, y || 0, 0.5, 0.2);
  sfx('hurt');
  runHooks('hurt', dmg);
  if (sq.hp <= 0) knockout();
  return true;
}
function knockout() {
  const sq = R.sq;
  sq.hp = 0; sq.ko = 3; sq.vx = sq.vy = 0; R.joy = null;
  R.eb.length = 0;
  for (const e of R.en) e.kb = 240 * U;
  for (const h of R.heroes) puff(h.x, h.y, 2);
  R.shake = 6;
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
    if (sq.ko <= 0) { sq.ko = 0; sq.hp = sq.maxHp; sq.inv = 1.5; for (const h of R.heroes) puff(h.x, h.y, 2); }
  } else if (sq.calm > 2.5 && sq.hp < sq.maxHp) sq.hp = Math.min(sq.maxHp, sq.hp + sq.maxHp * 0.05 * dt);
  sq.hp = Math.min(sq.hp, sq.maxHp);
  sq.lag = sq.lag > sq.hp ? Math.max(sq.hp, sq.lag - sq.maxHp * 0.5 * dt) : sq.hp;
  // control: your finger always wins; 0.7 s after you let go the autopilot takes over again
  let inp = { x: 0, y: 0 };
  if (sq.ko <= 0) {
    const man = moveInput();
    if (man.x || man.y) { inp = man; R.ctrlT = 0.7; if (!R.manual) { R.manual = true; ctrlBadge(); } }
    else if (R.ctrlT > 0) R.ctrlT -= dt;
    else { if (R.manual) { R.manual = false; ctrlBadge(); } inp = aiSteer(); }
  }
  const SPD = 210 * U, k = Math.min(1, dt * (R.manual ? 12 : 6));
  sq.vx = lerp(sq.vx, inp.x * SPD, k); sq.vy = lerp(sq.vy, inp.y * SPD, k);
  if (Math.abs(sq.vx) < 2 && !inp.x) sq.vx = 0; if (Math.abs(sq.vy) < 2 && !inp.y) sq.vy = 0;
  const hb = heroBox();
  sideT -= dt;
  if (sideT <= 0) { sideT = 0.5; sideRects = Array.from(document.querySelectorAll('#ui .side')).map(el => el.getBoundingClientRect()).filter(r => r.width > 0 && r.height > 0); }
  sq.x = clamp(sq.x + sq.vx * dt, hb.x0, hb.x1); sq.y = clamp(sq.y + sq.vy * dt, hb.y0, hb.y1);
  avoidSides(sq, 24 * U);
  const b = R.boss;
  if (b && b.arrive >= 1 && sq.ko <= 0) {
    const dx = sq.x - b.x, dy = (sq.y - b.y) / 0.6, d = Math.hypot(dx, dy), rr = 100 * U;
    if (d < rr) { const n = d || 1; sq.x = clamp(b.x + dx / n * rr, hb.x0, hb.x1); sq.y = clamp(b.y + dy / n * rr * 0.6, hb.y0, hb.y1); hurtSquad(hpBase() * 0.12, sq.x, sq.y - 8 * P); }
  }
  const adv = R.phase === 'advance' || R.phase === 'wait' && false;
  const fb = followBox();
  for (const h of R.heroes) {
    const ox = h.x, oy = h.y;
    if (h.i === 0) { h.x = sq.x; h.y = sq.y; }
    else if (sq.ko <= 0) { const t = avoidSides(clampBox(slotPos(h.i, sq), fb), 20 * U), f = Math.min(1, dt * 7); h.x = lerp(h.x, t.x, f); h.y = lerp(h.y, t.y, f); }
    const sp = Math.hypot(h.x - ox, h.y - oy) / Math.max(dt, 1e-4);
    h.spd = lerp(h.spd || 0, sp, Math.min(1, dt * 10));
    if (h.atk > 0) h.atk -= dt;
    const walking = h.spd > 30 * U || (adv && sq.ko <= 0);
    h.moving = walking;
    if (walking) {
      h.walk += dt * 8;
      if (h.atk <= 0) h.dir = h.spd > 30 * U ? dirOf(h.x - ox, h.y - oy) : 'u';
      h.dust = (h.dust || 0) - dt;
      if (h.dust <= 0) { h.dust = 0.32; part({ k: 'anim', a: 'fx_smoke', x: h.x, y: h.y + 2 * P, s: 0.5, life: 0.3, max: 0.3, ay: 1, alpha: 0.45 }); }
    } else if (h.atk <= 0 && R.phase === 'advance') h.dir = 'u';
  }
}

// ================================================================ enemy & boss attacks
function lob(e) {
  const L0 = R.heroes[0]; if (!L0) return;
  const tx = L0.x + rand(-14, 14) * U + R.sq.vx * 0.25, ty = L0.y + rand(-8, 8) * U + R.sq.vy * 0.25;
  R.eb.push({ k: 'lob', sx: e.x, sy: e.y - 10 * P, tx, ty, t: 0, T: 1.3, r: 6 * P, dmg: hpBase() * 0.09 });
  sfx('lob');
}
function orb(x, y, a, sp, dmg, r = 5) { R.eb.push({ k: 'orb', x, y, a, vx: Math.cos(a) * sp * U, vy: Math.sin(a) * sp * U, r: r * P, dmg, life: 7, age: rand(0, 1), spr: biome().orb }); }
function bossAttack(b, kind) {
  const L0 = R.heroes[0]; if (!L0) return;
  const cx = b.x, cy = b.y - bossH(b) * 0.5, dmg = hpBase() * 0.1, rage = b.hp < b.maxHp * 0.5;
  if (kind === 'fan') {
    const a0 = Math.atan2(L0.y - 8 * P - cy, L0.x - cx), n = rage ? 7 : 5;
    for (let i = 0; i < n; i++) orb(cx, cy, a0 + (i - (n - 1) / 2) * 0.2, 230, dmg);
    b.burst.push({ t: 0.45, k: 'aim' }); sfx('lob', 0);
  } else if (kind === 'aim') {
    orb(cx, cy, Math.atan2(L0.y - 8 * P - cy, L0.x - cx), 300, dmg, 6);
  } else if (kind === 'ring') {
    const n = rage ? 18 : 14, off = rand(0, TAU);
    for (let i = 0; i < n; i++) orb(cx, cy, off + i / n * TAU, 150, dmg);
    if (rage) b.burst.push({ t: 0.5, k: 'ring2', off: off + Math.PI / n });
    sfx('magic', 0);
  } else if (kind === 'ring2') {
    const n = 18; for (let i = 0; i < n; i++) orb(cx, cy, b.burstOff + i / n * TAU, 150, dmg);
  } else if (kind === 'slam') {
    R.eb.push({ k: 'wave', x: b.x, y: b.y, r: 40 * U, sp: 290 * U, max: 560 * U, w: 4 * P, col: b.col, dmg: hpBase() * 0.16, gaps: b.gaps, hit: false });
    R.shake = 6; sfx('boom', 0); puff(b.x - 40 * U, b.y, 2); puff(b.x + 40 * U, b.y, 2);
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
    b.teleK = k; b.tele = k === 'slam' ? 0.9 : 0.45;
    if (k === 'slam') { const L0 = R.heroes[0], a = L0 ? Math.atan2((L0.y - b.y) / 0.6, L0.x - b.x) : 2.4; b.gaps = [a + rand(0.6, 1.0) * (Math.random() < 0.5 ? -1 : 1), a + Math.PI * rand(0.8, 1.2)]; }
    b.atkT = (rage ? 1.7 : 2.3) + b.tele;
  }
}
function updateEnemyShots(dt) {
  const sq = R.sq, hs = R.heroes;
  for (const p of R.eb) {
    if (p.k === 'lob') {
      p.t += dt;
      if (p.t >= p.T) {
        p.dead = true; puff(p.tx, p.ty, 1); bits(p.tx, p.ty - 2 * P, 'q_Rock', 3);
        for (const h of hs) { const dx = h.x - p.tx, dy = (h.y - p.ty) / 0.6; if (Math.hypot(dx, dy) < 36 * U) { hurtSquad(p.dmg, p.tx, p.ty - 8 * P); break; } }
      }
    } else if (p.k === 'orb') {
      p.life -= dt; p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.life <= 0 || p.x < -60 || p.x > W + 60 || p.y < -60 || p.y > H + 60) p.dead = true;
      else for (const h of hs) if (Math.hypot(h.x - p.x, h.y - 8 * P - p.y) < p.r + 5 * P) { if (hurtSquad(p.dmg, p.x, p.y)) p.dead = true; break; }
    } else if (p.k === 'wave') {
      p.r += p.sp * dt; if (p.r > p.max) p.dead = true;
      if (!p.hit) for (const h of hs) {
        const dx = h.x - p.x, dy = (h.y - p.y) / 0.6, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
        if (Math.abs(d - p.r) < p.w + 8 * U && !p.gaps.some(g => angIn(a, g, 0.4))) { p.hit = true; hurtSquad(p.dmg, h.x, h.y - 4 * P); break; }
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
  if (R.retryT > 0) R.retryT -= dt;
  // the march: scroll the world while advancing, then hold for the wave
  if (!R.boss) {
    if (R.phase === 'advance' && !ko) {
      const d = R.advSpd * dt; R.cam += d; R.advLeft -= d;
      for (const m of R.amb) m.y += d;
      for (const p of R.parts) if (p.k === 'bit' || p.k === 'anim') p.y += d;
      if (R.advLeft <= 0) {
        if (save.bossReady && save.auto && R.retryT <= 0) startBoss();
        else startWave();
      }
    } else if (R.phase === 'fight' && !ko) {
      if (R.toSpawn > 0) { R.spawnT -= dt; if (R.spawnT <= 0) { spawnEnemy(); R.toSpawn--; R.spawnT = rand(0.25, 0.5); } }
      else if (!R.en.length && !R.eb.length) startAdvance(rand(170, 250) * U, 110 * U);
    }
  }
  const L0 = R.heroes[0];
  for (const e of R.en) {
    if (e.dead) continue;
    e.age += dt; e.anim += dt; if (e.flash > 0) e.flash -= dt;
    const goal = enemyGoal(e);
    const dx = goal.x - e.x, dy = goal.y - e.y, d = Math.hypot(dx, dy);
    if (e.stopped ? d > 30 * U : d > 6 * U) { e.stopped = false; const m = Math.min(d, e.sp * dt); e.x += dx / d * m; e.y += dy / d * m; }
    else e.stopped = true;
    if (L0) e.dir = e.stopped ? dirOf(L0.x - e.x, L0.y - e.y) : dirOf(dx, dy);
    if (e.knock > 0) { e.x += e.kx * e.knock; e.y += e.ky * e.knock; e.knock *= 0.5; if (e.knock < 0.3) e.knock = 0; }
    if (e.kb > 0) {
      const ax = e.x - R.sq.x, ay = e.y - R.sq.y, n = Math.hypot(ax, ay) || 1, m = Math.min(e.kb, 700 * U * dt);
      const p = clampBox({ x: e.x + ax / n * m, y: e.y + ay / n * m }, enemyBox()); e.x = p.x; e.y = p.y; e.kb -= m;
    }
    for (const o of R.en) {
      if (o === e || o.dead) continue;
      const sx = e.x - o.x, sy = e.y - o.y, sd = Math.hypot(sx, sy);
      if (sd < 46 * U && sd > 0.01) { const push = (46 * U - sd) * 0.5 * Math.min(1, dt * 8); e.x += sx / sd * push; e.y += sy / sd * push; }
    }
    if (e.ranged && e.stopped && !ko) {
      if (e.wind > 0) { e.wind -= dt; if (e.wind <= 0) { lob(e); e.atk = rand(3, 4); } }
      else { e.atk -= dt; if (e.atk <= 0 && R.lobGap <= 0 && R.eb.length < 3 + Math.floor(save.stage / 2)) { e.wind = 0.4; R.lobGap = 0.8; } }
    }
  }
  const b = R.boss;
  if (b) {
    b.anim += dt; if (b.flash > 0) b.flash -= dt;
    if (b.arrive < 1) { b.arrive = Math.min(1, b.arrive + dt / 1.4); const p = along(F.A, lerp(40, -330, b.arrive) * U, 0); b.x = p.x; b.y = p.y; if (b.arrive >= 1) { R.shake = 5; puff(b.x - 30 * U, b.y, 2); puff(b.x + 30 * U, b.y, 2); } }
    else { b.t -= dt; if (b.t <= 0) bossFail(); else if (!ko) updateBossAI(b, dt); }
  }
  if (R.leavingBoss) { const lb = R.leavingBoss; lb.leaving += dt; lb.x += F.dir.x * 300 * U * dt; lb.y += F.dir.y * 300 * U * dt; if (lb.leaving > 2) R.leavingBoss = null; }
  const rate = fireRate();
  for (const h of R.heroes) {
    h.fireT -= dt;
    const tgt = ko ? null : nearestTarget(h);
    if (tgt && h.fireT <= 0) { h.fireT = 1 / rate; fire(h, tgt); }
  }
  for (const q of R.bul) {
    q.life -= dt; q.age += dt; q.tt -= dt;
    if (q.tt <= 0) {   // trail: ghost copies + a few element motes
      q.tt = 0.035; q.trail.unshift({ x: q.x, y: q.y }); if (q.trail.length > 3) q.trail.pop();
      const tr = q.g.trail;
      if (!save.eco && tr !== 'ghost' && Math.random() < 0.6) {
        const set = tr === 'snow' ? 'q_Snow' : tr === 'fire' ? 'q_Fire' : 'q_Spark', m = AN[set] || 1;
        part({ k: 'float', f: `${set}_${Math.floor(Math.random() * m)}`, x: q.x + rand(-4, 4) * U, y: q.y + rand(-4, 4) * U, vx: rand(-20, 20) * U, vy: rand(-20, 20) * U, life: 0.35, max: 0.35 });
      }
    }
    const t = q.tgt, alive = t && !t.dead && (t === R.boss || R.en.includes(t));
    if (alive) { const want = Math.atan2(aimY(t) - q.y, t.x - q.x); let da = want - q.a; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU; q.a += da * Math.min(1, dt * 16); }
    q.x += Math.cos(q.a) * q.sp * dt; q.y += Math.sin(q.a) * q.sp * dt;
    if (alive && Math.hypot(t.x - q.x, aimY(t) - q.y) < (t === R.boss ? 60 * U : 22 * U)) { q.dead = true; hitFx(q, t); damage(t, q.dmg, q.crit, t === R.boss); }
    if (q.life <= 0 || q.x > W + 100 || q.x < -100 || q.y < -100 || q.y > H + 100) q.dead = true;
  }
  updateEnemyShots(dt);
  for (const p of R.parts) {
    p.life -= dt;
    if (p.k === 'bit') { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 700 * U * dt; p.vx *= 0.98; }
    else if (p.k === 'float') { p.x += p.vx * dt; p.y += p.vy * dt; }
  }
  for (const t of R.txt) { t.life -= dt; t.y -= (t.kind === 'money' ? 40 : 30) * U * dt; }
  for (const m of R.coins) {
    m.t += dt;
    if (m.t < 0.4) { m.x += m.vx * dt; m.y += m.vy * dt; m.vy += 600 * U * dt; }
    else { const dx = F.wallet.x - m.x, dy = F.wallet.y - m.y, d = Math.hypot(dx, dy), sp = (700 + m.t * 900) * U; if (d < 16) { m.dead = true; R.walletPop = 0.12; } else { const k = Math.min(d, sp * dt); m.x += dx / d * k; m.y += dy / d * k; } }
  }
  R.en = R.en.filter(e => !e.dead); R.bul = R.bul.filter(q => !q.dead); R.parts = R.parts.filter(p => p.life > 0);
  R.txt = R.txt.filter(t => t.life > 0); R.coins = R.coins.filter(m => !m.dead);
  if (R.shake > 0) R.shake = Math.max(0, R.shake - dt * 30);
  if (R.flash > 0) R.flash = Math.max(0, R.flash - dt * 2);
  if (R.hurt > 0) R.hurt = Math.max(0, R.hurt - dt);
  if (R.joy) R.joy.t += dt;
  if (R.walletPop > 0) R.walletPop -= dt;
  musicTick(dt);
  runHooks('update', dt);
  R.earnT += dt; if (R.earnT >= 10) { save.rate = lerp(save.rate || 0, R.earned / R.earnT, 0.5); R.earned = 0; R.earnT = 0; }
}

// ================================================================ drawing (all in CSS px; the canvas transform maps to low-res pixels)
function render() {
  ctx.setTransform(1 / L, 0, 0, 1 / L, 0, 0); ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = INK; ctx.fillRect(0, 0, W + L, H + L);
  const sh = Math.round(R.shake / P), sx = sh ? Math.round(rand(-sh, sh)) * P : 0, sy = sh ? Math.round(rand(-sh, sh)) * P : 0;
  ctx.translate(sx, sy);
  const t = R.t;
  drawGroundTiles();
  drawGround(t);
  const list = [];
  for (const e of R.en) list.push({ y: e.y, k: 0, o: e });
  if (R.boss) list.push({ y: R.boss.y, k: 1, o: R.boss });
  if (R.leavingBoss) list.push({ y: R.leavingBoss.y, k: 1, o: R.leavingBoss });
  for (const h of R.heroes) list.push({ y: h.y, k: 2, o: h });
  list.sort((a, b) => a.y - b.y);
  ctx.globalAlpha = 0.8;
  for (const it of list) spr('shadow', it.o.x, it.o.y + P, it.k === 1 ? 4 : 1, 0.5, 0.5);
  ctx.globalAlpha = 1;
  for (const it of list) {
    const o = it.o;
    if (it.k === 0) {
      const fly = o.d.fly, n = Math.floor(o.anim * (o.stopped ? 4 : 8)) % 4;
      const name = `m_${o.type}_${o.dir}${n}`, lift = fly ? (5 + (Math.floor(t * 3 + o.id) % 2)) * P : 0;
      if (o.age < 0.2) ctx.globalAlpha = o.age / 0.2;
      spr(name, o.x, o.y - lift);
      if (o.flash > 0) spr(name, o.x, o.y - lift, 1, 0.5, 1, false, 0, '#ffffff');
      else if (o.wind > 0 && Math.floor(t * 16) % 2) spr(name, o.x, o.y - lift, 1, 0.5, 1, false, 0, '#fce2ca');
      ctx.globalAlpha = 1;
      if (o.hp < o.maxHp) drawBar(o.x, o.y - lift - 19 * P, 16, o.hp / o.maxHp);
    } else if (it.k === 1) {
      const n = AN['b_' + o.key] || 1, name = `b_${o.key}_${Math.floor(o.anim * 7) % n}`;
      ctx.globalAlpha = o.leaving ? Math.max(0, 1 - o.leaving / 2) : 1;
      spr(name, o.x, o.y);
      if (o.flash > 0) { ctx.globalAlpha *= 0.7; spr(name, o.x, o.y, 1, 0.5, 1, false, 0, '#ffffff'); }
      if (o.tele > 0 && Math.floor(t * 12) % 2) { ctx.globalAlpha = 0.45; spr(name, o.x, o.y, 1, 0.5, 1, false, 0, '#e0394c'); }
      ctx.globalAlpha = 1;
    } else {
      const sq = R.sq, ko = sq.ko > 0;
      const fr = o.atk > 0 ? 'a' : o.moving ? String(Math.floor(o.walk) % 4) : '0';
      const name = `h_${o.id}_${o.dir}${fr}`;
      ctx.globalAlpha = ko ? 0.4 : (sq.inv > 0 && Math.floor(t * 14) % 2 === 0) ? 0.5 : 1;
      spr(name, o.x, o.y);
      if (sq.hit > 0 && !ko) spr(name, o.x, o.y, 1, 0.5, 1, false, 0, '#ffffff');
      ctx.globalAlpha = 1;
    }
  }
  drawShots(t);
  // thrown weapons: fading ghost trail, then the weapon (never freely rotated: spin = frame flip, else 16 directions)
  for (const q of R.bul) {
    const g = q.g, n = AN['p_' + g.spr] || 1, sc = g.sc || 1;
    const name = g.spin ? `p_${g.spr}_${Math.floor(q.age * 20) % n}` : `p_${g.spr}_${Math.floor(q.age * 12) % n}`;
    const rot = g.spin ? 0 : Math.round((q.a - (g.ori || 0)) / (Math.PI / 8)) * (Math.PI / 8);
    for (let i = q.trail.length - 1; i >= 0; i--) { ctx.globalAlpha = 0.4 - i * 0.12; spr(name, q.trail[i].x, q.trail[i].y, sc, 0.5, 0.5, false, rot, g.trail === 'ghost' ? '#fce2ca' : null); }
    ctx.globalAlpha = 1;
    spr(name, q.x, q.y, sc, 0.5, 0.5, false, rot);
  }
  for (const p of R.parts) {
    const a = clamp(p.life / p.max, 0, 1);
    if (p.k === 'anim') {
      const n = AN[p.a] || 1, f = Math.min(n - 1, Math.floor((1 - a) * n));
      if (p.alpha) ctx.globalAlpha = p.alpha;
      spr(`${p.a}_${f}`, p.x, p.y, p.s, 0.5, p.ay);
      ctx.globalAlpha = 1;
    } else { ctx.globalAlpha = Math.min(1, a * 2); spr(p.f, p.x, p.y, 1, 0.5, 0.5, p.flip); ctx.globalAlpha = 1; }
  }
  drawSquadHp();
  for (const m of R.coins) spr(`coin_${Math.floor(m.t * 10 + m.ph) % 4}`, m.x, m.y, 1, 0.5, 0.5);
  for (const tx of R.txt) {
    ctx.globalAlpha = Math.min(1, tx.life * 4);
    const age = tx.max - tx.life, big = tx.kind === 'crit';
    btext(big ? tx.s + '!' : tx.kind === 'money' ? '+' + tx.s : tx.s, tx.x, tx.y, tx.kind === 'money' ? 'y' : big ? 'o' : tx.kind === 'hurt' ? 'r' : 'w', big ? (age < 0.08 ? 1.5 : 1) : 0.5);
  }
  ctx.globalAlpha = 1;
  runHooks('render', ctx);
  drawAmbient(t);
  ctx.setTransform(1 / L, 0, 0, 1 / L, 0, 0);
  grade();
  if (R.flash > 0) { ctx.fillStyle = `rgba(252,226,202,${R.flash})`; ctx.fillRect(0, 0, W, H); }
  if (R.hurt > 0) {
    const gr = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.4, W / 2, H / 2, Math.max(W, H) * 0.7);
    gr.addColorStop(0, 'rgba(143,62,86,0)'); gr.addColorStop(1, `rgba(143,62,86,${Math.min(0.45, R.hurt * 1.2)})`);
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
  }
  drawJoystick();
}
// colour grade: a soft per-region light, plus stepped dark bands behind the HUD and the card tray for legibility
function grade() {
  if (!save.eco) { ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = 0.3; ctx.fillStyle = biome().tint; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
  const steps = [[0, 0.32], [70, 0.22], [120, 0.12], [150, 0.05]];
  for (let i = 0; i < steps.length; i++) { const y0 = steps[i][0], y1 = i + 1 < steps.length ? steps[i + 1][0] : 170; prect(0, y0, W, y1 - y0, `rgba(19,27,27,${steps[i][1]})`); }
  const b0 = H - 175;
  [[0, 0.06], [12, 0.14], [24, 0.24]].forEach(([o, a]) => prect(0, b0 + o, W, 12, `rgba(19,27,27,${a})`));
  prect(0, b0 + 36, W, H - b0 - 36, 'rgba(19,27,27,0.32)');
}
function drawBar(cx, y, w, f, col = '#e0394c', lag = 0) {
  const pw = w * P, x = cx - pw / 2;
  prect(x + P, y, pw - 2 * P, 4 * P, INK); prect(x, y + P, pw, 2 * P, INK);
  prect(x + P, y + P, pw - 2 * P, 2 * P, '#5f7160');
  if (lag > f) prect(x + P, y + P, (pw - 2 * P) * clamp(lag, 0, 1), 2 * P, '#fce2ca');
  if (f > 0) prect(x + P, y + P, Math.max(P, Math.round((w - 2) * clamp(f, 0, 1)) * P), 2 * P, col);
}
function drawAmbient(t) {
  const b = biome(); if (!b.amb || save.eco) return;
  const n = AN[b.amb] || 1, upward = b.amb === 'q_Fire';
  while (R.amb.length < 10) R.amb.push({ x: Math.random() * W, y: Math.random() * H, s: rand(0.5, 1), ph: rand(0, 6), f: Math.floor(Math.random() * n) });
  ctx.globalAlpha = 0.75;
  for (const m of R.amb) {
    m.y += (upward ? -14 : 16) * m.s / 60; m.x += Math.sin(t * 0.8 + m.ph) * 0.35;
    if (m.y > H + 10) { m.y = -10; m.x = Math.random() * W; } if (m.y < -10) { m.y = H + 10; m.x = Math.random() * W; }
    spr(`${b.amb}_${(m.f + Math.floor(t * 3 + m.ph)) % n}`, m.x, m.y, 1, 0.5, 0.5);
  }
  ctx.globalAlpha = 1;
}
function ellipse(x, y, rx, ry) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); }
function drawGround(t) {
  const sq = R.sq, L0 = R.heroes[0];
  if (L0 && sq.ko <= 0) {
    ctx.lineWidth = P; ctx.strokeStyle = R.manual ? 'rgba(255,225,141,0.8)' : 'rgba(252,226,202,0.5)'; ctx.setLineDash([3 * P, 2 * P]); ctx.lineDashOffset = -t * 10 * P;
    ellipse(snap(L0.x), snap(L0.y + P), 12 * P, 5 * P); ctx.stroke(); ctx.setLineDash([]);
  }
  for (const p of R.eb) {
    if (p.k === 'lob') {
      const u = p.t / p.T;
      ctx.fillStyle = `rgba(224,57,76,${0.1 + 0.18 * u})`; ellipse(p.tx, p.ty, 13 * P, 6 * P); ctx.fill();
      ctx.lineWidth = P; ctx.strokeStyle = `rgba(224,57,76,${0.6 + 0.4 * (Math.floor(t * 10) % 2)})`; ellipse(p.tx, p.ty, 13 * P * (0.5 + 0.5 * u), 6 * P * (0.5 + 0.5 * u)); ctx.stroke();
    } else if (p.k === 'wave') {
      ctx.save(); ctx.translate(p.x, p.y); ctx.scale(1, 0.6); ctx.lineCap = 'butt';
      ctx.globalAlpha = Math.max(0, 1 - p.r / p.max) * 0.6 + 0.4;
      for (const [lw, col] of [[p.w + 2 * P, INK], [p.w, p.col], [P, '#fce2ca']]) { ctx.lineWidth = lw; ctx.strokeStyle = col; arcsWithGaps(p.r, p.gaps, 0.4); ctx.stroke(); }
      ctx.restore(); ctx.globalAlpha = 1;
    }
  }
  const b = R.boss;
  if (b && b.tele > 0 && b.teleK === 'slam') {
    ctx.save(); ctx.translate(b.x, b.y); ctx.scale(1, 0.6);
    ctx.lineWidth = 2 * P; ctx.strokeStyle = `rgba(224,57,76,${0.35 + 0.35 * (Math.floor(t * 10) % 2)})`; ctx.setLineDash([5 * P, 3 * P]);
    for (const rr of [140, 260, 380]) { arcsWithGaps(rr * U, b.gaps, 0.4); ctx.stroke(); }
    ctx.setLineDash([]); ctx.restore();
  }
}
function arcsWithGaps(r, gaps, gw) {
  const g = gaps.map(a => ((a % TAU) + TAU) % TAU).sort((a, c) => a - c);
  ctx.beginPath();
  for (let i = 0; i < g.length; i++) {
    const s0 = g[i] + gw; const e0 = (i + 1 < g.length ? g[i + 1] : g[0] + TAU) - gw;
    if (e0 <= s0) continue;
    ctx.moveTo(Math.cos(s0) * r, Math.sin(s0) * r); ctx.arc(0, 0, r, s0, e0);
  }
}
function drawShots(t) {
  for (const p of R.eb) {
    if (p.k === 'lob') {
      const u = p.t / p.T, x = lerp(p.sx, p.tx, u), y = lerp(p.sy, p.ty - 4 * P, u) - Math.sin(Math.PI * u) * 110 * U;
      spr(`p_SpriteSheetRock_${Math.floor(p.t * 10) % 4}`, x, y, 1, 0.5, 0.5);
    } else if (p.k === 'orb') {
      const n = AN['p_' + p.spr] || 1, o = ORI[p.spr];
      spr(`p_${p.spr}_${Math.floor(p.age * 10) % n}`, p.x, p.y, 1, 0.5, 0.5, false, o === undefined ? 0 : Math.round((p.a - o) / (Math.PI / 8)) * (Math.PI / 8));
    }
  }
}
function drawSquadHp() {
  const sq = R.sq, L0 = R.heroes[0]; if (!L0) return;
  const w = 22, x = clamp(L0.x, 16 * P, W - 14 * P), y = L0.y - 22 * P;
  const f = clamp(sq.hp / sq.maxHp, 0, 1);
  drawBar(x + 3 * P, y, w, f, sq.ko > 0 ? '#8e7c73' : f > 0.5 ? '#74a334' : f > 0.25 ? '#f1c471' : '#e0394c', clamp(sq.lag / sq.maxHp, 0, 1));
  spr('heart', x - w / 2 * P + P, y + 2 * P, 0.5, 0.5, 0.5);
}
function drawJoystick() {
  const j = R.joy; if (!j) return;
  ctx.globalAlpha = Math.min(1, j.t * 8);
  ctx.fillStyle = 'rgba(19,27,27,0.28)'; ellipse(j.ox, j.oy, JOY_R, JOY_R); ctx.fill();
  ctx.lineWidth = P; ctx.strokeStyle = 'rgba(252,226,202,0.6)'; ctx.stroke();
  let dx = j.x - j.ox, dy = j.y - j.oy; const d = Math.hypot(dx, dy), m = JOY_R * 0.6;
  if (d > m) { dx = dx / d * m; dy = dy / d * m; }
  const kx = j.ox + dx, ky = j.oy + dy, kr = 22;
  ctx.fillStyle = INK; ellipse(kx, ky + 3, kr + 3, kr + 3); ctx.fill();
  ctx.fillStyle = '#d78b4a'; ellipse(kx, ky + 2, kr, kr); ctx.fill();
  ctx.fillStyle = '#ffcb8d'; ellipse(kx, ky - 1, kr - 3, kr - 4); ctx.fill();
  ctx.globalAlpha = 1;
}

// ================================================================ HUD & UI
const cards = Array.from(document.querySelectorAll('.ucard'));
let uiKey = '', uiT = 0;
function ctrlBadge() {
  const c = $('ctrl'); if (!c) return;
  c.classList.toggle('manual', R.manual);
  c.querySelector('span').textContent = R.manual ? 'Kontrol sende' : 'Otomatik';
  if (R.manual) { $('hint').classList.add('gone'); try { localStorage.setItem('ss_hint', '1'); } catch (e) { /* ignore */ } }
}
function updateUI(dt) {
  uiT -= dt; if (uiT > 0 && uiKey) return; uiT = 0.12;
  const key = [Math.floor(save.money), save.gems, save.stage, save.sub, save.kills, save.bossReady, !!R.boss, R.boss ? Math.ceil(R.boss.hp) : 0, R.boss ? Math.ceil(R.boss.t) : 0, save.lv.power, save.lv.speed, save.lv.money, save.gun, save.team, save.auto, save.sound, R.phase].join('|');
  if (key === uiKey) return; uiKey = key;
  $('money').textContent = fmt(save.money);
  $('gems').textContent = fmt(save.gems);
  $('stageLbl').textContent = `${biome().name} · ${save.stage}-${save.sub}`;
  const pct = save.bossReady ? 100 : Math.round(save.kills / KILLS_PER_SUB * 100);
  $('subFill').style.width = pct + '%'; $('subPct').textContent = save.bossReady ? 'BOSS HAZIR' : pct + '%';
  const nodes = $('nodes');
  if (!nodes.children.length) { for (let i = 1; i <= SUBS; i++) { const n = document.createElement('div'); n.className = 'node' + (i === SUBS ? ' boss' : ''); if (i === SUBS) n.innerHTML = '<img alt="">'; else n.textContent = i; nodes.appendChild(n); } }
  Array.from(nodes.children).forEach((n, i) => {
    n.classList.toggle('done', i + 1 < save.sub);
    n.classList.toggle('cur', i + 1 === save.sub && i + 1 < SUBS);
    if (i + 1 === SUBS) n.querySelector('img').src = `assets/ui/boss_${bossKey()}.png`;
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
  $('bossBtnImg').src = `assets/ui/boss_${bossKey()}.png`;
  $('autoBtn').classList.toggle('on', save.auto);
  if (R.boss) {
    $('bossFill').style.width = Math.max(0, R.boss.hp / R.boss.maxHp * 100) + '%';
    $('bossHpTxt').textContent = fmt(Math.max(0, R.boss.hp));
    const bt = $('bossTime'); bt.textContent = Math.max(0, Math.ceil(R.boss.t)); bt.classList.toggle('low', R.boss.t < 8);
  }
  const gi = document.querySelector('.gunico'); if (gi) gi.src = `assets/ui/wi_${GUNS[save.gun].spr}.png`;
}
function buy(k) {
  const lv = save.lv[k], cost = COST[k](lv);
  if (k === 'speed' && fireRate() >= 12) return false;
  if (save.money < cost) { sfx('no'); return false; }
  save.money -= cost; save.lv[k]++; sfx('buy'); runHooks('buy', k); uiKey = '';
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
function banner(text, sub = '') { const b = $('banner'); b.innerHTML = text + (sub ? `<small>${sub}</small>` : ''); b.classList.remove('show'); void b.offsetWidth; b.classList.add('show'); }
function toast(text) { const t = $('toast'); t.textContent = text; t.classList.remove('show'); void t.offsetWidth; t.classList.add('show'); }

// ---------------- panels (weapons, team, rebirth, offline)
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
      const row = el(`<div class="row-card ${i === save.gun ? 'cur' : ''} ${owned || next ? '' : 'lock'}"><div class="ico tile"><img src="assets/ui/wi_${g.spr}.png" alt=""></div>
        <div class="info"><h4>${g.name}</h4><p>Hasar x${fmt(g.mult)}${g.shots > 1 ? ` · ${g.shots} atış` : ''}${g.boom ? ' · patlar' : ''}</p></div>
        ${i === save.gun ? '<button class="btn grey off">TAKILI</button>' : owned ? '<button class="btn grey off">AÇILDI</button>' : next ? `<button class="btn yellow"><img src="assets/ui/gem.png" alt="">${g.cost}</button>` : '<button class="btn grey off"><img src="assets/ui/lock.png" alt=""></button>'}</div>`);
      if (next) row.querySelector('.btn').onclick = () => { if (save.gems < g.cost) { sfx('no'); toast('Yeterli elmas yok'); return; } save.gems -= g.cost; save.gun = i; sfx('bonus', 0); persist(); uiKey = ''; PANELS.guns(); };
      body.appendChild(row);
    });
  }),
  team: () => openPanel('Takım', 'green', body => {
    body.appendChild(el('<p class="big-note">Her yeni ninja takıma bir atıcı daha ekler.</p>'));
    TEAM.forEach((h, i) => {
      const owned = i < save.team, next = i === save.team;
      const row = el(`<div class="row-card ${owned || next ? '' : 'lock'}"><div class="ico face"><img src="assets/ui/face_${heroId(i)}.png" alt=""></div>
        <div class="info"><h4>${h.name}</h4><p>${owned ? 'Takımda, atış yapıyor' : 'Takıma katılmayı bekliyor'}</p></div>
        ${owned ? '<button class="btn grey off">TAKIMDA</button>' : next ? `<button class="btn yellow"><img src="assets/ui/coin.png" alt="">${fmt(h.cost)}</button>` : '<button class="btn grey off"><img src="assets/ui/lock.png" alt=""></button>'}</div>`);
      if (next) row.querySelector('.btn').onclick = () => { if (save.money < h.cost) { sfx('no'); toast('Yeterli altın yok'); return; } save.money -= h.cost; save.team++; setupHeroes(); sfx('bonus', 0); persist(); uiKey = ''; PANELS.team(); };
      body.appendChild(row);
    });
  }),
  rebirth: () => openPanel('Yeniden Doğuş', 'purple', body => {
    const gain = rebirthGain();
    body.appendChild(el(`<div class="big-num">x${(1 + save.rp * 0.3).toFixed(1)}</div>`));
    body.appendChild(el('<p class="big-note">Kalıcı hasar ve para bonusun. Her doğuş puanı +%30 ekler.</p>'));
    body.appendChild(el(`<div class="row-card"><div class="ico tile"><img src="assets/ui/ic_rebirth.png" alt=""></div><div class="info"><h4>+${gain} doğuş puanı</h4>
      <p>${save.stage >= 6 ? 'Bölüm, seviyeler ve altın sıfırlanır. Elmas, silahlar ve takım kalır.' : '6. bölüme ulaşınca açılır.'}</p></div></div>`));
    const btn = el(`<button class="btn purple wide ${gain > 0 ? '' : 'off'}">YENİDEN DOĞ</button>`);
    btn.onclick = () => {
      if (gain <= 0) return;
      save.rp += gain; save.rebirths++; save.stage = 1; save.sub = 1; save.kills = 0; save.bossReady = false; save.money = 0; save.lv = { power: 0, speed: 0, money: 0 };
      R.en.length = 0; R.eb.length = 0; R.boss = null; $('bossHud').classList.add('hidden');
      persist(); R.bioEdge = -1e9; chunks.clear(); startAdvance(150 * U, 110 * U); musicUpdate(); closePanel(); banner('YENİDEN DOĞDUN!', `Bonus x${(1 + save.rp * 0.3).toFixed(1)}`); sfx('win', 0); uiKey = '';
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
    const btn = el('<button class="btn yellow wide"><img src="assets/ui/coin.png" alt="">TOPLA</button>');
    btn.onclick = () => { audioInit(); addMoney(gain, W / 2, H / 2, 16); sfx('gold', 0); closePanel(); persist(); };
    body.appendChild(btn);
  });
}

// ================================================================ loop
let last = performance.now(), saveT = 0, popOn = false;
function frame(now) {
  const dt = Math.min(1 / 20, (now - last) / 1000); last = now;
  update(dt); render(); updateUI(dt);
  const pop = R.walletPop > 0; if (pop !== popOn) { popOn = pop; $('money').parentNode.classList.toggle('pop', pop); }
  saveT += dt; if (saveT > 5) { saveT = 0; persist(); }
  requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange', () => { if (document.hidden) { persist(); for (const k in tracks) tracks[k].pause(); } else last = performance.now(); musicUpdate(); });
window.addEventListener('pagehide', persist);
const fontReady = document.fonts && document.fonts.load ? Promise.all([document.fonts.load('700 20px "Pixelify Sans"'), document.fonts.load('700 20px "SquadNum"', '0123')]).catch(() => {}) : Promise.resolve();
Promise.all([atlasReady, Promise.race([fontReady, new Promise(r => setTimeout(r, 1500))])]).then(() => {
  resize();
  $('loading').classList.add('hidden');
  try { if (localStorage.getItem('ss_hint')) $('hint').classList.add('gone'); } catch (e) { /* ignore */ }
  ctrlBadge();
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
  spr, sprT, rrect, biome, dmgPerShot, fireRate, moneyMul, enemyHp, buy, startBoss, setupHeroes, heroId,
  hurtSquad, knockout, sqMaxHp, heroBox, part, puff, confetti, bits, boom, addText, along, audioInit, musicUpdate,
  get squad() { return R.sq; }, get leader() { return R.heroes[0]; },
  get U() { return U; }, get W() { return W; }, get H() { return H; }, get DPR() { return DPR; }, get P() { return P; },
  refreshUI() { uiKey = ''; }, get sounds() { return Object.keys(SND); }, get music() { return musicKey; },
};
window.SwarmSquad = { save, R, buy, startBoss, fmt };
})();
