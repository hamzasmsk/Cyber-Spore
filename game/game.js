/* Neon Swarm — survivor shooter (HTML5 canvas, no dependencies) */
'use strict';
(() => {

// ---------------------------------------------------------------- utilities
const $ = id => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const TAU = Math.PI * 2;
const fmtTime = s => { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };

// ---------------------------------------------------------------- canvas
const cv = $('c');
const ctx = cv.getContext('2d');
let W = 0, H = 0, DPR = 1, ZOOM = 1;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  cv.width = Math.floor(W * DPR); cv.height = Math.floor(H * DPR);
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  ZOOM = clamp(Math.min(W, H) / 560, 0.62, 1.15);
}
window.addEventListener('resize', resize);
resize();

// ---------------------------------------------------------------- save data
const SAVE_KEY = 'neonswarm_save_v1';
const DEFAULT_SAVE = { coins: 0, meta: {}, unlocked: 1, chars: { blip: true }, char: 'blip', best: {}, sound: true };
function loadSave() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { s = null; }
  const d = JSON.parse(JSON.stringify(DEFAULT_SAVE));
  if (s && typeof s === 'object') Object.assign(d, s);
  return d;
}
const save = loadSave();
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* storage may be blocked */ } }

// ---------------------------------------------------------------- game data
const CHARS = {
  blip:    { name: 'Blip',    ico: '🟢', desc: 'Dengeli avcı. Hızlı ve isabetli mermiler.', cost: 0,   color: '#59ffb0', hp: 100, speed: 170, dmg: 10, rate: 3.0, shots: 1, gap: 0.14, pierce: 0, bspd: 1 },
  volt:    { name: 'Volt',    ico: '⚡', desc: 'Makineli ateş. Düşük can, yüksek hız.',      cost: 400, color: '#ffd84a', hp: 75,  speed: 190, dmg: 5.5, rate: 6.5, shots: 1, gap: 0.14, pierce: 0, bspd: 1.15 },
  bulwark: { name: 'Bulwark', ico: '🛡️', desc: 'Tank. Pompalı tüfek: 3 saçma, yüksek can.',  cost: 900, color: '#ff6ad5', hp: 170, speed: 150, dmg: 9,  rate: 1.6, shots: 3, gap: 0.24, pierce: 0, bspd: 0.9 },
  phantom: { name: 'Phantom', ico: '👁️', desc: 'Keskin nişancı. Delici, ağır vuruşlar.',     cost: 1600, color: '#8fa8ff', hp: 90,  speed: 175, dmg: 26, rate: 1.4, shots: 1, gap: 0.14, pierce: 2, bspd: 1.5 },
};

const META = [
  { id: 'power',  ico: '⚔️', name: 'Güç',          desc: '+8% hasar',            max: 10, base: 60 },
  { id: 'vital',  ico: '❤️', name: 'Dayanıklılık', desc: '+12 maks. can',        max: 10, base: 60 },
  { id: 'swift',  ico: '👟', name: 'Çeviklik',     desc: '+4% hareket hızı',     max: 5,  base: 90 },
  { id: 'armor',  ico: '🛡️', name: 'Zırh',         desc: '-1 alınan hasar',      max: 5,  base: 140 },
  { id: 'wisdom', ico: '📘', name: 'Bilgelik',     desc: '+10% tecrübe',         max: 5,  base: 110 },
  { id: 'greed',  ico: '🪙', name: 'Açgözlülük',   desc: '+15% altın',           max: 5,  base: 110 },
  { id: 'reroll', ico: '🎲', name: 'Şans',         desc: '+1 seçenek yenileme',  max: 3,  base: 250 },
];
const metaCost = (m, lvl) => Math.round(m.base * Math.pow(1.55, lvl) / 5) * 5;
const metaLv = id => save.meta[id] || 0;

const ENEMIES = {
  mite:     { hp: 12, spd: 74,  r: 12, dmg: 8,  xp: 1, col: '#ff4d6d', shape: 'spiky' },
  runner:   { hp: 7,  spd: 138, r: 10, dmg: 6,  xp: 1, col: '#ffa94d', shape: 'tri' },
  brute:    { hp: 75, spd: 46,  r: 22, dmg: 16, xp: 5, col: '#b06bff', shape: 'hex' },
  spitter:  { hp: 20, spd: 60,  r: 13, dmg: 9,  xp: 3, col: '#4dd2ff', shape: 'ring', ranged: true },
  splitter: { hp: 32, spd: 64,  r: 16, dmg: 10, xp: 2, col: '#ff5fa2', shape: 'blob', split: true },
  mini:     { hp: 6,  spd: 112, r: 8,  dmg: 5,  xp: 0, col: '#ff8fc0', shape: 'blob' },
};

const BOSSES = {
  brood: { name: 'KULUÇKA ANA',     hp: 5200,  spd: 55, r: 46, dmg: 20, col: '#ff3b6b', atk: ['ring', 'summon'] },
  golem: { name: 'PAS GOLEMİ',      hp: 9500,  spd: 46, r: 52, dmg: 26, col: '#ff9a3b', atk: ['dash', 'ring', 'dash'] },
  hydra: { name: 'ASİT HİDRASI',    hp: 15000, spd: 52, r: 50, dmg: 24, col: '#9bff3b', atk: ['spiral', 'summon', 'ring'] },
  prism: { name: 'KRİSTAL PRİZMA',  hp: 23000, spd: 56, r: 50, dmg: 28, col: '#3bd7ff', atk: ['ring', 'dash', 'spiral'] },
  core:  { name: 'VİRÜS ÇEKİRDEĞİ', hp: 36000, spd: 60, r: 58, dmg: 32, col: '#d63bff', atk: ['spiral', 'dash', 'summon', 'ring'] },
};

const STAGES = [
  { name: 'Neon Kanalizasyon', ico: '🌃', hue: 150, dur: 150, diff: 1.0, pool: ['mite', 'mite', 'runner'], boss: 'brood' },
  { name: 'Paslı Fabrika',     ico: '🏭', hue: 28,  dur: 165, diff: 1.6, pool: ['mite', 'runner', 'brute'], boss: 'golem' },
  { name: 'Asit Bataklığı',    ico: '🧪', hue: 85,  dur: 180, diff: 2.4, pool: ['mite', 'runner', 'brute', 'spitter'], boss: 'hydra' },
  { name: 'Kristal Mağara',    ico: '💎', hue: 195, dur: 195, diff: 3.4, pool: ['runner', 'brute', 'spitter', 'splitter'], boss: 'prism' },
  { name: 'Virüs Çekirdeği',   ico: '☣️', hue: 290, dur: 210, diff: 4.8, pool: ['mite', 'runner', 'brute', 'spitter', 'splitter'], boss: 'core' },
];

