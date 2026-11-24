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
const SUF = ['', 'K', 'M', 'Mr', 'T'];   // Mr = milyar (a B looked like an 8 in the UI font)
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
const mainCtx = cv.getContext('2d', { alpha: false });
let ctx = mainCtx;
let W = 390, H = 844, DPR = 1, U = 1;
let K = 4, L = 1, P = 2, BW = 0, BH = 0;
// camera distance: device px per canvas px = ZOOM * U * DPR (rounded). 0.95 shows ~30% more field than the old 1.25.
const ZOOM = 0.95;   // K device px per canvas px, L = CSS px per canvas px, P = CSS px per art px
const F = {};
function resize() {
  DPR = window.devicePixelRatio || 1;
  W = window.innerWidth; H = window.innerHeight;
  U = clamp(Math.min(W, H * 0.56) / 390, 0.8, 1.7);
  K = Math.max(1, Math.round(ZOOM * U * DPR)); L = K / DPR; P = 2 * L;
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
// one-art-pixel coloured rim around a sprite (drawn underneath it): leader, evolved weapon, elites
function outline(name, x, y, col, sc = 1, a = 1) {
  const k = P * Math.max(1, Math.round(sc)), ga = ctx.globalAlpha; ctx.globalAlpha = ga * a;
  spr(name, x - k, y, sc, 0.5, 1, false, 0, col); spr(name, x + k, y, sc, 0.5, 1, false, 0, col);
  spr(name, x, y - k, sc, 0.5, 1, false, 0, col); spr(name, x, y + k, sc, 0.5, 1, false, 0, col);
  ctx.globalAlpha = ga;
}
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
// every boss mixes the shared patterns (fan, ring, slam) with two signature moves of its own
const BOSS_SIG = {
  GiantSlime2: ['summon', 'leap'], GiantFrog: ['leap', 'rain'], GiantBamboo: ['rain', 'summon'], GiantRacoon: ['charge', 'leap'],
  DemonCyclop: ['beam', 'charge'], GiantRacoonGold: ['rain', 'charge'], GiantSpirit: ['beam', 'summon'], TenguBlue: ['charge', 'rain'],
  GiantFlam: ['rain', 'beam'], TenguRed: ['charge', 'beam'],
};
const RAIN_SPR = { GiantFrog: 'EnergyBall', GiantBamboo: 'PlantSpike', GiantRacoonGold: 'CanonBall', TenguBlue: 'EnergyBall', GiantFlam: 'Fireball' };
const EDEF = {
  Slime3: { spd: 0.9 }, Mushroom: {}, Snake2: { spd: 1.2, ranged: 1 }, Butterfly: { fly: 1, spd: 1.3, hp: 0.8, ranged: 1 },
  Bamboo: { ranged: 1 }, KappaGreen: { hp: 1.3 }, Racoon: { spd: 1.3, hp: 0.8 }, SpiderRed: { spd: 1.4, hp: 0.7, ranged: 1 }, BlueBat: { fly: 1, spd: 1.4, hp: 0.7 },
  Lizard: { spd: 1.2 }, Mole: { hp: 1.4, spd: 0.8 }, Reptile2: { ranged: 1 }, YellowsBat: { fly: 1, spd: 1.4, hp: 0.7, ranged: 1 }, Skull: { ranged: 1 },
  Slime: {}, AxolotBlue: { spd: 1.2 }, Octopus2: { ranged: 1 }, Eye: { fly: 1, ranged: 1, hp: 0.8 }, SkullBlue: { hp: 1.5, spd: 0.8 },
  Flam: { ranged: 1, spd: 1.2 }, Spirit2: { fly: 1, hp: 0.8, ranged: 1 }, Cyclope: { hp: 1.3 }, Beast2: { hp: 2, spd: 0.7 }, LanternRed: { ranged: 1 },
};
// thrown weapons: ori = direction the art points; trail / hit choose the effects; sc = art scale (0.5 steps)
// thrown weapons. Every tier has its own behaviour and look:
//  ori = direction the art points; sc = art scale (0.5 steps); held = weapon drawn in the ninja's hand
//  curve (curved homing throw), bounce (ricochets), pierce (passes through N), stick (misses stick in the ground),
//  push (knock-back), boomer (boomerang), freeze (slows), burn (damage over time), boom (area blast), chain (lightning)
const GUNS = [
  { name: 'Shuriken', glow: 'gold',  evo: { name: 'Kasırga Yıldızı', sp: 'orbit',   desc: 'Hedefe giden shuriken kasırgası' },      mult: 1,   cost: 0,    spr: 'Shuriken',      spin: 1, sc: 1,   shots: 1, sp: 820,  curve: 0.55, bounce: 1, stick: 1,
    trail: 'ghost', hit: 'spark', snd: 'shoot', hsnd: 'hit', tags: ['Kavisli', 'Seker'] },
  { name: 'Kunai', glow: 'ink',   evo: { name: 'Kunai Yağmuru',   sp: 'rain',    desc: 'Gökten kunai yağar' },         mult: 2.5, cost: 5,    spr: 'Kunai',         ori: 0,  sc: 1,   shots: 1, sp: 1150, pierce: 1, stick: 1,
    trail: 'line', hit: 'cut', snd: 'throw2', hsnd: 'hit2', tags: ['Çok hızlı', 'Deler'] },
  { name: 'Üçlü Ok', glow: 'leaf',  evo: { name: 'Ok Yağmuru',      sp: 'volley',  desc: 'Kavisle düşen ok bulutu' },       mult: 6,   cost: 15,   spr: 'Arrow',         ori: 0,  sc: 1,   shots: 3, spread: 0.24, sp: 1100, stick: 1, held: 'wh_Bow',
    trail: 'line', hit: 'cut', bits: 'q_Wood', snd: 'throw2', hsnd: 'hit3', tags: ['3 ok', 'Yay'] },
  { name: 'Büyük Kunai', glow: 'magic', evo: { name: 'Gölge Hattı',     sp: 'column',  desc: 'Ekranı boydan yaran dev kunai' },   mult: 15,  cost: 40,   spr: 'BigKunai',      ori: 0,  sc: 0.5, shots: 1, sp: 1000, pierce: 3, push: 1, stick: 1,
    trail: 'line', hit: 'claw', snd: 'shoot', hsnd: 'hit2', tags: ['4 düşman deler', 'İter'] },
  { name: 'Büyü Yıldızı', glow: 'magic', evo: { name: 'Galaksi',         sp: 'galaxy',  desc: 'Üç dev yıldız bumerang' },  mult: 40,  cost: 100,  spr: 'ShurikenMagic', spin: 1, sc: 1,   shots: 1, sp: 760,  boomer: 1, held: 'wh_Wand',
    trail: 'spark', hit: 'star', snd: 'throw_magic', hsnd: 'magic', tags: ['Bumerang', 'Gidiş-dönüş keser'] },
  { name: 'Buz Mızrağı', glow: 'ice',   evo: { name: 'Buz Çiçeği',      sp: 'bloom',   desc: 'Alanı donduran buz patlaması' },   mult: 110, cost: 250,  spr: 'IceSpike',      ori: 0,  sc: 1,   shots: 1, sp: 1000, pierce: 1, freeze: 1, held: 'wh_Book',
    trail: 'snow', hit: 'ice', snd: 'throw_magic', hsnd: 'hit_ice', tags: ['Deler', 'Yavaşlatır'] },
  { name: 'Ateş Topu', glow: 'fire',  evo: { name: 'Meteor',          sp: 'meteor',  desc: 'Hedef işaretli gök taşları' },     mult: 300, cost: 600,  spr: 'Fireball',      ori: -Math.PI / 4, sc: 1, shots: 1, sp: 760, wobble: 1, boom: 1, burn: 1, held: 'wh_Wand',
    trail: 'fire', hit: 'fire', snd: 'throw_fire', hsnd: 'hit_fire', tags: ['Patlar', 'Yakar'] },
  { name: 'Ruh Küresi', glow: 'ice',   evo: { name: 'Gök Gürültüsü',   sp: 'thunder', desc: 'Gökten inen zincir şimşekler' },    mult: 900, cost: 1500, spr: 'BigEnergyBall', ori: -Math.PI / 2, sc: 1, shots: 1, sp: 700, boom: 1, chain: 3, held: 'wh_Book',
    trail: 'aura', hit: 'thunder', snd: 'throw_magic', hsnd: 'magic', tags: ['Zincir şimşek x3', 'Patlar'] },
  // Neo Ninja: the late-game line (energy weapons, original art from tools/build_neo.py)
  { name: 'Plazma Shuriken', neo: 1, glow: 'neon', evo: { name: 'Plazma Kasırgası', sp: 'orbit', desc: 'Etrafında dönen plazma yıldızları' }, mult: 2500, cost: 2000, spr: 'Plasma', spin: 1, sc: 1, shots: 2, spread: 0.3, sp: 900, curve: 0.4, bounce: 2,
    trail: 'neon', hit: 'plasma', snd: 'throw_magic', hsnd: 'magic', tags: ['2 yıldız', 'İki kez seker'] },
  { name: 'Lazer Kunai', neo: 1, glow: 'laser', evo: { name: 'Lazer Yağmuru', sp: 'rain', desc: 'Gökten lazer kunai yağar' }, mult: 7000, cost: 2800, spr: 'Laser', ori: 0, sc: 1, shots: 1, sp: 1700, pierce: 4,
    trail: 'line', hit: 'laser', snd: 'throw2', hsnd: 'hit2', tags: ['Işık hızında', '5 düşman deler'] },
  { name: 'Enerji Katana', neo: 1, glow: 'neon', evo: { name: 'Kılıç Hattı', sp: 'column', desc: 'Ekranı boydan yaran enerji kesiği' }, mult: 20000, cost: 3800, spr: 'Katana', ori: 0, sc: 1, shots: 1, sp: 950, pierce: 6, push: 1, held: 'wh_Katana',
    trail: 'neon', hit: 'wave', snd: 'shoot', hsnd: 'hit2', tags: ['Enerji dalgası', '7 düşman deler', 'İter'] },
  { name: 'Ray Yay', neo: 1, glow: 'neon', evo: { name: 'Ray Yağmuru', sp: 'volley', desc: 'Gökten düşen enerji okları' }, mult: 56000, cost: 5000, spr: 'Rail', ori: 0, sc: 1, shots: 3, spread: 0.2, sp: 1500, chain: 2, held: 'wh_NeoBow',
    trail: 'line', hit: 'plasma', snd: 'throw2', hsnd: 'hit3', tags: ['3 ok', 'Zincir şimşek x2'] },
  { name: 'Drone Kunai', neo: 1, glow: 'laser', evo: { name: 'Sürü Protokolü', sp: 'galaxy', desc: 'Üç dev drone hedef avlar' }, mult: 160000, cost: 6500, spr: 'Drone', spin: 1, sc: 1, shots: 2, spread: 0.5, sp: 650, curve: 0.9, boom: 1,
    trail: 'neon', hit: 'drone', snd: 'throw_magic', hsnd: 'magic', tags: ['2 drone', 'Hedef avlar', 'Patlar'] },
];
const TRAIL_COL = { gold: '#ffe18d', magic: '#d3a2c0', fire: '#ff9554', ice: '#8feff1', leaf: '#adbc3a', ink: '#8d977f', neon: '#3fd0e8', laser: '#ff4fb0', dragon: '#ff7a2e', lotus: '#6fb6ff', sakura: '#f9a3c8', moon: '#b9b4e6' };
const ORI = { EnergyBall: -Math.PI / 2, PlantSpike: 0, Fireball: -Math.PI / 4, IceSpike: 0 };
const TEAM = [
  { id: 'NinjaBlue',   name: 'Kaptan',  cost: 0,    perk: 'Mangayı yönetir' },
  { id: 'NinjaRed',    name: 'Kızıl',   cost: 800,  perk: 'Takıma +%10 atış hızı' },
  { id: 'NinjaYellow', name: 'Altın',   cost: 5e6,  perk: 'Takıma +%20 altın' },
  { id: 'NinjaBomb',   name: 'Bombacı', cost: 5e11, perk: 'Atışların %20si patlar (alan hasarı)' },
  { id: 'NinjaMasked', name: 'Maske',   cost: 5e17, perk: '+%6 kritik şansı' },
];
const SLOTS = [[0, 0], [-0.75, -0.25], [0.75, -0.25], [-0.38, 0.7], [0.38, 0.7]];
// more, weaker enemies (x0.55 HP, x0.6 gold each, 14 kills per step) keep the time and gold per step about the
// same as the old 8-kill waves but make every wave a crowd to mow down
const SUBS = 5, KILLS_PER_SUB = 20, BOSS_TIME = 30, EHP = 0.4, EGOLD = 0.45;

// ================================================================ save
const SAVE_KEY = 'swarmsquad_idle_v1';
const DEF = { money: 0, gems: 0, stage: 1, sub: 1, kills: 0, bossReady: false, lv: { power: 0, speed: 0, money: 0 }, gun: 0, team: 1, rebirths: 0, rp: 0, auto: true, sound: true, music: true, t: 0, rate: 0, best: 1 };
// auto boss is always on now (the OTO toggle was removed)
const save = (() => { let s = null; try { s = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { s = null; }
  const d = JSON.parse(JSON.stringify(DEF)); if (s && typeof s === 'object') { Object.assign(d, s); d.lv = Object.assign({ power: 0, speed: 0, money: 0 }, s.lv || {}); } return d; })();
function persist() { if (R.noSave) return; save.t = Date.now(); try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* storage blocked */ } }

// ================================================================ economy
const rebirthMul = () => 1 + save.rp * 0.3;
// Balance (checked with an economy simulation): enemy HP grows x1.30 per stage step but gold only x1.28, power
// costs grow faster than power, and the gold card is linear — so progress is quick at first, then slows into
// walls that weapons (gems) and rebirth break through. Rebirth pays off around stage 25-30.
const SPEED_CAP = 10;
const stat = { power: l => 6 * Math.pow(1.18, l), speed: l => Math.min(SPEED_CAP, 1.2 + 0.06 * l), money: l => 1 + 0.15 * l };
const COST = { power: l => 8 * Math.pow(1.25, l), speed: l => 12 * Math.pow(1.28, l), money: l => 15 * Math.pow(1.2, l) };
// multiplicative mods (dmg, rate, money, ehp = enemy HP, boss = damage to bosses, hp = squad HP, taken = damage the squad takes, rgems = rebirth gems)
// and additive ones (crit chance, critDmg, bossTime seconds, treasure chance, offH offline hours), fed by features (Ruh Ağacı, perks ...)
const MODS = { dmg: [], rate: [], money: [], ehp: [], boss: [], hp: [], ult: [], taken: [], rgems: [], crit: [], critDmg: [], bossTime: [], treasure: [], offH: [], shots: [], pierce: [], bounce: [] };
const modMul = k => MODS[k].reduce((m, f) => m * (f() || 1), 1);
const modAdd = k => MODS[k].reduce((m, f) => m + (f() || 0), 0);
// weapon stars (1-5, bought with gems): +30% damage per star, +1 projectile at 3 stars, evolution at 5 stars
if (!Array.isArray(save.wstar)) save.wstar = [];
if (typeof save.wbest !== 'number') save.wbest = save.gun;
const star = i => clamp(save.wstar[i] || 1, 1, 5);
const evolved = (i = save.gun) => star(i) >= 5;
const starCost = (i, s) => Math.max(2, Math.round(Math.max(GUNS[i].cost, 5) * 0.35 * s));
const shotsOf = g => g.shots + (star(GUNS.indexOf(g)) >= 3 ? 1 : 0);
const dmgPerShot = () => stat.power(save.lv.power) * GUNS[save.gun].mult * (1 + 0.3 * (star(save.gun) - 1)) * (evolved() ? 1.5 : 1) * rebirthMul() * modMul('dmg');
const fireRate = () => stat.speed(save.lv.speed) * modMul('rate') * (R.ultT > 0 ? 3 : 1);
const moneyMul = () => stat.money(save.lv.money) * rebirthMul() * modMul('money');
const stageIdx = () => (save.stage - 1) * SUBS + (save.sub - 1);
const enemyHp = () => 10 * Math.pow(1.3, stageIdx()) * modMul('ehp');
const reward = () => 10 * Math.pow(1.28, stageIdx());
const bossHp = () => 10 * Math.pow(1.3, (save.stage - 1) * SUBS + SUBS - 1) * 22 * modMul('ehp');
const bossTime = () => BOSS_TIME + modAdd('bossTime');
const biome = () => BIOMES[(save.stage - 1) % BIOMES.length];
const bossKey = () => { const b = biome(); return b.bosses[Math.floor((save.stage - 1) / BIOMES.length) % b.bosses.length]; };
// rebirth points grow x1.18 per stage (from stage 8): each rebirth then pushes the wall ~10-15 stages further
// instead of stalling (a linear formula flattened out after 3-4 rebirths in the economy simulation)
const REBIRTH_MIN = 8;
const rebirthGain = () => save.stage >= REBIRTH_MIN ? Math.floor(2 * Math.pow(1.18, save.stage - REBIRTH_MIN)) : 0;
const rebirthGems = g => g > 0 ? Math.round((5 + Math.min(60, Math.floor(Math.log2(g + 1) * 4))) * modMul('rgems')) : 0;
const heroId = i => (i === 0 && save.skin) ? save.skin : TEAM[i].id;
// hero levels (1-20): scrolls (Parşömen) from bosses + gold. Each level: +8% damage for that ninja's throws and a
// stronger team perk. Levels survive rebirth.
const HERO_MAX = 20;
if (!Array.isArray(save.hlv)) save.hlv = [];
if (!Array.isArray(save.scrolls)) save.scrolls = [];
const hlv = i => clamp(save.hlv[i] || 1, 1, HERO_MAX);
const heroMul = i => 1 + 0.08 * (hlv(i) - 1);
const scrollNeed = lv => lv * 2;
const heroCost = lv => reward() * 40 * lv;
const PERK_TXT = [
  l => `Takım canı +%${4 * (l - 1)}`, l => `Takıma +%${10 + (l - 1)} atış hızı`, l => `Takıma +%${20 + 2 * (l - 1)} altın`,
  l => `Atışların %${20 + (l - 1)}'si patlar (alan hasarı)`, l => `+%${(6 + 0.5 * (l - 1)).toFixed(1).replace('.0', '')} kritik şansı`];
function giveScroll(n, x, y) {
  const owned = Math.max(1, save.team), i = Math.floor(Math.random() * owned);
  save.scrolls[i] = (save.scrolls[i] || 0) + n;
  if (x !== undefined) { addText(x, y, '+' + n, 'gem'); }
  const ready = hlv(i) < HERO_MAX && save.scrolls[i] >= scrollNeed(hlv(i));
  toast(`Parşömen +${n} · ${TEAM[i].name}${ready ? ' · seviye atlayabilir!' : ''}`);
}

// ================================================================ audio
// Signal chain:  samples ─┬─> sfx bus ──> gentle high-cut ──┐
//                         └─> reverb send ─> short room ────┼─> soft compressor ─> master ─> out
//   music <audio> ──> music bus ──> low-pass (muffles while a panel is open or the squad is down) ─┘
//   wind bed (filtered noise, slow swell per region) ──> ambience gain ───────────────────────────┘
// Effects are pitched to a pentatonic scale for kill streaks, coin pickups and repeated purchases, panned by
// screen position, and every sample is the pack's softest, high-cut and loudness-matched (see build_assets.py).
let AC = null, master = null, sfxBus = null, musBus = null, musFilter = null, ambGain = null, ambFilter = null, noiseBuf = null, routed = false;
const SND = {};
if (!save.vol || typeof save.vol !== 'object') save.vol = { master: 0.8, music: 0.6, sfx: 0.8 };
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
function applyVol() {
  if (!AC) return;
  const v = save.vol, now = AC.currentTime;
  master.gain.setTargetAtTime(save.sound === false && save.music === false ? 0 : 0.75 * v.master, now, 0.05);
  sfxBus.gain.setTargetAtTime(save.sound === false ? 0 : v.sfx, now, 0.05);
  musBus.gain.setTargetAtTime(save.music === false ? 0 : v.music, now, 0.05);
}
function audioInit() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); musicUpdate(); return; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    const comp = AC.createDynamicsCompressor(); comp.threshold.value = -20; comp.knee.value = 20; comp.ratio.value = 3.5; comp.attack.value = 0.006; comp.release.value = 0.25;
    master = AC.createGain(); comp.connect(master); master.connect(AC.destination);
    const hc = AC.createBiquadFilter(); hc.type = 'lowpass'; hc.frequency.value = 7000; hc.Q.value = 0.4; hc.connect(comp);
    sfxBus = AC.createGain(); sfxBus.connect(hc);
    // short, warm room: generated impulse response, mixed low so effects sit in one shared space
    const n = Math.floor(AC.sampleRate * 1.4), ir = AC.createBuffer(2, n, AC.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.2); }
    const rev = AC.createConvolver(); rev.buffer = ir; const send = AC.createGain(); send.gain.value = 0.16;
    const revLp = AC.createBiquadFilter(); revLp.type = 'lowpass'; revLp.frequency.value = 3200;
    sfxBus.connect(send); send.connect(rev); rev.connect(revLp); revLp.connect(comp);
    musFilter = AC.createBiquadFilter(); musFilter.type = 'lowpass'; musFilter.frequency.value = 16000; musFilter.Q.value = 0.5;
    musBus = AC.createGain(); musBus.connect(musFilter); musFilter.connect(comp);
    // wind bed
    noiseBuf = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate);
    { const d = noiseBuf.getChannelData(0); let b0 = 0; for (let i = 0; i < d.length; i++) { b0 = 0.985 * b0 + 0.015 * (Math.random() * 2 - 1); d[i] = b0 * 6; } }
    const ns = AC.createBufferSource(); ns.buffer = noiseBuf; ns.loop = true;
    ambFilter = AC.createBiquadFilter(); ambFilter.type = 'bandpass'; ambFilter.frequency.value = 500; ambFilter.Q.value = 0.7;
    ambGain = AC.createGain(); ambGain.gain.value = 0; ns.connect(ambFilter); ambFilter.connect(ambGain); ambGain.connect(sfxBus); ns.start();
    routed = location.protocol !== 'file:' && !!AC.createMediaElementSource;
    applyVol();
    const D = window.SFXDATA || {};
    for (const k in D) {
      const bin = atob(D[k]), buf = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      try { AC.decodeAudioData(buf.buffer, bb => { SND[k] = bb; }, () => {}); } catch (e) { /* unsupported */ }
    }
  } catch (e) { AC = null; }
  musicUpdate();
}
// name: [samples, volume, pitch jitter, minimum gap]
const SFXMAP = {
  shoot: [['throw'], 0.1, 0.12, 0.12], throw2: [['throw2'], 0.1, 0.1, 0.12], throw_fire: [['throw_fire'], 0.12, 0.08, 0.15], throw_magic: [['throw_magic'], 0.1, 0.1, 0.14],
  hit: [['hit'], 0.13, 0.15, 0.07], hit2: [['hit2'], 0.12, 0.12, 0.07], hit3: [['hit3'], 0.12, 0.12, 0.07], hit_ice: [['hit_ice'], 0.14, 0.1, 0.09], hit_fire: [['hit_fire'], 0.14, 0.1, 0.12],
  kill: [['kill'], 0.26, 0, 0.04], coin: [['coin'], 0.1, 0, 0.05], tick: [['tick'], 0.08, 0, 0.03], gem: [['gem'], 0.3, 0, 0.1],
  buy: [['buy'], 0.22, 0, 0.05], no: [['no'], 0.2, 0, 0.25], boom: [['boom'], 0.24, 0.1, 0.14], boss: [['boss'], 0.45, 0, 0.5],
  win: [['win'], 0.42, 0, 0.5], fail: [['fail'], 0.34, 0, 0.5], hurt: [['hurt'], 0.2, 0.1, 0.15], voice: [['voice'], 0.16, 0.12, 0.4],
  lob: [['lob'], 0.12, 0.12, 0.15], click: [['click'], 0.26, 0.04, 0.05], magic: [['magic'], 0.26, 0.05, 0.1], gold: [['gold'], 0.28, 0, 0.2],
  bonus: [['bonus'], 0.32, 0, 0.2], accept: [['accept'], 0.3, 0, 0.1], open: [['open'], 0.22, 0, 0.08], close: [['close'], 0.18, 0, 0.08],
  skill: [['skill'], 0.4, 0, 0.3], stage: [['stage'], 0.2, 0, 0.6], elite: [['elite'], 0.24, 0, 0.5], treasure: [['treasure'], 0.32, 0, 0.5],
};
const sndLast = {};
function sfx(n, gap, x, semi) {
  if (!AC || save.sound === false) return;
  const m = SFXMAP[n]; if (!m) return;
  const now = AC.currentTime; if (sndLast[n] && now - sndLast[n] < (gap === 0 ? 0 : Math.max(gap || 0, m[3]))) return; sndLast[n] = now;
  const sy = SYN[n], pan = x !== undefined ? clamp(x / W * 2 - 1, -1, 1) * 0.55 : 0;
  if (sy) { try { sy[0](semi || 0, pan); } catch (e) { /* synth unavailable */ } if (!sy[1]) return; }
  const bf = SND[pick(m[0])]; if (!bf) return;
  const s = AC.createBufferSource(), g = AC.createGain();
  s.buffer = bf; s.playbackRate.value = Math.pow(2, (semi || 0) / 12) * (1 + (Math.random() * 2 - 1) * m[2]); g.gain.value = m[1] * (sy ? sy[1] : 1);
  s.connect(g);
  if (x !== undefined && AC.createStereoPanner) { const pn = AC.createStereoPanner(); pn.pan.value = clamp(x / W * 2 - 1, -1, 1) * 0.55; g.connect(pn); pn.connect(sfxBus); }
  else g.connect(sfxBus);
  s.start();
}
// ---------------- synthesized layer
// Every event is tuned to one key (D major pentatonic) so kill streaks, coin pickups and rewards play as little
// melodies instead of noise. Voices: pluck (kalimba-like), bell (FM chime), whoosh (filtered noise sweep),
// thump (pitch-dropping sine for weight), horn (filtered saw). Samples from the pack stay underneath where they add
// texture (impacts, explosions, voices); SYN[name] = [voice, sample level (0 = synth only)].
const KEY = 587.33;   // D5
const PEN = [0, 2, 4, 7, 9];
const pf = st => KEY * Math.pow(2, st / 12);
const penta = k => { const o = Math.floor(k / 5), i = ((k % 5) + 5) % 5; return PEN[i] + 12 * o; };
function out(pan, t) {   // per-voice gain -> (pan) -> sfx bus
  const g = AC.createGain(); g.gain.value = 0;
  if (pan && AC.createStereoPanner) { const p = AC.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(sfxBus); } else g.connect(sfxBus);
  return g;
}
function env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
function pluck(f, vol, d = 0.35, pan = 0, dt = 0) {
  const t = AC.currentTime + dt, g = out(pan), lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.min(9000, f * 5); lp.connect(g);
  const o1 = AC.createOscillator(), o2 = AC.createOscillator(), g2 = AC.createGain();
  o1.type = 'triangle'; o1.frequency.value = f; o2.type = 'sine'; o2.frequency.value = f * 4.01; g2.gain.value = 0.18;
  o1.connect(lp); o2.connect(g2); g2.connect(lp);
  g2.gain.setValueAtTime(0.25, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.06);   // bright tine attack
  env(g, t, 0.004, vol, d); o1.start(t); o2.start(t); o1.stop(t + d + 0.05); o2.stop(t + d + 0.05);
}
function bell(f, vol, d = 0.9, pan = 0, dt = 0, ratio = 3.5) {
  const t = AC.currentTime + dt, g = out(pan), c = AC.createOscillator(), m = AC.createOscillator(), mg = AC.createGain();
  c.type = 'sine'; c.frequency.value = f; m.type = 'sine'; m.frequency.value = f * ratio;
  mg.gain.setValueAtTime(f * 2.2, t); mg.gain.exponentialRampToValueAtTime(f * 0.05, t + d * 0.7);
  m.connect(mg); mg.connect(c.frequency); c.connect(g);
  env(g, t, 0.003, vol, d); c.start(t); m.start(t); c.stop(t + d + 0.05); m.stop(t + d + 0.05);
}
function whoosh(f0, f1, d, vol, pan = 0, q = 1.2) {
  if (!noiseBuf) return;
  const t = AC.currentTime, src = AC.createBufferSource(), bp = AC.createBiquadFilter(), g = out(pan);
  src.buffer = noiseBuf; bp.type = 'bandpass'; bp.Q.value = q; bp.frequency.setValueAtTime(f0, t); bp.frequency.exponentialRampToValueAtTime(f1, t + d);
  src.connect(bp); bp.connect(g); env(g, t, d * 0.3, vol, d * 0.7); src.start(t, Math.random()); src.stop(t + d + 0.05);
}
function thump(f0, f1, d, vol, pan = 0, dt = 0) {
  const t = AC.currentTime + dt, o = AC.createOscillator(), g = out(pan);
  o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + d); o.connect(g);
  env(g, t, 0.004, vol, d); o.start(t); o.stop(t + d + 0.05);
}
function horn(f, d, vol, dt = 0) {
  const t = AC.currentTime + dt, o = AC.createOscillator(), lp = AC.createBiquadFilter(), g = out(0), lfo = AC.createOscillator(), lg = AC.createGain();
  o.type = 'sawtooth'; o.frequency.value = f; lp.type = 'lowpass'; lp.frequency.setValueAtTime(300, t); lp.frequency.linearRampToValueAtTime(900, t + d * 0.4); lp.frequency.linearRampToValueAtTime(400, t + d);
  lfo.frequency.value = 5.5; lg.gain.value = f * 0.012; lfo.connect(lg); lg.connect(o.frequency);
  o.connect(lp); lp.connect(g); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.06); g.gain.setValueAtTime(vol, t + d * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.start(t); lfo.start(t); o.stop(t + d + 0.05); lfo.stop(t + d + 0.05);
}
function arp(steps, vol, gap, voice = bell, d = 0.8) { steps.forEach((k, i) => voice(pf(penta(k)), vol, d, 0, i * gap)); }
// music ducks under big moments so rewards are heard clearly
function duck(depth = 0.45, hold = 0.9) {
  if (!musBus) return; const t = AC.currentTime, v = save.music === false ? 0 : save.vol.music;
  musBus.gain.cancelScheduledValues(t); musBus.gain.setTargetAtTime(v * depth, t, 0.04); musBus.gain.setTargetAtTime(v, t + hold, 0.35);
}
const SYN = {
  shoot: [(s, p) => whoosh(2600, 900, 0.1, 0.05, p), 0.45],
  throw2: [(s, p) => whoosh(3400, 1300, 0.08, 0.045, p, 1.6), 0.4],
  throw_magic: [(s, p) => { whoosh(2000, 900, 0.12, 0.04, p); bell(pf(penta(10 + Math.floor(Math.random() * 5))), 0.018, 0.25, p); }, 0.35],
  throw_fire: [(s, p) => { whoosh(900, 260, 0.2, 0.07, p, 0.8); }, 0.5],
  hit: [(s, p) => thump(190, 70, 0.07, 0.07, p), 1], hit2: [(s, p) => thump(220, 80, 0.06, 0.06, p), 1], hit3: [(s, p) => thump(200, 75, 0.06, 0.06, p), 1],
  hit_ice: [(s, p) => bell(pf(penta(12)), 0.02, 0.2, p), 0.9], hit_fire: [(s, p) => thump(150, 50, 0.1, 0.07, p), 1],
  kill: [(s, p) => { pluck(pf(s - 12), 0.09, 0.32, p); thump(130, 50, 0.08, 0.05, p); }, 0.45],   // s = streak step: the combo plays a melody
  coin: [() => {}, 0.6],
  tick: [(s, p) => bell(pf(s - 5), 0.022, 0.16, p, 0, 2), 0],
  gem: [() => { bell(pf(12), 0.07, 0.9); bell(pf(19), 0.05, 0.9, 0, 0.07); duck(0.7, 0.4); }, 0],
  buy: [(s) => { pluck(pf(penta(Math.floor(s / 2.4))), 0.08, 0.22); thump(400, 200, 0.03, 0.03); }, 0],
  no: [() => { pluck(pf(-12 + 3), 0.06, 0.12); pluck(pf(-12), 0.06, 0.2, 0, 0.08); }, 0],
  click: [() => { pluck(pf(0) * 2, 0.035, 0.05); }, 0],
  open: [() => { pluck(pf(0), 0.05, 0.12); pluck(pf(7), 0.05, 0.18, 0, 0.05); }, 0],
  close: [() => { pluck(pf(7), 0.045, 0.1); pluck(pf(0), 0.045, 0.16, 0, 0.05); }, 0],
  accept: [() => { pluck(pf(4), 0.06, 0.2); pluck(pf(9), 0.06, 0.3, 0, 0.06); }, 0],
  bonus: [() => { arp([5, 7, 9, 10], 0.05, 0.06); duck(0.6, 0.6); }, 0],
  stage: [() => { bell(pf(0), 0.04, 0.6); bell(pf(7), 0.035, 0.7, 0, 0.09); }, 0],
  treasure: [() => { arp([5, 6, 7, 8, 9, 10, 12], 0.04, 0.045, bell, 0.5); }, 0.5],
  win: [() => { duck(0.35, 1.6); thump(110, 45, 0.35, 0.12); [0, 4, 7, 12].forEach((st, i) => bell(pf(st), 0.07, 1.4, (i - 1.5) * 0.2, i * 0.09)); pluck(pf(-12), 0.08, 1.2, 0, 0.36); pluck(pf(-5), 0.06, 1.2, 0, 0.36); }, 0],
  fail: [() => { duck(0.5, 1.2); [7, 3, 0].forEach((st, i) => pluck(pf(st - 12), 0.07, 0.5, 0, i * 0.16)); thump(90, 40, 0.4, 0.07, 0, 0.32); }, 0],
  boss: [() => { duck(0.4, 1.4); thump(85, 38, 0.6, 0.16); thump(85, 38, 0.6, 0.12, 0, 0.32); bell(110, 0.06, 2.2, 0, 0, 1.4); horn(73.4, 1.1, 0.05, 0.1); }, 0.5],
  elite: [() => { horn(146.8, 0.45, 0.04); }, 0.4],
  skill: [() => { arp([7, 9, 12, 14], 0.035, 0.05, bell, 0.6); whoosh(600, 3000, 0.4, 0.05); }, 0.5],
  magic: [(s, p) => { bell(pf(penta(8 + Math.floor(Math.random() * 6)) + s * 0), 0.025, 0.4, p); }, 0.6],
  gold: [() => { arp([0, 2, 4, 5, 7], 0.04, 0.04, bell, 0.45); }, 0.5],
  boom: [(s, p) => thump(120, 35, 0.25, 0.1, p), 0.8],
};
// soft synthesized footstep (filtered noise tap) for the march
function step(x) {
  if (!AC || save.sound === false || !noiseBuf) return;
  const s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain(), t = AC.currentTime;
  s.buffer = noiseBuf; f.type = 'lowpass'; f.frequency.value = 380 + Math.random() * 120;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.09, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
  s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t, Math.random()); s.stop(t + 0.1);
}
const AMB = { forest: [520, 0.022], grass: [620, 0.02], sand: [300, 0.026], snow: [1300, 0.024], ash: [180, 0.03] };
const tracks = {};
let musicKey = null, muffled = null;
function musicUpdate() {
  const want = (save.music !== false && AC && !document.hidden) ? biome().ground : null;
  if (want !== musicKey) {
    musicKey = want;
    if (want && !tracks[want]) {
      const a = new Audio('assets/music/' + want + '.mp3'); a.loop = true; a.volume = 0; a.preload = 'auto'; a.fade = 0; tracks[want] = a;
      if (routed) { try { AC.createMediaElementSource(a).connect(musBus); a.routed = true; } catch (e) { a.routed = false; } }
    }
  }
}
function musicTick(dt) {
  musicUpdate();
  if (!AC) return;
  for (const k in tracks) {
    const a = tracks[k], target = k === musicKey ? (R.boss ? 0.85 : 1) : 0;
    a.fade = clamp(a.fade + clamp(target - a.fade, -dt * 0.35, dt * 0.35), 0, 1);
    a.volume = clamp(a.routed ? a.fade : a.fade * save.vol.music * save.vol.master * 0.5, 0, 1);
    if (target > 0 && a.paused) a.play().catch(() => {});
    if (target === 0 && a.fade <= 0.001 && !a.paused) a.pause();
  }
  const muff = panelOpen() || (R.sq && R.sq.ko > 0);
  if (muff !== muffled) { muffled = muff; musFilter.frequency.setTargetAtTime(muff ? 650 : 16000, AC.currentTime, 0.25); }
  const am = AMB[biome().ground] || AMB.forest, sw = 0.6 + 0.4 * Math.sin(R.t * 0.21) * Math.sin(R.t * 0.13 + 1);
  ambFilter.frequency.setTargetAtTime(am[0] * (0.85 + 0.3 * sw), AC.currentTime, 0.5);
  ambGain.gain.setTargetAtTime(save.eco ? 0 : am[1] * sw, AC.currentTime, 0.5);
}

