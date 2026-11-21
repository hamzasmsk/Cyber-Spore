/* Swarm Squad — mobile survivor shooter (HTML5 canvas, no dependencies). Art: Kenney (CC0). */
'use strict';
(() => {

// ---------------------------------------------------------------- utilities
const $ = id => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const TAU = Math.PI * 2;
const fmtTime = s => { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const hash = (x, y, k = 0) => { let h = (x * 374761393 + y * 668265263 + k * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
const easeOutBack = t => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const OUTLINE = '#2b2f3a';
const FONT = '800 "Baloo 2", system-ui, sans-serif';

// ---------------------------------------------------------------- canvas
const cv = $('c');
const ctx = cv.getContext('2d');
let W = 0, H = 0, DPR = 1, ZOOM = 1, vignette = null;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  cv.width = Math.floor(W * DPR); cv.height = Math.floor(H * DPR);
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  ZOOM = clamp(Math.min(W, H) / 500, 0.72, 1.25);
  vignette = document.createElement('canvas');
  vignette.width = Math.max(1, Math.floor(W / 2)); vignette.height = Math.max(1, Math.floor(H / 2));
  const g = vignette.getContext('2d'), w = vignette.width, h = vignette.height;
  const gr = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.max(w, h) * 0.75);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(10,20,30,0.35)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
}
window.addEventListener('resize', resize);
resize();

// ---------------------------------------------------------------- atlas
const ATLAS = window.ATLAS;
const AF = ATLAS.frames;
const atlasImg = new Image();
const atlasReady = new Promise(res => { atlasImg.onload = res; atlasImg.onerror = res; });
atlasImg.src = 'assets/atlas.png';

const tintCache = new Map();
function tinted(name, color) { // the frame recoloured (keeps alpha), cached
  const key = name + color;
  let c = tintCache.get(key);
  if (c) return c;
  const f = AF[name];
  c = document.createElement('canvas'); c.width = f[2]; c.height = f[3];
  const g = c.getContext('2d');
  g.drawImage(atlasImg, f[0], f[1], f[2], f[3], 0, 0, f[2], f[3]);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color; g.fillRect(0, 0, f[2], f[3]);
  tintCache.set(key, c);
  return c;
}
// draw an atlas frame centred at (x,y) with height h (world units)
function drawF(name, x, y, h, rot = 0, flip = false, sx = 1, sy = 1) {
  const f = AF[name]; if (!f) return;
  const s = h / f[3], w = f[2] * s * sx, hh = h * sy;
  if (!rot && !flip) { ctx.drawImage(atlasImg, f[0], f[1], f[2], f[3], x - w / 2, y - hh / 2, w, hh); return; }
  ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot); if (flip) ctx.scale(-1, 1);
  ctx.drawImage(atlasImg, f[0], f[1], f[2], f[3], -w / 2, -hh / 2, w, hh);
  ctx.restore();
}
function drawT(name, color, x, y, h, rot = 0, sx = 1, sy = 1) {
  const c = tinted(name, color), s = h / c.height, w = c.width * s * sx, hh = h * sy;
  if (!rot) { ctx.drawImage(c, x - w / 2, y - hh / 2, w, hh); return; }
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.drawImage(c, -w / 2, -hh / 2, w, hh); ctx.restore();
}
function shadow(x, y, w, a = 0.22) {
  ctx.fillStyle = `rgba(20,30,20,${a})`;
  ctx.beginPath(); ctx.ellipse(x, y, w, w * 0.32, 0, 0, TAU); ctx.fill();
}

// ---------------------------------------------------------------- save data
const SAVE_KEY = 'swarmsquad_save_v1';
const DEFAULT_SAVE = { coins: 0, meta: {}, unlocked: 1, chars: { panda: true }, char: 'panda', best: {}, sound: true };
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
  panda:  { name: 'Panda',  hero: 'panda',  desc: 'Dengeli savaşçı. İsabetli tabanca.', cost: 0,    accent: '#4aa8ff', gun: 'pistol',  hp: 100, speed: 170, dmg: 10,  rate: 3.0, shots: 1, gap: 0.14, pierce: 0, bspd: 1 },
  rabbit: { name: 'Tavşan', hero: 'rabbit', desc: 'Makineli: çok hızlı ateş, az can.',   cost: 400,  accent: '#ff7ac8', gun: 'smg',     hp: 75,  speed: 192, dmg: 5.5, rate: 6.5, shots: 1, gap: 0.14, pierce: 0, bspd: 1.15 },
  bear:   { name: 'Ayı',    hero: 'bear',   desc: 'Pompalı: 3 saçma, çok dayanıklı.',    cost: 900,  accent: '#ff9a3b', gun: 'shotgun', hp: 170, speed: 150, dmg: 9,   rate: 1.6, shots: 3, gap: 0.24, pierce: 0, bspd: 0.9 },
  owl:    { name: 'Baykuş', hero: 'owl',    desc: 'Keskin nişancı: delici, ağır vuruş.', cost: 1600, accent: '#b07bff', gun: 'rifle',   hp: 90,  speed: 175, dmg: 26,  rate: 1.4, shots: 1, gap: 0.14, pierce: 2, bspd: 1.5 },
};
const GUNS = {
  pistol:  { len: 20, body: '#6b7686', acc: '#3a4250' },
  smg:     { len: 26, body: '#3f8fe0', acc: '#2a4e7a' },
  shotgun: { len: 32, body: '#b06a3a', acc: '#5b3a22' },
  rifle:   { len: 40, body: '#5a6b44', acc: '#2e3824' },
};
const META = [
  { id: 'power',  icon: 'ic_power',  bg: '#ff5a6e', name: 'Güç',          desc: '+8% hasar',           max: 10, base: 60 },
  { id: 'vital',  icon: 'heart',     bg: '#ffd6dc', name: 'Dayanıklılık', desc: '+12 maks. can',       max: 10, base: 60 },
  { id: 'swift',  icon: 'ic_speed',  bg: '#2fbe6e', name: 'Çeviklik',     desc: '+4% hareket hızı',    max: 5,  base: 90 },
  { id: 'armor',  icon: 'ic_armor',  bg: '#8d9ab0', name: 'Zırh',         desc: '-1 alınan hasar',     max: 5,  base: 140 },
  { id: 'wisdom', icon: 'gem_green', bg: '#d4f7e0', name: 'Bilgelik',     desc: '+10% tecrübe',        max: 5,  base: 110 },
  { id: 'greed',  icon: 'coin',      bg: '#fff0c2', name: 'Açgözlülük',   desc: '+15% altın',          max: 5,  base: 110 },
  { id: 'reroll', icon: 'ic_reroll', bg: '#4aa8ff', name: 'Şans',         desc: '+1 seçenek yenileme', max: 3,  base: 250 },
];
const metaCost = (m, lvl) => Math.round(m.base * Math.pow(1.55, lvl) / 5) * 5;
const metaLv = id => save.meta[id] || 0;

// h = drawn height (world units), r = collision radius
const ENEMIES = {
  mite:     { hp: 12, spd: 74,  h: 42, r: 14, dmg: 8,  xp: 1, col: '#ff5a6e' },
  runner:   { hp: 7,  spd: 138, h: 38, r: 12, dmg: 6,  xp: 1, col: '#ffc02e' },
  brute:    { hp: 75, spd: 46,  h: 70, r: 24, dmg: 16, xp: 5, col: '#6b5440' },
  spitter:  { hp: 20, spd: 60,  h: 46, r: 15, dmg: 9,  xp: 3, col: '#3fd6e8', ranged: true },
  splitter: { hp: 32, spd: 64,  h: 50, r: 17, dmg: 10, xp: 2, col: '#2fd27a', split: true },
  mini:     { hp: 6,  spd: 112, h: 28, r: 10, dmg: 5,  xp: 0, col: '#2fd27a' },
};
const BOSSES = {
  brood: { name: 'KULUÇKA ANA',   hp: 5200,  spd: 55, h: 120, r: 46, dmg: 20, col: '#ff5a6e', atk: ['ring', 'summon'] },
  golem: { name: 'KAR DEVİ',      hp: 9500,  spd: 46, h: 126, r: 50, dmg: 26, col: '#dfe6f0', atk: ['dash', 'ring', 'dash'] },
  hydra: { name: 'BATAKLIK GÖZÜ', hp: 15000, spd: 52, h: 126, r: 50, dmg: 24, col: '#2fd27a', atk: ['spiral', 'summon', 'ring'] },
  prism: { name: 'BUZ KUTUSU',    hp: 23000, spd: 56, h: 126, r: 50, dmg: 28, col: '#3fd6e8', atk: ['ring', 'dash', 'spiral'] },
  core:  { name: 'ALTIN KABUS',   hp: 36000, spd: 60, h: 136, r: 56, dmg: 32, col: '#ffc02e', atk: ['spiral', 'dash', 'summon', 'ring'] },
};
const STAGES = [
  { name: 'Yeşil Çayır',     biome: 'grass', dur: 150, diff: 1.0, pool: ['mite', 'mite', 'runner'], boss: 'brood' },
  { name: 'Sonbahar Vadisi', biome: 'dirt',  dur: 165, diff: 1.6, pool: ['mite', 'runner', 'brute'], boss: 'golem' },
  { name: 'Kara Bataklık',   biome: 'swamp', dur: 180, diff: 2.4, pool: ['mite', 'runner', 'brute', 'spitter'], boss: 'hydra' },
  { name: 'Buzul Ormanı',    biome: 'ice',   dur: 195, diff: 3.4, pool: ['runner', 'brute', 'spitter', 'splitter'], boss: 'prism' },
  { name: 'Kızıl Çöl',       biome: 'sand',  dur: 210, diff: 4.8, pool: ['mite', 'runner', 'brute', 'spitter', 'splitter'], boss: 'core' },
];
const UPGRADES = [
  { id: 'dmg',    icon: 'ic_power',  bg: '#ff5a6e', name: 'Keskin Mermi',  desc: '+25% hasar',                     max: 8, apply: p => { p.dmgMul += 0.25; } },
  { id: 'rate',   icon: 'ic_rate',   bg: '#ff9a3b', name: 'Hızlı Tetik',   desc: '+18% atış hızı',                 max: 8, apply: p => { p.rateMul += 0.18; } },
  { id: 'multi',  icon: 'ic_multi',  bg: '#b07bff', name: 'Çoklu Atış',    desc: '+1 mermi',                       max: 4, apply: p => { p.extraShots++; } },
  { id: 'pierce', icon: 'ic_pierce', bg: '#4a7bff', name: 'Delici Mermi',  desc: 'Mermi +1 düşmanı deler',         max: 4, apply: p => { p.pierce++; } },
  { id: 'crit',   icon: 'ic_crit',   bg: '#ffc02e', name: 'Kritik Vuruş',  desc: '+8% kritik şansı (x2 hasar)',    max: 5, apply: p => { p.crit += 0.08; } },
  { id: 'bspd',   icon: 'ic_bspd',   bg: '#3bc4ff', name: 'Uzun Namlu',    desc: '+20% mermi hızı ve menzil',      max: 4, apply: p => { p.bspdMul += 0.2; } },
  { id: 'speed',  icon: 'ic_speed',  bg: '#2fbe6e', name: 'Turbo Pati',    desc: '+10% hareket hızı',              max: 5, apply: p => { p.spdMul += 0.1; } },
  { id: 'hp',     icon: 'heart',     bg: '#ffd6dc', name: 'Kalın Post',    desc: '+25 maks. can ve iyileşme',      max: 6, apply: p => { p.maxHp += 25; p.hp = Math.min(p.maxHp, p.hp + 40); } },
  { id: 'regen',  icon: 'ic_regen',  bg: '#53e07f', name: 'Yenilenme',     desc: '+0.7 can / saniye',              max: 5, apply: p => { p.regen += 0.7; } },
  { id: 'magnet', icon: 'gem_green', bg: '#d4f7e0', name: 'Mıknatıs',      desc: '+45% toplama alanı',             max: 4, apply: p => { p.magnet *= 1.45; } },
  { id: 'orbit',  icon: 'ic_orbit',  bg: '#8a5cff', name: 'Dönen Bıçak',   desc: 'Etrafında dönen bıçak (+1)',     max: 5, apply: p => { p.orbit++; } },
  { id: 'nova',   icon: 'ic_nova',   bg: '#ff6ad5', name: 'Şok Dalgası',   desc: 'Düzenli alan hasarı + itme',     max: 5, apply: p => { p.nova++; } },
  { id: 'drone',  icon: 'star',      bg: '#fff0c2', name: 'Yıldız Drone',  desc: 'Otomatik ateş eden yardımcı',    max: 3, apply: p => { p.drones++; } },
  { id: 'chain',  icon: 'ic_chain',  bg: '#3bd7ff', name: 'Zincir Şimşek', desc: 'Düşmanlar arası seken yıldırım', max: 5, apply: p => { p.chain++; } },
];
const xpNeed = l => Math.floor(3 + l * 3 + l * l * 0.6);
const uiImg = n => 'assets/ui/' + n + '.png';

// ---------------------------------------------------------------- audio (tiny synth)
let AC = null;
function audioInit() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; }
}
const sndLast = {};
const SFX = {
  shoot:  ['square',   660, 330, 0.05, 0.02],
  hit:    ['triangle', 320, 140, 0.05, 0.05],
  kill:   ['square',   260, 70,  0.1,  0.05],
  pickup: ['sine',     900, 1500, 0.06, 0.05],
  coin:   ['triangle', 1200, 1900, 0.08, 0.06],
  hurt:   ['sawtooth', 220, 60,  0.18, 0.12],
  level:  ['triangle', 440, 1320, 0.35, 0.12],
  boss:   ['sawtooth', 90,  40,  0.9,  0.18],
  nova:   ['sine',     180, 40,  0.25, 0.12],
  zap:    ['sawtooth', 1400, 300, 0.1, 0.05],
  win:    ['triangle', 523, 1046, 0.6, 0.14],
  click:  ['triangle', 700, 900, 0.05, 0.06],
};
function sfx(name, minGap = 0.03) {
  if (!AC || !save.sound) return;
  const now = AC.currentTime;
  if (sndLast[name] && now - sndLast[name] < minGap) return;
  sndLast[name] = now;
  const P = SFX[name]; if (!P) return;
  const o = AC.createOscillator(), g = AC.createGain();
  o.connect(g); g.connect(AC.destination);
  o.type = P[0];
  o.frequency.setValueAtTime(P[1], now);
  o.frequency.exponentialRampToValueAtTime(P[2], now + P[3]);
  g.gain.setValueAtTime(P[4], now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + P[3]);
  o.start(now); o.stop(now + P[3] + 0.02);
}
const vibrate = ms => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* ignore */ } };