const UPGRADES = [
  { id: 'dmg',    ico: '⚔️', name: 'Keskin Mermi',   desc: '+25% hasar',                     max: 8, apply: p => { p.dmgMul += 0.25; } },
  { id: 'rate',   ico: '🔥', name: 'Hızlı Tetik',    desc: '+18% atış hızı',                 max: 8, apply: p => { p.rateMul += 0.18; } },
  { id: 'multi',  ico: '🔱', name: 'Çoklu Atış',     desc: '+1 mermi',                       max: 4, apply: p => { p.extraShots++; } },
  { id: 'pierce', ico: '🗡️', name: 'Delici Mermi',   desc: 'Mermi +1 düşmanı deler',         max: 4, apply: p => { p.pierce++; } },
  { id: 'crit',   ico: '🎯', name: 'Kritik Vuruş',   desc: '+8% kritik şansı (x2 hasar)',   max: 5, apply: p => { p.crit += 0.08; } },
  { id: 'bspd',   ico: '🚀', name: 'Ray Topu',       desc: '+20% mermi hızı ve menzil',      max: 4, apply: p => { p.bspdMul += 0.2; } },
  { id: 'speed',  ico: '👟', name: 'Turbo',          desc: '+10% hareket hızı',              max: 5, apply: p => { p.spdMul += 0.1; } },
  { id: 'hp',     ico: '❤️', name: 'Biyo-Kalkan',    desc: '+25 maks. can ve iyileşme',      max: 6, apply: p => { p.maxHp += 25; p.hp = Math.min(p.maxHp, p.hp + 40); } },
  { id: 'regen',  ico: '🌿', name: 'Yenilenme',      desc: '+0.7 can / saniye',              max: 5, apply: p => { p.regen += 0.7; } },
  { id: 'magnet', ico: '🧲', name: 'Mıknatıs',       desc: '+45% toplama alanı',             max: 4, apply: p => { p.magnet *= 1.45; } },
  { id: 'orbit',  ico: '🌀', name: 'Yörünge Bıçağı', desc: 'Etrafında dönen bıçak (+1)',     max: 5, apply: p => { p.orbit++; } },
  { id: 'nova',   ico: '💥', name: 'Şok Dalgası',    desc: 'Düzenli alan hasarı + itme',     max: 5, apply: p => { p.nova++; } },
  { id: 'drone',  ico: '🛸', name: 'Drone',          desc: 'Otomatik ateş eden yardımcı',    max: 3, apply: p => { p.drones++; } },
  { id: 'chain',  ico: '⚡', name: 'Zincir Şimşek',  desc: 'Düzenli olarak düşmanlara sekmeli yıldırım', max: 5, apply: p => { p.chain++; } },
];
const xpNeed = l => Math.floor(3 + l * 3 + l * l * 0.6);

// ---------------------------------------------------------------- audio (tiny synth)
let AC = null;
function audioInit() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; }
}
const sndLast = {};
function sfx(name, minGap = 0.03) {
  if (!AC || !save.sound) return;
  const now = AC.currentTime;
  if (sndLast[name] && now - sndLast[name] < minGap) return;
  sndLast[name] = now;
  const o = AC.createOscillator(), g = AC.createGain();
  o.connect(g); g.connect(AC.destination);
  const P = {
    shoot:  ['square',   880, 440, 0.04, 0.025],
    hit:    ['triangle', 300, 120, 0.05, 0.05],
    kill:   ['square',   220, 60,  0.09, 0.05],
    pickup: ['sine',     900, 1500, 0.06, 0.05],
    coin:   ['triangle', 1200, 1800, 0.08, 0.06],
    hurt:   ['sawtooth', 200, 60,  0.18, 0.12],
    level:  ['triangle', 440, 1320, 0.35, 0.12],
    boss:   ['sawtooth', 90,  40,  0.9,  0.18],
    nova:   ['sine',     160, 40,  0.25, 0.12],
    zap:    ['sawtooth', 1400, 300, 0.1, 0.05],
    win:    ['triangle', 523, 1046, 0.6, 0.14],
  }[name];
  if (!P) return;
  o.type = P[0];
  o.frequency.setValueAtTime(P[1], now);
  o.frequency.exponentialRampToValueAtTime(P[2], now + P[3]);
  g.gain.setValueAtTime(P[4], now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + P[3]);
  o.start(now); o.stop(now + P[3] + 0.02);
}
const vibrate = ms => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* ignore */ } };

// ---------------------------------------------------------------- sprites (pre-rendered glow)
const spriteCache = new Map();
function sprite(key, r, draw) {
  let s = spriteCache.get(key);
  if (s) return s;
  const size = Math.ceil(r * 2 + r * 1.4 + 16);
  const c = document.createElement('canvas');
  c.width = c.height = size * 2;
  const g = c.getContext('2d');
  g.scale(2, 2); g.translate(size / 2, size / 2);
  draw(g, r);
  s = { c, size };
  spriteCache.set(key, s);
  return s;
}
function bodyPath(g, shape, r) {
  g.beginPath();
  if (shape === 'spiky' || shape === 'boss') {
    const n = shape === 'boss' ? 14 : 9;
    for (let i = 0; i <= n * 2; i++) {
      const a = i / (n * 2) * TAU, rr = i % 2 ? r * 0.82 : r * 1.12;
      g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
  } else if (shape === 'tri') {
    g.moveTo(r * 1.25, 0); g.lineTo(-r * 0.9, r * 0.95); g.quadraticCurveTo(-r * 0.4, 0, -r * 0.9, -r * 0.95);
  } else if (shape === 'hex') {
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  } else if (shape === 'blob') {
    for (let i = 0; i <= 24; i++) { const a = i / 24 * TAU, rr = r * (1 + 0.1 * Math.sin(a * 3)); g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  } else {
    g.arc(0, 0, r, 0, TAU);
  }
  g.closePath();
}
function enemySprite(shape, r, col) {
  return sprite('e' + shape + r + col, r, (g) => {
    g.shadowColor = col; g.shadowBlur = r * 0.7 + 6;
    g.fillStyle = col; bodyPath(g, shape, r); g.fill();
    g.shadowBlur = 0;
    g.fillStyle = 'rgba(0,0,0,0.28)'; bodyPath(g, shape, r * 0.72); g.fill();
    if (shape === 'ring') { g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, r * 0.62, 0, TAU); g.stroke(); }
    // eyes (looking towards +x)
    const er = Math.max(2.4, r * 0.22), ex = r * 0.32, ey = r * 0.34;
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(ex, -ey, er, 0, TAU); g.arc(ex, ey, er, 0, TAU); g.fill();
    g.fillStyle = '#120008';
    g.beginPath(); g.arc(ex + er * 0.35, -ey, er * 0.55, 0, TAU); g.arc(ex + er * 0.35, ey, er * 0.55, 0, TAU); g.fill();
    if (shape === 'boss') {
      g.fillStyle = '#fff'; g.beginPath(); g.arc(r * 0.55, 0, er * 1.2, 0, TAU); g.fill();
      g.fillStyle = '#300'; g.beginPath(); g.arc(r * 0.62, 0, er * 0.7, 0, TAU); g.fill();
    }
  });
}
function glowDot(r, col) {
  return sprite('g' + r + col, r, (g) => {
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, r * 2.2);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.25, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r * 2.2, 0, TAU); g.fill();
  });
}
function drawSprite(s, x, y, rot, scale = 1) {
  const sz = s.size * scale;
  if (rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.drawImage(s.c, -sz / 2, -sz / 2, sz, sz);
    ctx.restore();
  } else ctx.drawImage(s.c, x - sz / 2, y - sz / 2, sz, sz);
}

// ---------------------------------------------------------------- UI helpers
const screens = ['menu', 'stages', 'chars', 'shop', 'levelup', 'pause', 'over'];
function show(id) {
  for (const s of screens) $(s).classList.toggle('hidden', s !== id);
  document.querySelectorAll('.coinTotal').forEach(e => { e.textContent = save.coins; });
  if (id === 'stages') renderStages();
  if (id === 'chars') renderChars();
  if (id === 'shop') renderShop();
}
function el(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; }
function pips(n, max) { let s = '<div class="pips">'; for (let i = 0; i < max; i++) s += `<i class="${i < n ? 'on' : ''}"></i>`; return s + '</div>'; }