// ================================================================ runtime state
const R = { fx: 0, en: [], bul: [], eb: [], parts: [], txt: [], coins: [], boss: null, t: 0, shake: 0, flash: 0, hurt: 0, earned: 0, earnT: 0, retryT: 0,
  heroes: [], amb: [], nextId: 1, walletPop: 0, leavingBoss: null, lobGap: 0, sq: null, joy: null,
  cam: 0, phase: 'advance', advLeft: 120, advSpd: 160, waveT: 0, toSpawn: 0, spawnT: 0, bioEdge: -1e9, oldBio: null, manual: false, ctrlT: 0, hintT: 0, ult: 0, ultT: 0, ultFull: 0, combo: 0, comboT: 0, coinN: 0, coinT: 0, buyN: 0, buyT: 0, bossFails: 0, stepF: 0, stop: 0, bolts: [], decals: [], specs: [], specT: 3, cheerT: 0, corpses: [], swish: [], ghosts: [], ghostT: 0 };
MODS.rate.push(() => save.team >= 2 ? 1.1 + 0.01 * (hlv(1) - 1) : 1);
MODS.money.push(() => save.team >= 3 ? 1.2 + 0.02 * (hlv(2) - 1) : 1);
MODS.hp.push(() => 1 + 0.04 * (hlv(0) - 1));
const critChance = () => 0.1 + (save.team >= 5 ? 0.06 + 0.005 * (hlv(4) - 1) : 0) + modAdd('crit');
const sqMaxHp = () => Math.round((100 + 12 * (save.stage - 1)) * (1 + 0.1 * (save.team - 1)) * modMul('hp'));
const hpBase = () => 100 + 12 * (save.stage - 1);
function slotPos(i, p) { const s = SLOTS[i]; return along(p, s[1] * 84 * U, s[0] * F.pathW * 0.46); }
function setupHeroes() {
  const hb = heroBox();
  if (!R.sq) { const mh = sqMaxHp(); R.sq = { x: F.S.x, y: F.S.y, vx: 0, vy: 0, hp: mh, maxHp: mh, lag: mh, ko: 0, inv: 0, hit: 0, calm: 9 }; }
  const p = clampBox(R.sq, hb); R.sq.x = p.x; R.sq.y = p.y;
  const old = R.heroes;
  R.heroes = TEAM.slice(0, save.team).map((h, i) => {
    if (old[i]) { const o = old[i]; o.id = heroId(i); if (i === 0) { o.x = p.x; o.y = p.y; } return o; }
    const pos = clampBox(slotPos(i, R.sq), followBox());
    if (old.length) puff(pos.x, pos.y, 1);
    return { id: heroId(i), x: pos.x, y: pos.y, fireT: rand(0, 0.6), atk: 0, wind: 0, recoil: 0, pt: null, ang: -Math.PI / 2, dir: 'u', ph: rand(0, 6), i, walk: 0, moving: false, spd: 0 };
  });
}
function followBox() { const b = heroBox(); return { x0: 22 * U, x1: W - 22 * U, y0: b.y0 - 24 * U, y1: b.y1 + 30 * U }; }
const dirOf = (dx, dy) => Math.abs(dy) > Math.abs(dx) * 0.8 ? (dy > 0 ? 'd' : 'u') : (dx > 0 ? 'r' : 'l');

// ================================================================ scrolling ground: endless tile map in cached chunks
// World row r sits at screen y = r*T + R.cam; R.cam grows while the squad advances, so the ground slides down.
const CH = 10;   // tile rows per chunk
const chunks = new Map();
const chunkBio = c => (c < R.bioEdge || R.oldBio === null) ? (save.stage - 1) % BIOMES.length : R.oldBio;
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
// wind: tree crowns and bushes lean one art pixel with the gusts; the trunk stays put (strips of the sprite)
const SWAY = /tree|trio|big_|palm|bush|leafy|drybush|clover|flower/;
function sway(d, y) {
  const f = AF[d.n]; if (!f) return;
  const gust = Math.sin(R.t * 0.7) * 0.6 + Math.sin(R.t * 0.23 + 1.7) * 0.5, ph = d.x * 0.013 + d.y * 0.007;
  const top = Math.round((Math.sin(R.t * 1.6 + ph) * 0.6 + gust) * (f[3] > 24 ? 1 : 0.6));
  const w = f[2] * P, h = f[3] * P, x0 = snap(d.x - w / 2), y0 = snap(y - h), cut = [0, Math.floor(f[3] * 0.35), Math.floor(f[3] * 0.65), f[3]];
  ctx.save(); if (d.flip) { ctx.translate(snap(d.x) * 2, 0); ctx.scale(-1, 1); }
  for (let i = 0; i < 3; i++) {
    const off = i === 0 ? top : i === 1 ? Math.round(top / 2) : 0, sy = cut[i], sh = cut[i + 1] - sy; if (sh <= 0) continue;
    ctx.drawImage(atlasImg, f[0], f[1] + sy, f[2], sh, x0 + off * P * (d.flip ? -1 : 1), y0 + sy * P, w, sh * P);
  }
  ctx.restore();
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
    for (const d of ch.deco) { const y = y0 + d.y; if (y < -10 || y - 300 > H) continue; if (SWAY.test(d.n) && !save.eco && !R.fx) sway(d, y); else spr(d.n, d.x, y, 1, 0.5, 1, d.flip); }
  }
}