// ---------------------------------------------------------------- UI (HTML screens)
const screens = ['menu', 'stages', 'chars', 'shop', 'levelup', 'pause', 'over', 'loading'];
function show(id) {
  for (const s of screens) $(s).classList.toggle('hidden', s !== id);
  document.querySelectorAll('.coinTotal').forEach(e => { e.textContent = save.coins; });
  if (id === 'menu') renderMenu();
  if (id === 'stages') renderStages();
  if (id === 'chars') renderChars();
  if (id === 'shop') renderShop();
}
function el(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; }
function pips(n, max, next = false) { let s = '<div class="pips">'; for (let i = 0; i < max; i++) s += `<i class="${i < n ? 'on' : (next && i === n ? 'next' : '')}"></i>`; return s + '</div>'; }
const badge = (icon, bg) => `<div class="badge" style="background:${bg}"><img src="${uiImg(icon)}" alt=""></div>`;
const coinTxt = n => `<img src="${uiImg('coin')}" alt="">${n}`;

function renderMenu() {
  const c = CHARS[save.char] || CHARS.panda;
  $('menuHero').src = uiImg('hero_' + c.hero);
  $('menuHeroName').textContent = c.name;
  $('soundIco').src = uiImg(save.sound ? 'icon_audio_on' : 'icon_audio_off');
}
function renderStages() {
  const list = $('stageList'); list.innerHTML = '';
  STAGES.forEach((st, i) => {
    const open = i < save.unlocked, best = save.best[i];
    const status = !open ? 'Önceki bölümün bossunu yen' : best ? (best.cleared ? 'Temizlendi! En iyi ' + fmtTime(best.time) : 'En iyi: ' + fmtTime(best.time)) : 'Boss ' + fmtTime(st.dur) + ' sonra gelir';
    const card = el(`<div class="card stage ${open ? '' : 'locked'}">
      <div class="scene" style="background-image:url(${uiImg('tile_' + st.biome)})">
        <div class="num">${i + 1}</div><img class="boss" src="${uiImg('mon_boss_' + st.boss)}" alt="">
        ${open ? '' : `<div class="lock"><img src="${uiImg('icon_lock')}" alt=""></div>`}</div>
      <div class="info"><div class="body"><div class="t">${st.name}</div><div class="d">${status}</div></div>
      <button class="kbtn ${open ? 'yellow' : 'grey'}" ${open ? '' : 'disabled'}>${open ? 'BAŞLA' : 'KİLİTLİ'}</button></div></div>`);
    if (open) card.querySelector('button').onclick = () => { sfx('click'); startRun(i); };
    list.appendChild(card);
  });
}
function renderChars() {
  const list = $('charList'); list.innerHTML = '';
  for (const id in CHARS) {
    const c = CHARS[id], owned = !!save.chars[id], cur = save.char === id;
    const card = el(`<div class="card hero-card ${cur ? 'current' : ''} ${owned ? '' : 'locked'}">
      <div class="pic"><img src="${uiImg('hero_' + c.hero)}" alt=""></div>
      <div class="t">${c.name}</div><div class="d">${c.desc}</div>
      <div class="stats"><span>❤ ${c.hp}</span><span>⚔ ${c.dmg}</span><span>» ${c.rate}/sn</span></div>
      <button class="kbtn ${cur ? 'grey' : owned ? 'green' : 'yellow'}">${cur ? 'SEÇİLİ' : owned ? 'SEÇ' : coinTxt(c.cost)}</button></div>`);
    const b = card.querySelector('button');
    if (cur || (!owned && save.coins < c.cost)) b.disabled = true;
    b.onclick = () => {
      if (!owned) { if (save.coins < c.cost) return; save.coins -= c.cost; save.chars[id] = true; sfx('coin'); }
      else sfx('click');
      save.char = id; persist(); show('chars');
    };
    list.appendChild(card);
  }
}
function renderShop() {
  const list = $('shopList'); list.innerHTML = '';
  for (const m of META) {
    const lv = metaLv(m.id), maxed = lv >= m.max, cost = metaCost(m, lv);
    const card = el(`<div class="card">${badge(m.icon, m.bg)}
      <div class="body"><div class="t">${m.name}</div><div class="d">${m.desc}</div>${pips(lv, m.max)}</div>
      <button class="kbtn ${maxed ? 'grey' : 'yellow'}">${maxed ? 'MAKS' : coinTxt(cost)}</button></div>`);
    const b = card.querySelector('button');
    if (maxed || save.coins < cost) b.disabled = true;
    b.onclick = () => {
      if (maxed || save.coins < cost) return;
      save.coins -= cost; save.meta[m.id] = lv + 1; persist(); sfx('coin'); show('shop');
    };
    list.appendChild(card);
  }
}
document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => { audioInit(); sfx('click'); show(b.dataset.go); }));
$('soundBtn').onclick = () => { audioInit(); save.sound = !save.sound; persist(); renderMenu(); sfx('click'); };

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
const JOY_R = 58;
cv.addEventListener('pointerdown', e => {
  audioInit();
  if (state !== 'play' || joy) return;
  joy = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
  try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
});
cv.addEventListener('pointermove', e => {
  if (!joy || e.pointerId !== joy.id) return;
  joy.x = e.clientX; joy.y = e.clientY;
  const dx = joy.x - joy.ox, dy = joy.y - joy.oy, d = Math.hypot(dx, dy);
  if (d > JOY_R * 1.5) { const k = (d - JOY_R * 1.5) / d; joy.ox += dx * k; joy.oy += dy * k; }
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
let state = 'loading';
let G = null;
let nextId = 1;

function newPlayer() {
  const c = CHARS[save.char] || CHARS.panda;
  const maxHp = c.hp + metaLv('vital') * 12;
  return {
    x: 0, y: 0, r: 16, c, hero: 'hero_' + c.hero, accent: c.accent, gun: GUNS[c.gun],
    hp: maxHp, maxHp,
    spd: c.speed * (1 + metaLv('swift') * 0.04), spdMul: 1,
    dmg: c.dmg * (1 + metaLv('power') * 0.08), dmgMul: 1,
    rate: c.rate, rateMul: 1, shots: c.shots, extraShots: 0, gap: c.gap,
    pierce: c.pierce, bspd: c.bspd, bspdMul: 1, crit: 0.05,
    regen: 0, magnet: 95, orbit: 0, nova: 0, drones: 0, chain: 0,
    armor: metaLv('armor'), xpMul: 1 + metaLv('wisdom') * 0.1, coinMul: 1 + metaLv('greed') * 0.15,
    lvl: 1, xp: 0, next: xpNeed(1), fireT: 0, inv: 0, aim: 0, moving: 0, face: 1,
    novaT: 2, chainT: 1.5, droneT: 0, upg: {}, recoil: 0, flashT: 0, walk: 0,
  };
}

function startRun(stageIdx) {
  audioInit();
  const S = STAGES[stageIdx];
  G = {
    stage: stageIdx, S, t: 0, p: newPlayer(),
    en: [], bul: [], ebul: [], orbs: [], fx: [], txt: [], bolts: [], decals: [],
    kills: 0, coins: 0, spawnT: 0.5, waveT: 40, eliteT: 55,
    boss: null, bossSpawned: false, shake: 0,
    cam: { x: 0, y: 0 }, orbitA: 0, pending: 0, rerolls: metaLv('reroll') + 1, ended: false, hitStop: 0,
  };
  joy = null;
  state = 'play';
  show(null);
  $('hud').classList.remove('hidden');
  $('bossBar').classList.add('hidden');
  $('hudHero').src = uiImg('hero_' + G.p.c.hero);
  hudCache = '';
  banner(S.name);
}

function banner(text, warn = false) {
  const b = $('banner');
  b.textContent = text;
  b.classList.toggle('warn', warn);
  b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
}

// ---------------------------------------------------------------- spawning
function spawnEnemy(type, x, y, opts = {}) {
  const d = ENEMIES[type];
  const S = G.S;
  const scale = S.diff * (1 + G.t / 95);
  const elite = !!opts.elite;
  const k = elite ? 1.45 : 1;
  const e = {
    id: nextId++, type, frame: 'mon_' + type, x, y, h: d.h * k, r: d.r * k, col: d.col,
    hp: d.hp * scale * (elite ? 9 : 1), spd: d.spd * (1 + Math.min(0.35, G.t / 600)) * (elite ? 0.85 : 1),
    dmg: d.dmg * (1 + (S.diff - 1) * 0.35) * (elite ? 1.5 : 1), xp: d.xp * (elite ? 12 : 1),
    ranged: d.ranged, split: d.split, elite, flash: 0, hitT: 0, orbCd: 0, shootT: rand(1, 2.5), kx: 0, ky: 0, age: 0, face: 1,
  };
  e.maxHp = e.hp;
  G.en.push(e);
  return e;
}
const viewRadius = () => Math.hypot(W, H) / ZOOM / 2 + 50;
function spawnAround(type, n, opts) {
  const p = G.p, R = viewRadius();
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), d = R + rand(0, 120);
    spawnEnemy(type, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, opts);
  }
}
function spawnBoss() {
  const key = G.S.boss, def = BOSSES[key];
  const p = G.p, a = rand(0, TAU), d = Math.min(W, H) / ZOOM / 2 + 100;
  const hpMul = 0.75 + G.p.dmg * G.p.dmgMul / 20; // soft-scale with player strength
  const b = {
    id: nextId++, type: 'boss', boss: true, def, frame: 'mon_boss_' + key, x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d,
    h: def.h, r: def.r, col: def.col, hp: def.hp * hpMul, spd: def.spd, dmg: def.dmg,
    xp: 0, flash: 0, hitT: 0, orbCd: 0, kx: 0, ky: 0, age: 0, face: 1,
    atkT: 3, atkI: 0, dash: 0, tele: 0, spiral: 0, spiralA: 0, spiralT: 0, dvx: 0, dvy: 0,
  };
  b.maxHp = b.hp;
  G.en.push(b);
  G.boss = b; G.bossSpawned = true;
  $('bossName').textContent = def.name;
  $('bossImg').src = uiImg('mon_boss_' + key);
  $('bossBar').classList.remove('hidden');
  banner('BOSS GELİYOR!', true);
  sfx('boss', 0); vibrate([60, 40, 60]);
  G.shake = 14;
}
function updateSpawning(dt) {
  const S = G.S, cap = 230;
  if (!G.bossSpawned && G.t >= S.dur) spawnBoss();
  const rate = (1.5 + G.t / 18) * Math.sqrt(S.diff) * (G.bossSpawned ? 0.35 : 1);
  G.spawnT -= dt;
  if (G.spawnT <= 0 && G.en.length < cap) {
    G.spawnT = 1 / rate;
    spawnAround(pick(S.pool), Math.random() < 0.25 ? 3 : 1);
  }
  if (!G.bossSpawned) {
    G.waveT -= dt;
    if (G.waveT <= 0) {
      G.waveT = 42;
      const p = G.p, n = 18 + Math.floor(G.t / 10), R = Math.min(W, H) / ZOOM * 0.55 + 60, type = S.pool[0];
      for (let i = 0; i < n && G.en.length < cap + 40; i++) {
        const a = i / n * TAU;
        spawnEnemy(type, p.x + Math.cos(a) * R, p.y + Math.sin(a) * R);
      }
      banner('SÜRÜ GELİYOR!', true);
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
  e.hp -= dmg; e.flash = 0.1; e.hitT = 0.12;
  if (!e.boss) { e.kx += kx; e.ky += ky; }
  if (G.txt.length < 70) G.txt.push({ x: e.x + rand(-8, 8), y: e.y - e.h * 0.45, v: Math.round(dmg), life: 0.75, crit });
  if (e.hp <= 0) killEnemy(e);
  else sfx('hit', 0.05);
}
function killEnemy(e) {
  e.dead = true;
  G.kills++;
  puff(e.x, e.y, e.h * (e.boss ? 1.6 : 1));
  confetti(e.x, e.y, e.col, e.boss ? 40 : e.elite ? 18 : 7);
  if (G.decals.length > 70) G.decals.shift();
  G.decals.push({ x: e.x, y: e.y + e.h * 0.3, f: 'splat_' + (e.id % 4), col: e.col, h: e.h * 1.1, rot: rand(0, TAU), life: 9 });
  sfx('kill', 0.04);
  if (e.boss) { G.shake = 24; winRun(); return; }
  if (e.xp > 0) dropOrb(e.x, e.y, 'xp', e.xp);
  const coinChance = e.elite ? 1 : 0.07 + G.stage * 0.01;
  if (Math.random() < coinChance) dropOrb(e.x + rand(-8, 8), e.y + rand(-8, 8), 'coin', e.elite ? 25 + G.stage * 10 : 1 + Math.floor(G.stage / 2));
  if (e.elite || Math.random() < 0.006) dropOrb(e.x + 10, e.y, 'heart', 30);
  if (e.split) for (let i = 0; i < 2; i++) spawnEnemy('mini', e.x + rand(-12, 12), e.y + rand(-12, 12));
}
function dropOrb(x, y, kind, v) {
  if (kind === 'xp' && G.orbs.length > 320) {
    const o = G.orbs[Math.floor(Math.random() * G.orbs.length)];
    if (o.kind === 'xp') { o.v += v; return; }
  }
  G.orbs.push({ x, y, kind, v, vx: rand(-70, 70), vy: rand(-70, 70), pull: false, ph: rand(0, TAU) });
}
function puff(x, y, size) {
  if (G.fx.length > 450) return;
  G.fx.push({ k: 'puff', x, y, s: size * 0.6, S: size * 1.5, life: 0.45, max: 0.45, rot: rand(0, TAU) });
}
function confetti(x, y, col, n, spd = 260) {
  for (let i = 0; i < n && G.fx.length < 450; i++) {
    const a = rand(0, TAU), s = rand(spd * 0.3, spd);
    G.fx.push({ k: 'dot', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, life: rand(0.35, 0.65), max: 0.65, col, r: rand(3, 6) });
  }
}
function spark(x, y, col = '#ffffff', size = 26) {
  if (G.fx.length > 450) return;
  G.fx.push({ k: 'spark', x, y, s: size, life: 0.12, max: 0.12, col, rot: rand(0, TAU) });
}
function hurtPlayer(dmg) {
  const p = G.p;
  if (p.inv > 0 || G.ended) return;
  dmg = Math.max(1, dmg - p.armor);
  p.hp -= dmg; p.inv = 0.6;
  G.shake = Math.max(G.shake, 9);
  sfx('hurt', 0.1); vibrate(40);
  confetti(p.x, p.y, '#ff5a6e', 8, 200);
  G.txt.push({ x: p.x, y: p.y - 34, v: '-' + Math.round(dmg), life: 0.9, hurt: true });
  if (p.hp <= 0) { p.hp = 0; loseRun(); }
}
function fireBullet(x, y, ang, dmgMul = 1, isDrone = false) {
  const p = G.p;
  const spd = 560 * p.bspd * p.bspdMul;
  const crit = Math.random() < p.crit;
  G.bul.push({
    x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, ang, r: isDrone ? 5 : 6,
    dmg: p.dmg * p.dmgMul * dmgMul * (crit ? 2 : 1), crit, pierce: isDrone ? 0 : p.pierce,
    life: 0.85 * p.bspdMul, hits: [], drone: isDrone,
  });
}

// ---------------------------------------------------------------- update
function update(dt) {
  const p = G.p;
  if (G.hitStop > 0) { G.hitStop -= dt; return; }
  G.t += dt;

  const iv = inputVec();
  const spd = p.spd * p.spdMul;
  p.x += iv.x * spd * dt; p.y += iv.y * spd * dt;
  p.moving = Math.hypot(iv.x, iv.y);
  if (p.moving > 0.1) p.walk += dt * 14;
  if (p.regen) p.hp = Math.min(p.maxHp, p.hp + p.regen * dt);
  if (p.inv > 0) p.inv -= dt;
  if (p.recoil > 0) p.recoil = Math.max(0, p.recoil - dt * 8);
  if (p.flashT > 0) p.flashT -= dt;

  updateSpawning(dt);

  // auto-fire at the nearest enemy
  const range = 470 * p.bspd * p.bspdMul * 0.95;
  const target = nearestEnemy(p.x, p.y, range);
  if (target) p.aim = Math.atan2(target.y - p.y, target.x - p.x);
  else if (p.moving > 0.1) p.aim = Math.atan2(iv.y, iv.x);
  p.face = Math.cos(p.aim) < 0 ? -1 : 1;
  p.fireT -= dt;
  if (p.fireT <= 0 && target) {
    p.fireT = 1 / (p.rate * p.rateMul);
    const n = p.shots + p.extraShots, gap = p.gap;
    const mx = p.x + Math.cos(p.aim) * (p.gun.len + 12), my = p.y + 6 + Math.sin(p.aim) * (p.gun.len + 12);
    for (let i = 0; i < n; i++) fireBullet(mx, my, p.aim + (i - (n - 1) / 2) * gap);
    p.recoil = 1; p.flashT = 0.06;
    sfx('shoot', 0.07);
  }

  if (p.drones) {
    p.droneT -= dt;
    if (p.droneT <= 0) {
      p.droneT = 0.55;
      for (let i = 0; i < p.drones; i++) {
        const dp = dronePos(i), t = nearestEnemy(dp.x, dp.y, 420);
        if (t) fireBullet(dp.x, dp.y, Math.atan2(t.y - dp.y, t.x - dp.x), 0.6, true);
      }
    }
  }
  if (p.nova) {
    p.novaT -= dt;
    if (p.novaT <= 0) {
      p.novaT = Math.max(1.4, 3.6 - p.nova * 0.4);
      const R = 110 + p.nova * 22, dmg = p.dmg * p.dmgMul * (1.4 + p.nova * 0.5);
      for (const e of G.en) {
        if (e.dead) continue;
        const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy);
        if (d < R + e.r) damageEnemy(e, dmg, false, dx / (d || 1) * 280, dy / (d || 1) * 280);
      }
      G.fx.push({ k: 'ring', x: p.x, y: p.y, s: 20, S: R * 2.3, life: 0.4, max: 0.4, col: p.accent });
      sfx('nova', 0.2);
    }
  }
  if (p.chain) {
    p.chainT -= dt;
    if (p.chainT <= 0) {
      p.chainT = Math.max(0.8, 2.4 - p.chain * 0.3);
      let from = { x: p.x, y: p.y };
      const used = new Set(), pts = [from], hops = 2 + p.chain;
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
        spark(best.x, best.y, '#bff3ff', 40);
        from = best;
      }
      if (pts.length > 1) { G.bolts.push({ pts, life: 0.2, seed: Math.floor(Math.random() * 1000) }); sfx('zap', 0.2); }
    }
  }

  G.orbitA += dt * 3.4;
  const orbR = 78, orbDmg = p.dmg * p.dmgMul * 0.9;

  for (const e of G.en) {
    if (e.dead) continue;
    e.age += dt;
    if (e.flash > 0) e.flash -= dt;
    if (e.hitT > 0) e.hitT -= dt;
    if (e.orbCd > 0) e.orbCd -= dt;
    const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;
    let mvx = dx / d, mvy = dy / d, sp = e.spd;
    if (e.boss) {
      updateBoss(e, dt, dx, dy, d);
      if (e.dash > 0 || e.tele > 0) sp = 0;
    } else if (e.ranged) {
      if (d < 230) { const ox = mvx; mvx = -mvx * 0.6 - mvy * 0.5; mvy = -mvy * 0.6 + ox * 0.5; }
      e.shootT -= dt;
      if (e.shootT <= 0 && d < 520) {
        e.shootT = rand(2, 3);
        const a = Math.atan2(dy, dx);
        G.ebul.push({ x: e.x, y: e.y, vx: Math.cos(a) * 210, vy: Math.sin(a) * 210, r: 8, dmg: e.dmg, life: 4, col: e.col });
        e.hitT = 0.12;
      }
    }
    e.x += mvx * sp * dt + e.kx * dt;
    e.y += mvy * sp * dt + e.ky * dt;
    e.kx *= 0.86; e.ky *= 0.86;
    if (Math.abs(dx) > 4) e.face = dx < 0 ? -1 : 1;
    if (!e.boss && d > 1500) { const a = rand(0, TAU), R = viewRadius() + 20; e.x = p.x + Math.cos(a) * R; e.y = p.y + Math.sin(a) * R; }
    if (d < e.r + p.r - 2) hurtPlayer(e.dmg);
    if (p.orbit && e.orbCd <= 0 && Math.abs(d - orbR) < e.r + 14) {
      const ea = Math.atan2(-dy, -dx);
      for (let i = 0; i < p.orbit; i++) {
        let da = Math.abs(((ea - (G.orbitA + i / p.orbit * TAU)) % TAU + TAU) % TAU);
        if (da > Math.PI) da = TAU - da;
        if (da * orbR < e.r + 14) { damageEnemy(e, orbDmg, false, -dx / d * 150, -dy / d * 150); e.orbCd = 0.35; break; }
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
  for (const b of G.bul) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.life <= 0) { b.dead = true; continue; }
    for (const e of G.en) {
      if (e.dead) continue;
      const dx = e.x - b.x, dy = e.y - b.y, rr = e.r + b.r;
      if (dx * dx + dy * dy < rr * rr && b.hits.indexOf(e.id) < 0) {
        b.hits.push(e.id);
        const sp = Math.hypot(b.vx, b.vy);
        spark(b.x, b.y, b.crit ? '#ffd84a' : '#ffffff', b.crit ? 44 : 30);
        damageEnemy(e, b.dmg, b.crit, b.vx / sp * 90, b.vy / sp * 90);
        if (b.pierce-- <= 0) { b.dead = true; break; }
      }
    }
  }
  for (const b of G.ebul) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.life <= 0) { b.dead = true; continue; }
    const dx = p.x - b.x, dy = p.y - b.y, rr = p.r + b.r - 3;
    if (dx * dx + dy * dy < rr * rr) { b.dead = true; hurtPlayer(b.dmg); }
  }
  const mag = p.magnet;
  for (const o of G.orbs) {
    const dx = p.x - o.x, dy = p.y - o.y, d = Math.hypot(dx, dy) || 1;
    if (d < mag || o.pull) {
      o.pull = true;
      const s = 520 + (mag - Math.min(d, mag)) * 4;
      o.x += dx / d * s * dt; o.y += dy / d * s * dt;
    } else { o.x += o.vx * dt; o.y += o.vy * dt; o.vx *= 0.9; o.vy *= 0.9; }
    if (d < p.r + 10) {
      o.dead = true;
      if (o.kind === 'xp') { p.xp += o.v * p.xpMul; sfx('pickup', 0.05); }
      else if (o.kind === 'coin') { G.coins += Math.round(o.v * p.coinMul); sfx('coin', 0.05); }
      else if (o.kind === 'heart') { p.hp = Math.min(p.maxHp, p.hp + o.v); sfx('level', 0.2); G.txt.push({ x: p.x, y: p.y - 34, v: '+' + o.v, life: 0.9, heal: true }); }
    }
  }
  while (p.xp >= p.next) { p.xp -= p.next; p.lvl++; p.next = xpNeed(p.lvl); G.pending++; }

  for (const f of G.fx) {
    f.life -= dt;
    if (f.k === 'dot') { f.x += f.vx * dt; f.y += f.vy * dt; f.vx *= 0.9; f.vy = f.vy * 0.9 + 500 * dt; }
  }
  for (const t of G.txt) { t.life -= dt; t.y -= 34 * dt; }
  for (const b of G.bolts) b.life -= dt;
  for (const d of G.decals) d.life -= dt;
  G.en = G.en.filter(e => !e.dead);
  G.bul = G.bul.filter(b => !b.dead);
  G.ebul = G.ebul.filter(b => !b.dead);
  G.orbs = G.orbs.filter(o => !o.dead);
  G.fx = G.fx.filter(f => f.life > 0);
  G.txt = G.txt.filter(t => t.life > 0);
  G.bolts = G.bolts.filter(b => b.life > 0);
  G.decals = G.decals.filter(d => d.life > 0);
  if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 40);

  // camera with a little look-ahead in the move direction
  const tx = p.x + iv.x * 40, ty = p.y + iv.y * 40;
  G.cam.x += (tx - G.cam.x) * Math.min(1, dt * 6);
  G.cam.y += (ty - G.cam.y) * Math.min(1, dt * 6);

  if (G.pending > 0 && !G.ended) openLevelUp();
}