function renderStages() {
  const list = $('stageList'); list.innerHTML = '';
  STAGES.forEach((st, i) => {
    const open = i < save.unlocked;
    const best = save.best[i];
    const card = el(`<div class="card ${open ? '' : 'locked'}">
      <div class="ico">${open ? st.ico : '🔒'}</div>
      <div class="body"><div class="t">${i + 1}. ${st.name}</div>
      <div class="d">${open ? (best ? (best.cleared ? '✅ Temizlendi · ' : 'En iyi: ') + fmtTime(best.time) : 'Boss ' + fmtTime(st.dur) + ' sonra gelir') : 'Önceki bölümün bossunu yen'}</div></div>
      <button class="act ${open ? 'sel' : ''}" ${open ? '' : 'disabled'}>${open ? 'BAŞLA' : 'KİLİTLİ'}</button></div>`);
    if (open) card.querySelector('button').onclick = () => startRun(i);
    list.appendChild(card);
  });
}
function renderChars() {
  const list = $('charList'); list.innerHTML = '';
  for (const id in CHARS) {
    const c = CHARS[id], owned = !!save.chars[id], cur = save.char === id;
    const card = el(`<div class="card ${cur ? 'current' : ''}">
      <div class="ico" style="color:${c.color}">${c.ico}</div>
      <div class="body"><div class="t" style="color:${c.color}">${c.name}</div><div class="d">${c.desc}</div>
      <div class="d">Can ${c.hp} · Hasar ${c.dmg} · Atış ${c.rate}/sn</div></div>
      <button class="act ${cur ? 'sel' : owned ? '' : 'buy'}">${cur ? 'SEÇİLİ' : owned ? 'SEÇ' : '🪙 ' + c.cost}</button></div>`);
    const b = card.querySelector('button');
    if (!owned && save.coins < c.cost) b.disabled = true;
    b.onclick = () => {
      if (!owned) { if (save.coins < c.cost) return; save.coins -= c.cost; save.chars[id] = true; sfx('coin'); }
      save.char = id; persist(); show('chars');
    };
    list.appendChild(card);
  }
}
function renderShop() {
  const list = $('shopList'); list.innerHTML = '';
  for (const m of META) {
    const lv = metaLv(m.id), maxed = lv >= m.max, cost = metaCost(m, lv);
    const card = el(`<div class="card"><div class="ico">${m.ico}</div>
      <div class="body"><div class="t">${m.name}</div><div class="d">${m.desc}</div>${pips(lv, m.max)}</div>
      <button class="act ${maxed ? '' : 'buy'}">${maxed ? 'MAKS' : '🪙 ' + cost}</button></div>`);
    const b = card.querySelector('button');
    if (maxed || save.coins < cost) b.disabled = true;
    b.onclick = () => {
      if (maxed || save.coins < cost) return;
      save.coins -= cost; save.meta[m.id] = lv + 1; persist(); sfx('coin'); show('shop');
    };
    list.appendChild(card);
  }
}

document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => { audioInit(); show(b.dataset.go); }));
function syncSoundBtn() { $('soundBtn').textContent = 'Ses: ' + (save.sound ? 'Açık' : 'Kapalı'); }
$('soundBtn').onclick = () => { audioInit(); save.sound = !save.sound; persist(); syncSoundBtn(); };
syncSoundBtn();

// ---------------------------------------------------------------- input
const keys = {};
window.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'Escape' || e.code === 'KeyP') { if (state === 'play') pauseGame(); else if (state === 'pause') resumeGame(); }
  if (state === 'levelup' && /^Digit[1-3]$/.test(e.code)) {
    const btn = $('upgList').children[+e.code.slice(5) - 1];
    if (btn) btn.click();
  }
});
window.addEventListener('keyup', e => { keys[e.code] = false; });
let joy = null;
const JOY_R = 56;
cv.addEventListener('pointerdown', e => {
  audioInit();
  if (state !== 'play' || joy) return;
  joy = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
  try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
});
cv.addEventListener('pointermove', e => {
  if (!joy || e.pointerId !== joy.id) return;
  joy.x = e.clientX; joy.y = e.clientY;
  // floating base follows the finger when dragged far
  const dx = joy.x - joy.ox, dy = joy.y - joy.oy, d = Math.hypot(dx, dy);
  if (d > JOY_R * 1.6) { const k = (d - JOY_R * 1.6) / d; joy.ox += dx * k; joy.oy += dy * k; }
});
const endJoy = e => { if (joy && e.pointerId === joy.id) joy = null; };
cv.addEventListener('pointerup', endJoy);
cv.addEventListener('pointercancel', endJoy);
function inputVec() {
  let x = 0, y = 0;
  if (keys.KeyA || keys.ArrowLeft) x -= 1;
  if (keys.KeyD || keys.ArrowRight) x += 1;
  if (keys.KeyW || keys.ArrowUp) y -= 1;
  if (keys.KeyS || keys.ArrowDown) y += 1;
  if (joy) {
    const dx = joy.x - joy.ox, dy = joy.y - joy.oy, d = Math.hypot(dx, dy);
    if (d > 6) { const m = Math.min(1, d / JOY_R); x = dx / d * m; y = dy / d * m; }
  }
  const l = Math.hypot(x, y);
  if (l > 1) { x /= l; y /= l; }
  return { x, y };
}

// ---------------------------------------------------------------- game state
let state = 'menu';
let G = null;
let nextId = 1;

function newPlayer() {
  const c = CHARS[save.char] || CHARS.blip;
  const maxHp = c.hp + metaLv('vital') * 12;
  return {
    x: 0, y: 0, r: 14, col: c.color, char: save.char,
    hp: maxHp, maxHp,
    spd: c.speed * (1 + metaLv('swift') * 0.04), spdMul: 1,
    dmg: c.dmg * (1 + metaLv('power') * 0.08), dmgMul: 1,
    rate: c.rate, rateMul: 1, shots: c.shots, extraShots: 0, gap: c.gap,
    pierce: c.pierce, bspd: c.bspd, bspdMul: 1, crit: 0.05,
    regen: 0, magnet: 95, orbit: 0, nova: 0, drones: 0, chain: 0,
    armor: metaLv('armor'), xpMul: 1 + metaLv('wisdom') * 0.1, coinMul: 1 + metaLv('greed') * 0.15,
    lvl: 1, xp: 0, next: xpNeed(1), fireT: 0, inv: 0, aim: 0, moving: 0,
    novaT: 2, chainT: 1.5, droneT: 0, upg: {},
  };
}

function startRun(stageIdx) {
  audioInit();
  const S = STAGES[stageIdx];
  G = {
    stage: stageIdx, S, t: 0, p: newPlayer(),
    en: [], bul: [], ebul: [], orbs: [], fx: [], txt: [], bolts: [],
    kills: 0, coins: 0, spawnT: 0.5, waveT: 40, eliteT: 55,
    boss: null, bossSpawned: false, shake: 0,
    cam: { x: 0, y: 0 }, orbitA: 0, pending: 0, rerolls: metaLv('reroll') + 1, ended: false, hitStop: 0,
  };
  joy = null;
  state = 'play';
  show(null);
  $('hud').classList.remove('hidden');
  $('bossBar').classList.add('hidden');
  banner(S.name);
}