// ================================================================ waves: advance (scroll) → fight → advance ...
function startAdvance(dist, spd) { R.phase = 'advance'; R.advLeft = dist; R.advSpd = spd; }
function startWave() {
  R.phase = 'fight'; R.waveT = 0;
  // every so often a horde: twice the crowd, each one frailer, pouring in fast
  R.horde = save.stage >= 2 && Math.random() < 0.18;
  R.toSpawn = R.horde ? 20 + Math.floor(Math.random() * 7) : 8 + Math.floor(Math.random() * 4) + Math.min(4, Math.floor(save.stage / 4));
  R.spawnT = 0.1;
  if (R.horde) { banner2('SÜRÜ!'); sfx('elite', 0); R.shake = 3; }
  if (save.stage >= 2 && Math.random() < (save.boost && save.boost.treasureEnd > Date.now() ? 0.2 : 0.05) + modAdd('treasure')) setTimeout(spawnTreasure, 1200);
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
  // stand distance adapts to the screen: on short screens enemies hold the middle of the field, not the HUD edge
  const eb = enemyBox(), sq = R.sq, st = clamp((sq.y - eb.y0) * 0.6, 140 * U, STAND * U);
  let g = clampBox(along(sq, st, e.lane * F.pathW * 0.8), eb);
  if (dist(g, sq) < st * 0.85) {
    const dx = e.x - sq.x, dy = e.y - sq.y, d = Math.hypot(dx, dy) || 1;
    g = clampBox({ x: sq.x + dx / d * st, y: sq.y + dy / d * st }, eb);
  }
  return g;
}
function spawnEnemy(forceVr) {
  const b = biome(), type = pick(b.pool), d = EDEF[type];
  const lane = R.horde ? rand(-0.55, 0.55) : rand(-0.45, 0.45);
  const x = clamp(W / 2 + lane * F.pathW * 1.1, 60 * U, W - 60 * U), y = 120 + rand(-20, 20) * U;
  const elite = !R.horde && save.stage >= 2 && Math.random() < 0.1, hm = R.horde ? 0.6 : 1;
  // variants (from stage 4): shield / splitter / healer / runner — they make weapon choice and target order matter
  const vr = forceVr === 'none' ? null : forceVr || !elite && !R.horde && save.stage >= 4 && Math.random() < 0.2 ? pick(VARIANTS) : null, vd = vr ? VAR[vr] : null;
  const hp = enemyHp() * EHP * hm * (d.hp || 1) * (elite ? 4 : 1) * (vd ? vd.hp : 1);
  R.en.push({ id: R.nextId++, type, d, x, y, lane, hp, maxHp: hp, sp: 105 * U * (d.spd || 1) * (elite ? 0.8 : 1) * (vd ? vd.spd : 1), flash: 0, anim: rand(0, 1), knock: 0, kx: 0, ky: 0, kb: 0, age: 0,
    ranged: !!d.ranged && vr !== 'runner', stopped: false, atk: rand(1.4, 2.6), wind: 0, dir: 'd', elite, sc: elite ? 1.5 : 1, gold: EGOLD * hm * (d.hp || 1) * (elite ? 4 : 1) * (vd ? vd.gold : 1), vr, healT: rand(1, 2) });
  if (elite) sfx('elite', 0, x);
  if (vr && !(save.varSeen || {})[vr]) { save.varSeen = save.varSeen || {}; save.varSeen[vr] = 1; toast(vd.tip); }
}
const VAR = {
  shield: { hp: 1.3, spd: 0.85, gold: 1.5, rim: '#8feff1', tip: 'Kalkanlı düşman: delen ve patlayan silahlar kalkanı aşar' },
  split: { hp: 1.1, spd: 1, gold: 0.8, rim: '#d3a2c0', tip: 'Bölünen düşman: ölünce ikiye ayrılır' },
  healer: { hp: 0.9, spd: 0.9, gold: 1.6, rim: '#a9d16a', tip: 'Şifacı: yanındakileri iyileştirir, önce onu vur!' },
  runner: { hp: 0.6, spd: 2.1, gold: 1.2, rim: '#ffe18d', tip: 'Koşucu: hızlı ama kırılgan' },
};
const VARIANTS = Object.keys(VAR);
// golden racoon: runs across the field, never attacks; catch it for gems and a shower of gold
function spawnTreasure() {
  if (R.boss || R.phase !== 'fight') return;
  const fromL = Math.random() < 0.5, hp = enemyHp() * 5;
  R.en.push({ id: R.nextId++, type: 'GoldRacoon', d: { runner: 1 }, x: fromL ? -20 : W + 20, y: rand(230, 320) * U + 40, lane: 0, hp, maxHp: hp, sp: 95 * U, vx: fromL ? 1 : -1,
    flash: 0, anim: 0, knock: 0, kx: 0, ky: 0, kb: 0, age: 0, ranged: false, stopped: false, atk: 9, wind: 0, dir: fromL ? 'r' : 'l', sc: 1, gold: 10, treasure: true, spark: 0 });
  toast('Hazine canavarı! Kaçmadan yakala'); sfx('treasure', 0);
}
// ex: a special fight (Kule floor) {key, hp, time, sub, rage, spd, sig} — does not touch stage progress
function startBoss(ex) {
  if (R.boss || (!ex && !save.bossReady) || (R.sq && R.sq.ko > 0)) return false;
  const key = ex ? ex.key : bossKey(), bd = BOSSES[key];
  for (const e of R.en) { e.dead = true; puff(e.x, e.y, 1); }
  R.eb.length = 0; R.phase = 'fight'; R.toSpawn = 0;
  const p = along(F.A, 40 * U, 0), hp = ex ? ex.hp : bossHp();
  R.boss = { x: p.x, y: p.y, hp, maxHp: hp, t: ex ? ex.time : bossTime(), flash: 0, anim: 0, key, name: bd.name, col: bd.col, arrive: 0, leaving: 0, atkT: 1.6, seq: 0, tele: 0, teleK: '', burst: [], ex: ex || null, spd: ex && ex.spd || 1 };
  if (ex && ex.rage) R.boss.rage = true;
  $('bossImg').src = `assets/ui/boss_${key}.png`;
  $('bossHud').classList.remove('hidden');
  const card = $('bossCard'); if (card) { card.querySelector('img').src = `assets/ui/boss_${key}.png`; card.querySelector('b').textContent = bd.name; card.querySelector('span').textContent = ex ? ex.sub : `${biome().name} · ${Math.round(bossTime())} saniye`; card.classList.remove('show'); void card.offsetWidth; card.classList.add('show'); }
  sfx('boss', 0); R.shake = 5; uiKey = '';
  runHooks('bossStart', R.boss);
  return true;
}
// shared clean-up when a special fight ends (win or lose): back to the normal march
function endSpecial(b, won) {
  R.boss = null; R.eb.length = 0; $('bossHud').classList.add('hidden');
  for (const e of R.en) if (e.summoned && !e.dead) { e.dead = true; puff(e.x, e.y, 1); }
  if (won) { for (let i = 0; i < 6; i++) setTimeout(() => boom(b.x + rand(-50, 50) * U, b.y - rand(10, bossH(b) * 0.8), 1), i * 110); R.stop = 0.15; R.cheerT = 2; sfx('win', 0); }
  else { b.dash = b.leap = null; b.z = 0; b.leaving = 0.01; R.leavingBoss = b; sfx('fail', 0); }
  R.phase = 'wait'; uiKey = '';
  try { b.ex.done(won, b); } catch (e) { console.error(e); }
  setTimeout(() => { if (!R.boss) startAdvance(160 * U, 110 * U); }, won ? 1100 : 600);
}
const bossH = b => frameH(`b_${b.key}_0`);
function bossWin() {
  if (R.boss && R.boss.ex) return endSpecial(R.boss, true);
  const b = R.boss; R.boss = null; R.eb.length = 0;
  for (const e of R.en) if (e.summoned && !e.dead) { e.dead = true; puff(e.x, e.y, 1); }
  runHooks('bossWin', b);
  for (let i = 0; i < 6; i++) setTimeout(() => boom(b.x + rand(-50, 50) * U, b.y - rand(10, bossH(b) * 0.8), 1), i * 110);
  // gems only for a stage beaten for the first time (replaying after a rebirth pays gold, not gems)
  const first = save.stage >= (save.best || 1), gems = first ? 3 + Math.floor(save.stage / 4) : 0, cash = reward() * 25 * moneyMul();
  save.gems += gems; addMoney(cash, b.x, b.y - bossH(b) / 2, 16);
  setTimeout(() => giveScroll(first ? 2 : 1), 2200);
  setTimeout(() => { const mon = window.SS && window.SS.mon; if (mon) mon.bossReward(gems); }, 1400);
  R.bossFails = 0; R.stop = 0.32; R.cheerT = 2; R.flash = 0.35; R.shake = 8;   // the kill blow freezes for a beat
  save.stage++; save.sub = 1; save.kills = 0; save.bossReady = false; save.best = Math.max(save.best, save.stage);
  $('bossHud').classList.add('hidden');
  banner('ZAFER!', gems ? `+${gems} elmas · ${biome().name}` : `Bölüm ${save.stage} · ${biome().name}`); sfx('win', 0);
  persist();
  setTimeout(() => { newBiomeAhead(); musicUpdate(); }, 1100);
  R.phase = 'wait';
}
function bossFail() {
  const b = R.boss; if (!b) return;
  if (b.ex) return endSpecial(b, false);
  for (const e of R.en) if (e.summoned && !e.dead) { e.dead = true; puff(e.x, e.y, 1); }
  b.dash = b.leap = null; b.z = 0;
  b.leaving = 0.01; R.boss = null; R.leavingBoss = b; R.eb.length = 0;
  $('bossHud').classList.add('hidden');
  banner('BOSS KAÇTI!', 'Güçlen ve tekrar dene'); sfx('fail', 0);
  R.retryT = 12; startAdvance(160 * U, 110 * U);
  R.bossFails++; runHooks('bossFail', b); if (R.bossFails >= 2 && rebirthGain() > 0) setTimeout(() => toast('İpucu: Doğuş ile kalıcı güç kazan!'), 2300);
  uiKey = '';
}
function damage(target, dmg, crit, isBoss) {
  if (target.dead) return;
  if (isBoss) dmg *= modMul('boss');
  target.hp -= dmg; target.flash = 0.08;
  if (!isBoss && target.y > enemyBox().y0 + 50 * U) { const dx = target.x - R.sq.x, dy = target.y - R.sq.y, d = Math.hypot(dx, dy) || 1; target.kx = dx / d; target.ky = dy / d; target.knock = Math.max(target.knock || 0, (crit ? 7 : 2) * U); }
  const top = isBoss ? bossH(target) : 18 * P * (target.sc || 1);
  addText(target.x + rand(-14, 14) * U, target.y - top - 2 * U + rand(-6, 6) * U, fmt(dmg), crit ? 'crit' : 'dmg');
  if (target.hp <= 0) { if (isBoss) bossWin(); else kill(target); }
}
function kill(e) {
  e.dead = true;
  if (e.vr === 'split' && !e.half) for (const s of [-1, 1]) {
    const hp = e.maxHp * 0.35; R.en.push({ ...e, id: R.nextId++, dead: false, half: true, vr: null, x: e.x + s * 14 * U, y: e.y + rand(-4, 4) * U, hp, maxHp: hp, sc: 1, gold: e.gold * 0.3, flash: 0.1, age: 0.2, kx: s, ky: 0, knock: 10 * U, pend: 0 });
    puff(e.x + s * 14 * U, e.y, 1);
  }
  if (R.corpses.length < 14) { const fly = e.d && e.d.fly; R.corpses.push({ n: `m_${e.type}_${e.dir}${Math.floor(e.anim * 8) % 4}`, x: e.x, y: e.y - (fly ? 5 * P : 0), sc: e.sc || 1, t: 0, flip: e.x < (R.sq ? R.sq.x : W / 2) }); }
  runHooks('kill', e);
  puff(e.x, e.y, e.elite ? 3 : 2); bits(e.x, e.y - 8 * P, biome().bits, e.elite ? 7 : 4);
  R.combo = R.comboT > 0 ? R.combo + 1 : 0; R.comboT = 1.5; R.comboPop = 0.18;
  addMoney(reward() * 0.5 * (e.gold || 1) * moneyMul() * (1 + Math.min(R.combo, 50) * 0.01), e.x, e.y - 10 * P, e.treasure ? 14 : e.elite ? 6 : 2);
  if (R.combo === 10 || R.combo === 25 || R.combo === 50 || (R.combo > 50 && R.combo % 50 === 0)) { banner2(`KOMBO x${R.combo}!`); sfx('bonus', 0); R.shake = Math.max(R.shake, 3); for (const h of R.heroes) vfx('burst', 'gold', h.x, h.y - 10 * P, 0.5, 0.3); }
  sfx('kill', 0, e.x, penta(R.combo % 10));
  if (e.elite || e.treasure) R.stop = 0.07;
  if (e.elite && Math.random() < 0.04) giveScroll(1, e.x, e.y - 24 * P);
  if (e.treasure) { const g = 1 + (save.stage >= 25 ? 1 : 0); save.gems += g; addText(e.x, e.y - 30 * P, '+' + g, 'gem'); sfx('gem', 0); fx('fx_circlew', e.x, e.y - 8 * P, 1, 0.3); }
  if (!R.boss && !save.bossReady && !R.mode) {
    save.kills++;
    if (save.kills >= KILLS_PER_SUB) {
      if (save.sub < SUBS) { save.sub++; save.kills = 0; toast(`Aşama ${save.stage}-${save.sub}`); sfx('stage', 0); runHooks('stage'); }
      else { save.kills = KILLS_PER_SUB; save.bossReady = true; R.retryT = 0; }
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
function addText(x, y, s, kind) { if (kind === 'dmg' && R.txt.length > 14) return; if (kind === 'crit' && R.txt.filter(t => t.kind === 'crit').length > 2) return; if (R.txt.length > 50) R.txt.shift(); R.txt.push({ x, y, s, kind, life: kind === 'money' ? 1.0 : 0.7, max: kind === 'money' ? 1.0 : 0.7 }); }
// particles: anim = pack fx sheet played once; bit = physical chip with gravity; float = drifting trail mote
const busy = () => Math.min(1, 12 / Math.max(1, R.bul.length)) * Math.min(1, 110 / Math.max(1, R.parts.length));
function part(p) { if ((save.eco || R.fx >= 2) && p.k !== 'anim' && Math.random() < 0.6) return; if (p.k !== 'anim' && Math.random() > busy()) return; if (R.parts.length < 200) R.parts.push(p); }
let fxGate = 0;
const gate = (gap) => { if (R.t - fxGate < gap) return false; fxGate = R.t; return true; };
function puff(x, y, s = 1) { part({ k: 'anim', a: 'fx_smoke', x, y: y + 2 * P, s: s * 0.5, life: 0.4, max: 0.4, ay: 1, alpha: 0.85 }); }
function fx(a, x, y, s = 0.5, life = 0.25, ay = 0.5) { part({ k: 'anim', a, x, y, s, life, max: life, ay }); }
function bits(x, y, set, n) {
  const m = AN[set] || 1;
  for (let i = 0; i < n; i++) { const a = rand(-Math.PI * 0.9, -Math.PI * 0.1), s = rand(70, 200) * U; part({ k: 'bit', f: `${set}_${Math.floor(Math.random() * m)}`, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.45, 0.8), max: 0.8, flip: Math.random() < 0.5 }); }
}
function confetti(x, y, col, n) { bits(x, y, biome().bits, Math.min(8, n)); }
function boom(x, y, s = 1) {
  if (R.flashes && R.flashes.length < 12) R.flashes.push({ x, y, r: 70 * s, life: 0.25, max: 0.25 });   // light flash (features/visuals.js)
  vfx('ring', 'fire', x, y, s, 0.35);
  if (s < 1) { if (R.t - (R.boomT || 0) < 0.07 || R.parts.length > 170) { fx('fx_circle', x, y, s, 0.25); return; } R.boomT = R.t; }
  fx('fx_circle', x, y, s, 0.32);
  part({ k: 'anim', a: 'fx_smoke', x, y: y + 6 * P * s, s, life: 0.5, max: 0.5, ay: 1, alpha: 0.85 });
  bits(x, y, 'q_Fire', 4);
  R.shake = Math.max(R.shake, 4); sfx('boom');
}
// ================================================================ projectile look (per weapon)
// Every throw is drawn in layers: a tapered ribbon trail with the weapon's own colour ramp (head = hot core,
// tail = dark edge), an additive glow for energy weapons, element motes, then the sprite. Impacts get a one-frame
// white flash, outward spark streaks in the same ramp and, for heavy weapons, a shock ring. Budgeted by R.fx.
// ramp: head -> tail colours; w: ribbon width at the head (art px); len: trail length (CSS px at U=1);
// add: additive blend; motes: particle set left behind; sparks: impact streak count; ring: impact ring palette
const PSTYLE = {
  Shuriken:      { ramp: ['#ffffff', '#ffe18d', '#f2a93b', '#b0601e'], w: 4, len: 54, add: false, motes: 'q_Spark', mp: 0.15, sparks: 6, sc: 1 },
  Kunai:         { ramp: ['#ffffff', '#cfe8ff', '#6fa8dc', '#2d4f8c'], w: 3, len: 80, add: false, sparks: 5, sc: 1.5, cut: 1 },
  Arrow:         { ramp: ['#ffffff', '#ffe9b3', '#e0a040', '#8a4f1e'], w: 3, len: 70, add: false, sparks: 4, sc: 1.5 },
  BigKunai:      { ramp: ['#ffffff', '#f2d6f0', '#c98ae0', '#6b3fa0'], w: 5, len: 90, add: true, sparks: 9, ring: 'magic', sc: 0.75 },
  ShurikenMagic: { ramp: ['#ffffff', '#ffe1f4', '#d3a2c0', '#8a5cf0'], w: 4, len: 64, add: true, motes: 'q_Spark', mp: 0.6, sparks: 8, sc: 1 },
  IceSpike:      { ramp: ['#ffffff', '#d9fbff', '#8feff1', '#3b8fb0'], w: 3, len: 70, add: true, motes: 'q_Snow', mp: 0.5, sparks: 8, ring: 'ice', sc: 1.25 },
  Fireball:      { ramp: ['#fff8d0', '#ffe18d', '#ff9554', '#d14b34', '#6b3a3a'], w: 6, len: 64, add: true, motes: 'q_Fire', mp: 0.7, sparks: 10, sc: 1.25 },
  BigEnergyBall: { ramp: ['#ffffff', '#d9fbff', '#8feff1', '#6fb6ff', '#3b3aa6'], w: 6, len: 60, add: true, jitter: 1, motes: 'q_Spark', mp: 0.5, sparks: 10, ring: 'ice', sc: 1 },
  Plasma:        { ramp: ['#ffffff', '#d9fbff', '#3fd0e8', '#ff4fb0'], w: 4, len: 56, add: true, motes: 'fxp_bit', mp: 0.4, sparks: 8, sc: 1 },
  Laser:         { ramp: ['#ffffff', '#ffd6ef', '#ff4fb0', '#7a1f5c'], w: 4, len: 150, add: true, sparks: 6, sc: 1, cut: 1 },
  Katana:        { ramp: ['#ffffff', '#d9fbff', '#3fd0e8', '#1b5f8c'], w: 8, len: 50, add: true, motes: 'fxp_bit', mp: 0.3, sparks: 9, ring: 'neon', sc: 1 },
  Rail:          { ramp: ['#ffffff', '#d9fbff', '#3fd0e8', '#1b5f8c'], w: 3, len: 130, add: true, sparks: 6, sc: 1 },
  Drone:         { ramp: ['#ffffff', '#ffd6ef', '#ff4fb0', '#7a1f5c'], w: 3, len: 60, add: true, motes: 'fxp_bit', mp: 0.25, sparks: 7, sc: 1 },
};
const pstyle = g => PSTYLE[g.spr] || PSTYLE.Shuriken;
const hexA = (h, a) => { const n = parseInt(h.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
const ramp = (r, t) => r[Math.min(r.length - 1, Math.max(0, Math.floor(t * r.length)))];
// a filled disk on the pixel grid (rows of whole pixels, so it stays crisp)
function pdisk(x, y, r, col) {
  const n = Math.max(1, Math.round(r / P)), cx = snap(x), cy = snap(y);
  for (let j = -n; j <= n; j++) { const w = Math.round(Math.sqrt(Math.max(0, n * n - j * j))); prect(cx - w * P, cy + j * P, (2 * w + 1) * P, P, col); }
}
// tapered ribbon along the trail points: wide hot head, thin dark tail; electric styles jitter sideways.
// Two passes: a darker edge (normal blend, 1 px wider each side) so the trail reads on snow as well as on dark
// ground, then the bright core (additive for energy weapons).
function drawRibbon(q, S, rp, lead, many) {
  const tr = q.trail; if (!tr.length) return;
  const pts = [{ x: q.x, y: q.y }].concat(tr);
  let D = 0; for (let i = 1; i < pts.length; i++) D += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  if (D < 2 * P) return;
  if (R.fx >= 2 && !lead) return;   // adaptive quality: on slow phones only the leader's throws keep a ribbon
  const step = (lead && !many && R.fx < 1 ? 1 : 2) * P, w0 = S.w * (lead ? 1 : 0.7) * ((q.sc || 1) >= 1.5 ? 1.5 : 1);
  const edge = rp[rp.length - 1], samples = [];
  let d = 0;
  for (let i = 1; i < pts.length; i++) {
    const A = pts[i - 1], B = pts[i], seg = Math.hypot(B.x - A.x, B.y - A.y); if (seg < 0.01) continue;
    const nx = -(B.y - A.y) / seg, ny = (B.x - A.x) / seg;
    for (let s0 = 0; s0 < seg; s0 += step) {
      const t = (d + s0) / D; if (t > 1) break;
      const j = S.jitter && t > 0.08 ? Math.round(rand(-1.5, 1.5)) * P : 0;
      samples.push(t, snap(A.x + (B.x - A.x) * s0 / seg + nx * j), snap(A.y + (B.y - A.y) * s0 / seg + ny * j));
    }
    d += seg;
  }
  const k = lead ? 1 : 0.6;
  for (let i = 0; i < samples.length; i += 3) {   // edge
    const t = samples[i], w = Math.max(1, Math.round(w0 * Math.pow(1 - t, 0.75))) + 2;
    ctx.globalAlpha = 0.45 * Math.pow(1 - t, 1.4) * k;
    prect(samples[i + 1] - Math.floor(w / 2) * P, samples[i + 2] - Math.floor(w / 2) * P, w * P, w * P, edge);
  }
  if (S.add) ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < samples.length; i += 3) {   // core
    const t = samples[i], w = Math.max(1, Math.round(w0 * Math.pow(1 - t, 0.75)));
    ctx.globalAlpha = (S.add ? 0.8 : 0.95) * Math.pow(1 - t, 1.1) * k;
    prect(samples[i + 1] - Math.floor(w / 2) * P, samples[i + 2] - Math.floor(w / 2) * P, w * P, w * P, ramp(rp, t));
  }
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
}
// impact: white flash + spark streaks thrown outward along the hit direction (+ ring for heavy weapons)
function impactFx(q, x, y, big) {
  if (save.eco) return;
  const S = pstyle(q.g), budget = R.fx >= 2 ? 0.35 : R.fx >= 1 ? 0.6 : 1, lead = !q.from || q.from.i === 0 || q.special;
  if (R.parts.length < 185) R.parts.push({ k: 'flash', x, y, r: (big ? 9 : 5) * P, col: S.ramp[1], life: 0.07, max: 0.07 });
  const n = Math.round((S.sparks + (q.crit ? 4 : 0) + (big ? 4 : 0)) * budget * (lead ? 1 : 0.5));
  for (let i = 0; i < n && R.parts.length < 195; i++) {
    const a = q.a + Math.PI + rand(-1.2, 1.2) + (Math.random() < 0.35 ? Math.PI : 0), sp = rand(120, 320) * U * (big ? 1.3 : 1);
    R.parts.push({ k: 'streak', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, len: rand(3, 6) * P, ramp: S.ramp, life: rand(0.16, 0.3), max: 0.3, add: S.add });
  }
  if (S.ring && (big || q.crit || lead) && gate(0.05)) vfx('ring', q.pg || S.ring, x, y, big ? 0.8 : 0.5, 0.25);
}
// throw flash in the hand
function muzzleFx(q) {
  if (save.eco || R.fx >= 2 || R.parts.length > 170) return;
  const S = pstyle(q.g);
  R.parts.push({ k: 'flash', x: q.x, y: q.y, r: 4 * P, col: S.ramp[1], life: 0.06, max: 0.06 });
  for (let i = 0; i < 2; i++) { const a = q.a + rand(-0.5, 0.5), sp = rand(80, 160) * U; R.parts.push({ k: 'streak', x: q.x, y: q.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, len: 3 * P, ramp: S.ramp, life: 0.12, max: 0.12, add: S.add }); }
}
function hitFx(q, t) {
  const g = q.g, x = q.x, y = q.y;
  impactFx(q, x, y, t === R.boss || !!g.boom);
  switch (g.hit) {
    case 'cut': fx('fx_cut', x, y); break;
    case 'claw': fx('fx_claw', x, y); break;
    case 'star': fx('fx_spark', x, y, 0.5, 0.2); if (Math.random() < busy()) fx('fx_circlew', x, y, 0.5, 0.2); break;
    case 'ice': fx('fx_ice', x, y, 0.5, 0.4); bits(x, y, 'q_Snow', 3); break;
    case 'fire': fx('fx_flam', x, y, 0.5, 0.3); break;
    case 'thunder': fx('fx_thunder', x, y, 0.5, 0.3); fx('fx_circlew', x, y, 1, 0.25); break;
    case 'plasma': if (gate(0.05)) vfx('burst', 'neon', x, y, 0.5, 0.2); bits(x, y, 'fxp_bit', 2); break;
    case 'laser': fx('fx_cut', x, y); if (gate(0.06)) vfx('burst', 'laser', x, y, 0.5, 0.18); break;
    case 'wave': fx('vx_slash_neon', x, y, 0.75, 0.25); bits(x, y, 'fxp_bit', 2); break;
    case 'drone': vfx('ring', 'laser', x, y, 0.5, 0.25); break;
    default: fx('fx_spark', x, y);
  }
  if (g.bits) bits(x, y, g.bits, 2);
  if (q.crit && R.t - (R.critT || 0) > 0.22) {   // impact feel: a 30 ms hit-stop and a one-pixel camera kick along the throw
    R.critT = R.t; R.stop = Math.max(R.stop, t === R.boss ? 0.05 : 0.03);
    R.kickX = Math.cos(q.a) * P * (t === R.boss ? 2 : 1); R.kickY = Math.sin(q.a) * P * (t === R.boss ? 2 : 1);
  }
  if (q.crit) { fx('fx_cut', x + 4 * U, y - 4 * U, 1, 0.22); if (gate(0.06)) vfx('burst', g.glow || 'gold', x, y, 0.5, 0.22); }
  else if (evolved() && gate(0.12)) vfx('burst', g.glow || 'gold', x, y, 0.5, 0.2);
  if (g.boom) boom(x, y, t === R.boss ? 1 : 0.5); else sfx(g.hsnd || 'hit', 0, x);
  if (save.team >= 4 && t !== R.boss && Math.random() < 0.2 + 0.01 * (hlv(3) - 1)) {   // Bombacı perk: splash
    boom(x, y, 0.5);
    for (const e of R.en) if (e !== t && !e.dead && Math.hypot(e.x - x, e.y - 8 * P - y) < 60 * U) damage(e, q.dmg * 0.6, false, false);
  }
}
// spread the squad's fire: prefer the nearest enemy that is not already going to die from shots in the air
function nearestTarget(h) {
  if (R.boss && R.boss.arrive >= 1) return R.boss;
  let best = null, bd = 1e9, any = null, ad = 1e9;
  for (const e of R.en) {
    if (e.dead || e.y < enemyBox().y0 - 10 * U) continue;
    const d = Math.hypot(e.x - h.x, e.y - h.y);
    if (d < ad) { ad = d; any = e; }
    const dd = e.vr === 'healer' ? d * 0.45 : d;   // healers are shot first
    if ((e.pend || 0) < e.hp && dd < bd) { bd = dd; best = e; }
  }
  return best || any;
}
const aimY = t => t === R.boss ? t.y - bossH(t) * 0.5 : t.y - 8 * P * (t.sc || 1) - (t.d && t.d.fly ? 5 * P : 0);
// hand position (art-pixel offsets from the feet) for each facing
// heroes are drawn at 1.25x so the squad reads clearly on a phone without crowding the field
const HS = 1.25;
// hand anchors measured on the pack's ninja frames, in art pixels from the feet: idle (sleeve) and attack (arm out)
const HAND = { u: [-3.5, -15], d: [5, -5], l: [-7, -4], r: [6.5, -4] };
const HAND_IDLE = { u: [7, -7], d: [5, -5], l: [-4, -5], r: [4, -5] };
const handPos = h => { const o = HAND[h.dir] || HAND.u; return { x: h.x + o[0] * P * HS, y: h.y + o[1] * P * HS }; };
// wind-up: the ninja turns, raises the weapon for a moment, then releases it
function fire(h, tgt) {
  h.pt = tgt;
  const hx = h.x, hy = h.y - 12 * P;
  h.ang = Math.atan2(aimY(tgt) - hy, tgt.x - hx);
  // fighting ninjas turn sideways toward the target: the side frames show the face and the throwing arm
  // (the back view read as a faceless blob). A target straight above keeps the side the ninja already faces.
  const dx = tgt.x - hx; h.dir = Math.abs(dx) < 6 * P && (h.dir === 'l' || h.dir === 'r') ? h.dir : dx < 0 ? 'l' : 'r';
  h.atk = 0.2; h.wind = 0.07;
}
function throwNow(h) {
  let t = h.pt;
  if (!t || t.dead || (t !== R.boss && !R.en.includes(t))) { t = nearestTarget(h); if (!t) return; }
  const g = GUNS[save.gun], o = handPos(h);
  h.ang = Math.atan2(aimY(t) - o.y, t.x - o.x); h.recoil = 0.09; h.empty = 0.16;
  const base = shotsOf(g), ns = base + modAdd('shots'), crit = Math.random() < critChance(), total = dmgPerShot() * heroMul(h.i) * (crit ? 3 + modAdd('critDmg') : 1), dmg = total / base;
  let tg = [t];
  if (ns > 1 && t !== R.boss) tg = tg.concat(R.en.filter(e => e !== t && !e.dead && e.y > enemyBox().y0 - 10 * U).sort((a, b) => Math.hypot(a.x - o.x, a.y - o.y) - Math.hypot(b.x - o.x, b.y - o.y)).slice(0, ns - 1));
  for (let k = 0; k < ns; k++) {
    const tk = tg[k % tg.length];
    let a = (k < tg.length ? Math.atan2(aimY(tk) - o.y, tk.x - o.x) : h.ang) + (ns > 1 ? (k - (ns - 1) / 2) * (g.spread || 0.14) : 0);
    if (g.curve) a += (Math.random() < 0.5 ? -1 : 1) * g.curve * rand(0.6, 1);
    R.bul.push({ x: o.x, y: o.y, a, sp: g.sp * U, tgt: tk, dmg, crit, g, age: rand(0, 1), life: g.boomer ? 2.4 : 1.3, trail: [], tt: 0,
      hits: new Set(), pierce: (g.pierce || 0) + (evolved() && g.pierce ? 1 : 0) + modAdd('pierce'), bounce: (g.bounce || 0) + (evolved() && g.bounce ? 1 : 0) + modAdd('bounce'), sc: (g.sc || 1) * (evolved() && h.i === 0 && (g.sc || 1) >= 1 && (AF[`p_${g.spr}_0`] || [0, 0, 99])[2] <= 18 ? 1.5 : 1), home: true, from: h, dist: 0, back: false, wob: rand(0, 6), settled: false });
    if (tk !== R.boss) tk.pend = (tk.pend || 0) + dmg;
    runHooks('shot', R.bul[R.bul.length - 1]);
  }
  if (g.held === 'wh_Wand' || g.held === 'wh_Book') fx('fx_spark', o.x, o.y, 0.5, 0.15);
  if (h.i === 0 || Math.random() < 0.35) muzzleFx(R.bul[R.bul.length - 1]);
  if (!save.eco && R.swish.length < 10) R.swish.push({ x: o.x, y: o.y, a: h.ang, life: 0.14, col: TRAIL_COL[(save.cos && save.cos.trail) || g.glow] || '#fce2ca' });
  sfx(g.snd || 'shoot', 0.12, o.x);
}
const turn = (a, want, k) => { let da = want - a; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU; return a + da * Math.min(1, k); };
// a projectile touches something: effects, status, damage, then decide whether it keeps flying
function onHit(q, c) {
  q.hits.add(c);
  const g = q.g, isB = c === R.boss;
  if (c === q.tgt && !q.settled) { q.settled = true; c.pend = Math.max(0, (c.pend || 0) - q.dmg); }
  hitFx(q, c);
  let dmg = q.hits.size > 1 && !g.boomer ? q.dmg * 0.8 : q.dmg;
  if (c.vr === 'shield' && !(g.pierce || q.pierce > 0 || g.boom || g.chain || q.special)) { dmg *= 0.3; if (gate(0.15)) { fx('fx_spark', q.x, q.y, 0.5, 0.15); sfx('hit_ice', 0, q.x); } }
  if (!isB) {
    if (g.push) c.knock = 16 * U;
    if (g.freeze) { c.slow = 2; fx('fx_ice', c.x, aimY(c), 0.5, 0.4); }
    if (g.burn) { c.burn = 2.2; c.burnD = q.dmg * 0.12; c.burnT = 0.4; }
  }
  if (g.boom) for (const e of R.en) if (e !== c && !e.dead && Math.hypot(e.x - q.x, aimY(e) - q.y) < 58 * U) { damage(e, q.dmg * 0.5, false, false); if (g.burn) { e.burn = 1.5; e.burnD = q.dmg * 0.08; e.burnT = 0.4; } }
  if (g.chain) chainBolt(c, q.dmg * 0.6, g.chain);
  runHooks('hit', q, c, isB);
  damage(c, dmg, q.crit, isB);
  if (g.boomer) return;
  if (q.bounce > 0) {
    let best = null, bd = 190 * U;
    for (const e of R.en) { if (e.dead || q.hits.has(e)) continue; const d = Math.hypot(e.x - c.x, e.y - c.y); if (d < bd) { bd = d; best = e; } }
    if (best) { q.bounce--; q.tgt = best; q.home = true; q.settled = true; q.a = Math.atan2(aimY(best) - q.y, best.x - q.x); q.life = Math.max(q.life, 0.7); fx('fx_spark', q.x, q.y, 0.5, 0.12); sfx('tick', 0, q.x, 12); return; }
  }
  if (q.pierce > 0) { q.pierce--; q.home = false; return; }
  q.dead = true;
}
function chainBolt(from, dmg, n) {
  let cur = from; const hit = new Set([from]);
  for (let i = 0; i < n; i++) {
    let best = null, bd = 160 * U;
    for (const e of R.en) { if (e.dead || hit.has(e)) continue; const d = Math.hypot(e.x - cur.x, e.y - cur.y); if (d < bd) { bd = d; best = e; } }
    if (!best) break;
    hit.add(best);
    R.bolts.push({ x0: cur.x, y0: aimY(cur), x1: best.x, y1: aimY(best), life: 0.24 });
    fx('fx_thunder', best.x, aimY(best), 0.5, 0.25);
    damage(best, dmg, false, false); cur = best;
  }
  if (hit.size > 1) sfx('magic', 0.1, from.x, 7);
}
// a missed blade / arrow drops and sticks in the ground for a moment
function stickDecal(q) {
  const g = q.g, rot = g.spin ? 0 : Math.round((q.a - (g.ori || 0)) / (Math.PI / 8)) * (Math.PI / 8);
  if (R.decals.length > 24) R.decals.shift();
  R.decals.push({ f: `p_${g.spr}_0`, x: q.x, y: q.y, rot, sc: g.sc || 1, life: 1.6 });
  bits(q.x, q.y, 'q_Rock', 1);
}

// ================================================================ evolved weapons: special attacks
// Every few seconds in a fight an evolved (5-star) weapon fires its signature attack. Each spec is a small
// object with its own update/draw so the effects stay readable and independent.
const specDmg = k => dmgPerShot() * Math.max(1, save.team) * k;
function densest(radius) {   // enemy with the most neighbours
  let best = null, bn = -1;
  for (const e of R.en) { if (e.dead || e.y < enemyBox().y0 - 10 * U) continue; let n = 0; for (const o of R.en) if (!o.dead && Math.hypot(o.x - e.x, o.y - e.y) < radius) n++; if (n > bn) { bn = n; best = e; } }
  return best || (R.boss && R.boss.arrive >= 1 ? R.boss : null);
}
const liveTargets = () => R.en.filter(e => !e.dead && e.y > enemyBox().y0 - 10 * U).concat(R.boss && R.boss.arrive >= 1 ? [R.boss] : []);
function areaHit(x, y, r, dmg, onEach) {
  for (const e of R.en) if (!e.dead && Math.hypot(e.x - x, (aimY(e) - y) * 1.2) < r) { if (onEach) onEach(e); damage(e, dmg, false, false); }
  const b = R.boss; if (b && b.arrive >= 1 && Math.hypot(b.x - x, (aimY(b) - y) * 0.8) < r + 50 * U) damage(b, dmg, false, true);
}
function vfx(kind, col, x, y, s = 1, life = 0.35) { fx(`vx_${kind}_${col}`, x, y, s, life); }
function castSpecial() {
  const g = GUNS[save.gun], L0 = R.heroes[0], T = liveTargets(); if (!L0 || !T.length) return false;
  const sp = g.evo.sp;
  banner2(g.evo.name);
  if (sp === 'orbit') {
    const tgt = densest(90 * U) || pick(T);
    R.specs.push({ k: 'orbit', spr: g.neo ? g.spr : 'Shuriken', glow: g.neo ? g.glow : 'gold', x: L0.x, y: L0.y - 10 * P, sx: L0.x, sy: L0.y - 10 * P, tx: tgt.x, ty: aimY(tgt), t: 0, T: 3.2, hit: new Map(), dmg: specDmg(0.22) });
    sfx('throw_magic', 0); sfx('skill', 0);
  } else if (sp === 'rain') {
    for (let i = 0; i < 16; i++) { const e = pick(T); R.specs.push({ k: 'drop', spr: g.neo ? `p_${g.spr}_0` : 'p_Kunai_0', ori: 0, sc: 1, x: e.x + rand(-30, 30) * U, y: (e === R.boss ? e.y : e.y) + rand(-10, 10) * U, z: 320 * U, vz: 1100 * U, delay: i * 0.07, r: 26 * U, dmg: specDmg(0.18), land: 'cut', stick: 1 }); }
    sfx('throw2', 0);
  } else if (sp === 'volley') {
    for (let i = 0; i < 14; i++) { const e = pick(T), h = pick(R.heroes); R.specs.push({ k: 'arc', spr: g.neo ? `p_${g.spr}_0` : 'p_Arrow_0', sx: h.x, sy: h.y - 10 * P, tx: e.x + rand(-26, 26) * U, ty: e.y + rand(-8, 8) * U, t: -i * 0.05, T: 0.85, hgt: 240 * U, dmg: specDmg(0.18), r: 28 * U }); }
    sfx('throw2', 0);
  } else if (sp === 'column') {
    const e = densest(40 * U) || pick(T);
    R.specs.push({ k: 'column', spr: g.neo ? `p_${g.spr}_0` : 'p_BigKunai_0', col: g.neo ? TRAIL_COL[g.glow] : '#d3a2c0', x: e.x, t: 0, tele: 0.35, y: H, hit: new Set(), dmg: specDmg(0.9) });
    sfx('elite', 0);
  } else if (sp === 'galaxy') {
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + (i - 1) * 0.7, tgt = pick(T);
      R.bul.push({ x: L0.x, y: L0.y - 10 * P, a, sp: 700 * U, tgt, dmg: specDmg(0.3), crit: false, g, age: rand(0, 1), life: 2.6, trail: [], tt: 0, hits: new Set(), pierce: 0, bounce: 0, home: true, from: L0, dist: 0, back: false, wob: 0, settled: true, sc: 2, special: 1 });
    }
    sfx('throw_magic', 0); sfx('magic', 0);
  } else if (sp === 'bloom') {
    const e = densest(90 * U) || pick(T);
    R.specs.push({ k: 'bloom', x: e.x, y: e.y, t: 0, tele: 0.35, done: false, dmg: specDmg(0.8) });
  } else if (sp === 'meteor') {
    for (let i = 0; i < 4; i++) { const e = T[i % T.length]; R.specs.push({ k: 'meteor', x: e.x + rand(-12, 12) * U, y: e.y + rand(-6, 6) * U, t: -i * 0.3, T: 0.75, dmg: specDmg(0.6) }); }
    sfx('throw_fire', 0);
  } else if (sp === 'thunder') {
    const order = T.slice().sort(() => Math.random() - 0.5).slice(0, 6);
    order.forEach((e, i) => R.specs.push({ k: 'strike', tgt: e, t: -i * 0.13, tele: 0.18, dmg: specDmg(0.45), done: false }));
  }
  return true;
}
function banner2(name) { const b = $('evoTag'); if (!b) return; b.textContent = name; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show'); }
function updateSpecs(dt) {
  for (const sp of R.specs) {
    sp.t += dt;
    if (sp.k === 'orbit') {
      const k = sp.t / sp.T, go = Math.min(1, sp.t / 0.7), back = Math.max(0, (sp.t - (sp.T - 0.7)) / 0.7);
      const cx = lerp(lerp(sp.sx, sp.tx, go), R.heroes[0] ? R.heroes[0].x : sp.sx, back), cy = lerp(lerp(sp.sy, sp.ty, go), R.heroes[0] ? R.heroes[0].y - 10 * P : sp.sy, back);
      sp.x = cx; sp.y = cy; sp.rad = (34 + 18 * Math.sin(sp.t * 3)) * U;
      for (const [e, cd] of sp.hit) if (cd - dt <= 0) sp.hit.delete(e); else sp.hit.set(e, cd - dt);
      for (const e of R.en) if (!e.dead && !sp.hit.has(e) && Math.hypot(e.x - cx, aimY(e) - cy) < sp.rad + 14 * U) { sp.hit.set(e, 0.3); damage(e, sp.dmg, false, false); fx('fx_spark', e.x, aimY(e), 0.5, 0.15); sfx('hit', 0.05, e.x); }
      const b = R.boss; if (b && b.arrive >= 1 && !sp.hit.has(b) && Math.hypot(b.x - cx, aimY(b) - cy) < sp.rad + 60 * U) { sp.hit.set(b, 0.25); damage(b, sp.dmg, false, true); }
      if (k >= 1) sp.dead = true;
    } else if (sp.k === 'drop') {
      if (sp.t < sp.delay) continue;
      sp.z -= sp.vz * dt;
      if (sp.z <= 0) { sp.dead = true; areaHit(sp.x, sp.y - 6 * P, sp.r, sp.dmg); fx('fx_cut', sp.x, sp.y - 4 * P, 0.5, 0.18); puff(sp.x, sp.y, 1); if (sp.stick && R.decals.length < 30) R.decals.push({ f: sp.spr, x: sp.x, y: sp.y - 3 * P, rot: Math.PI / 2, sc: 1, life: 1.4 }); sfx('hit2', 0.05, sp.x); }
    } else if (sp.k === 'arc') {
      if (sp.t < 0) continue;
      if (sp.t >= sp.T) { sp.dead = true; areaHit(sp.tx, sp.ty - 6 * P, sp.r, sp.dmg); vfx('burst', 'leaf', sp.tx, sp.ty - 6 * P, 0.5, 0.25); puff(sp.tx, sp.ty, 1); if (R.decals.length < 30) R.decals.push({ f: sp.spr, x: sp.tx, y: sp.ty - 3 * P, rot: Math.PI / 2 - 0.4, sc: 1, life: 1.4 }); sfx('hit3', 0.05, sp.tx); }
    } else if (sp.k === 'column') {
      if (sp.t < sp.tele) continue;
      const v = 2600 * U; sp.y -= v * dt;
      for (const e of R.en) if (!e.dead && !sp.hit.has(e) && Math.abs(e.x - sp.x) < 30 * U && e.y > sp.y) { sp.hit.add(e); e.knock = 20 * U; damage(e, sp.dmg, true, false); vfx('burst', 'magic', e.x, aimY(e), 0.5, 0.25); }
      const b = R.boss; if (b && !sp.hit.has(b) && Math.abs(b.x - sp.x) < 70 * U && b.y > sp.y) { sp.hit.add(b); damage(b, sp.dmg, true, true); }
      if (!sp.fx) { sp.fx = 1; R.flash = 0.25; R.shake = 7; sfx('boom', 0); }
      if (sp.y < -80) sp.dead = true;
      sp.life = (sp.life || 0) + dt;
    } else if (sp.k === 'bloom') {
      if (!sp.done && sp.t >= sp.tele) {
        sp.done = true; R.flash = 0.15; R.shake = 5; sfx('hit_ice', 0, sp.x); sfx('magic', 0, sp.x, -5);
        vfx('ring', 'ice', sp.x, sp.y - 6 * P, 2.5, 0.5); vfx('burst', 'ice', sp.x, sp.y - 6 * P, 1.5, 0.4);
        for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; fx('fx_ice', sp.x + Math.cos(a) * 55 * U, sp.y + Math.sin(a) * 30 * U - 6 * P, 0.5, 0.5); }
        areaHit(sp.x, sp.y - 6 * P, 95 * U, sp.dmg, e => { e.slow = 3.5; });
      }
      if (sp.t > 0.9) sp.dead = true;
    } else if (sp.k === 'meteor') {
      if (sp.t >= sp.T) {
        sp.dead = true; R.shake = Math.max(R.shake, 6); sfx('boom', 0, sp.x); sfx('hit_fire', 0, sp.x);
        vfx('burst', 'fire', sp.x, sp.y - 8 * P, 1.5, 0.4); vfx('ring', 'fire', sp.x, sp.y - 4 * P, 1.5, 0.45);
        part({ k: 'anim', a: 'fx_smoke', x: sp.x, y: sp.y + 4 * P, s: 1.5, life: 0.6, max: 0.6, ay: 1, alpha: 0.85 }); bits(sp.x, sp.y - 6 * P, 'q_Fire', 7);
        areaHit(sp.x, sp.y - 6 * P, 70 * U, sp.dmg, e => { e.burn = 2.5; e.burnD = sp.dmg * 0.1; e.burnT = 0.4; });
      }
    } else if (sp.k === 'strike') {
      if (!sp.done && sp.t >= sp.tele) {
        sp.done = true; const e = sp.tgt; if (!e || e.dead) { sp.dead = true; continue; }
        sp.x = e.x; sp.y = aimY(e); R.flash = Math.max(R.flash, 0.12); sfx('magic', 0.05, e.x, 5);
        vfx('burst', 'ice', sp.x, sp.y, 1, 0.3); fx('fx_thunder', sp.x, sp.y, 0.5, 0.3);
        damage(e, sp.dmg, false, e === R.boss); if (e !== R.boss) chainBolt(e, sp.dmg * 0.5, 2);
      }
      if (sp.t > sp.tele + 0.22) sp.dead = true;
    }
  }
  R.specs = R.specs.filter(sp => !sp.dead);
}
function drawSpecs(t) {
  for (const sp of R.specs) {
    if (sp.k === 'orbit') {
      const n = 6;
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.22; spr(`vx_glow40_${sp.glow || 'gold'}`, sp.x, sp.y, 1, 0.5, 0.5); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      for (let i = 0; i < n; i++) {
        const a = sp.t * 7 + i / n * TAU, x = sp.x + Math.cos(a) * sp.rad, y = sp.y + Math.sin(a) * sp.rad * 0.7;
        for (let k = 1; k <= 2; k++) { const a2 = a - k * 0.25; ctx.globalAlpha = 0.35 / k; spr(`p_${sp.spr || 'Shuriken'}_0`, sp.x + Math.cos(a2) * sp.rad, sp.y + Math.sin(a2) * sp.rad * 0.7, 1, 0.5, 0.5, false, 0, '#fce2ca'); }
        ctx.globalAlpha = 1; spr(`p_${sp.spr || 'Shuriken'}_${Math.floor(t * 20 + i) % 2}`, x, y, 1, 0.5, 0.5);
      }
    } else if (sp.k === 'drop') {
      if (sp.t < sp.delay) { ctx.globalAlpha = 0.5; ellipse(sp.x, sp.y, 7 * P, 3 * P); ctx.fillStyle = 'rgba(19,27,27,0.35)'; ctx.fill(); ctx.globalAlpha = 1; continue; }
      ctx.fillStyle = 'rgba(19,27,27,0.35)'; ellipse(sp.x, sp.y, 6 * P * (1 - sp.z / (400 * U)), 2.5 * P, 0, 0, TAU); ctx.fill();
      for (let k = 1; k <= 6; k++) { ctx.globalAlpha = 0.5 * (1 - k / 7); prect(sp.x - P / 2, sp.y - sp.z - k * 4 * P, P, 3 * P, '#fce2ca'); }
      ctx.globalAlpha = 1; spr(sp.spr, sp.x, sp.y - sp.z, sp.sc, 0.5, 0.5, false, Math.PI / 2);
    } else if (sp.k === 'arc') {
      if (sp.t < 0) continue;
      const u = sp.t / sp.T, x = lerp(sp.sx, sp.tx, u), gy = lerp(sp.sy, sp.ty, u), y = gy - Math.sin(Math.PI * u) * sp.hgt;
      const u2 = Math.min(1, u + 0.02), x2 = lerp(sp.sx, sp.tx, u2), y2 = lerp(sp.sy, sp.ty, u2) - Math.sin(Math.PI * u2) * sp.hgt;
      ctx.fillStyle = 'rgba(19,27,27,0.3)'; ellipse(x, gy, 5 * P, 2 * P); ctx.fill();
      spr(sp.spr, x, y, 1, 0.5, 0.5, false, Math.round(Math.atan2(y2 - y, x2 - x) / (Math.PI / 8)) * (Math.PI / 8));
    } else if (sp.k === 'column') {
      if (sp.t < sp.tele) {   // telegraph: thin blinking guide line
        if (Math.floor(t * 20) % 2) for (let y = 140; y < H - 170; y += 4 * P) prect(sp.x - P / 2, y, P, 2 * P, sp.col || '#d3a2c0');
        continue;
      }
      const a = clamp(1 - (sp.life || 0) / 0.5, 0, 1);
      ctx.globalAlpha = a * 0.55; prect(sp.x - 9 * P, sp.y, 18 * P, H - sp.y, sp.col || '#d3a2c0'); ctx.globalAlpha = a; prect(sp.x - 3 * P, sp.y, 6 * P, H - sp.y, '#ffffff'); ctx.globalAlpha = 1;
      spr(sp.spr || 'p_BigKunai_0', sp.x, sp.y, 1, 0.5, 0.5, false, -Math.PI / 2);
    } else if (sp.k === 'bloom') {
      if (sp.t < sp.tele) { const k = sp.t / sp.tele; ctx.lineWidth = P; ctx.strokeStyle = Math.floor(t * 20) % 2 ? '#8feff1' : '#ffffff'; ellipse(sp.x, sp.y, 95 * U * k, 50 * U * k); ctx.stroke(); }
    } else if (sp.k === 'meteor') {
      const u = clamp(sp.t / sp.T, 0, 1);
      if (sp.t > -0.3) {   // landing marker
        const pulse = Math.floor(t * 14) % 2;
        ctx.lineWidth = P; ctx.strokeStyle = pulse ? '#e0394c' : '#ffe18d'; ellipse(sp.x, sp.y, 30 * U, 14 * U); ctx.stroke();
        ctx.fillStyle = `rgba(224,57,76,${0.12 + 0.2 * u})`; ellipse(sp.x, sp.y, 30 * U * u, 14 * U * u); ctx.fill();
      }
      if (sp.t >= 0) {
        const mx = sp.x + (1 - u) * 160 * U, my = sp.y - 8 * P - (1 - u) * 420 * U;
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5; spr('vx_glow40_fire', mx, my, 1.5, 0.5, 0.5); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
        spr(`p_Fireball_${Math.floor(t * 12) % 4}`, mx, my, 2, 0.5, 0.5, false, Math.round((Math.atan2(420, -160) - (-Math.PI / 4)) / (Math.PI / 8)) * (Math.PI / 8));
        if (Math.random() < 0.7) part({ k: 'float', f: `q_Fire_${Math.floor(Math.random() * (AN.q_Fire || 1))}`, x: mx + rand(-6, 6) * U, y: my + rand(-6, 6) * U, vx: rand(10, 40) * U, vy: rand(-60, -20) * U, life: 0.4, max: 0.4 });
      }
    } else if (sp.k === 'strike') {
      const e = sp.tgt; if (!e) continue;
      const x = sp.done ? sp.x : e.x, y = sp.done ? sp.y : aimY(e);
      if (!sp.done) { if (sp.t > -0.05 && Math.floor(t * 24) % 2) { ctx.lineWidth = P; ctx.strokeStyle = '#8feff1'; ellipse(x, y + 8 * P, 12 * P, 5 * P); ctx.stroke(); } continue; }
      const pts = [[x + rand(-10, 10) * U, 120]]; const seg = 7;
      for (let i = 1; i < seg; i++) pts.push([x + rand(-16, 16) * U, lerp(120, y, i / seg)]);
      pts.push([x, y]);
      for (const [col, sz] of [['#548789', 4], ['#8feff1', 2], ['#ffffff', 1]]) for (let i = 0; i < pts.length - 1; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[i + 1], n = Math.ceil(Math.hypot(bx - ax, by - ay) / P);
        for (let k = 0; k <= n; k++) prect(lerp(ax, bx, k / n) - sz * P / 2, lerp(ay, by, k / n) - sz * P / 2, sz * P, sz * P, col);
      }
    }
  }
}

// ================================================================ ultimate: Shuriken Storm (charges with kills)
function useUlt() {
  if (R.ult < 1 || R.ultT > 0 || !R.sq || R.sq.ko > 0) return;
  R.ult = 0; R.ultT = 5; R.ultFull = 0; R.flash = 0.25; R.shake = 4;
  for (const h of R.heroes) { fx('fx_circlew', h.x, h.y - 8 * P, 1, 0.35); fx('fx_aura', h.x, h.y, 1, 0.4, 1); }
  banner('FIRTINA!', '5 saniye x3 atış'); sfx('skill', 0); uiKey = ''; runHooks('ult');
  if (save.tut) save.tut.ult = true;
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
  if (R.mode) for (const e of R.en) { if (e.dead || !e.rush) continue; const dx = sq.x - e.x, dy = sq.y - e.y, d = Math.hypot(dx, dy) || 1, r0 = 110 * U; if (d < r0) { const w = (1 - d / r0) * 2.4; vx += dx / d * w; vy += dy / d * w; } }
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
  // columns (beam / charge): step sideways out of the marked lane, toward the roomier side
  const lane = b && ((b.tele > 0 && (b.teleK === 'beam' || b.teleK === 'charge')) || b.dash) ? b.lineX : null;
  const beam = R.eb.find(p => p.k === 'beam');
  for (const lx of [lane, beam ? beam.x : null]) {
    if (lx === null || lx === undefined) continue;
    const dx = sq.x - lx; if (Math.abs(dx) < 75 * U) { const dir = Math.abs(dx) > 4 * U ? Math.sign(dx) : (lx < W / 2 ? 1 : -1); vx += dir * 3.5 * (1 - Math.abs(dx) / (75 * U)) + dir * 0.6; }
  }
  const m = Math.hypot(vx, vy); if (m > 1) { vx /= m; vy /= m; }
  return { x: vx * 0.85, y: vy * 0.85 };
}
function hurtSquad(dmg, x, y) {
  const sq = R.sq;
  if (!sq || sq.ko > 0 || sq.inv > 0) return false;
  dmg = Math.max(1, Math.round(dmg * modMul('taken')));
  sq.hp -= dmg; sq.inv = 0.7; sq.hit = 0.25; sq.calm = 0;
  R.shake = Math.max(R.shake, 4); R.hurt = 0.35;
  const L0 = R.heroes[0];
  addText(clamp((L0 ? L0.x : x) + rand(-10, 10) * U, 40 * U, W - 40 * U), (L0 ? L0.y : y) - 30 * P, '-' + dmg, 'hurt');
  fx('fx_cut', x || 0, y || 0, 0.5, 0.2);
  sfx('hurt', 0, x); sfx('voice', 0, x, rand(-2, 2));
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
  if (R.mode) { /* survival etc. end through HOOKS.ko */ }
  else if (R.boss) bossFail();
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
      const wf = Math.floor(h.walk); h.walk += dt * 8; if (h.i === 0 && Math.floor(h.walk) !== wf && Math.floor(h.walk) % 2 === 0) step(h.x);
      if (h.atk <= 0) h.dir = h.spd > 30 * U ? dirOf(h.x - ox, h.y - oy) : 'u';
      h.dust = (h.dust || 0) - dt;
      if (h.dust <= 0) { h.dust = 0.45; part({ k: 'anim', a: 'fx_smoke', x: h.x, y: h.y + 2 * P, s: 0.5, life: 0.3, max: 0.3, ay: 1, alpha: 0.25 }); }
    } else if (h.atk <= 0 && R.phase === 'advance') h.dir = 'u';
    else if (h.atk <= 0 && (h.dir === 'u' || h.dir === 'd') && R.phase !== 'advance') h.dir = h.x < W / 2 ? 'r' : 'l';   // standing: guard stance, facing the middle
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
  const cx = b.x, cy = b.y - bossH(b) * 0.5, dmg = hpBase() * 0.1, rage = b.rage || b.hp < b.maxHp * 0.5;
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
  } else if (kind === 'spiral') {   // phase 2: a rotating stream of orbs from two arms
    for (const off of [0, Math.PI]) orb(cx, cy, (b.spAng || 0) + off, 160, dmg * 0.7, 4);
    b.spAng = (b.spAng || 0) + 0.42; sfx('lob', 0.06, cx);
  } else if (kind === 'ring2') {
    const n = 18; for (let i = 0; i < n; i++) orb(cx, cy, b.burstOff + i / n * TAU, 150, dmg);
  } else if (kind === 'summon') {
    const n = rage ? 4 : 3, pool = biome().pool;
    for (let i = 0; i < n; i++) {
      const type = pick(pool), d = EDEF[type], x = clamp(b.x + (i - (n - 1) / 2) * 50 * U, 70 * U, W - 70 * U), y = b.y + rand(10, 40) * U, hp = enemyHp() * 1.5;
      R.en.push({ id: R.nextId++, type, d, x, y, lane: (x - W / 2) / F.pathW, hp, maxHp: hp, sp: 90 * U, flash: 0, anim: 0, knock: 0, kx: 0, ky: 0, kb: 0, age: 0, ranged: !!d.ranged, stopped: false, atk: rand(1.5, 2.5), wind: 0, dir: 'd', sc: 1, gold: 0.5, summoned: true });
      puff(x, y, 2); vfx('ring', 'magic', x, y - 6 * P, 0.5, 0.3);
    }
    sfx('elite', 0);
  } else if (kind === 'rain') {
    const n = rage ? 8 : 6, spr = RAIN_SPR[b.key] || 'SpriteSheetRock';
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), r = i === 0 ? 0 : rand(30, 95) * U;
      R.eb.push({ k: 'lob', sx: b.x + rand(-20, 20) * U, sy: b.y - bossH(b) * 0.6, tx: clamp(L0.x + Math.cos(a) * r, 30 * U, W - 30 * U), ty: L0.y + Math.sin(a) * r * 0.6, t: -i * 0.14, T: 1.05, r: 6 * P, dmg: dmg * 0.9, spr });
    }
    sfx('lob', 0);
  } else if (kind === 'beam') {
    R.eb.push({ k: 'beam', x: b.lineX, y0: b.y - bossH(b) * 0.45, t: 0, T: 0.55, w: 12 * P, col: b.col, dmg: dmg * 1.6, hit: false });
    R.shake = 5; R.flash = 0.12; sfx('hit_fire', 0, b.lineX); sfx('magic', 0, b.lineX, -7);
  } else if (kind === 'charge') {
    b.dash = { x0: b.x, y0: b.y, x1: b.lineX, y1: Math.min(L0.y - 40 * U, H - 230), t: 0 };
    sfx('elite', 0); R.shake = 4;
  } else if (kind === 'leap') {
    b.leap = { x0: b.x, x1: clamp(b.lineX, 90 * U, W - 90 * U), t: 0, T: 0.6 };
    sfx('throw2', 0); sfx('voice', 0, b.x, -12);
  } else if (kind === 'slam') {
    R.eb.push({ k: 'wave', x: b.x, y: b.y, r: 40 * U, sp: 290 * U, max: 560 * U, w: 4 * P, col: b.col, dmg: hpBase() * 0.16, gaps: b.gaps, hit: false });
    R.shake = 6; sfx('boom', 0); puff(b.x - 40 * U, b.y, 2); puff(b.x + 40 * U, b.y, 2);
  }
}
const angIn = (a, c, w) => { let d = a - c; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return Math.abs(d) < w; };
function updateBossMoves(b, dt) {
  if (b.dash) {   // charge: rush down the marked column and back
    const d = b.dash; d.t += dt;
    const k = d.t < 0.35 ? d.t / 0.35 : d.t < 0.55 ? 1 : Math.max(0, 1 - (d.t - 0.55) / 0.45);
    b.x = lerp(d.x0, d.x1, k); b.y = lerp(d.y0, d.y1, k);
    if (d.t < 0.35 && Math.random() < 0.6) puff(b.x + rand(-20, 20) * U, b.y, 1);
    if (d.t >= 1) { b.x = d.x0; b.y = d.y0; b.dash = null; }
    return true;
  }
  if (b.leap) {   // leap: arc to the marked spot, land with a shockwave
    const l = b.leap; l.t += dt; const k = Math.min(1, l.t / l.T);
    b.x = lerp(l.x0, l.x1, k); b.z = Math.sin(Math.PI * k) * 90 * U;
    if (k >= 1) {
      b.leap = null; b.z = 0; b.homeX = b.x;
      const L0 = R.heroes[0], a = L0 ? Math.atan2((L0.y - b.y) / 0.6, L0.x - b.x) : 2.4;
      b.gaps = [a + rand(0.7, 1.0) * (Math.random() < 0.5 ? -1 : 1), a + Math.PI * rand(0.8, 1.2)];
      bossAttack(b, 'slam'); vfx('ring', 'ink', b.x, b.y - 4 * P, 2, 0.45);
    }
    return true;
  }
  return false;
}
function updateBossAI(b, dt) {
  if (!b.p2 && b.hp < b.maxHp * 0.3) {
    b.p2 = true; b.rage = true; b.spd = (b.spd || 1) * 1.25; b.spAng = rand(0, TAU);
    banner('2. AŞAMA!', b.name + ' gerçek gücünü gösteriyor'); sfx('boss', 0); R.shake = 9; R.flash = 0.3; R.stop = 0.25;
    vfx('ring', 'magic', b.x, b.y - bossH(b) * 0.5, 2, 0.6); vfx('burst', 'magic', b.x, b.y - bossH(b) * 0.5, 2, 0.5);
    for (let i = 0; i < 16; i++) b.burst.push({ t: 0.6 + i * 0.07, k: 'spiral' });
  }
  if (b.p2) { b.spT = (b.spT || 4) - dt; if (b.spT <= 0) { b.spT = 5.5; for (let i = 0; i < 14; i++) b.burst.push({ t: i * 0.08, k: 'spiral' }); } }
  if (!b.rage && b.hp < b.maxHp * 0.5) { b.rage = true; banner('ÖFKE!', b.name + ' hızlandı'); sfx('elite', 0); R.shake = 7; R.flash = 0.2; vfx('ring', 'fire', b.x, b.y - bossH(b) * 0.5, 2, 0.5); }
  if (updateBossMoves(b, dt)) return;
  for (const q of b.burst) { q.t -= dt; if (q.t <= 0) { if (q.k === 'ring2') b.burstOff = q.off; bossAttack(b, q.k); } }
  b.burst = b.burst.filter(q => q.t > 0);
  if (b.tele > 0) { b.tele -= dt; if (b.tele <= 0) bossAttack(b, b.teleK); return; }
  b.atkT -= dt;
  if (b.atkT <= 0) {
    const rage = b.rage || b.hp < b.maxHp * 0.5, sig = (b.ex && b.ex.sig) || BOSS_SIG[b.key] || ['slam', 'ring'];
    const seq = ['fan', sig[0], 'ring', sig[1], 'slam', sig[0]];
    const k = seq[b.seq++ % seq.length];
    b.teleK = k; b.tele = { slam: 0.9, beam: 0.95, charge: 0.85, leap: 0.6, rain: 0.5, summon: 0.6 }[k] || 0.45;
    const L0 = R.heroes[0]; if (L0) b.lineX = clamp(L0.x, 40 * U, W - 40 * U);
    if (k === 'slam') { const L0 = R.heroes[0], a = L0 ? Math.atan2((L0.y - b.y) / 0.6, L0.x - b.x) : 2.4; b.gaps = [a + rand(0.6, 1.0) * (Math.random() < 0.5 ? -1 : 1), a + Math.PI * rand(0.8, 1.2)]; }
    b.atkT = ((rage ? 1.7 : 2.3) + b.tele) / (b.spd || 1);
  }
}
function updateEnemyShots(dt) {
  const sq = R.sq, hs = R.heroes;
  for (const p of R.eb) {
    if (p.k === 'lob') {
      p.t += dt;
      if (p.t >= p.T) {
        p.dead = true; puff(p.tx, p.ty, 1); bits(p.tx, p.ty - 2 * P, p.spr === 'Fireball' ? 'q_Fire' : 'q_Rock', 3); if (p.spr) { vfx('burst', p.spr === 'Fireball' ? 'fire' : p.spr === 'PlantSpike' ? 'leaf' : p.spr === 'EnergyBall' ? 'ice' : 'ink', p.tx, p.ty - 3 * P, 0.5, 0.25); sfx('hit', 0.05, p.tx); }
        for (const h of hs) { const dx = h.x - p.tx, dy = (h.y - p.ty) / 0.6; if (Math.hypot(dx, dy) < 36 * U) { hurtSquad(p.dmg, p.tx, p.ty - 8 * P); break; } }
      }
    } else if (p.k === 'orb') {
      p.life -= dt; p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.life <= 0 || p.x < -60 || p.x > W + 60 || p.y < -60 || p.y > H + 60) p.dead = true;
      else for (const h of hs) if (Math.hypot(h.x - p.x, h.y - 12 * P - p.y) < p.r + 5 * P) { if (hurtSquad(p.dmg, p.x, p.y)) p.dead = true; break; }
    } else if (p.k === 'beam') {
      p.t += dt; if (p.t >= p.T) p.dead = true;
      if (!p.hit) for (const h of hs) if (Math.abs(h.x - p.x) < p.w / 2 + 6 * U && h.y > p.y0) { p.hit = true; hurtSquad(p.dmg, h.x, h.y - 8 * P); break; }
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
const HOOKS = { update: [], render: [], kill: [], bossWin: [], bossStart: [], bossFail: [], buy: [], stage: [], hurt: [], ko: [], purchase: [], ult: [], star: [], rebirth: [], shot: [], hit: [], tower: [], perk: [], light: [] };
const runHooks = (k, ...a) => { for (const f of HOOKS[k]) { try { f(...a); } catch (err) { console.error('hook', k, err); } } };
function update(dt) {
  R.t += dt;
  updateSquad(dt);
  const ko = R.sq.ko > 0;
  if (R.lobGap > 0) R.lobGap -= dt;
  if (R.retryT > 0) R.retryT -= dt;
  R.waveT += dt;
  if (R.comboT > 0) R.comboT -= dt; if (R.comboPop > 0) R.comboPop -= dt; if (R.coinT > 0) R.coinT -= dt; else R.coinN = 0; if (R.buyT > 0) R.buyT -= dt; else R.buyN = 0;
  if (R.ultT > 0) { R.ultT -= dt; if (Math.random() < 0.5) for (const h of R.heroes) if (Math.random() < 0.3) fx('fx_aura', h.x, h.y, 0.5, 0.3, 1); if (R.ultT <= 0) uiKey = ''; }
  // the march: scroll the world while advancing, then hold for the wave
  if (!R.boss) {
    if (R.phase === 'advance' && !ko) {
      const d = R.advSpd * dt; R.cam += d; R.advLeft -= d;
      for (const m of R.amb) m.y += d;
      for (const dc of R.decals) dc.y += d;
      for (const p of R.parts) if (p.k === 'bit' || p.k === 'anim') p.y += d;
      if (R.advLeft <= 0) {
        if (save.bossReady && R.retryT <= 0 && !R.mode && !(window.SS && window.SS.busy && window.SS.busy())) startBoss();
        else startWave();
      }
    } else if (R.phase === 'fight' && !ko) {
      if (R.toSpawn > 0) { R.spawnT -= dt; if (R.spawnT <= 0) { spawnEnemy(); R.toSpawn--; R.spawnT = R.horde ? rand(0.04, 0.09) : rand(0.08, 0.2); } }
      else if (R.en.length <= 2 && !R.eb.length && R.toSpawn <= 0 && (R.en.length === 0 || R.waveT > 4)) startAdvance(rand(110, 170) * U, 160 * U);
    }
  }
  const L0 = R.heroes[0];
  for (const e of R.en) {
    if (e.dead) continue;
    e.age += dt; e.anim += dt; if (e.flash > 0) e.flash -= dt;
    if (e.treasure) {
      if (e.slow > 0) e.slow -= dt;
      e.x += e.vx * e.sp * (e.slow > 0 ? 0.45 : 1) * dt; e.spark -= dt;
      if (e.spark <= 0) { e.spark = 0.25; fx('fx_spark', e.x + rand(-10, 10) * U, e.y - rand(4, 16) * P, 0.5, 0.2); }
      if (e.x < -40 || e.x > W + 40) { e.dead = true; toast('Hazine kaçtı!'); }
      continue;
    }
    if (e.slow > 0) e.slow -= dt;
    if (e.vr === 'healer' && !ko) { e.healT -= dt; if (e.healT <= 0) { e.healT = 2.2; let n = 0; for (const o of R.en) if (!o.dead && o !== e && !o.treasure && Math.hypot(o.x - e.x, o.y - e.y) < 95 * U && o.hp < o.maxHp) { o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.12); n++; fx('fx_spark', o.x, o.y - 10 * P, 0.5, 0.25); } if (n) { vfx('ring', 'leaf', e.x, e.y - 6 * P, 1, 0.35); sfx('magic', 0.2, e.x, -5); } } }
    if (e.burn > 0) {
      e.burn -= dt; e.burnT -= dt;
      if (e.burnT <= 0) { e.burnT = 0.4; bits(e.x, e.y - 10 * P, 'q_Fire', 1); damage(e, e.burnD, false, false); if (e.dead) continue; }
    }
    const goal = e.rush ? { x: R.sq.x, y: R.sq.y - 4 * P } : enemyGoal(e);
    if (e.rush && !ko) { e.hitT = (e.hitT || 0) - dt; if (e.hitT <= 0 && Math.hypot(e.x - R.sq.x, (e.y - R.sq.y) * 1.3) < 26 * U * (e.sc || 1)) { e.hitT = 0.8; hurtSquad(e.dmg || hpBase() * 0.05, e.x, e.y - 8 * P); } }
    const dx = goal.x - e.x, dy = goal.y - e.y, d = Math.hypot(dx, dy);
    if (e.vr === 'runner' && !e.stopped && Math.random() < 0.15) part({ k: 'anim', a: 'fx_smoke', x: e.x, y: e.y + 2 * P, s: 0.5, life: 0.25, max: 0.25, ay: 1, alpha: 0.35 });
    if (e.rush ? d > 4 * U : e.stopped ? d > 30 * U : d > 6 * U) { e.stopped = false; const m = Math.min(d, e.sp * (e.slow > 0 ? 0.45 : 1) * dt); e.x += dx / d * m; e.y += dy / d * m; }
    else e.stopped = true;
    if (L0) e.dir = e.stopped ? dirOf(L0.x - e.x, L0.y - e.y) : dirOf(dx, dy);
    if (e.knock > 0) { const eb = enemyBox(); e.x = clamp(e.x + e.kx * e.knock, eb.x0 - 20 * U, eb.x1 + 20 * U); e.y = Math.max(e.y + e.ky * e.knock, Math.min(e.y, eb.y0 + 20 * U)); e.knock *= 0.5; if (e.knock < 0.3) e.knock = 0; }
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
    else {
      b.t -= dt;
      if (b.t <= 0) {
        const mon = window.SS && window.SS.mon;
        if (!b.cont && !b.ex && mon && mon.canContinue() && b.hp < b.maxHp * 0.6) {   // only offered when the win is in reach
          b.cont = true; b.t = 0; R.paused = true;
          mon.offerContinue(ok => { R.paused = false; last = performance.now(); if (ok && R.boss === b) { b.t = 15; banner('+15 SN!', 'Bitir şunu!'); sfx('skill', 0); uiKey = ''; } else if (R.boss === b) bossFail(); });
        } else bossFail();
      } else if (!ko) updateBossAI(b, dt);
    }
  }
  if (R.leavingBoss) { const lb = R.leavingBoss; lb.leaving += dt; lb.x += F.dir.x * 300 * U * dt; lb.y += F.dir.y * 300 * U * dt; if (lb.leaving > 2) R.leavingBoss = null; }
  const rate = fireRate();
  for (const h of R.heroes) {
    h.fireT -= dt; if (h.recoil > 0) h.recoil -= dt; if (h.empty > 0) h.empty -= dt;
    if (h.wind > 0) { h.wind -= dt; if (h.wind <= 0 && !ko) throwNow(h); }
    const tgt = ko ? null : nearestTarget(h);
    if (tgt && h.fireT <= 0 && !(h.wind > 0)) { h.fireT = 1 / rate; fire(h, tgt); }
  }
  for (const q of R.bul) {
    q.life -= dt; q.age += dt; q.tt -= dt;
    const g = q.g;
    if (q.tt <= 0) {   // trail: ghost copies + element motes
      q.tt = 0.03;
      const S = pstyle(g);
      if (!save.eco && S.motes && Math.random() < S.mp) {
        const set = S.motes, m = AN[set] || 1;
        part({ k: 'float', f: `${set}_${Math.floor(Math.random() * m)}`, x: q.x + rand(-4, 4) * U, y: q.y + rand(-4, 4) * U, vx: rand(-20, 20) * U, vy: (set === 'q_Fire' ? rand(-50, -15) : rand(-20, 20)) * U, life: 0.35, max: 0.35 });
      }
    }
    const t = q.tgt, alive = t && !t.dead && (t === R.boss || R.en.includes(t));
    if (g.boomer) {
      q.dist += q.sp * dt;
      if (!q.back && (q.dist > 330 * U || (!alive && q.dist > 120 * U))) { q.back = true; q.hits.clear(); }
      if (q.back) {
        const h = q.from, dx = h.x - q.x, dy = h.y - 12 * P - q.y;
        // turn harder the closer it gets, so a returning blade lands in the hand instead of orbiting the squad
        const dd = Math.hypot(dx, dy);
        q.a = turn(q.a, Math.atan2(dy, dx), dt * (9 + 40 * Math.max(0, 1 - dd / (160 * U)))); q.sp = Math.min(q.sp * (1 + dt * 1.5), 1100 * U);
        if (dd < 30 * U || h.i >= save.team || (q.back && q.life < 0.6)) { q.dead = true; fx('fx_spark', q.x, q.y, 0.5, 0.15); }
      } else if (alive) q.a = turn(q.a, Math.atan2(aimY(t) - q.y, t.x - q.x), dt * 5);
    } else if (alive && q.home) q.a = turn(q.a, Math.atan2(aimY(t) - q.y, t.x - q.x), dt * (g.curve ? 7 : g.shots > 1 ? 7 : 16));
    q.x += Math.cos(q.a) * q.sp * dt; q.y += Math.sin(q.a) * q.sp * dt;
    { const tr = q.trail, h0 = tr[0];   // ribbon points: a new one every ~2 px, trimmed to the style's length
      if (!h0 || Math.hypot(q.x - h0.x, q.y - h0.y) > 2 * U) tr.unshift({ x: q.x, y: q.y });
      const max = pstyle(g).len * U; let d = 0;
      for (let i = 1; i < tr.length; i++) { d += Math.hypot(tr[i].x - tr[i - 1].x, tr[i].y - tr[i - 1].y); if (d > max) { tr.length = i + 1; break; } }
      if (tr.length > 80) tr.length = 80; }
    if (g.wobble) { const w = Math.cos(q.age * 16 + q.wob) * 70 * U * dt; q.x -= Math.sin(q.a) * w; q.y += Math.cos(q.a) * w; }
    if (!q.dead && R.boss && R.boss.arrive >= 1 && !q.hits.has(R.boss) && Math.hypot(R.boss.x - q.x, aimY(R.boss) - q.y) < 60 * U) onHit(q, R.boss);
    if (!q.dead) for (const c of R.en) {
      if (c.dead || q.hits.has(c)) continue;
      if (Math.hypot(c.x - q.x, aimY(c) - q.y) < 20 * U * (c.sc || 1)) { onHit(q, c); if (q.dead) break; }
    }
    if (!q.dead && g.stick && !alive && !g.boomer) { q.fall = (q.fall || 0) + dt; if (q.fall > 0.2) { q.dead = true; stickDecal(q); } }
    if (q.life <= 0 || q.x > W + 100 || q.x < -100 || q.y < -100 || q.y > H + 100) q.dead = true;
    if (q.dead && !q.settled && q.tgt && q.tgt !== R.boss) { q.settled = true; q.tgt.pend = Math.max(0, (q.tgt.pend || 0) - q.dmg); }
  }
  for (const c of R.corpses) c.t += dt; R.corpses = R.corpses.filter(c => c.t < 0.28);
  for (const w of R.swish) w.life -= dt; R.swish = R.swish.filter(w => w.life > 0);
  for (const g of R.ghosts) g.life -= dt; R.ghosts = R.ghosts.filter(g => g.life > 0);
  { const L0 = R.heroes[0]; R.ghostT -= dt;   // afterimages while you steer the squad fast
    if (L0 && R.manual && !save.eco && Math.hypot(R.sq.vx, R.sq.vy) > 150 * U && R.ghostT <= 0) { R.ghostT = 0.045; for (const h of R.heroes) R.ghosts.push({ n: `h_${h.id}_${h.dir}${Math.floor(h.walk) % 4}`, x: h.x, y: h.y, life: 0.18 }); } }
  for (const b of R.bolts) b.life -= dt;
  R.bolts = R.bolts.filter(b => b.life > 0);
  for (const d of R.decals) d.life -= dt;
  R.decals = R.decals.filter(d => d.life > 0);
  updateSpecs(dt);
  if (evolved() && !ko && (R.en.length || (R.boss && R.boss.arrive >= 1))) { R.specT -= dt; if (R.specT <= 0) R.specT = castSpecial() ? 5.5 : 1; }
  if (R.cheerT > 0) R.cheerT -= dt;
  updateEnemyShots(dt);
  for (const p of R.parts) {
    p.life -= dt;
    if (p.k === 'bit') { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 700 * U * dt; p.vx *= 0.98; }
    else if (p.k === 'streak') { p.x += p.vx * dt; p.y += p.vy * dt; const k = Math.pow(0.02, dt); p.vx *= k; p.vy *= k; }
    else if (p.k === 'float') { p.x += p.vx * dt; p.y += p.vy * dt; }
  }
  for (const t of R.txt) { t.life -= dt; t.y -= (t.kind === 'money' ? 40 : 30) * U * dt; }
  for (const m of R.coins) {
    m.t += dt;
    if (m.t < 0.4) { m.x += m.vx * dt; m.y += m.vy * dt; m.vy += 600 * U * dt; }
    else { const dx = F.wallet.x - m.x, dy = F.wallet.y - m.y, d = Math.hypot(dx, dy), sp = (700 + m.t * 900) * U; if (d < 16) { m.dead = true; R.walletPop = 0.12; R.coinT = 0.5; sfx('tick', 0.03, F.wallet.x, PENTA[Math.min(R.coinN++, PENTA.length - 1)] + 7); } else { const k = Math.min(d, sp * dt); m.x += dx / d * k; m.y += dy / d * k; } }
  }
  R.en = R.en.filter(e => !e.dead); R.bul = R.bul.filter(q => !q.dead); R.parts = R.parts.filter(p => p.life > 0);
  R.txt = R.txt.filter(t => t.life > 0); R.coins = R.coins.filter(m => !m.dead);
  if (R.shake > 0) R.shake = Math.max(0, R.shake - dt * 30);
  if (R.kickX || R.kickY) { const k = Math.pow(0.0005, dt); R.kickX = Math.abs(R.kickX * k) < 0.3 ? 0 : R.kickX * k; R.kickY = Math.abs(R.kickY * k) < 0.3 ? 0 : R.kickY * k; }
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
  const sh = Math.round(R.shake / P), sx = (sh ? Math.round(rand(-sh, sh)) * P : 0) + Math.round((R.kickX || 0) / P) * P, sy = (sh ? Math.round(rand(-sh, sh)) * P : 0) + Math.round((R.kickY || 0) / P) * P;
  ctx.translate(sx, sy);
  const t = R.t;
  drawGroundTiles();
  drawGround(t);
  for (const d of R.decals) { ctx.globalAlpha = Math.min(1, d.life * 2); spr(d.f, d.x, d.y, d.sc, 0.5, 0.5, false, d.rot); }
  ctx.globalAlpha = 1;
  for (const g of R.ghosts) { ctx.globalAlpha = g.life / 0.18 * 0.35; spr(g.n, g.x, g.y, HS, 0.5, 1, false, 0, '#fce2ca'); }
  for (const c of R.corpses) {   // white pop, then a rising fade
    const k = c.t / 0.28; ctx.globalAlpha = c.t < 0.06 ? 1 : 1 - k;
    spr(c.n, c.x, c.y - k * 10 * P, c.sc, 0.5, 1, false, 0, c.t < 0.06 ? '#ffffff' : '#fce2ca');
  }
  ctx.globalAlpha = 1;
  const list = [];
  for (const e of R.en) list.push({ y: e.y, k: 0, o: e });
  if (R.boss) list.push({ y: R.boss.y, k: 1, o: R.boss });
  if (R.leavingBoss) list.push({ y: R.leavingBoss.y, k: 1, o: R.leavingBoss });
  for (const h of R.heroes) list.push({ y: h.y, k: 2, o: h });
  list.sort((a, b) => a.y - b.y);
  ctx.globalAlpha = 0.8;
  for (const it of list) {
    if (it.k === 1) {   // boss: soft two-step pixel ellipse sized to the sprite, shrinking while it is airborne
      const o = it.o, f = AF[`b_${o.key}_0`], w = (f ? f[2] : 50) * P * 0.36 * (1 - Math.min(0.5, (o.z || 0) / (180 * U)));
      ctx.fillStyle = 'rgba(19,27,27,0.22)'; ellipse(snap(o.x), snap(o.y + P), w, w * 0.32); ctx.fill();
      ctx.fillStyle = 'rgba(19,27,27,0.25)'; ellipse(snap(o.x), snap(o.y + P), w * 0.72, w * 0.22); ctx.fill();
    } else spr('shadow', it.o.x, it.o.y + P, it.k === 2 ? HS : it.o.sc || 1, 0.5, 0.5);
  }
  ctx.globalAlpha = 1;
  for (const it of list) {
    const o = it.o;
    if (it.k === 0) {
      const fly = o.d.fly, n = Math.floor(o.anim * (o.stopped ? 4 : 8)) % 4;
      const name = `m_${o.type}_${o.dir}${n}`, lift = fly ? (5 + (Math.floor(t * 3 + o.id) % 2)) * P : 0;
      if (o.age < 0.2) ctx.globalAlpha = o.age / 0.2;
      const es = o.sc || 1;
      if (o.treasure) outline(name, o.x, o.y - lift, Math.floor(t * 8) % 2 ? '#ffe18d' : '#f1c471', es);
      else if (o.elite) outline(name, o.x, o.y - lift, '#e0394c', es, 0.9);
      else if (o.vr) outline(name, o.x, o.y - lift, VAR[o.vr].rim, es, 0.9);
      spr(name, o.x, o.y - lift, es);
      if (o.flash > 0) spr(name, o.x, o.y - lift, es, 0.5, 1, false, 0, '#ffffff');
      else if (o.wind > 0 && Math.floor(t * 16) % 2) spr(name, o.x, o.y - lift, es, 0.5, 1, false, 0, '#fce2ca');
      if (o.slow > 0) { ctx.globalAlpha = 0.5; spr(name, o.x, o.y - lift, es, 0.5, 1, false, 0, '#b8dce5'); }
      ctx.globalAlpha = 1;
      if (o.burn > 0) spr(`q_Fire_${Math.floor(t * 10 + o.id) % (AN.q_Fire || 1)}`, o.x + 3 * P, o.y - lift - 15 * P * es, 1, 0.5, 1);
      if (o.hp < o.maxHp || o.elite || o.treasure) drawBar(o.x, o.y - lift - (16 * es + 3) * P, o.elite ? 20 : 16, o.hp / o.maxHp, o.elite || o.treasure ? '#f1c471' : '#e0394c');
    } else if (it.k === 1) {
      const n = AN['b_' + o.key] || 1, name = `b_${o.key}_${Math.floor(o.anim * (o.rage ? 11 : 7)) % n}`, by = o.y - (o.z || 0);
      ctx.globalAlpha = o.leaving ? Math.max(0, 1 - o.leaving / 2) : 1;
      if (o.p2 && !o.leaving) outline(name, o.x, by, Math.floor(t * 8) % 2 ? '#d3a2c0' : '#a5608b', 1, 1);
      else if (o.rage && !o.leaving) outline(name, o.x, by, Math.floor(t * 6) % 2 ? '#e0394c' : '#8f3e56', 1, 0.85);
      spr(name, o.x, by);
      if (o.flash > 0) { ctx.globalAlpha *= 0.7; spr(name, o.x, by, 1, 0.5, 1, false, 0, '#ffffff'); }
      else if (o.rage && Math.floor(t * 3) % 2) { ctx.globalAlpha = 0.22; spr(name, o.x, by, 1, 0.5, 1, false, 0, '#e0394c'); }
      if (o.tele > 0 && Math.floor(t * 12) % 2) { ctx.globalAlpha = 0.45; spr(name, o.x, by, 1, 0.5, 1, false, 0, '#e0394c'); }
      ctx.globalAlpha = 1;
    } else {
      const sq = R.sq, ko = sq.ko > 0;
      const hop = (R.ultT > 0 || R.cheerT > 0) && sq.ko <= 0;
      const fr = o.atk > 0 ? 'a' : hop ? 'j' : o.moving ? String(Math.floor(o.walk) % 4) : '0';
      const name = `h_${o.id}_${R.cheerT > 0 && o.atk <= 0 ? 'd' : o.dir}${fr}`;
      const idle = fr === '0' && R.cheerT <= 0;
      const lift = hop ? Math.round(Math.abs(Math.sin(t * 7 + o.ph)) * 6) * P : idle && Math.floor(t * 1.6 + o.ph) % 2 ? P * HS : 0;
      // recoil: one art pixel back, away from the throw
      const rx = o.recoil > 0 ? -Math.round(Math.cos(o.ang)) * P * HS : 0, ry = o.recoil > 0 ? -Math.round(Math.sin(o.ang)) * P * HS : 0;
      const hx = o.x + rx, hy = o.y + ry - lift;
      ctx.globalAlpha = ko ? 0.4 : (sq.inv > 0 && Math.floor(t * 14) % 2 === 0) ? 0.5 : 1;
      const g0 = GUNS[save.gun], rim = ko ? null : R.ultT > 0 ? (Math.floor(t * 10 + o.i) % 2 ? '#ffe18d' : '#ff9554') : evolved() ? TRAIL_COL[g0.glow] : (o.i === 0 && R.manual) ? '#fce2ca' : null;
      const behind = false;   // weapons are always drawn in front so they stay visible (the squad mostly faces up)
      if (behind) drawHeld(o, hx, hy);
      if (rim) outline(name, hx, hy, rim, HS, R.ultT > 0 ? 1 : 0.8);
      spr(name, hx, hy, HS);
      if (sq.hit > 0 && !ko) spr(name, hx, hy, HS, 0.5, 1, false, 0, '#ffffff');
      if (!behind) drawHeld(o, hx, hy);
      ctx.globalAlpha = 1;
    }
  }
  drawShots(t);
  for (const w of R.swish) {   // throw smear: a short bent line of pixels from the hand
    const k = w.life / 0.14; ctx.globalAlpha = k;
    for (let i = 0; i < 5; i++) { const a = w.a + (i - 2) * 0.32, r = (9 + (1 - k) * 6) * P; prect(w.x + Math.cos(a) * r - P / 2, w.y + Math.sin(a) * r - P / 2, P, P, i === 2 ? '#ffffff' : w.col); }
  }
  ctx.globalAlpha = 1;
  drawSpecs(t);
  // chain lightning: pixel bolts (square dots along a jagged path, outer glow + white core)
  for (const b of R.bolts) {
    const seg = 6, pts = [[b.x0, b.y0]];
    for (let i = 1; i < seg; i++) { const k = i / seg, nx = -(b.y1 - b.y0), ny = b.x1 - b.x0, nl = Math.hypot(nx, ny) || 1, j = rand(-7, 7) * P; pts.push([lerp(b.x0, b.x1, k) + nx / nl * j, lerp(b.y0, b.y1, k) + ny / nl * j]); }
    pts.push([b.x1, b.y1]);
    for (const [col, sz] of [['#79b8ce', 2], ['#f2eaf1', 1]]) for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1], n = Math.ceil(Math.hypot(bx - ax, by - ay) / P);
      for (let k = 0; k <= n; k++) prect(lerp(ax, bx, k / n) - sz * P / 2, lerp(ay, by, k / n) - sz * P / 2, sz * P, sz * P, col);
    }
  }
  // thrown weapons: ribbon trail + glow + sprite (never freely rotated: spin = frame flip, else 16 directions)
  const many = R.bul.length > 24;
  for (const q of R.bul) {
    const g = q.g, S = pstyle(g), n = AN['p_' + g.spr] || 1, sc = (q.sc || g.sc || 1) * (S.sc || 1);
    const cosT = save.cos && save.cos.trail, tint = q.pg ? TRAIL_COL[q.pg] : cosT ? TRAIL_COL[cosT] : null;
    const rp = tint ? ['#ffffff', tint, tint, '#46402e'] : S.ramp;
    const lead = q.special || !q.from || q.from.i === 0 || R.bul.length < 10;   // visual hierarchy: the leader's throws are the loud ones
    if (!save.eco) drawRibbon(q, S, rp, lead, many);
    if ((S.add || q.pg || q.special) && (lead || !many)) {   // soft additive core glow
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = (0.32 + 0.08 * Math.sin(q.age * 20)) * (lead ? 1 : 0.5);
      spr(`vx_glow${q.special || evolved() || sc >= 1.5 ? 40 : 24}_${q.pg || cosT || g.glow || 'gold'}`, q.x, q.y, 1, 0.5, 0.5);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    }
    const name = g.spin ? `p_${g.spr}_${Math.floor(q.age * 20) % n}` : `p_${g.spr}_${Math.floor(q.age * 12) % n}`;
    const rot = g.spin ? 0 : Math.round((q.a - (g.ori || 0)) / (Math.PI / 8)) * (Math.PI / 8);
    spr(name, q.x, q.y, sc, 0.5, 0.5, false, rot);
  }
  for (const p of R.parts) {
    const a = clamp(p.life / p.max, 0, 1);
    if (p.k === 'flash') {   // one-frame white-hot pop
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a;
      pdisk(p.x, p.y, p.r * (0.6 + 0.4 * a), '#ffffff'); pdisk(p.x, p.y, p.r * (1.1 + 0.5 * (1 - a)), hexA(p.col, 0.45));
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; continue;
    }
    if (p.k === 'streak') {   // a spark: short pixel line along its motion, hot head, cooling tail
      const v = Math.hypot(p.vx, p.vy) || 1, ux = p.vx / v, uy = p.vy / v, len = Math.max(P, p.len * a), m = Math.ceil(len / P);
      if (p.add) ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < m; k++) { ctx.globalAlpha = a * (1 - k / (m + 1)); prect(snap(p.x - ux * k * P) - P / 2, snap(p.y - uy * k * P) - P / 2, P, P, ramp(p.ramp, (1 - a) * 0.6 + k / m * 0.4)); }
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; continue;
    }
    if (p.k === 'anim') {
      const n = AN[p.a] || 1, f = Math.min(n - 1, Math.floor((1 - a) * n));
      if (p.alpha) ctx.globalAlpha = p.alpha;
      spr(`${p.a}_${f}`, p.x, p.y, p.s, 0.5, p.ay);
      ctx.globalAlpha = 1;
    } else { ctx.globalAlpha = Math.min(1, a * 2); spr(p.f, p.x, p.y, 1, 0.5, 0.5, p.flip); ctx.globalAlpha = 1; }
  }
  runHooks('light', ctx);   // lighting / weather layer (features/visuals.js), drawn under the HUD-like overlays
  drawSquadHp();
  for (const m of R.coins) spr(`coin_${Math.floor(m.t * 10 + m.ph) % 4}`, m.x, m.y, 1, 0.5, 0.5);
  for (const tx of R.txt) {
    ctx.globalAlpha = Math.min(1, tx.life * 4);
    const age = tx.max - tx.life, big = tx.kind === 'crit';
    if (tx.kind === 'gem') { spr('gem_icon', tx.x - 6 * P, tx.y, 0.5, 0.5, 0.5); }
    else if (tx.kind === 'fen') spr('m_LanternRed_d0', tx.x - 7 * P, tx.y + 4 * P, 0.5, 0.5, 1);
    btext(big ? tx.s + '!' : tx.kind === 'money' ? '+' + tx.s : tx.s, tx.x, tx.y, tx.kind === 'money' ? 'y' : big ? 'o' : tx.kind === 'hurt' ? 'r' : tx.kind === 'gem' || tx.kind === 'fen' ? 'w' : 'w', big ? (age < 0.08 ? 1.5 : 1) : tx.kind === 'gem' || tx.kind === 'fen' ? 1 : 0.5);
  }
  ctx.globalAlpha = 1;
  if (R.combo >= 4 && R.comboT > 0) {
    ctx.globalAlpha = Math.min(1, R.comboT * 2);
    const big = R.comboPop > 0 ? 1.5 : 1, c = R.combo >= 50 ? 'o' : R.combo >= 25 ? 'r' : 'y';
    btext('x' + (R.combo + 1), W - 52, 152, c, big);
    ctx.globalAlpha = 1;
  }
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
// weapon in hand, always: bow / wand / book, or the blade that is thrown next (it leaves the hand on the throw
// and a fresh one is drawn a moment later). Idle: held at the sleeve pointing down / forward; attack: in the
// outstretched hand, pointing at the target (snapped to 45° so the pixels stay clean).
const HELD_ROT = { d: 0, u: Math.PI, l: Math.PI / 2, r: -Math.PI / 2 };
const FACE_ANG = { u: -Math.PI / 2, d: Math.PI / 2, l: Math.PI, r: 0 };
const HOLD = { Shuriken: 1, Kunai: 1, BigKunai: 0.5 };   // in-hand size of thrown weapons
function drawHeld(o, x, y) {
  if (R.sq.ko > 0) return;
  const g = GUNS[save.gun], atk = o.atk > 0, a = (atk ? HAND : HAND_IDLE)[o.dir] || HAND_IDLE.d;
  const px = x + a[0] * P * HS, py = y + a[1] * P * HS;
  if (g.held) {
    let rot = g.held === 'wh_Book' ? 0 : (HELD_ROT[o.dir] || 0);
    const bow = /Bow$/.test(g.held), stick = g.held === 'wh_Wand' || g.held === 'wh_Katana';
    if (bow && o.dir === 'u' && atk) { spr(g.held, x, y - 23 * P, 1, 0.5, 0.5); return; }   // bow raised over the head to shoot
    if (stick && !atk) rot = o.dir === 'l' ? -0.4 : 0.4;   // wand / katana rests tilted, tip up
    if (g.held === 'wh_Katana' && atk) rot = Math.round((o.ang + Math.PI / 2) / (Math.PI / 4)) * (Math.PI / 4);   // katana swings toward the target
    if (bow && !atk) rot = o.dir === 'l' ? -Math.PI / 2 : Math.PI / 2;   // bow carried upright at the side
    spr(g.held, px, py, g.held === 'wh_Wand' ? 1.5 : 1, 0.5, stick && !atk ? 0.9 : 0.5, false, rot);
    if (g.held !== 'wh_Book') drawFist(px, py);
    return;
  }
  if (o.empty > 0) return;
  const sc = HOLD[g.spr] || 0.5, snap45 = v => Math.round(v / (Math.PI / 4)) * (Math.PI / 4);
  // idle: guard stance, blade raised forward; attack: pointing at the target
  const ang = atk ? snap45(o.ang) : o.dir === 'l' ? -Math.PI * 0.75 : o.dir === 'r' ? -Math.PI * 0.25 : o.dir === 'u' ? -Math.PI / 2 : Math.PI / 2;
  const f = AF[`p_${g.spr}_0`], len = f ? f[2] * sc : 8, grip = g.spin ? 0 : len * 0.32;   // the hand holds the handle end
  const cx = px + Math.cos(ang) * grip * P, cy = py + Math.sin(ang) * grip * P;
  spr(`p_${g.spr}_0`, cx, cy, sc, 0.5, 0.5, false, g.spin ? 0 : ang - (g.ori || 0));
  drawFist(px, py);
}
// a small gloved fist (3x3 art px, ink outline) so every weapon is visibly held, not floating beside the body
function drawFist(x, y) {
  const q = P * HS * 0.8, x0 = snap(x - 1.5 * q), y0 = snap(y - 1.5 * q);
  prect(x0 - P, y0, 3 * q + 2 * P, 3 * q, INK); prect(x0, y0 - P, 3 * q, 3 * q + 2 * P, INK);
  prect(x0, y0, 3 * q, 3 * q, '#3d3247'); prect(x0, y0, 2 * q, q, '#5e5070');
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
      const u = Math.max(0, p.t / p.T);
      ctx.fillStyle = `rgba(224,57,76,${0.1 + 0.18 * u})`; ellipse(p.tx, p.ty, 13 * P, 6 * P); ctx.fill();
      ctx.lineWidth = P; ctx.strokeStyle = `rgba(224,57,76,${0.6 + 0.4 * (Math.floor(t * 10) % 2)})`; ellipse(p.tx, p.ty, 13 * P * (0.5 + 0.5 * u), 6 * P * (0.5 + 0.5 * u)); ctx.stroke();
    } else if (p.k === 'wave') {
      ctx.save(); ctx.translate(p.x, p.y); ctx.scale(1, 0.6); ctx.lineCap = 'butt';
      ctx.globalAlpha = Math.max(0, 1 - p.r / p.max) * 0.6 + 0.4;
      for (const [lw, col] of [[p.w + 2 * P, INK], [p.w, p.col], [P, '#fce2ca']]) { ctx.lineWidth = lw; ctx.strokeStyle = col; arcsWithGaps(p.r, p.gaps, 0.4); ctx.stroke(); }
      ctx.restore(); ctx.globalAlpha = 1;
    }
  }
  for (const p of R.eb) if (p.k === 'beam') {   // the beam: a pixel column from the boss down the screen
    const a = 1 - p.t / p.T, w = p.w * (0.6 + 0.4 * a);
    ctx.globalAlpha = 0.5 * a + 0.3; prect(p.x - w / 2 - P, p.y0, w + 2 * P, H - p.y0, INK);
    ctx.globalAlpha = 1; prect(p.x - w / 2, p.y0, w, H - p.y0, p.col); prect(p.x - w / 6, p.y0, w / 3, H - p.y0, '#ffffff');
    if (Math.random() < 0.5) bits(p.x + rand(-w / 2, w / 2), rand(p.y0, H - 180), 'q_Spark', 1);
  }
  const b = R.boss;
  if (b && b.tele > 0 && (b.teleK === 'beam' || b.teleK === 'charge')) {   // telegraph: blinking danger column
    const on = Math.floor(t * 12) % 2, w = (b.teleK === 'beam' ? 12 : 30) * P / (b.teleK === 'beam' ? 1 : 2.5);
    ctx.globalAlpha = 0.18; prect(b.lineX - w / 2, b.y, w, H - b.y, '#e0394c'); ctx.globalAlpha = 1;
    if (on) for (let y = b.y; y < H - 170; y += 5 * P) { prect(b.lineX - w / 2, y, P, 3 * P, '#e0394c'); prect(b.lineX + w / 2 - P, y, P, 3 * P, '#e0394c'); }
  }
  if (b && ((b.tele > 0 && b.teleK === 'leap') || b.leap)) {   // landing marker
    const x = b.leap ? b.leap.x1 : clamp(b.lineX, 90 * U, W - 90 * U), on = Math.floor(t * 12) % 2;
    ctx.fillStyle = 'rgba(19,27,27,0.3)'; ellipse(x, b.y, 50 * U, 16 * U); ctx.fill();
    ctx.lineWidth = P; ctx.strokeStyle = on ? '#e0394c' : '#ffe18d'; ellipse(x, b.y, 50 * U, 16 * U); ctx.stroke();
  }
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
      if (p.t < 0) continue;
      const u = p.t / p.T, x = lerp(p.sx, p.tx, u), y = lerp(p.sy, p.ty - 4 * P, u) - Math.sin(Math.PI * u) * 110 * U, sp = p.spr || 'SpriteSheetRock';
      if (p.spr === 'Fireball' || p.spr === 'EnergyBall') { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35; spr(`vx_glow24_${p.spr === 'Fireball' ? 'fire' : 'ice'}`, x, y, 1, 0.5, 0.5); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
      spr(`p_${sp}_${Math.floor(p.t * 10) % (AN['p_' + sp] || 1)}`, x, y, 1, 0.5, 0.5, false, ORI[sp] !== undefined && p.t > 0 ? Math.round((Math.atan2(p.ty - y, p.tx - x) - ORI[sp]) / (Math.PI / 8)) * (Math.PI / 8) : 0);
    } else if (p.k === 'orb') {
      const n = AN['p_' + p.spr] || 1, o = ORI[p.spr];
      spr(`p_${p.spr}_${Math.floor(p.age * 10) % n}`, p.x, p.y, 1, 0.5, 0.5, false, o === undefined ? 0 : Math.round((p.a - o) / (Math.PI / 8)) * (Math.PI / 8));
    }
  }
}
function drawSquadHp() {
  const sq = R.sq, L0 = R.heroes[0]; if (!L0) return;
    // squad health: framed pixel bar drawn at half-art-pixel detail (Q = one canvas pixel), with a highlight and a
  // shade row, quarter ticks, an orange damage trail, a passing shine, and a heart that beats faster when low
  const Q = P / 2, w = 54, h = 9, f = clamp(sq.hp / sq.maxHp, 0, 1), lag = clamp(sq.lag / sq.maxHp, 0, 1), t = R.t;
  const cx = clamp(L0.x, (w / 2 + 8) * Q, W - (w / 2 + 2) * Q), x = snap(cx - w / 2 * Q + 4 * Q), y = snap(L0.y - 24 * P);
  const ko = sq.ko > 0, low = !ko && f <= 0.25;
  const C = ko ? ['#8e7c73', '#b9ad9c', '#5f5a48'] : f > 0.5 ? ['#74a334', '#a9d16a', '#4c7a2a'] : f > 0.25 ? ['#f1c471', '#ffe18d', '#c98f2f'] : ['#e0394c', '#f07b7b', '#8f3e56'];
  const r = (a, b, c, d, col) => prect(x + a * Q, y + b * Q, c * Q, d * Q, col);
  ctx.globalAlpha = 0.35; r(-1, 1, w + 2, h, INK); ctx.globalAlpha = 1;            // soft drop shadow
  r(1, -1, w - 2, h + 2, INK); r(0, 0, w, h, INK);                                    // outline with cut corners
  if (low && Math.floor(t * 4) % 2) { r(1, -1, w - 2, 1, '#e0394c'); r(1, h, w - 2, 1, '#e0394c'); }
  const iw = w - 4, fx = Math.round(iw * f), lx = Math.round(iw * lag);
  r(2, 2, iw, h - 4, '#2b2620');                                                       // empty trough
  if (lx > fx) r(2 + fx, 2, lx - fx, h - 4, '#ff9554');                                // recent damage
  if (fx > 0) {
    r(2, 2, fx, h - 4, C[0]); r(2, 2, fx, 1, C[1]); r(2, h - 3, fx, 1, C[2]);
    const sp = (t * 0.6 % 2.5) / 1.5;                                                  // shine sweep every 2.5 s
    if (sp < 1 && !ko) { const sx = Math.round(sp * (fx + 6)) - 3; ctx.globalAlpha = 0.55; for (let k = 0; k < 2; k++) { const xx = sx + k; if (xx >= 0 && xx < fx) r(2 + xx, 2, 1, h - 4, '#ffffff'); } ctx.globalAlpha = 1; }
  }
  for (let k = 1; k < 4; k++) r(2 + Math.round(iw * k / 4), 3, 1, h - 6, 'rgba(19,27,27,0.45)');   // quarter ticks
  const beat = ko ? 0 : (t * (low ? 3.2 : 1.2)) % 1 < 0.15 ? 1 : 0;
  spr('heart', x - 2 * Q, y + h / 2 * Q, beat ? 0.5 : 0.5, 0.5, 0.5);
  if (beat) { ctx.globalAlpha = 0.5; spr('heart', x - 2 * Q, y + h / 2 * Q - Q, 0.5, 0.5, 0.5, false, 0, '#ffffff'); ctx.globalAlpha = 1; }
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
function ctrlBadge() {   // the Otomatik badge was removed: the squad just follows your finger and walks on its own
  const c = $('ctrl'); if (!c) return;
  c.classList.toggle('manual', R.manual);
  c.querySelector('span').textContent = R.manual ? 'Kontrol sende' : 'Otomatik';
  if (R.manual) { $('hint').classList.add('gone'); try { localStorage.setItem('ss_hint', '1'); } catch (e) { /* ignore */ } }
}
function updateUI(dt) {
  uiT -= dt; if (uiT > 0 && uiKey) return; uiT = 0.12;
  const key = [Math.floor(save.money), save.gems, R.bossFails, save.stage, save.sub, save.kills, save.bossReady, !!R.boss, R.boss ? Math.ceil(R.boss.hp) : 0, R.boss ? Math.ceil(R.boss.t) : 0, save.lv.power, save.lv.speed, save.lv.money, save.gun, save.team, save.auto, save.sound, R.phase].join('|');
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
    const k = c.dataset.up, lv = save.lv[k], cost = COST[k](lv), maxed = k === 'speed' && stat.speed(lv) >= SPEED_CAP;
    c.querySelector('.lv').textContent = lv;
    c.querySelector('.val').textContent = k === 'power' ? fmt(dmgPerShot()) : k === 'speed' ? fireRate().toFixed(2) + '/sn' : 'x' + fmt(moneyMul());
    c.querySelector('.cost b').textContent = maxed ? 'MAKS' : fmt(cost);
    c.classList.toggle('cant', maxed || save.money < cost);
  }
  const bb = $('bossBtn');
  bb.classList.toggle('ready', save.bossReady && !R.boss); bb.classList.toggle('locked', !save.bossReady);
  $('bossBtnImg').src = `assets/ui/boss_${bossKey()}.png`;
  if (R.boss) {
    $('bossFill').style.width = Math.max(0, R.boss.hp / R.boss.maxHp * 100) + '%';
    $('bossHpTxt').textContent = fmt(Math.max(0, R.boss.hp));
    const bt = $('bossTime'); bt.textContent = Math.max(0, Math.ceil(R.boss.t)); bt.classList.toggle('low', R.boss.t < 8);
  }
  const gi = document.querySelector('.gunico'); if (gi) gi.src = `assets/ui/wi_${GUNS[save.gun].spr}.png`;
  // ultimate meter
  // red "something to do" dots: affordable weapon, team member, rebirth worth taking
  const note = (sel, on) => { const b = document.querySelector(sel); if (b) b.classList.toggle('notify', !!on); };
  note('[data-open="guns"]', (save.wbest < GUNS.length - 1 && save.gems >= GUNS[save.wbest + 1].cost) || (star(save.gun) < 5 && save.gems >= starCost(save.gun, star(save.gun))));
  note('[data-open="team"]', (save.team < TEAM.length && save.money >= TEAM[save.team].cost) || TEAM.some((h, i) => i < save.team && hlv(i) < HERO_MAX && (save.scrolls[i] || 0) >= scrollNeed(hlv(i)) && save.money >= heroCost(hlv(i))));
  note('[data-open="rebirth"]', (rebirthGain() > 0 && R.bossFails >= 2) || !!(window.SS && window.SS.tree && window.SS.tree.canBuy()));
  // first steps
  if (!save.tut) save.tut = {};
  const tp = $('tut');
  let tgt = null, txt = '';
  if (!save.tut.power && save.money >= COST.power(save.lv.power)) { tgt = document.querySelector('.ucard[data-up="power"]'); txt = 'Dokun: Güç al'; }
  if (tgt) { const r = tgt.getBoundingClientRect(); tp.style.left = (r.left + r.width / 2) + 'px'; tp.style.top = (r.top - 8) + 'px'; tp.querySelector('span').textContent = txt; tp.classList.remove('hidden'); }
  else tp.classList.add('hidden');
}
function buy(k) {
  const lv = save.lv[k], cost = COST[k](lv);
  if (k === 'speed' && stat.speed(save.lv.speed) >= SPEED_CAP) return false;
  if (save.money < cost) { sfx('no'); return false; }
  save.money -= cost; save.lv[k]++; R.buyT = 0.6;
  if (R.t - (R.buyFx || 0) > 0.25 && R.heroes.length) { R.buyFx = R.t; const h = pick(R.heroes); vfx('burst', k === 'money' ? 'gold' : k === 'speed' ? 'ice' : 'fire', h.x, h.y - 10 * P, 0.5, 0.25); } sfx('buy', 0, undefined, PENTA[Math.min(R.buyN++, 6)]); runHooks('buy', k); uiKey = '';
  if (save.tut && !save.tut.power && save.lv.power >= 3) save.tut.power = true;
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
function banner(text, sub = '') { const b = $('banner'); b.innerHTML = text + (sub ? `<small>${sub}</small>` : ''); b.classList.remove('show'); void b.offsetWidth; b.classList.add('show'); }
function toast(text) { const t = $('toast'); t.textContent = text; t.classList.remove('show'); void t.offsetWidth; t.classList.add('show'); }

// ---------------- panels (weapons, team, rebirth, offline)
function el(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; }
function openPanel(title, color, build) {
  $('pTitle').textContent = title; $('pTitle').dataset.k = title; $('pTitle').className = 'ribbon ' + (color || '');   // data-k keeps the untranslated title for features
  const body = $('pBody'); body.innerHTML = ''; build(body);
  if ($('panel').classList.contains('hidden')) sfx('open', 0);
  $('panel').classList.remove('hidden');
  const imgs = [...body.querySelectorAll('img')].filter(im => im.complete && im.naturalWidth && !im.dataset.px), rs = imgs.map(im => im.getBoundingClientRect());
  imgs.forEach((im, i) => { if (rs[i].width) { im.dataset.r = rs[i].width + ',' + rs[i].height; snapImg(im); } });
}
function closePanel() { if (!$('panel').classList.contains('hidden')) sfx('close', 0); $('panel').classList.add('hidden'); }
$('pClose').onclick = () => closePanel();
$('panel').addEventListener('pointerdown', e => { if (e.target.id === 'panel') closePanel(); });
// new weapon: a short celebration so the upgrade is felt, not just read
function evolveMoment(g) {
  banner(`<img class="bimg" src="assets/ui/wi_${g.spr}.png" alt="">EVRİM!`, `${g.evo.name} · ${g.evo.desc}`);
  sfx('skill', 0); setTimeout(() => sfx('win', 0), 300);
  R.flash = 0.45; R.stop = 0.2; R.shake = 6; R.cheerT = 2; R.specT = 1.2;
  for (const h of R.heroes) { vfx('ring', g.glow || 'gold', h.x, h.y - 8 * P, 1.5, 0.6); vfx('burst', g.glow || 'gold', h.x, h.y - 10 * P, 1, 0.45); fx('fx_aura', h.x, h.y, 1, 0.6, 1); }
}
function unlockMoment(g) {
  banner(`<img class="bimg" src="assets/ui/wi_${g.spr}.png" alt="">YENİ SİLAH`, g.name + ' · ' + g.tags.join(' · '));
  sfx('bonus', 0); setTimeout(() => sfx('skill', 0), 250);
  R.flash = 0.3; R.stop = 0.1;
  for (const h of R.heroes) { fx('fx_circlew', h.x, h.y - 8 * P, 1, 0.4); fx('fx_aura', h.x, h.y, 1, 0.5, 1); h.atk = 0.4; h.dir = 'd'; }
}
// live weapon preview in the Silahlar panel: a ninja throws the selected weapon at a training dummy
let prevRun = 0;
function startPreview(canvas, gi) {
  const run = ++prevRun, g = GUNS[gi], CW = 300, CH = 116, GY = 104;
  const pw = Math.round(CW / L), ph = Math.round(CH / L);
  canvas.width = pw; canvas.height = ph; canvas.style.width = pw * L + 'px'; canvas.style.height = ph * L + 'px';
  const pc = canvas.getContext('2d'); pc.imageSmoothingEnabled = false;
  const mon = biome().pool[0], hero = { x: 46, y: GY, dir: 'r', atk: 0, wind: 0, recoil: 0, ang: 0, id: heroId(0), i: 0 }, PS = pstyle(g);
  let shots = [], parts = [], t = 0, next = 0.4, flash = 0, lastT = performance.now();
  const step = now => {
    if (run !== prevRun || !canvas.isConnected) return;
    const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now; t += dt;
    next -= dt; if (hero.atk > 0) hero.atk -= dt; if (hero.recoil > 0) hero.recoil -= dt; if (flash > 0) flash -= dt;
    if (next <= 0) { hero.atk = 0.2; hero.wind = 0.07; next = 1.1; }
    if (hero.wind > 0) { hero.wind -= dt; if (hero.wind <= 0) { hero.recoil = 0.09; for (let k = 0; k < g.shots; k++) shots.push({ x: hero.x + 7 * P, y: hero.y - 8 * P, a: (g.shots > 1 ? (k - (g.shots - 1) / 2) * 0.12 : 0) + (g.curve ? -0.5 : 0), age: 0, trail: [] }); } }
    for (const q of shots) {
      q.age += dt;
      q.a = turn(q.a, Math.atan2(GY - 8 * P - q.y, 250 - q.x), dt * (g.curve ? 6 : 12));
      q.x += Math.cos(q.a) * g.sp * 0.5 * dt; q.y += Math.sin(q.a) * g.sp * 0.5 * dt;
      { const tr = q.trail, h0 = tr[0]; if (!h0 || Math.hypot(q.x - h0.x, q.y - h0.y) > 2 * U) tr.unshift({ x: q.x, y: q.y });
        let d = 0; for (let i = 1; i < tr.length; i++) { d += Math.hypot(tr[i].x - tr[i - 1].x, tr[i].y - tr[i - 1].y); if (d > PS.len * 0.7 * U) { tr.length = i + 1; break; } } }
      if (g.wobble) q.y += Math.cos(q.age * 16) * 40 * dt;
      if (q.x > 244) { q.dead = true; flash = 0.08; const fxn = { cut: 'fx_cut', claw: 'fx_claw', star: 'fx_spark', ice: 'fx_ice', fire: 'fx_flam', thunder: 'fx_thunder' }[g.hit] || 'fx_spark';
        parts.push({ a: fxn, x: q.x, y: q.y, life: 0.3, max: 0.3, s: 0.5 }); if (g.boom) parts.push({ a: 'fx_circle', x: q.x, y: q.y, life: 0.3, max: 0.3, s: 1 });
        parts.push({ k: 'flash', x: q.x, y: q.y, r: 6 * P, life: 0.07, max: 0.07 });
        for (let i = 0; i < PS.sparks; i++) { const a = Math.PI + rand(-1.2, 1.2) + (Math.random() < 0.35 ? Math.PI : 0), sp = rand(90, 220) * U; parts.push({ k: 'streak', x: q.x, y: q.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(0.18, 0.3), max: 0.3 }); } }
    }
    shots = shots.filter(q => !q.dead);
    for (const p of parts) { p.life -= dt; if (p.k === 'streak') { p.x += p.vx * dt; p.y += p.vy * dt; const k = Math.pow(0.02, dt); p.vx *= k; p.vy *= k; } } parts = parts.filter(p => p.life > 0);
    // draw with the shared sprite code on the preview canvas
    const keep = ctx; ctx = pc;
    try {
      ctx.setTransform(1 / L, 0, 0, 1 / L, 0, 0); ctx.imageSmoothingEnabled = false;
      const T = 16 * P, gk = biome().ground;
      for (let x = 0; x < CW + T; x += T) for (let y = 0; y < CH + T; y += T) { const f = AF[`t_${gk}_fill`]; ctx.drawImage(atlasImg, f[0], f[1], 16, 16, x, y, T, T); }
      ctx.globalAlpha = 0.8; spr('shadow', hero.x, hero.y + P); spr('shadow', 250, GY + P); ctx.globalAlpha = 1;
      spr(`m_${mon}_l${Math.floor(t * 4) % 4}`, 250, GY);
      if (flash > 0) spr(`m_${mon}_l0`, 250, GY, 1, 0.5, 1, false, 0, '#ffffff');
      const hx = hero.x - (hero.recoil > 0 ? P : 0), fr = hero.atk > 0 ? 'a' : '0';
      spr(`h_${hero.id}_r${fr}`, hx, hero.y);
      if (g.held) spr(g.held, hx + 7 * P, hero.y - 8 * P, 1, 0.5, 0.5, false, -Math.PI / 2);
      else if (hero.wind > 0) spr(`p_${g.spr}_0`, hx + 7 * P, hero.y - 8 * P, 0.5, 0.5, 0.5, false, g.spin ? 0 : -(g.ori || 0));
      const n = AN['p_' + g.spr] || 1;
      for (const q of shots) {
        const name = g.spin ? `p_${g.spr}_${Math.floor(q.age * 20) % n}` : `p_${g.spr}_${Math.floor(q.age * 12) % n}`;
        const rot = g.spin ? 0 : Math.round((q.a - (g.ori || 0)) / (Math.PI / 8)) * (Math.PI / 8);
        drawRibbon(q, PS, PS.ramp, true, false);
        if (PS.add) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35; spr(`vx_glow24_${g.glow || 'gold'}`, q.x, q.y, 1, 0.5, 0.5); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
        spr(name, q.x, q.y, (g.sc || 1) * (PS.sc || 1), 0.5, 0.5, false, rot);
      }
      for (const p of parts) {
        const a = p.life / p.max;
        if (p.k === 'flash') { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a; pdisk(p.x, p.y, p.r, '#ffffff'); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; continue; }
        if (p.k === 'streak') { const v = Math.hypot(p.vx, p.vy) || 1; for (let k = 0; k < 4; k++) { ctx.globalAlpha = a * (1 - k / 5); prect(snap(p.x - p.vx / v * k * P) - P / 2, snap(p.y - p.vy / v * k * P) - P / 2, P, P, ramp(PS.ramp, (1 - a) * 0.6 + k / 4 * 0.4)); } ctx.globalAlpha = 1; continue; }
        const nn = AN[p.a] || 1, f = Math.min(nn - 1, Math.floor((1 - p.life / p.max) * nn)); spr(`${p.a}_${f}`, p.x, p.y, p.s, 0.5, 0.5);
      }
    } finally { ctx = keep; }
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
const PANELS = {
  guns: (sel) => openPanel('Silahlar', 'blue', body => {
    const show = sel === undefined ? save.gun : sel;
    const sg = GUNS[show], evoTxt = evolved(show) ? `EVRİM: ${sg.evo.name}` : sg.tags.join(' · ');
    const pv = el(`<div class="wprev"><canvas></canvas><div class="wcap"><b>${evolved(show) ? sg.evo.name : sg.name}</b><span>${evoTxt}</span></div></div>`);
    body.appendChild(pv); startPreview(pv.querySelector('canvas'), show);
    GUNS.forEach((g, i) => {
      const owned = i <= save.wbest, next = i === save.wbest + 1, cur = i === save.gun, st = star(i), evo = evolved(i);
      const stars = owned ? `<div class="stars">${[1, 2, 3, 4, 5].map(k => `<i class="${k <= st ? 'on' : ''}"></i>`).join('')}</div>` : '';
      const nextTxt = !owned ? g.tags.join(' · ') : evo ? `<b class="evo">${g.evo.name}</b> · ${g.evo.desc}` : st === 2 ? `★3: +1 atış` : st === 4 ? `★5: Evrim → ${g.evo.name}` : `★${st + 1}: +%30 hasar`;
      let btn;
      if (cur && st < 5) btn = (save.inv && save.inv.star > 0) ? `<button class="btn purple up"><img src="assets/ui/ic_luck.png" alt="">Taş (${save.inv.star})</button>` : `<button class="btn yellow up"><img src="assets/ui/gem.png" alt="">${starCost(i, st)}</button>`;
      else if (cur) btn = '<button class="btn purple off">EVRİM</button>';
      else if (owned) btn = '<button class="btn green eq">TAK</button>';
      else if (next) btn = `<button class="btn yellow buy"><img src="assets/ui/gem.png" alt="">${g.cost}</button>`;
      else btn = '<button class="btn grey off"><img src="assets/ui/lock.png" alt=""></button>';
      const row = el(`<div class="row-card ${cur ? 'cur' : ''} ${owned || next ? '' : 'lock'} ${i === show ? 'sel' : ''} ${evo ? 'evolved' : ''}"><div class="ico tile"><img src="assets/ui/wi_${g.spr}.png" alt=""></div>
        <div class="info"><h4>${evo ? g.evo.name : g.name}</h4>${stars}<p>Hasar x${fmt(g.mult)} · ${nextTxt}</p></div>${btn}</div>`);
      row.querySelector('.ico').onclick = row.querySelector('.info').onclick = () => { sfx('tick', 0); PANELS.guns(i); };
      const b = row.querySelector('.btn');
      if (b.classList.contains('up')) b.onclick = () => {
        const c = starCost(i, st), stone = (save.inv && save.inv.star) > 0;
        if (stone) save.inv.star--; else { if (save.gems < c) { sfx('no'); toast('Yeterli elmas yok'); return; } save.gems -= c; }
        save.wstar[i] = st + 1; persist(); uiKey = ''; runHooks('star');
        if (st + 1 >= 5) { closePanel(); evolveMoment(g); } else { sfx('buy', 0, undefined, PENTA[st + 2]); vfx('burst', g.glow || 'gold', W / 2, H / 2, 1, 0.3); PANELS.guns(i); }
      };
      if (b.classList.contains('eq')) b.onclick = () => { save.gun = i; persist(); uiKey = ''; sfx('accept', 0); PANELS.guns(i); };
      if (b.classList.contains('buy')) b.onclick = () => {
        if (save.gems < g.cost) { sfx('no'); toast('Yeterli elmas yok'); return; }
        save.gems -= g.cost; save.wbest = i; save.gun = i; persist(); uiKey = ''; closePanel(); unlockMoment(g);
      };
      if (g.neo && !GUNS[i - 1].neo) body.appendChild(el('<h3 class="fb-sec neo-sec"><img src="assets/ui/ic_neo.png" alt="">NEO NİNJA</h3>'));
      body.appendChild(row);
    });
  }),
  team: () => openPanel('Takım', 'green', body => {
    const sc = $('pBody').scrollTop;
    body.appendChild(el('<p class="big-note">Her ninja takıma bir atıcı ve bir yetenek ekler. Bosslardan düşen <b>parşömenlerle</b> seviye atlarlar (Doğuşta sıfırlanmaz).</p>'));
    TEAM.forEach((h, i) => {
      const owned = i < save.team, next = i === save.team, lv = hlv(i), sc2 = save.scrolls[i] || 0, need = scrollNeed(lv), max = lv >= HERO_MAX, cost = heroCost(lv), can = owned && !max && sc2 >= need;
      const bar = owned && !max ? `<div class="hl-bar ${sc2 >= need ? 'full' : ''}"><i style="width:${Math.min(100, sc2 / need * 100)}%"></i><span><img src="assets/ui/ic_scroll.png" alt="">${sc2} / ${need}</span></div>` : '';
      const row = el(`<div class="row-card hl-row ${owned || next ? '' : 'lock'}"><div class="ico face"><img src="assets/ui/face_${heroId(i)}.png" alt="">${owned ? `<span class="hl-lv">${max ? 'MAKS' : 'Sv.' + lv}</span>` : ''}</div>
        <div class="info"><h4>${h.name}</h4><p>${owned ? PERK_TXT[i](lv) : h.perk}${owned && lv > 1 ? ` · <b>+%${Math.round((heroMul(i) - 1) * 100)} hasar</b>` : ''}</p>${bar}</div>
        ${owned ? (max ? '<button class="btn grey off">MAKS</button>' : `<button class="btn ${can ? 'green' : 'grey off'} up"><img src="assets/ui/coin.png" alt="">${fmt(cost)}</button>`)
          : next ? `<button class="btn yellow"><img src="assets/ui/coin.png" alt="">${fmt(h.cost)}</button>` : '<button class="btn grey off"><img src="assets/ui/lock.png" alt=""></button>'}</div>`);
      const b = row.querySelector('.btn');
      if (next) b.onclick = () => { if (save.money < h.cost) { sfx('no'); toast('Yeterli altın yok'); return; } save.money -= h.cost; save.team++; setupHeroes(); sfx('bonus', 0); persist(); uiKey = ''; PANELS.team(); };
      if (can) b.onclick = () => {
        if (save.money < cost) { sfx('no'); toast('Yeterli altın yok'); return; }
        save.money -= cost; save.scrolls[i] = sc2 - need; save.hlv[i] = lv + 1; persist(); uiKey = '';
        sfx('buy', 0, undefined, PENTA[Math.min(lv, 10)]); sfx('skill', 0);
        const hh = R.heroes[i]; if (hh) { vfx('ring', 'gold', hh.x, hh.y - 8 * P, 1, 0.45); vfx('burst', 'gold', hh.x, hh.y - 10 * P, 1, 0.4); fx('fx_aura', hh.x, hh.y, 1, 0.5, 1); }
        if (i === 0 && R.sq) R.sq.maxHp = sqMaxHp();
        PANELS.team(); $('pBody').scrollTop = sc;
      };
      body.appendChild(row);
    });
  }),
  rebirth: (tab) => openPanel('Yeniden Doğuş', 'purple', body => {
    const T = window.SS && window.SS.tree;
    if (T) {
      tab = tab || 'r';
      const tb = el(`<div class="dex-tabs"><button class="btn ${tab === 'r' ? 'purple' : 'grey'}" data-t="r">Doğuş</button><button class="btn ${tab === 't' ? 'purple' : 'grey'}" data-t="t">Ruh Ağacı${T.points() ? ` (${T.points()})` : ''}</button></div>`);
      tb.querySelectorAll('button').forEach(x => x.onclick = () => { sfx('tick', 0); PANELS.rebirth(x.dataset.t); });
      body.appendChild(tb);
      if (tab === 't') { T.build(body); return; }
    }
    const gain = rebirthGain(), souls = T ? T.soulGain() : 0;
    body.appendChild(el(`<div class="big-num">x${fmt(1 + save.rp * 0.3)}</div>`));
    body.appendChild(el('<p class="big-note">Kalıcı hasar ve para bonusun. Her doğuş puanı +%30 ekler.</p>'));
    body.appendChild(el(`<div class="row-card"><div class="ico tile"><img src="assets/ui/ic_rebirth.png" alt=""></div><div class="info"><h4>+${fmt(gain)} doğuş puanı${souls ? ` · +${souls} ruh` : ''}</h4>
      <p>${gain > 0 ? `Bonus x${fmt(1 + save.rp * 0.3)} → x${fmt(1 + (save.rp + gain) * 0.3)} · +${rebirthGems(gain)} elmas${souls ? ` · Ruh Ağacı için ${souls} ruh` : ''}. Bölüm, seviyeler ve altın sıfırlanır; elmas, silahlar, takım ve Ruh Ağacı kalır.` : `${REBIRTH_MIN}. bölüme ulaşınca açılır. Puan her bölümde %18 artar: ne kadar ileri gidersen o kadar değerli.`}</p></div></div>`));
    const pk = window.SS && window.SS.perks ? window.SS.perks.list() : [];
    if (pk.length) body.appendChild(el(`<div class="pk-have"><b>Bu turun kartları (Doğuşta sıfırlanır)</b><div>${pk.map(p => `<span class="${p.r}" title="${p.name}"><img src="assets/ui/${p.icon}.png" alt="">${p.n > 1 ? `<i>${p.n}</i>` : ''}</span>`).join('')}</div></div>`));
    const btn = el(`<button class="btn purple wide ${gain > 0 ? '' : 'off'}">YENİDEN DOĞ</button>`);
    btn.onclick = () => {
      if (gain <= 0) return;
      const rg = rebirthGems(gain); save.gems += rg; runHooks('rebirth', gain);
      save.rp += gain; save.rebirths++; save.stage = 1; save.sub = 1; save.kills = 0; save.bossReady = false; save.money = 0; save.lv = { power: 0, speed: 0, money: 0 };
      R.en.length = 0; R.eb.length = 0; R.bul.length = 0; R.boss = null; $('bossHud').classList.add('hidden'); setupHeroes(); if (R.sq) R.sq.hp = R.sq.maxHp = sqMaxHp();
      persist(); R.bioEdge = -1e9; R.oldBio = null; chunks.clear(); startAdvance(150 * U, 110 * U); musicUpdate(); closePanel(); banner('YENİDEN DOĞDUN!', `Bonus x${fmt(1 + save.rp * 0.3)} · +${rg} elmas${souls ? ` · +${souls} ruh` : ''}`); sfx('win', 0); uiKey = '';
    };
    body.appendChild(btn);
  }),
};
document.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => { audioInit(); sfx('click'); PANELS[b.dataset.open](); }));
function offlineReward() {
  if (!save.t) return;
  const away = (Date.now() - save.t) / 1000;
  if (away < 60 || !save.rate) return;
  const gain = Math.min(away, (8 + modAdd('offH')) * 3600) * save.rate * 0.4;
  if (gain < 1) return;
  const h = Math.floor(away / 3600), m = Math.floor(away % 3600 / 60);
  openPanel('Hoş geldin!', 'green', body => {
    body.appendChild(el(`<p class="big-note">Sen yokken (${h ? h + ' sa ' : ''}${m} dk) takımın savaşmaya devam etti:</p>`));
    body.appendChild(el(`<div class="big-num">+${fmt(gain)}</div>`));
    const Ads = window.SS && window.SS.Ads;
    const row = el(`<div class="btnrow"><button class="btn green"><img src="assets/ui/coin.png" alt="">TOPLA</button>${Ads && Ads.available('offline') ? '<button class="btn yellow"><img src="assets/ui/play.png" alt="">x2 TOPLA</button>' : ''}</div>`);
    row.children[0].onclick = () => { audioInit(); addMoney(gain, W / 2, H / 2, 16); sfx('gold', 0); closePanel(); persist(); };
    if (row.children[1]) row.children[1].onclick = async () => { audioInit(); const ok = await Ads.show('offline'); addMoney(gain * (ok ? 2 : 1), W / 2, H / 2, ok ? 24 : 16); sfx('gold', 0); closePanel(); persist(); };
    body.appendChild(row);
  });
}

// ================================================================ loop
let last = performance.now(), saveT = 0, popOn = false;
// adaptive quality: R.fx 0 = full, 1 = lighter (no swaying trees / cloud shadows / weather, coarser light map),
// 2 = eco. Measured on the real frame time; steps down quickly when a phone struggles, back up slowly.
let fxEma = 16, fxT = 0, fxGood = 0;
function adapt(ms) {
  if (document.hidden || ms > 250) return;
  fxEma = fxEma * 0.95 + ms * 0.05; fxT += ms;
  if (fxT < 2500) return; fxT = 0;
  if (save.gfx === 'high') { R.fx = 0; return; } if (save.gfx === 'low') { R.fx = 2; return; }
  if (fxEma > 21 && R.fx < 2) { R.fx++; fxGood = 0; }
  else if (fxEma < 15 && R.fx > 0) { if ((fxGood += 2.5) > 25) { R.fx--; fxGood = 0; } }
}
function frame(now) {
  adapt(now - last);
  let dt = Math.min(1 / 20, (now - last) / 1000); last = now;
  if (R.stop > 0) { R.stop -= dt; dt *= 0.12; }
  if (R.paused) dt = 0;
  if (dt > 0) { const n = Math.max(1, Math.round(R.timeScale || 1)); for (let k = 0; k < n; k++) update(dt); }   // timeScale: test panel fast-forward
  render(); updateUI(dt);
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
  ctrlBadge();
  offlineReward();
  requestAnimationFrame(frame);
});
window.addEventListener('pointerdown', audioInit, { once: true });