function updateBoss(e, dt, dx, dy, d) {
  const def = e.def, st = G.stage;
  if (e.tele > 0) {
    e.tele -= dt;
    if (e.tele <= 0) { e.dash = 0.55; const s = 520; e.dvx = dx / d * s; e.dvy = dy / d * s; }
  } else if (e.dash > 0) {
    e.dash -= dt; e.x += e.dvx * dt; e.y += e.dvy * dt;
    if (Math.random() < 0.4) puff(e.x, e.y + e.h * 0.4, 30);
  }
  if (e.spiral > 0) {
    e.spiral -= dt; e.spiralT -= dt;
    while (e.spiralT <= 0) {
      e.spiralT += 0.07; e.spiralA += 0.42;
      for (let k = 0; k < 2; k++) {
        const a = e.spiralA + k * Math.PI;
        G.ebul.push({ x: e.x, y: e.y, vx: Math.cos(a) * 170, vy: Math.sin(a) * 170, r: 8, dmg: e.dmg * 0.6, life: 5, col: e.col });
      }
    }
  }
  e.atkT -= dt;
  if (e.atkT <= 0) {
    const enraged = e.hp < e.maxHp * 0.4;
    e.atkT = Math.max(1.3, 3 - st * 0.2) * (enraged ? 0.7 : 1);
    const atk = def.atk[e.atkI++ % def.atk.length];
    e.hitT = 0.2;
    if (atk === 'ring') {
      const n = 16 + st * 3 + (enraged ? 8 : 0), off = rand(0, TAU);
      for (let i = 0; i < n; i++) {
        const a = off + i / n * TAU;
        G.ebul.push({ x: e.x, y: e.y, vx: Math.cos(a) * 180, vy: Math.sin(a) * 180, r: 8, dmg: e.dmg * 0.6, life: 5, col: e.col });
      }
    } else if (atk === 'summon') {
      const type = G.S.pool[0], n = 6 + st * 2;
      for (let i = 0; i < n; i++) { const a = i / n * TAU; spawnEnemy(type, e.x + Math.cos(a) * 80, e.y + Math.sin(a) * 80); }
    } else if (atk === 'dash') e.tele = 0.75;
    else if (atk === 'spiral') { e.spiral = 2.2; e.spiralT = 0; }
  }
}
function dronePos(i) {
  const p = G.p, a = G.t * 1.6 + i / Math.max(1, p.drones) * TAU;
  return { x: p.x + Math.cos(a) * 48, y: p.y - 10 + Math.sin(a) * 30 };
}