function banner(text) {
  const b = $('banner');
  b.textContent = text;
  b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
}

// ---------------------------------------------------------------- spawning
function spawnEnemy(type, x, y, opts = {}) {
  const d = ENEMIES[type];
  const S = G.S;
  const scale = S.diff * (1 + G.t / 95);
  const elite = !!opts.elite;
  const e = {
    id: nextId++, type, x, y, r: d.r * (elite ? 1.5 : 1), col: elite ? '#ffd84a' : d.col, shape: d.shape,
    hp: d.hp * scale * (elite ? 9 : 1), spd: d.spd * (1 + Math.min(0.35, G.t / 600)) * (elite ? 0.85 : 1),
    dmg: d.dmg * (1 + (S.diff - 1) * 0.35) * (elite ? 1.5 : 1), xp: d.xp * (elite ? 12 : 1),
    ranged: d.ranged, split: d.split, elite, flash: 0, orbCd: 0, shootT: rand(1, 2.5), kx: 0, ky: 0, ang: 0,
  };
  e.maxHp = e.hp;
  G.en.push(e);
  return e;
}
function spawnAround(type, n, opts) {
  const p = G.p;
  const viewR = Math.hypot(W, H) / ZOOM / 2 + 40;
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), d = viewR + rand(0, 120);
    spawnEnemy(type, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, opts);
  }
}
function spawnBoss() {
  const def = BOSSES[G.S.boss];
  const p = G.p, a = rand(0, TAU), d = Math.min(W, H) / ZOOM / 2 + 90;
  const hpMul = 0.75 + G.p.dmg * G.p.dmgMul / 20; // soft-scale with player strength
  const b = {
    id: nextId++, type: 'boss', boss: true, def, x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d,
    r: def.r, col: def.col, shape: 'boss', hp: def.hp * hpMul, spd: def.spd, dmg: def.dmg,
    xp: 0, flash: 0, orbCd: 0, kx: 0, ky: 0, ang: 0,
    atkT: 3, atkI: 0, dash: 0, tele: 0, spiral: 0, spiralA: 0, spiralT: 0, dvx: 0, dvy: 0,
  };
  b.maxHp = b.hp;
  G.en.push(b);
  G.boss = b; G.bossSpawned = true;
  $('bossName').textContent = def.name;
  $('bossBar').classList.remove('hidden');
  banner('⚠ BOSS GELİYOR ⚠');
  sfx('boss', 0); vibrate([60, 40, 60]);
  G.shake = 14;
}
function updateSpawning(dt) {
  const S = G.S;
  const cap = 230;
  if (!G.bossSpawned && G.t >= S.dur) spawnBoss();
  const rate = (1.5 + G.t / 18) * Math.sqrt(S.diff) * (G.bossSpawned ? 0.35 : 1); // enemies per second
  G.spawnT -= dt;
  if (G.spawnT <= 0 && G.en.length < cap) {
    G.spawnT = 1 / rate;
    spawnAround(pick(S.pool), Math.random() < 0.25 ? 3 : 1);
  }
  if (!G.bossSpawned) {
    G.waveT -= dt;
    if (G.waveT <= 0) { // swarm ring
      G.waveT = 42;
      const p = G.p, n = 18 + Math.floor(G.t / 10), R = Math.min(W, H) / ZOOM * 0.55 + 60;
      const type = S.pool[0];
      for (let i = 0; i < n && G.en.length < cap + 40; i++) {
        const a = i / n * TAU;
        spawnEnemy(type, p.x + Math.cos(a) * R, p.y + Math.sin(a) * R);
      }
      banner('SÜRÜ!');
    }
    G.eliteT -= dt;
    if (G.eliteT <= 0) { G.eliteT = 50; spawnAround(pick(S.pool), 1, { elite: true }); }
  }
}

// ---------------------------------------------------------------- combat
function nearestEnemy(x, y, maxD) {
  let best = null, bd = maxD * maxD;
  for (const e of G.en) {
    if (e.dead) continue;
    const dx = e.x - x, dy = e.y - y, d = dx * dx + dy * dy;
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}
function damageEnemy(e, dmg, crit, kx = 0, ky = 0) {
  if (e.dead) return;
  e.hp -= dmg; e.flash = 0.08;
  if (!e.boss) { e.kx += kx; e.ky += ky; }
  if (G.txt.length < 70) G.txt.push({ x: e.x + rand(-6, 6), y: e.y - e.r, v: Math.round(dmg), life: 0.6, crit });
  sfx('hit', 0.05);
  if (e.hp <= 0) killEnemy(e);
}
function killEnemy(e) {
  e.dead = true;
  G.kills++;
  burst(e.x, e.y, e.col, e.boss ? 80 : e.elite ? 30 : 9, e.boss ? 380 : 220);
  sfx('kill', 0.04);
  if (e.boss) { G.shake = 24; winRun(); return; }
  if (e.xp > 0) dropOrb(e.x, e.y, 'xp', e.xp);
  const coinChance = e.elite ? 1 : 0.07 + G.stage * 0.01;
  if (Math.random() < coinChance) dropOrb(e.x + rand(-8, 8), e.y + rand(-8, 8), 'coin', e.elite ? 25 + G.stage * 10 : 1 + Math.floor(G.stage / 2));
  if (e.elite || Math.random() < 0.006) dropOrb(e.x + 10, e.y, 'heart', 30);
  if (e.split) for (let i = 0; i < 2; i++) spawnEnemy('mini', e.x + rand(-10, 10), e.y + rand(-10, 10));
}
function dropOrb(x, y, kind, v) {
  if (kind === 'xp' && G.orbs.length > 320) { // merge to keep it fast
    const o = G.orbs[Math.floor(Math.random() * G.orbs.length)];
    if (o.kind === 'xp') { o.v += v; return; }
  }
  G.orbs.push({ x, y, kind, v, vx: rand(-60, 60), vy: rand(-60, 60), pull: false });
}
function burst(x, y, col, n, spd) {
  for (let i = 0; i < n && G.fx.length < 500; i++) {
    const a = rand(0, TAU), s = rand(spd * 0.3, spd);
    G.fx.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.25, 0.6), max: 0.6, col, r: rand(1.5, 3.5) });
  }
}
function hurtPlayer(dmg) {
  const p = G.p;
  if (p.inv > 0 || G.ended) return;
  dmg = Math.max(1, dmg - p.armor);
  p.hp -= dmg; p.inv = 0.6;
  G.shake = Math.max(G.shake, 8);
  sfx('hurt', 0.1); vibrate(40);
  burst(p.x, p.y, '#ff4d6d', 10, 200);
  if (p.hp <= 0) { p.hp = 0; loseRun(); }
}
function fireBullet(x, y, ang, dmgMul = 1, isDrone = false) {
  const p = G.p;
  const spd = 560 * p.bspd * p.bspdMul;
  const crit = Math.random() < p.crit;
  G.bul.push({
    x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, r: isDrone ? 4 : 5.5,
    dmg: p.dmg * p.dmgMul * dmgMul * (crit ? 2 : 1), crit, pierce: isDrone ? 0 : p.pierce,
    life: 0.85 * p.bspdMul, hits: [], col: isDrone ? '#9be7ff' : p.col,
  });
}