// ---------------- pixel-perfect interface images
// UI PNGs are stored pre-scaled (portraits x3, everything else x4). Whatever size CSS asks for, each image is
// snapped to a whole multiple of its art pixels so no pixel is drawn wider than its neighbour.
function snapImg(im) {
  if (!im || !im.naturalWidth || im.dataset.px || !/assets\/ui\//.test(im.src) || /\/theme\//.test(im.src)) return;
  const f = /\/(face|mon|boss)_/.test(im.src) ? 3 : /lever/.test(im.src) ? 2 : 4, aw = im.naturalWidth / f, ah = im.naturalHeight / f;
  const rr = im.dataset.r ? im.dataset.r.split(',').map(Number) : null, r = rr ? { width: rr[0], height: rr[1] } : im.getBoundingClientRect(); if (!r.width) return;
  // the HUD and panels may be scaled as a whole on tablets (html.uiz, features/layout.js): measure in layout px
  const z = document.documentElement.classList.contains('uiz') && im.closest('#ui,#panel') ? (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--uiz')) || 1) : 1;
  const want = Math.max(r.width / z / aw, r.height / z / ah), dev = (window.devicePixelRatio || 1) * z;
  const k = Math.max(1, Math.round(want * dev)) / dev;   // whole device pixels per art pixel
  im.style.width = aw * k + 'px'; im.style.height = ah * k + 'px'; im.style.maxWidth = 'none'; im.style.maxHeight = 'none'; im.style.objectFit = 'fill';
  im.dataset.px = '1';
}
function snapAll(root = document) { root.querySelectorAll('img').forEach(queueSnap); }
// only images that are new or whose file changed are measured (re-measuring every image on every DOM change was
// the main cost behind slow panel opening); reads happen before writes so layout is computed once per batch
let snapQ = new Set(), snapRaf = 0;
function queueSnap(im) { snapQ.add(im); if (!snapRaf) snapRaf = requestAnimationFrame(flushSnap); }
function flushSnap() {
  snapRaf = 0; const list = [...snapQ].filter(im => im.isConnected && im.complete && im.naturalWidth); snapQ.clear();
  const rects = list.map(im => im.getBoundingClientRect());
  list.forEach((im, i) => { if (rects[i].width) { im.dataset.r = rects[i].width + ',' + rects[i].height; snapImg(im); } });
}
document.addEventListener('load', e => { const im = e.target; if (im && im.tagName === 'IMG' && im.dataset.nw !== String(im.naturalWidth)) { im.dataset.nw = im.naturalWidth; if (im.dataset.px) { delete im.dataset.px; im.style.width = im.style.height = ''; } queueSnap(im); } }, true);
new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) { if (n.tagName === 'IMG') queueSnap(n); else if (n.querySelectorAll) n.querySelectorAll('img').forEach(queueSnap); } }).observe(document.body, { childList: true, subtree: true });
window.addEventListener('resize', () => { document.querySelectorAll('img[data-px]').forEach(im => { delete im.dataset.px; im.style.width = im.style.height = ''; }); requestAnimationFrame(() => snapAll()); });