// ---------------------------------------------------------------- level up
let offered = [];
function rollUpgrades() {
  const p = G.p;
  const pool = UPGRADES.filter(u => (p.upg[u.id] || 0) < u.max);
  const out = [];
  while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  if (!out.length) out.push(
    { id: '_heal', icon: 'heart', bg: '#ffd6dc', name: 'Ziyafet', desc: 'Tüm canı doldur', max: 99, apply: q => { q.hp = q.maxHp; } },
    { id: '_gold', icon: 'coin', bg: '#fff0c2', name: 'Hazine', desc: '+50 altın', max: 99, apply: () => { G.coins += 50; } });
  return out;
}
function openLevelUp() {
  state = 'levelup'; joy = null;
  sfx('level', 0);
  offered = rollUpgrades();
  renderLevelUp();
  show('levelup');
}
function renderLevelUp() {
  const list = $('upgList'); list.innerHTML = '';
  const p = G.p;
  offered.forEach(u => {
    const lv = p.upg[u.id] || 0;
    const card = el(`<button class="card upg">${badge(u.icon, u.bg)}
      <div class="body"><div class="t">${u.name}${lv === 0 && u.max < 99 ? '<span class="new">YENİ</span>' : ''}</div>
      <div class="d">${u.desc}</div>${u.max < 99 ? pips(lv, u.max, true) : ''}</div></button>`);
    card.onclick = () => chooseUpgrade(u);
    list.appendChild(card);
  });
  const rb = $('rerollBtn');
  rb.textContent = 'YENİLE (' + G.rerolls + ')';
  rb.disabled = G.rerolls <= 0;
}
$('rerollBtn').onclick = () => { if (G && G.rerolls > 0) { G.rerolls--; sfx('click'); offered = rollUpgrades(); renderLevelUp(); } };
function chooseUpgrade(u) {
  if (state !== 'levelup') return;
  const p = G.p;
  u.apply(p);
  p.upg[u.id] = (p.upg[u.id] || 0) + 1;
  G.pending--;
  confetti(p.x, p.y, '#ffd84a', 24, 320);
  G.fx.push({ k: 'ring', x: p.x, y: p.y, s: 20, S: 180, life: 0.5, max: 0.5, col: '#ffd84a' });
  sfx('click');
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
  for (const u of UPGRADES) if (G.p.upg[u.id]) chips.appendChild(el(`<span><i style="background:${u.bg}"><img src="${uiImg(u.icon)}" alt=""></i>${u.name} ${G.p.upg[u.id]}</span>`));
  show('pause');
}
function resumeGame() { state = 'play'; show(null); last = performance.now(); }
$('pauseBtn').addEventListener('click', e => { e.stopPropagation(); sfx('click'); pauseGame(); });
$('resumeBtn').onclick = () => { sfx('click'); resumeGame(); };
$('quitBtn').onclick = () => { endRun(false, true); };
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });

function winRun() { if (!G.ended) { const run = G; sfx('win', 0); G.ended = true; setTimeout(() => { if (G === run) endRun(true); }, 1400); } }
function loseRun() { if (!G.ended) { const run = G; G.ended = true; G.hitStop = 0.4; setTimeout(() => { if (G === run) endRun(false); }, 1000); } }
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
  t.textContent = win ? 'ZAFER!' : quit ? 'GÖREV İPTAL' : 'YENİLDİN';
  t.className = 'ribbon ' + (win ? 'win' : 'lose');
  $('overHero').src = uiImg('hero_' + G.p.c.hero);
  $('rTime').textContent = fmtTime(G.t);
  $('rKills').textContent = G.kills;
  $('rLevel').textContent = G.p.lvl;
  $('rCoins').textContent = '+' + earned;
  const lastStage = G.stage === STAGES.length - 1;
  $('overNote').textContent = win ? (lastStage ? 'Tüm bölümleri bitirdin!' : 'Zafer bonusu +' + bonus + ' altın. Yeni bölüm açıldı!')
    : 'Altınlarını geliştirmelere harca ve tekrar dene!';
  $('nextBtn').classList.toggle('hidden', !(win && !lastStage));
  show('over');
}
$('againBtn').onclick = () => { sfx('click'); startRun(G.stage); };
$('nextBtn').onclick = () => { sfx('click'); startRun(Math.min(STAGES.length - 1, G.stage + 1)); };
$('menuBtn').onclick = () => { sfx('click'); G = null; state = 'menu'; show('menu'); };