// ---------------------------------------------------------------- update
function update(dt) {
  const p = G.p;
  if (G.hitStop > 0) { G.hitStop -= dt; return; }
  G.t += dt;

  // movement
  const iv = inputVec();
  const spd = p.spd * p.spdMul;
  p.x += iv.x * spd * dt; p.y += iv.y * spd * dt;
  p.moving = Math.hypot(iv.x, iv.y);
  if (p.regen) p.hp = Math.min(p.maxHp, p.hp + p.regen * dt);
  if (p.inv > 0) p.inv -= dt;

  updateSpawning(dt);

  // auto-fire
  const range = 470 * p.bspd * p.bspdMul * 0.95;
  const target = nearestEnemy(p.x, p.y, range);
  if (target) p.aim = Math.atan2(target.y - p.y, target.x - p.x);
  else if (p.moving > 0.1) p.aim = Math.atan2(iv.y, iv.x);
  p.fireT -= dt;
  if (p.fireT <= 0 && target) {
    p.fireT = 1 / (p.rate * p.rateMul);
    const n = p.shots + p.extraShots;
    const gap = p.gap;
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * gap;
      fireBullet(p.x + Math.cos(p.aim) * 18, p.y + Math.sin(p.aim) * 18, p.aim + off);
    }
    sfx('shoot', 0.07);
  }

  // drones
  if (p.drones) {
    p.droneT -= dt;
    if (p.droneT <= 0) {
      p.droneT = 0.55;
      for (let i = 0; i < p.drones; i++) {
        const dp = dronePos(i);
        const t = nearestEnemy(dp.x, dp.y, 420);
        if (t) fireBullet(dp.x, dp.y, Math.atan2(t.y - dp.y, t.x - dp.x), 0.6, true);
      }
    }
  }

  // nova
  if (p.nova) {
    p.novaT -= dt;
    if (p.novaT <= 0) {
      p.novaT = Math.max(1.4, 3.6 - p.nova * 0.4);
      const R = 110 + p.nova * 22, dmg = p.dmg * p.dmgMul * (1.4 + p.nova * 0.5);
      for (const e of G.en) {
        if (e.dead) continue;
        const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy);
        if (d < R + e.r) damageEnemy(e, dmg, false, dx / (d || 1) * 260, dy / (d || 1) * 260);
      }
      G.fx.push({ ring: true, x: p.x, y: p.y, r: 10, R, life: 0.35, max: 0.35, col: p.col });
      sfx('nova', 0.2);
    }
  }

  // chain lightning
  if (p.chain) {
    p.chainT -= dt;
    if (p.chainT <= 0) {
      p.chainT = Math.max(0.8, 2.4 - p.chain * 0.3);
      let from = { x: p.x, y: p.y }, hops = 2 + p.chain, used = new Set(), pts = [from];
      for (let h = 0; h < hops; h++) {
        let best = null, bd = 260 * 260;
        for (const e of G.en) {
          if (e.dead || used.has(e.id)) continue;
          const d = (e.x - from.x) ** 2 + (e.y - from.y) ** 2;
          if (d < bd) { bd = d; best = e; }
        }
        if (!best) break;
        used.add(best.id); pts.push({ x: best.x, y: best.y });
        damageEnemy(best, p.dmg * p.dmgMul * (1.2 + p.chain * 0.35), false);
        from = best;
      }
      if (pts.length > 1) { G.bolts.push({ pts, life: 0.18 }); sfx('zap', 0.2); }
    }
  }

  // orbit blades
  G.orbitA += dt * 3.4;
  const orbR = 74, orbDmg = p.dmg * p.dmgMul * 0.9;

  // enemies
  const S = G.S;
  for (const e of G.en) {
    if (e.dead) continue;
    if (e.flash > 0) e.flash -= dt;
    if (e.orbCd > 0) e.orbCd -= dt;
    const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;
    let mvx = dx / d, mvy = dy / d, sp = e.spd;
    if (e.boss) {
      updateBoss(e, dt, dx, dy, d);
      if (e.dash > 0 || e.tele > 0) sp = 0;
    } else if (e.ranged) {
      if (d < 230) { mvx = -mvx * 0.6 + -mvy * 0.5; mvy = -mvy * 0.6 + (dx / d) * 0.5; }
      e.shootT -= dt;
      if (e.shootT <= 0 && d < 520) {
        e.shootT = rand(2, 3);
        const a = Math.atan2(dy, dx);
        G.ebul.push({ x: e.x, y: e.y, vx: Math.cos(a) * 210, vy: Math.sin(a) * 210, r: 6, dmg: e.dmg, life: 4, col: e.col });
      }
    }
    e.x += mvx * sp * dt + e.kx * dt;
    e.y += mvy * sp * dt + e.ky * dt;
    e.kx *= 0.86; e.ky *= 0.86;
    e.ang = Math.atan2(dy, dx);
    // despawn far stragglers & respawn near player
    if (!e.boss && d > 1500) { const a = rand(0, TAU), R = Math.hypot(W, H) / ZOOM / 2 + 60; e.x = p.x + Math.cos(a) * R; e.y = p.y + Math.sin(a) * R; }
    // contact
    if (d < e.r + p.r - 2) hurtPlayer(e.dmg);
    // orbit
    if (p.orbit && e.orbCd <= 0 && Math.abs(d - orbR) < e.r + 12) {
      const ea = Math.atan2(-dy, -dx);
      for (let i = 0; i < p.orbit; i++) {
        let da = Math.abs(((ea - (G.orbitA + i / p.orbit * TAU)) % TAU + TAU) % TAU);
        if (da > Math.PI) da = TAU - da;
        if (da * orbR < e.r + 12) { damageEnemy(e, orbDmg, false, -dx / d * 140, -dy / d * 140); e.orbCd = 0.35; break; }
      }
    }
  }
  // separation (cheap pairwise; enemy count is capped)
  const en = G.en;
  for (let i = 0; i < en.length; i++) {
    const a = en[i]; if (a.dead) continue;
    for (let j = i + 1; j < en.length; j++) {
      const b = en[j]; if (b.dead) continue;
      const dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r;
      if (dx > rr || dx < -rr || dy > rr || dy < -rr) continue;
      const d2 = dx * dx + dy * dy;
      if (d2 < rr * rr && d2 > 0.01) {
        const d = Math.sqrt(d2), push = (rr - d) / d * 0.5;
        if (a.boss) { b.x += dx * push * 2; b.y += dy * push * 2; }
        else if (b.boss) { a.x -= dx * push * 2; a.y -= dy * push * 2; }
        else { a.x -= dx * push; a.y -= dy * push; b.x += dx * push; b.y += dy * push; }
      }
    }
  }

  // player bullets
  for (const b of G.bul) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.life <= 0) { b.dead = true; continue; }
    for (const e of G.en) {
      if (e.dead) continue;
      const dx = e.x - b.x, dy = e.y - b.y, rr = e.r + b.r;
      if (dx * dx + dy * dy < rr * rr && b.hits.indexOf(e.id) < 0) {
        b.hits.push(e.id);
        const sp = Math.hypot(b.vx, b.vy);
        damageEnemy(e, b.dmg, b.crit, b.vx / sp * 90, b.vy / sp * 90);
        if (b.pierce-- <= 0) { b.dead = true; break; }
      }
    }
  }
  // enemy bullets
  for (const b of G.ebul) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.life <= 0) { b.dead = true; continue; }
    const dx = p.x - b.x, dy = p.y - b.y, rr = p.r + b.r - 3;
    if (dx * dx + dy * dy < rr * rr) { b.dead = true; hurtPlayer(b.dmg); }
  }
  // pickups
  const mag = p.magnet;
  for (const o of G.orbs) {
    const dx = p.x - o.x, dy = p.y - o.y, d = Math.hypot(dx, dy) || 1;
    if (d < mag || o.pull) {
      o.pull = true;
      const s = 520 + (mag - Math.min(d, mag)) * 4;
      o.x += dx / d * s * dt; o.y += dy / d * s * dt;
    } else {
      o.x += o.vx * dt; o.y += o.vy * dt; o.vx *= 0.9; o.vy *= 0.9;
    }
    if (d < p.r + 8) {
      o.dead = true;
      if (o.kind === 'xp') { p.xp += o.v * p.xpMul; sfx('pickup', 0.05); }
      else if (o.kind === 'coin') { G.coins += Math.round(o.v * p.coinMul); sfx('coin', 0.05); }
      else if (o.kind === 'heart') { p.hp = Math.min(p.maxHp, p.hp + o.v); sfx('level', 0.2); G.txt.push({ x: p.x, y: p.y - 20, v: '+' + o.v, life: 0.8, heal: true }); }
    }
  }
  while (p.xp >= p.next) { p.xp -= p.next; p.lvl++; p.next = xpNeed(p.lvl); G.pending++; }

  // fx
  for (const f of G.fx) {
    f.life -= dt;
    if (f.ring) f.r += (f.R - f.r) * Math.min(1, dt * 14);
    else { f.x += f.vx * dt; f.y += f.vy * dt; f.vx *= 0.92; f.vy *= 0.92; }
  }
  for (const t of G.txt) { t.life -= dt; t.y -= 40 * dt; }
  for (const b of G.bolts) b.life -= dt;
  G.en = G.en.filter(e => !e.dead);
  G.bul = G.bul.filter(b => !b.dead);
  G.ebul = G.ebul.filter(b => !b.dead);
  G.orbs = G.orbs.filter(o => !o.dead);
  G.fx = G.fx.filter(f => f.life > 0);
  G.txt = G.txt.filter(t => t.life > 0);
  G.bolts = G.bolts.filter(b => b.life > 0);
  if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 40);

  // camera
  G.cam.x += (p.x - G.cam.x) * Math.min(1, dt * 10);
  G.cam.y += (p.y - G.cam.y) * Math.min(1, dt * 10);

  if (G.pending > 0 && !G.ended) openLevelUp();
}