// ---------------- plugin API used by features/*.js
function addSideButton({ side = 'left', label, icon, color = 'blue', onClick, id }) {
  const b = el(`<button class="sbtn ${color}" ${id ? `id="${id}"` : ''}><img src="${icon}" alt=""><span>${label}</span></button>`);
  b.addEventListener('click', () => { audioInit(); sfx('click'); onClick(); });
  document.querySelector('.side.' + side).appendChild(b);
  return b;
}
window.SS = {
  save, R, F, GUNS, TEAM, VAR, giveScroll, hlv, spawnTreasure, spawnEnemy, startWave, offlineReward, bossWin, HERO_MAX, KILLS_PER_SUB, SUBS, BIOMES, BOSSES, BOSS_SIG, EDEF, MODS, HOOKS, PANELS, modMul, modAdd, rebirthGain, rebirthGems, REBIRTH_MIN, critChance, bossTime, nearestTarget, damage, onHit, aimY, vfx, fx, chainBolt, kill, liveTargets, areaHit, fmt, sfx, toast, banner, el, openPanel, closePanel, persist, addMoney, addSideButton,
  spr, sprT, rrect, prect, snap, AF, AN, atlasImg, INK, bossH, biome, dmgPerShot, fireRate, moneyMul, enemyHp, reward, buy, startBoss, setupHeroes, heroId,
  hurtSquad, knockout, sqMaxHp, heroBox, part, puff, confetti, bits, boom, addText, along, audioInit, musicUpdate, applyVol, useUlt,
  get _audio() { return { AC, master, sfxBus }; },
  get squad() { return R.sq; }, get leader() { return R.heroes[0]; },
  get U() { return U; }, get W() { return W; }, get H() { return H; }, get DPR() { return DPR; }, get P() { return P; },
  refreshUI() { uiKey = ''; }, get sounds() { return Object.keys(SND); }, get music() { return musicKey; },
};
window.SwarmSquad = { save, R, buy, startBoss, fmt };
})();