// ---------------------------------------------------------------- world rendering
const CHUNK = 220;
const chunkCache = new Map();
function chunkDecor(biome, cx, cy) {
  const key = biome + cx + ',' + cy;
  let list = chunkCache.get(key);
  if (list) return list;
  list = [];
  const names = ATLAS.decor[biome];
  const n = hash(cx, cy, 7) < 0.55 ? 1 : hash(cx, cy, 8) < 0.5 ? 2 : 0;
  for (let i = 0; i < n; i++) {
    const name = names[Math.floor(hash(cx, cy, 11 + i) * names.length)];
    const f = AF[name];
    const x = cx * CHUNK + hash(cx, cy, 21 + i) * CHUNK, y = cy * CHUNK + hash(cx, cy, 31 + i) * CHUNK;
    if (Math.abs(x) < 120 && Math.abs(y) < 120) continue; // keep the spawn point clear
    const tall = f[3] > 80;
    const h = tall ? f[3] * 0.62 : f[3] * 0.7;
    list.push({ name, x, y, h, w: f[2] * h / f[3], tall, flip: hash(cx, cy, 41 + i) < 0.5 });
  }
  if (chunkCache.size > 600) chunkCache.clear();
  chunkCache.set(key, list);
  return list;
}
function drawGround(biome, x0, y0, x1, y1) {
  const T = 64;
  for (let ty = Math.floor(y0 / T); ty * T < y1; ty++) {
    for (let tx = Math.floor(x0 / T); tx * T < x1; tx++) {
      const v = hash(tx, ty, 3);
      const f = AF['tile_' + biome + '_' + (v < 0.7 ? 0 : v < 0.8 ? 1 : v < 0.9 ? 2 : 3)];
      ctx.drawImage(atlasImg, f[0] + 0.5, f[1] + 0.5, f[2] - 1, f[3] - 1, tx * T, ty * T, T + 0.6, T + 0.6);
    }
  }
}
const DL = []; // y-sorted draw list: k 0 decor, 1 enemy, 2 player, 3 menu mob
function pushDL(y, k, o) { DL.push({ y, k, o }); }
function drawDecorItem(d) {
  if (d.tall) shadow(d.x, d.y, d.w * 0.32, 0.18);
  const f = AF[d.name];
  ctx.save(); ctx.translate(d.x, d.y); if (d.flip) ctx.scale(-1, 1);
  ctx.drawImage(atlasImg, f[0], f[1], f[2], f[3], -d.w / 2, -d.h, d.w, d.h);
  ctx.restore();
}
function drawEnemy(e, t) {
  const pop = e.age < 0.3 ? easeOutBack(e.age / 0.3) : 1;
  const wob = Math.sin(t * 11 + e.id * 1.7);
  let sx = 1 + wob * 0.05, sy = 1 - wob * 0.05;
  if (e.hitT > 0) { const k = e.hitT / 0.12; sx += 0.18 * k; sy -= 0.16 * k; }
  if (e.boss && e.tele > 0) { const k = Math.sin(t * 40) * 0.05; sx += k; sy -= k; }
  const h = e.h * pop;
  shadow(e.x, e.y + e.h * 0.42, e.r * 1.25);
  if (e.elite) {
    ctx.strokeStyle = '#ffcd40'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.ellipse(e.x, e.y + e.h * 0.42, e.r * 1.5, e.r * 0.5, 0, 0, TAU); ctx.stroke();
  }
  const rot = wob * 0.06;
  const cy = e.y + (1 - sy) * h * 0.5; // squash towards the feet
  drawF(e.frame, e.x, cy, h, rot, e.face < 0, sx, sy);
  if (e.flash > 0) {
    ctx.globalAlpha = Math.min(1, e.flash / 0.1) * 0.85;
    const c = tinted(e.frame, '#ffffff'), s = h / c.height, w = c.width * s * sx, hh = h * sy;
    ctx.save(); ctx.translate(e.x, cy); ctx.rotate(rot); if (e.face < 0) ctx.scale(-1, 1);
    ctx.drawImage(c, -w / 2, -hh / 2, w, hh); ctx.restore();
    ctx.globalAlpha = 1;
  }
  if (e.elite) drawF('star', e.x, e.y - e.h * 0.62, 18, Math.sin(t * 3) * 0.3);
  if ((e.elite || e.type === 'brute') && e.hp < e.maxHp && !e.boss) {
    const w = e.r * 2.2, y = e.y - e.h * 0.62 - (e.elite ? 14 : 0);
    ctx.fillStyle = OUTLINE; ctx.fillRect(e.x - w / 2 - 2, y - 2, w + 4, 8);
    ctx.fillStyle = '#ff5a6e'; ctx.fillRect(e.x - w / 2, y, w * Math.max(0, e.hp / e.maxHp), 4);
  }
}
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function drawGun(p) {
  const g = p.gun, L = g.len, back = -p.recoil * 7;
  ctx.save();
  ctx.translate(p.x + Math.cos(p.aim) * 10, p.y + 6 + Math.sin(p.aim) * 6);
  ctx.rotate(p.aim);
  if (Math.cos(p.aim) < 0) ctx.scale(1, -1);
  ctx.translate(back, 0);
  ctx.lineWidth = 3; ctx.strokeStyle = OUTLINE; ctx.lineJoin = 'round';
  ctx.fillStyle = g.acc; roundRect(4, 1, 8, 12, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = g.acc; roundRect(L - 6, -3.5, 12, 7, 2); ctx.fill(); ctx.stroke();
  if (p.c.gun === 'shotgun') { roundRect(L - 6, 1, 12, 5, 2); ctx.fill(); ctx.stroke(); }
  ctx.fillStyle = g.body; roundRect(-2, -6, L, 12, 5); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; roundRect(2, -4, L - 10, 3, 1.5); ctx.fill();
  if (p.c.gun === 'smg') { ctx.fillStyle = g.acc; roundRect(L * 0.45, 4, 6, 12, 2); ctx.fill(); ctx.stroke(); }
  if (p.c.gun === 'rifle') { ctx.fillStyle = OUTLINE; roundRect(L * 0.35, -12, 14, 6, 3); ctx.fill(); }
  ctx.restore();
}
function drawPlayer(p, t) {
  const moving = p.moving > 0.1;
  const bob = moving ? Math.abs(Math.sin(p.walk)) * 5 : Math.sin(t * 3) * 1.2;
  const sq = moving ? 1 + Math.sin(p.walk * 2) * 0.04 : 1 + Math.sin(t * 3) * 0.02;
  shadow(p.x, p.y + 22, 20 * (1 - bob * 0.02));
  ctx.strokeStyle = p.accent; ctx.lineWidth = 3; ctx.globalAlpha = 0.9;
  ctx.beginPath(); ctx.ellipse(p.x, p.y + 22, 27, 10, 0, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
  if (p.drones) for (let i = 0; i < p.drones; i++) { const d = dronePos(i); if (d.y < p.y) drawDrone(d, t, i); }
  const blink = p.inv > 0 && Math.floor(t * 20) % 2 === 0;
  if (!blink) {
    const gunBehind = Math.sin(p.aim) < -0.35;
    if (gunBehind) drawGun(p);
    drawF(p.hero, p.x, p.y - bob, 48, Math.sin(p.walk) * (moving ? 0.08 : 0), p.face < 0, 1 / sq, sq);
    if (!gunBehind) drawGun(p);
    if (p.flashT > 0) {
      const L = p.gun.len + 16;
      ctx.globalCompositeOperation = 'lighter';
      drawT('fx_muzzle', '#ffd84a', p.x + Math.cos(p.aim) * L, p.y + 6 + Math.sin(p.aim) * L, 34, p.aim + Math.PI / 2);
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  if (p.drones) for (let i = 0; i < p.drones; i++) { const d = dronePos(i); if (d.y >= p.y) drawDrone(d, t, i); }
}
function drawDrone(d, t, i) {
  shadow(d.x, d.y + 30, 8, 0.15);
  drawF('star', d.x, d.y + Math.sin(t * 6 + i) * 3, 24, t * 4);
}
function drawBlade(x, y, a, col) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(a);
  ctx.beginPath();
  for (let i = 0; i < 8; i++) { const r = i % 2 ? 5 : 15, q = i / 8 * TAU; ctx.lineTo(Math.cos(q) * r, Math.sin(q) * r); }
  ctx.closePath();
  ctx.fillStyle = '#eef3f8'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = OUTLINE; ctx.stroke();
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, 4, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.restore();
}
function drawBullet(b) {
  ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.ang);
  const L = b.drone ? 10 : b.crit ? 20 : 15, R = b.drone ? 3.5 : b.crit ? 5.5 : 4.5;
  ctx.fillStyle = b.drone ? '#ffe680' : b.crit ? '#ff7a3b' : '#ffd84a';
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2.5;
  roundRect(-L / 2, -R, L, R * 2, R); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; roundRect(-L / 2 + 3, -R + 1.5, L - 7, 2, 1); ctx.fill();
  ctx.restore();
}
function drawEBullet(b, t) {
  const r = b.r * (1 + Math.sin(t * 14 + b.x) * 0.08);
  ctx.fillStyle = b.col; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath(); ctx.arc(b.x - r * 0.3, b.y - r * 0.35, r * 0.3, 0, TAU); ctx.fill();
}

function renderWorld(t) {
  const p = G.p, S = G.S;
  const sx = G.shake ? rand(-G.shake, G.shake) : 0, sy = G.shake ? rand(-G.shake, G.shake) : 0;
  const k = DPR * ZOOM;
  ctx.setTransform(k, 0, 0, k, cv.width / 2 - G.cam.x * k + sx * DPR, cv.height / 2 - G.cam.y * k + sy * DPR);
  const vw = W / ZOOM / 2 + 40, vh = H / ZOOM / 2 + 40;
  const x0 = G.cam.x - vw, x1 = G.cam.x + vw, y0 = G.cam.y - vh, y1 = G.cam.y + vh;
  drawGround(S.biome, x0, y0, x1, y1);

  for (const d of G.decals) {
    ctx.globalAlpha = Math.min(1, d.life / 2) * 0.45;
    drawT(d.f, d.col, d.x, d.y, d.h * 0.5, d.rot, 1, 0.6);
  }
  ctx.globalAlpha = 1;

  DL.length = 0;
  for (let cy = Math.floor((y0 - 40) / CHUNK); cy * CHUNK < y1 + 200; cy++) {
    for (let cx = Math.floor((x0 - 100) / CHUNK); cx * CHUNK < x1 + 100; cx++) {
      for (const d of chunkDecor(S.biome, cx, cy)) {
        if (d.tall) pushDL(d.y, 0, d); else drawDecorItem(d);
      }
    }
  }
  for (const o of G.orbs) {
    if (o.x < x0 || o.x > x1 || o.y < y0 || o.y > y1) continue;
    const by = Math.sin(t * 5 + o.ph) * 3;
    shadow(o.x, o.y + 10, 7, 0.18);
    if (o.kind === 'xp') drawF(o.v >= 20 ? 'gem_red' : o.v >= 5 ? 'gem_blue' : 'gem_green', o.x, o.y - 2 + by, o.v >= 20 ? 26 : o.v >= 5 ? 22 : 17);
    else if (o.kind === 'coin') drawF('coin', o.x, o.y - 2 + by, 20, 0, false, Math.abs(Math.cos(t * 4 + o.ph)) * 0.8 + 0.2, 1);
    else drawF('heart', o.x, o.y - 2 + by, 24);
  }
  if (G.boss && !G.boss.dead && G.boss.tele > 0) {
    const b = G.boss;
    ctx.strokeStyle = 'rgba(255,60,70,0.35)'; ctx.lineWidth = b.r * 1.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x + (p.x - b.x) * 1.2, b.y + (p.y - b.y) * 1.2); ctx.stroke();
    ctx.lineCap = 'butt';
  }
  for (const e of G.en) {
    if (e.x < x0 - 80 || e.x > x1 + 80 || e.y < y0 - 80 || e.y > y1 + 120) continue;
    pushDL(e.y + e.h * 0.42, 1, e);
  }
  pushDL(p.y + 22, 2, p);
  DL.sort((a, b) => a.y - b.y);
  for (const d of DL) {
    if (d.k === 0) drawDecorItem(d.o);
    else if (d.k === 1) drawEnemy(d.o, t);
    else drawPlayer(d.o, t);
  }
  for (let i = 0; i < p.orbit; i++) {
    const a = G.orbitA + i / p.orbit * TAU;
    drawBlade(p.x + Math.cos(a) * 78, p.y + Math.sin(a) * 78, a * 4, p.accent);
  }
  for (const b of G.bul) drawBullet(b);
  for (const b of G.ebul) drawEBullet(b, t);
  for (const f of G.fx) {
    const a = Math.max(0, f.life / f.max), q = 1 - a;
    if (f.k === 'dot') {
      ctx.fillStyle = f.col; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.4 + a * 0.6), 0, TAU); ctx.fill(); ctx.stroke();
    } else if (f.k === 'puff') {
      ctx.globalAlpha = a * 0.9;
      drawT('fx_smoke', '#ffffff', f.x, f.y, f.s + (f.S - f.s) * (1 - a * a), f.rot + q);
      ctx.globalAlpha = 1;
    } else if (f.k === 'ring') {
      ctx.globalAlpha = a; ctx.globalCompositeOperation = 'lighter';
      drawT('fx_ring2', f.col, f.x, f.y, f.s + (f.S - f.s) * Math.sqrt(q));
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    } else if (f.k === 'spark') {
      ctx.globalCompositeOperation = 'lighter';
      drawT('fx_spark', f.col, f.x, f.y, f.s * (0.6 + a * 0.6), f.rot);
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  for (const b of G.bolts) {
    ctx.globalAlpha = Math.min(1, b.life / 0.12);
    const pts = [];
    for (let i = 0; i < b.pts.length; i++) {
      pts.push(b.pts[i]);
      if (i < b.pts.length - 1) {
        const A = b.pts[i], C = b.pts[i + 1];
        pts.push({ x: (A.x + C.x) / 2 + (hash(i, b.seed, 1) - 0.5) * 30, y: (A.y + C.y) / 2 + (hash(i, b.seed, 2) - 0.5) * 30 });
      }
    }
    for (const [w, c] of [[9, OUTLINE], [6, '#5fd7ff'], [2.5, '#ffffff']]) {
      ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (const q of pts) ctx.lineTo(q.x, q.y); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  for (const tx of G.txt) {
    const age = (tx.heal || tx.hurt ? 0.9 : 0.75) - tx.life;
    const pop = age < 0.12 ? 1 + (0.12 - age) * 6 : 1;
    const size = (tx.crit ? 24 : tx.hurt || tx.heal ? 20 : 16) * pop;
    ctx.globalAlpha = Math.min(1, tx.life * 4);
    ctx.font = FONT.replace('800 ', `800 ${size}px `);
    ctx.lineWidth = 5; ctx.strokeStyle = OUTLINE;
    const s = tx.crit ? tx.v + '!' : String(tx.v);
    ctx.strokeText(s, tx.x, tx.y);
    ctx.fillStyle = tx.heal ? '#53e07f' : tx.hurt ? '#ff5a6e' : tx.crit ? '#ffd84a' : '#ffffff';
    ctx.fillText(s, tx.x, tx.y);
  }
  ctx.globalAlpha = 1;

  // screen space
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (vignette) ctx.drawImage(vignette, 0, 0, W, H);
  if (G.boss && !G.boss.dead) {
    const b = G.boss, bx = (b.x - G.cam.x) * ZOOM + W / 2, by = (b.y - G.cam.y) * ZOOM + H / 2;
    if (bx < 0 || bx > W || by < 0 || by > H) {
      const a = Math.atan2(by - H / 2, bx - W / 2);
      const ax = clamp(bx, 34, W - 34), ay = clamp(by, 220, H - 34);
      ctx.save(); ctx.translate(ax, ay); ctx.rotate(a);
      ctx.fillStyle = '#ff5a6e'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 3; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(20, 0); ctx.lineTo(-10, 14); ctx.lineTo(-10, -14); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  }
  if (joy && state === 'play') {
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.strokeStyle = 'rgba(43,47,58,0.5)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(joy.ox, joy.oy, JOY_R, 0, TAU); ctx.fill(); ctx.stroke();
    const dx = joy.x - joy.ox, dy = joy.y - joy.oy, d = Math.hypot(dx, dy), m = Math.min(d, JOY_R);
    const kx = d ? joy.ox + dx / d * m : joy.ox, ky = d ? joy.oy + dy / d * m : joy.oy;
    ctx.beginPath(); ctx.arc(kx, ky + 3, 26, 0, TAU); ctx.fillStyle = 'rgba(43,47,58,0.4)'; ctx.fill();
    ctx.beginPath(); ctx.arc(kx, ky, 26, 0, TAU); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.strokeStyle = OUTLINE; ctx.stroke();
  }
  if (p.hp / p.maxHp < 0.3 && !G.finished) {
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    g.addColorStop(0, 'rgba(255,40,60,0)'); g.addColorStop(1, `rgba(255,40,60,${0.28 + Math.sin(t * 6) * 0.1})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
}

// menu background: a living diorama of the furthest unlocked biome
const menuMobs = Array.from({ length: 9 }, (_, i) => ({ type: ['mite', 'runner', 'splitter', 'spitter', 'brute', 'mite', 'runner', 'mini', 'mite'][i], x: rand(-300, 300), y: rand(-500, 500), vx: rand(-30, 30), vy: rand(-30, 30), ph: rand(0, 6) }));
function renderMenuScene(t) {
  const biome = STAGES[clamp(save.unlocked, 1, STAGES.length) - 1].biome;
  const k = DPR * ZOOM, camx = Math.sin(t * 0.05) * 200, camy = t * 12;
  ctx.setTransform(k, 0, 0, k, cv.width / 2 - camx * k, cv.height / 2 - camy * k);
  const vw = W / ZOOM / 2 + 40, vh = H / ZOOM / 2 + 40;
  const x0 = camx - vw, x1 = camx + vw, y0 = camy - vh, y1 = camy + vh;
  drawGround(biome, x0, y0, x1, y1);
  DL.length = 0;
  for (let cy = Math.floor((y0 - 40) / CHUNK); cy * CHUNK < y1 + 200; cy++)
    for (let cx = Math.floor((x0 - 100) / CHUNK); cx * CHUNK < x1 + 100; cx++)
      for (const d of chunkDecor(biome, cx, cy)) { if (d.tall) pushDL(d.y, 0, d); else drawDecorItem(d); }
  for (const m of menuMobs) {
    m.x += m.vx / 60; m.y += m.vy / 60;
    if (m.y < y0 - 60) m.y += vh * 2 + 100; if (m.y > y1 + 60) m.y -= vh * 2 + 100;
    if (m.x < x0 - 60) m.x += vw * 2 + 100; if (m.x > x1 + 60) m.x -= vw * 2 + 100;
    pushDL(m.y + ENEMIES[m.type].h * 0.42, 3, m);
  }
  DL.sort((a, b) => a.y - b.y);
  for (const d of DL) {
    if (d.k === 0) { drawDecorItem(d.o); continue; }
    const m = d.o, e = ENEMIES[m.type], wob = Math.sin(t * 8 + m.ph);
    shadow(m.x, m.y + e.h * 0.42, e.r * 1.25);
    drawF('mon_' + m.type, m.x, m.y, e.h, wob * 0.06, m.vx < 0, 1 + wob * 0.05, 1 - wob * 0.05);
  }
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (vignette) ctx.drawImage(vignette, 0, 0, W, H);
}
function render(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#2fa866';
  ctx.fillRect(0, 0, cv.width, cv.height);
  if (!atlasImg.complete || !atlasImg.naturalWidth) return;
  if (G) renderWorld(G.t);
  else renderMenuScene(t);
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
  hud.lv.textContent = p.lvl;
  hud.time.textContent = remaining;
  hud.time.classList.toggle('boss', G.bossSpawned);
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
  render(now / 1000);
  updateHud();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
const fontReady = (document.fonts && document.fonts.load) ? document.fonts.load('800 20px "Baloo 2"').catch(() => {}) : Promise.resolve();
Promise.all([atlasReady, Promise.race([fontReady, new Promise(r => setTimeout(r, 1500))])]).then(() => {
  state = 'menu';
  show('menu');
});

// small hook for automated tests / balancing
window.SwarmSquad = { get G() { return G; }, get state() { return state; }, startRun, STAGES, UPGRADES, save };
})();