function updateBoss(e, dt, dx, dy, d) {
  const def = e.def, st = G.stage;
  if (e.tele > 0) {
    e.tele -= dt;
    if (e.tele <= 0) { e.dash = 0.55; const s = 520; e.dvx = dx / d * s; e.dvy = dy / d * s; }
  } else if (e.dash > 0) {
    e.dash -= dt; e.x += e.dvx * dt; e.y += e.dvy * dt;
    if (Math.random() < 0.5) burst(e.x, e.y, e.col, 1, 80);
  }
  if (e.spiral > 0) {
    e.spiral -= dt; e.spiralT -= dt;
    while (e.spiralT <= 0) {
      e.spiralT += 0.07; e.spiralA += 0.42;
      for (let k = 0; k < 2; k++) {
        const a = e.spiralA + k * Math.PI;
        G.ebul.push({ x: e.x, y: e.y, vx: Math.cos(a) * 170, vy: Math.sin(a) * 170, r: 7, dmg: e.dmg * 0.6, life: 5, col: e.col });
      }
    }
  }
  e.atkT -= dt;
  if (e.atkT <= 0) {
    const enraged = e.hp < e.maxHp * 0.4;
    e.atkT = Math.max(1.3, 3 - st * 0.2) * (enraged ? 0.7 : 1);
    const atk = def.atk[e.atkI++ % def.atk.length];
    if (atk === 'ring') {
      const n = 16 + st * 3 + (enraged ? 8 : 0), off = rand(0, TAU);
      for (let i = 0; i < n; i++) {
        const a = off + i / n * TAU;
        G.ebul.push({ x: e.x, y: e.y, vx: Math.cos(a) * 180, vy: Math.sin(a) * 180, r: 7, dmg: e.dmg * 0.6, life: 5, col: e.col });
      }
    } else if (atk === 'summon') {
      const type = G.S.pool[0];
      for (let i = 0; i < 6 + st * 2; i++) { const a = i / (6 + st * 2) * TAU; spawnEnemy(type, e.x + Math.cos(a) * 70, e.y + Math.sin(a) * 70); }
    } else if (atk === 'dash') {
      e.tele = 0.7;
    } else if (atk === 'spiral') {
      e.spiral = 2.2; e.spiralT = 0;
    }
  }
}

function dronePos(i) {
  const p = G.p, a = G.t * 1.6 + i / Math.max(1, p.drones) * TAU;
  return { x: p.x + Math.cos(a) * 44, y: p.y + Math.sin(a) * 44 };
}

// ---------------------------------------------------------------- level up
let offered = [];
function rollUpgrades() {
  const p = G.p;
  const avail = UPGRADES.filter(u => (p.upg[u.id] || 0) < u.max);
  // weight new abilities a bit lower once the player already has several
  const out = [];
  const pool = avail.slice();
  while (out.length < 3 && pool.length) {
    const i = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(i, 1)[0]);
  }
  if (!out.length) out.push({ id: '_heal', ico: '🍖', name: 'Ziyafet', desc: 'Tüm canı doldur', max: 99, apply: q => { q.hp = q.maxHp; } },
    { id: '_gold', ico: '💰', name: 'Hazine', desc: '+50 altın', max: 99, apply: () => { G.coins += 50; } });
  return out;
}
function openLevelUp() {
  state = 'levelup';
  joy = null;
  sfx('level', 0);
  offered = rollUpgrades();
  renderLevelUp();
  show('levelup');
}
function renderLevelUp() {
  const list = $('upgList'); list.innerHTML = '';
  const p = G.p;
  offered.forEach((u, idx) => {
    const lv = p.upg[u.id] || 0;
    const card = el(`<button class="card upg"><div class="ico">${u.ico}</div>
      <div class="body"><div class="t">${u.name}${lv === 0 && u.max < 99 ? '<span class="new">YENİ</span>' : ''}</div>
      <div class="d">${u.desc}</div>${u.max < 99 ? pips(lv + 1, u.max) : ''}</div><div class="d">${idx + 1}</div></button>`);
    card.onclick = () => chooseUpgrade(u);
    list.appendChild(card);
  });
  const rb = $('rerollBtn');
  rb.textContent = 'Yenile (' + G.rerolls + ')';
  rb.disabled = G.rerolls <= 0;
}
$('rerollBtn').onclick = () => { if (G && G.rerolls > 0) { G.rerolls--; offered = rollUpgrades(); renderLevelUp(); } };
function chooseUpgrade(u) {
  if (state !== 'levelup') return;
  const p = G.p;
  u.apply(p);
  p.upg[u.id] = (p.upg[u.id] || 0) + 1;
  G.pending--;
  burst(p.x, p.y, '#ffd84a', 24, 260);
  if (G.pending > 0) { offered = rollUpgrades(); renderLevelUp(); return; }
  state = 'play';
  show(null);
  last = performance.now();
}

