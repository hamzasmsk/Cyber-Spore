// Economy simulation: node tools/economy-sim.js [json overrides]   e.g.  '{"paid":true}'  or  '{"hg":1.32,"hours":20}'
// Mirrors the formulas in game.js (enemy HP, gold, upgrade costs, weapons/stars, team, rebirth, gem sources); used to tune balance.
const A = JSON.parse(process.argv[2] || '{}');
const cfg = Object.assign({
  hg: 1.3, rg: 1.28, bossMul: 22, pc: 1.25, sc: 1.28, mcg: 1.2, ml: 0.15,
  team: [0, 800, 5e6, 5e11, 5e17], gunMult: [1, 2.5, 6, 15, 40, 110, 300, 900, 2500, 7000, 20000, 56000, 160000], gunCost: [0, 5, 15, 40, 100, 250, 600, 1500, 2000, 2800, 3800, 5000, 6500], starK: 0.35,
  bossGemsFirst: s => 3 + Math.floor(s / 4), bossGemsRepeat: s => 0, treasureP: 0.04, treasureGems: s => 1,
  rebGain: s => s >= 8 ? Math.floor(2 * Math.pow(1.18, s - 8)) : 0, rebPer: 0.3, rebGems: g => 5 + Math.min(60, Math.floor(Math.log2(g + 1) * 4)),
  dailyGemsPerHour: 4.5, hours: 10, paid: false, early: 0, earlyCap: 15, ex: 2.4, exCap: 8, rex: 1.691,   // early ramp (game.js EARLY_HP / EARLY_GOLD / EARLY_CAP) noGun: false,
}, A);
// allow overriding functions via strings
for (const k of ['bossGemsFirst', 'bossGemsRepeat', 'treasureGems', 'rebGain', 'rebGems']) if (typeof cfg[k] === 'string') cfg[k] = eval(cfg[k]);
const s = { money: 0, gems: 0, stage: 1, sub: 1, lv: { power: 0, speed: 0, money: 0 }, gun: 0, best: 0, team: 1, rp: 0, reb: 0, star: Array(13).fill(1), boost: 0 };
const power = l => 6 * Math.pow(1.18, l), speed = l => Math.min(10, 1.2 + 0.06 * l), mm = l => 1 + cfg.ml * l;
const COST = { power: l => 8 * Math.pow(cfg.pc, l), speed: l => 12 * Math.pow(cfg.sc, l), money: l => 15 * Math.pow(cfg.mcg, l) };
const idx = () => (s.stage - 1) * 5 + (s.sub - 1), ehp = () => 10 * Math.pow(cfg.hg, idx()) * (1 + cfg.early * Math.min(s.stage - 1, cfg.earlyCap)) * Math.pow(cfg.ex, Math.min(s.stage - 1, cfg.exCap)), erw = () => 10 * Math.pow(cfg.rg, idx()) * Math.pow(cfg.rex, Math.min(s.stage - 1, cfg.exCap));
const rb = () => 1 + s.rp * cfg.rebPer;
const starMul = () => (1 + 0.3 * (s.star[s.gun] - 1)) * (s.star[s.gun] >= 5 ? 1.5 : 1);
const crit = () => 1 + 2 * (0.1 + (s.team >= 5 ? 0.06 : 0));
const goldPerk = () => (s.team >= 3 ? 1.2 : 1) * (1 + Math.min(0.4, t / 3600 * 0.08)) * (s.boost > t ? 2 : 1);   // collection bonus ~ +8%/h, capped
const dps = () => s.team * speed(s.lv.speed) * (s.team >= 2 ? 1.1 : 1) * power(s.lv.power) * cfg.gunMult[s.gun] * starMul() * crit() * rb() * (s.boost > t ? 2 : 1);
let t = 0; const log = [], ms = {}; let fails = 0, stuck = 0, gemsEarned = 0, gemsByBoss = 0, gemsByTreasure = 0, gemsDaily = 0, gemsReb = 0;
const mark = k => { if (!(k in ms)) ms[k] = Math.round(t / 60); };
const addGems = (n, src) => { s.gems += n; gemsEarned += n; if (src === 'b') gemsByBoss += n; if (src === 't') gemsByTreasure += n; if (src === 'r') gemsReb += n; };
function shop() {
  for (let k = 0; k < 2000; k++) {
    const opts = [];
    for (const key of ['power', 'speed', 'money']) { if (key === 'speed' && speed(s.lv.speed) >= 10) continue; opts.push([COST[key](s.lv[key]) * (key === 'money' ? 1.3 : 1), key]); }
    if (s.team < 5) opts.push([cfg.team[s.team] * 0.7, 'team']);
    opts.sort((a, b) => a[0] - b[0]); let [c, key] = opts[0];
    c = key === 'team' ? cfg.team[s.team] : COST[key](s.lv[key]);
    if (c > s.money) break; s.money -= c; if (key === 'team') { s.team++; mark('team' + s.team); } else s.lv[key]++;
  }
  for (let k = 0; k < 20; k++) {   // gems: next weapon first, otherwise cheap stars
    const nx = s.gun + 1;
    if (!cfg.noGun && nx < cfg.gunMult.length && s.gems >= cfg.gunCost[nx]) { s.gems -= cfg.gunCost[nx]; s.gun = nx; mark('gun' + nx); continue; }
    const st = s.star[s.gun], c = Math.max(2, Math.round(Math.max(cfg.gunCost[s.gun], 5) * cfg.starK * st));
    if (st < 5 && s.gems >= c && (nx >= cfg.gunMult.length || c < 0.35 * cfg.gunCost[nx])) { s.gems -= c; s.star[s.gun]++; if (s.star[s.gun] === 5) mark('evo' + s.gun); continue; }
    break;
  }
}
let lastHour = 0;
while (t < cfg.hours * 3600) {
  if (cfg.paid) { if (s.stage >= 3 && !ms.starter) { ms.starter = Math.round(t / 60); addGems(400); s.boost = t + 7200; } if (t > 3600 && !ms.pack) { ms.pack = 60; addGems(650); } }
  const h = Math.floor(t / 3600); if (h > lastHour) { lastHour = h; }
  addGems(cfg.dailyGemsPerHour * 0, '');   // passive sources added continuously below
  for (let w = 0; w < 2; w++) {
    const kt = 4 * ehp() / dps(); const dt = 2.2 + 2 + Math.max(kt, 0.6); t += dt;
    s.money += 4 * erw() * 0.5 * 1.12 * mm(s.lv.money) * rb() * goldPerk();
    if (Math.random() < cfg.treasureP) addGems(cfg.treasureGems(s.stage), 't');
    s.gems += cfg.dailyGemsPerHour * dt / 3600; gemsDaily += cfg.dailyGemsPerHour * dt / 3600;
    shop();
  }
  if (s.sub < 5) { s.sub++; continue; }
  const bh = 10 * Math.pow(cfg.hg, (s.stage - 1) * 5 + 4) * cfg.bossMul * (1 + cfg.early * Math.min(s.stage - 1, cfg.earlyCap)) * Math.pow(cfg.ex, Math.min(s.stage - 1, cfg.exCap));
  if (bh / (dps() * 1.25) <= 27) {
    t += bh / (dps() * 1.25) + 5;
    addGems(s.stage > s.best ? cfg.bossGemsFirst(s.stage) : cfg.bossGemsRepeat(s.stage), 'b');
    s.best = Math.max(s.best, s.stage);
    s.money += erw() * 25 * mm(s.lv.money) * goldPerk();
    s.stage++; s.sub = 1; stuck = 0; mark('stage' + s.stage);
  } else {
    fails++; stuck++; t += 30;
    if (stuck === 1 && !ms['wall' + s.reb]) ms['wall' + s.reb] = [Math.round(t / 60), s.stage];
    if (stuck >= 6 && cfg.rebGain(s.stage) > 0) {
      const g = cfg.rebGain(s.stage); addGems(cfg.rebGems(g), 'r');
      log.push(`REBIRTH#${s.reb + 1} @${Math.round(t / 60)}m stage ${s.stage} +${g}pt (x${(1 + (s.rp + g) * cfg.rebPer).toFixed(1)})`);
      s.rp += g; s.reb++; Object.assign(s, { money: 0, stage: 1, sub: 1, lv: { power: 0, speed: 0, money: 0 } }); stuck = 0;
    }
  }
  shop();
}
const pick = ['stage5', 'stage10', 'stage20', 'stage30', 'stage40', 'stage50', 'gun1', 'gun2', 'gun3', 'gun4', 'gun5', 'gun6', 'gun7', 'evo0', 'evo1', 'evo2', 'evo3', 'team2', 'team3', 'team4', 'team5'];
console.log((cfg.paid ? 'PAID' : 'FREE') + ' milestones (min):', pick.filter(k => k in ms).map(k => `${k}=${ms[k]}`).join(' '));
console.log('walls:', Object.keys(ms).filter(k => k.startsWith('wall')).map(k => `${k}:${ms[k][0]}m@s${ms[k][1]}`).join(' '));
log.forEach(l => console.log(l));
console.log(`end ${cfg.hours}h: stage ${s.stage} best ${s.best} gun ${s.gun} stars ${s.star.join('')} team ${s.team} reb ${s.reb} rp ${s.rp} gems left ${Math.round(s.gems)} | earned ${Math.round(gemsEarned + gemsDaily)} (boss ${gemsByBoss}, treasure ${gemsByTreasure}, rebirth ${gemsReb}, daily ${Math.round(gemsDaily)})`);