// ---------------------------------------------------------------- pause / end
function pauseGame() {
  if (state !== 'play') return;
  state = 'pause'; joy = null;
  const chips = $('pauseUpgs'); chips.innerHTML = '';
  for (const u of UPGRADES) if (G.p.upg[u.id]) chips.appendChild(el(`<span>${u.ico} ${u.name} ${G.p.upg[u.id]}</span>`));
  show('pause');
}
function resumeGame() { state = 'play'; show(null); last = performance.now(); }
$('pauseBtn').addEventListener('click', e => { e.stopPropagation(); pauseGame(); });
$('resumeBtn').onclick = resumeGame;
$('quitBtn').onclick = () => { endRun(false, true); };
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });

function winRun() { if (!G.ended) { const run = G; sfx('win', 0); G.ended = true; setTimeout(() => { if (G === run) endRun(true); }, 1200); } }
function loseRun() { if (!G.ended) { const run = G; G.ended = true; G.hitStop = 0.4; setTimeout(() => { if (G === run) endRun(false); }, 900); } }
function endRun(win, quit = false) {
  if (!G || G.finished) return;
  G.ended = true; G.finished = true;
  const bonus = win ? 150 + G.stage * 120 : 0;
  const earned = G.coins + bonus;
  save.coins += earned;
  const b = save.best[G.stage] || { time: 0, cleared: false };
  b.time = Math.max(b.time, Math.floor(G.t));
  if (win) { b.cleared = true; save.unlocked = Math.max(save.unlocked, Math.min(STAGES.length, G.stage + 2)); }
  save.best[G.stage] = b;
  persist();
  state = 'over';
  $('hud').classList.add('hidden');
  const t = $('overTitle');
  t.textContent = win ? 'BÖLÜM TEMİZLENDİ!' : quit ? 'GÖREV İPTAL' : 'YENİLDİN';
  t.className = win ? 'win' : 'lose';
  $('rTime').textContent = fmtTime(G.t);
  $('rKills').textContent = G.kills;
  $('rLevel').textContent = G.p.lvl;
  $('rCoins').textContent = '+' + earned;
  const last = G.stage === STAGES.length - 1;
  $('overNote').textContent = win ? (last ? 'Tüm bölümleri bitirdin! Yeni içerik yakında.' : 'Zafer bonusu: +' + bonus + ' altın. Yeni bölüm açıldı!')
    : 'Altınlarını kalıcı geliştirmelere harca ve tekrar dene.';
  $('nextBtn').classList.toggle('hidden', !(win && !last));
  show('over');
}
$('againBtn').onclick = () => startRun(G.stage);
$('nextBtn').onclick = () => startRun(Math.min(STAGES.length - 1, G.stage + 1));
$('menuBtn').onclick = () => { G = null; state = 'menu'; show('menu'); };

// ---------------------------------------------------------------- render
function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const hue = G ? G.S.hue : 150;
  ctx.fillStyle = `hsl(${hue},45%,5%)`;
  ctx.fillRect(0, 0, cv.width, cv.height);
  if (!G) { renderMenuBg(); return; }
  const p = G.p;
  const sx = G.shake ? rand(-G.shake, G.shake) : 0, sy = G.shake ? rand(-G.shake, G.shake) : 0;
  const k = DPR * ZOOM;
  ctx.setTransform(k, 0, 0, k, cv.width / 2 - G.cam.x * k + sx * DPR, cv.height / 2 - G.cam.y * k + sy * DPR);
  const vw = W / ZOOM / 2 + 60, vh = H / ZOOM / 2 + 60;
  const x0 = G.cam.x - vw, x1 = G.cam.x + vw, y0 = G.cam.y - vh, y1 = G.cam.y + vh;

  // floor grid + decor
  const C = 64;
  ctx.strokeStyle = `hsla(${hue},80%,55%,0.08)`; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = Math.floor(x0 / C) * C; x < x1; x += C) { ctx.moveTo(x, y0); ctx.lineTo(x, y1); }
  for (let y = Math.floor(y0 / C) * C; y < y1; y += C) { ctx.moveTo(x0, y); ctx.lineTo(x1, y); }
  ctx.stroke();
  for (let cx = Math.floor(x0 / C); cx * C < x1; cx++) for (let cy = Math.floor(y0 / C); cy * C < y1; cy++) {
    const h = hash(cx, cy);
    if (h < 0.18) {
      ctx.fillStyle = `hsla(${hue + h * 200},90%,60%,${0.08 + h * 0.5})`;
      ctx.beginPath(); ctx.arc(cx * C + h * 300 % C, cy * C + h * 900 % C, 2 + h * 14, 0, TAU); ctx.fill();
    }
  }

  // pickups
  for (const o of G.orbs) {
    if (o.x < x0 || o.x > x1 || o.y < y0 || o.y > y1) continue;
    if (o.kind === 'xp') drawSprite(glowDot(o.v >= 5 ? 5 : 3.2, o.v >= 5 ? '#3bd7ff' : '#59ffb0'), o.x, o.y);
    else if (o.kind === 'coin') drawSprite(glowDot(4.5, '#ffd84a'), o.x, o.y);
    else { ctx.font = '18px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('❤️', o.x, o.y); }
  }

  // enemies
  for (const e of G.en) {
    if (e.x < x0 - 60 || e.x > x1 + 60 || e.y < y0 - 60 || e.y > y1 + 60) continue;
    const s = enemySprite(e.shape, e.r, e.col);
    const wob = 1 + Math.sin(G.t * 10 + e.id) * 0.04;
    if (e.boss && e.tele > 0) { ctx.strokeStyle = 'rgba(255,60,60,0.6)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(p.x, p.y); ctx.stroke(); }
    drawSprite(s, e.x, e.y, e.ang, wob);
    if (e.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, TAU); ctx.fill(); }
    if (e.elite) { ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 6 + Math.sin(G.t * 6) * 2, 0, TAU); ctx.stroke(); }
    if ((e.elite || e.type === 'brute') && e.hp < e.maxHp) {
      ctx.fillStyle = '#0008'; ctx.fillRect(e.x - e.r, e.y - e.r - 10, e.r * 2, 4);
      ctx.fillStyle = '#ff4d6d'; ctx.fillRect(e.x - e.r, e.y - e.r - 10, e.r * 2 * e.hp / e.maxHp, 4);
    }
  }

  // orbit blades
  if (p.orbit) {
    for (let i = 0; i < p.orbit; i++) {
      const a = G.orbitA + i / p.orbit * TAU, bx = p.x + Math.cos(a) * 74, by = p.y + Math.sin(a) * 74;
      ctx.save(); ctx.translate(bx, by); ctx.rotate(a * 3);
      ctx.fillStyle = p.col; ctx.beginPath();
      ctx.moveTo(12, 0); ctx.lineTo(0, 4); ctx.lineTo(-12, 0); ctx.lineTo(0, -4); ctx.closePath(); ctx.fill();
      ctx.rotate(Math.PI / 2); ctx.fill();
      ctx.restore();
    }
  }

  // player
  const blink = p.inv > 0 && Math.floor(G.t * 20) % 2 === 0;
  if (!blink) drawPlayer(p);
  // drones
  for (let i = 0; i < p.drones; i++) {
    const d = dronePos(i);
    drawSprite(glowDot(5, '#9be7ff'), d.x, d.y);
    ctx.fillStyle = '#e8fbff'; ctx.fillRect(d.x - 7, d.y - 1.5, 14, 3);
  }

  // bullets (additive)
  ctx.globalCompositeOperation = 'lighter';
  for (const b of G.bul) drawSprite(glowDot(b.crit ? b.r + 2 : b.r, b.crit ? '#ffd84a' : b.col), b.x, b.y);
  for (const b of G.ebul) drawSprite(glowDot(b.r, b.col), b.x, b.y);
  for (const f of G.fx) {
    const a = Math.max(0, f.life / f.max);
    if (f.ring) {
      ctx.strokeStyle = f.col; ctx.globalAlpha = a; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, TAU); ctx.stroke();
    } else {
      ctx.globalAlpha = a; ctx.fillStyle = f.col;
      ctx.fillRect(f.x - f.r, f.y - f.r, f.r * 2, f.r * 2);
    }
  }
  ctx.globalAlpha = 1;
  for (const b of G.bolts) {
    ctx.strokeStyle = '#bfe9ff'; ctx.lineWidth = 3; ctx.globalAlpha = b.life / 0.18;
    ctx.beginPath(); ctx.moveTo(b.pts[0].x, b.pts[0].y);
    for (let i = 1; i < b.pts.length; i++) {
      const a = b.pts[i - 1], c = b.pts[i];
      ctx.lineTo((a.x + c.x) / 2 + rand(-12, 12), (a.y + c.y) / 2 + rand(-12, 12)); ctx.lineTo(c.x, c.y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  // damage numbers
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const t of G.txt) {
    ctx.globalAlpha = Math.min(1, t.life * 3);
    ctx.font = `900 ${t.crit ? 18 : 13}px system-ui`;
    ctx.fillStyle = t.heal ? '#59ffb0' : t.crit ? '#ffd84a' : '#fff';
    ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
    ctx.strokeText(t.v, t.x, t.y); ctx.fillText(t.v, t.x, t.y);
  }
  ctx.globalAlpha = 1;

  // screen space: boss arrow, joystick, low-hp vignette
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (G.boss && !G.boss.dead) {
    const b = G.boss, bx = (b.x - G.cam.x) * ZOOM + W / 2, by = (b.y - G.cam.y) * ZOOM + H / 2;
    if (bx < 0 || bx > W || by < 0 || by > H) {
      const a = Math.atan2(by - H / 2, bx - W / 2);
      const ax = clamp(bx, 30, W - 30), ay = clamp(by, 130, H - 30);
      ctx.save(); ctx.translate(ax, ay); ctx.rotate(a);
      ctx.fillStyle = '#ff3b6b'; ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-10, 11); ctx.lineTo(-10, -11); ctx.fill();
      ctx.restore();
    }
  }
  if (joy && state === 'play') {
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(joy.ox, joy.oy, JOY_R, 0, TAU); ctx.stroke();
    const dx = joy.x - joy.ox, dy = joy.y - joy.oy, d = Math.hypot(dx, dy), m = Math.min(d, JOY_R);
    const kx = d ? joy.ox + dx / d * m : joy.ox, ky = d ? joy.oy + dy / d * m : joy.oy;
    ctx.fillStyle = 'rgba(89,255,176,0.45)'; ctx.beginPath(); ctx.arc(kx, ky, 24, 0, TAU); ctx.fill();
  }
  if (p.hp / p.maxHp < 0.3) {
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    g.addColorStop(0, 'rgba(255,0,40,0)'); g.addColorStop(1, `rgba(255,0,40,${0.25 + Math.sin(G.t * 6) * 0.1})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
}
function drawPlayer(p) {
  const s = sprite('pl' + p.col, p.r, (g, r) => {
    g.shadowColor = p.col; g.shadowBlur = 18;
    g.fillStyle = p.col; bodyPath(g, 'blob', r); g.fill();
    g.shadowBlur = 0;
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(-r * 0.3, -r * 0.35, r * 0.35, 0, TAU); g.fill();
  });
  const bob = Math.sin(G.t * (p.moving > 0.1 ? 16 : 4)) * (p.moving > 0.1 ? 1.6 : 0.7);
  drawSprite(s, p.x, p.y + bob);
  // gun
  ctx.save(); ctx.translate(p.x, p.y + bob); ctx.rotate(p.aim);
  ctx.fillStyle = '#e8fff5'; ctx.fillRect(8, -3.5, 16, 7);
  ctx.fillStyle = '#20302a'; ctx.fillRect(20, -2, 5, 4);
  ctx.restore();
  // eyes look towards aim
  const ex = Math.cos(p.aim) * 3, ey = Math.sin(p.aim) * 3;
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(p.x - 4.5 + ex, p.y - 2 + ey + bob, 3.6, 0, TAU); ctx.arc(p.x + 4.5 + ex, p.y - 2 + ey + bob, 3.6, 0, TAU); ctx.fill();
  ctx.fillStyle = '#04241a';
  ctx.beginPath(); ctx.arc(p.x - 4.5 + ex * 1.4, p.y - 2 + ey * 1.4 + bob, 1.8, 0, TAU); ctx.arc(p.x + 4.5 + ex * 1.4, p.y - 2 + ey * 1.4 + bob, 1.8, 0, TAU); ctx.fill();
}
// drifting particles behind menus
const menuDots = Array.from({ length: 40 }, () => ({ x: Math.random(), y: Math.random(), r: rand(2, 9), s: rand(0.01, 0.04), h: rand(120, 330) }));
function renderMenuBg() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  for (const m of menuDots) {
    m.y -= m.s / 60; if (m.y < -0.05) { m.y = 1.05; m.x = Math.random(); }
    drawSprite(glowDot(m.r, `hsl(${m.h},90%,60%)`), m.x * W, m.y * H);
  }
}

// ---------------------------------------------------------------- HUD
const hud = { hp: $('hpFill'), hpT: $('hpTxt'), xp: $('xpFill'), lv: $('lvTxt'), time: $('timeTxt'), kills: $('killTxt'), coins: $('coinTxt'), boss: $('bossFill') };
let hudCache = '';
function updateHud() {
  if (!G || state === 'menu') return;
  const p = G.p;
  const remaining = G.bossSpawned ? 'BOSS' : fmtTime(G.S.dur - G.t);
  const key = [Math.ceil(p.hp), p.maxHp, Math.floor(p.xp), p.lvl, remaining, G.kills, G.coins, G.boss ? Math.ceil(G.boss.hp) : 0].join('|');
  if (key === hudCache) return;
  hudCache = key;
  hud.hp.style.width = (p.hp / p.maxHp * 100) + '%';
  hud.hpT.textContent = Math.ceil(p.hp) + ' / ' + p.maxHp;
  hud.xp.style.width = (p.xp / p.next * 100) + '%';
  hud.lv.textContent = 'Sv ' + p.lvl;
  hud.time.textContent = remaining;
  hud.kills.textContent = G.kills;
  hud.coins.textContent = G.coins;
  if (G.boss) hud.boss.style.width = Math.max(0, G.boss.hp / G.boss.maxHp * 100) + '%';
}

// ---------------------------------------------------------------- loop
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (state === 'play' && G) update(dt);
  render();
  updateHud();
  requestAnimationFrame(frame);
}
show('menu');
requestAnimationFrame(frame);

// small hook for automated tests / balancing
window.NeonSwarm = { get G() { return G; }, get state() { return state; }, startRun, STAGES, UPGRADES, save };
})();
