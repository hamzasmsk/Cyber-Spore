/* Shuriken Squad feature: Görevler (rotating daily missions). Requires window.SS from game.js. */
'use strict';
(() => {
  const SS = window.SS;
  if (!SS) { console.warn('missions: SS missing'); return; }
  const save = SS.save;
  const SLOTS = 3;

  const dayKey = () => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
  const msToMidnight = () => { const d = new Date(); const m = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1); return m - d; };
  const hms = ms => { const s = Math.max(0, Math.floor(ms / 1000)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ':' : '') + String(m).padStart(2, '0') + ':' + String(x).padStart(2, '0'); };
  const pickOf = a => a[Math.floor(Math.random() * a.length)];
  const nice = v => { if (v < 100) return Math.ceil(v); const p = Math.pow(10, Math.floor(Math.log10(v)) - 1); return Math.ceil(v / p) * p; };
  const killReward = () => { try { return (SS.reward ? SS.reward() : SS.enemyHp()) * 0.5 * SS.moneyMul(); } catch (e) { return 10; } };

  // ---------------- mission templates (icons come from the Ninja Adventure pack in assets/ui/)
  const bio = () => { try { return SS.biome() || {}; } catch (e) { return {}; } };
  const monIcon = () => { const p = bio().pool; return `assets/ui/mon_${(p && p[0]) || 'Slime3'}.png`; };
  const bossIcon = () => { const b = bio().bosses; return `assets/ui/boss_${(b && b[0]) || 'GiantSlime2'}.png`; };
  const icon = t => { const i = TYPES[t].icon; return typeof i === 'function' ? i() : i; };
  const TYPES = {
    kill: {
      icon: monIcon,
      make: () => { const n = pickOf([50, 90, 140, 200]); return { goal: n, gems: n >= 140 ? 4 : 3, cash: nice(killReward() * n * 0.6) }; },
      text: m => `${m.goal} düşman yok et`,
    },
    buy: {
      icon: 'assets/ui/ic_upq.png',
      make: () => { const n = pickOf([10, 15, 25, 40]); return { goal: n, gems: n >= 25 ? 4 : 3, cash: 0 }; },
      text: m => `${m.goal} yükseltme satın al`,
    },
    boss: {
      icon: bossIcon,
      make: () => { const n = Math.random() < 0.7 ? 1 : 2; return { goal: n, gems: 4 + n * 2, cash: 0 }; },
      text: m => m.goal > 1 ? `${m.goal} boss yen` : 'Bir boss yen',
    },
    stage: {
      icon: 'assets/ui/ic_stamp.png',
      make: () => { const add = pickOf([1, 1, 2]); return { goal: (save.stage || 1) + add, base: save.stage || 1, gems: 4 + add * 2, cash: 0 }; },
      text: m => `Bölüm ${m.goal}'e ulaş`,
    },
    earn: {
      icon: 'assets/ui/coin.png',
      make: () => { const rate = Math.max(save.rate || 0, killReward() * 1.5); const g = nice(rate * pickOf([90, 150, 240])); return { goal: g, gems: 3, cash: 0 }; },
      text: m => `${SS.fmt(m.goal)} altın kazan`,
    },
  };

  function newMission(exclude) {
    const keys = Object.keys(TYPES).filter(k => !exclude.includes(k));
    const type = pickOf(keys.length ? keys : Object.keys(TYPES));
    const m = Object.assign({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), type, p: 0, done: false }, TYPES[type].make());
    if (type === 'stage') m.p = save.stage || 1;
    return m;
  }

  // ---------------- state
  function state() {
    let s = save.missions;
    if (!s || typeof s !== 'object') s = save.missions = {};
    if (!Array.isArray(s.list)) s.list = [];
    s.list = s.list.filter(m => m && TYPES[m.type] && typeof m.goal === 'number');
    if (typeof s.claimed !== 'number') s.claimed = 0;
    if (s.day !== dayKey()) {
      // a new day: keep finished (claimable) missions, rotate the rest
      s.day = dayKey(); s.claimed = 0;
      s.list = s.list.filter(m => isDone(m));
    }
    while (s.list.length < SLOTS) s.list.push(newMission(s.list.map(m => m.type)));
    return s;
  }
  const isDone = m => m.p >= m.goal;
  const pct = m => {
    if (m.type === 'stage') { const b = m.base || 1; return Math.max(0, Math.min(1, (m.p - b) / Math.max(1, m.goal - b))); }
    return Math.max(0, Math.min(1, m.p / m.goal));
  };
  const progTxt = m => m.type === 'earn' ? `${SS.fmt(Math.min(m.p, m.goal))} / ${SS.fmt(m.goal)}` : `${Math.min(m.p, m.goal)} / ${m.goal}`;
  const claimable = () => state().list.some(isDone);

  function bump(type, v) {
    const s = state(); let changed = false;
    for (const m of s.list) {
      if (m.type !== type || isDone(m)) continue;
      if (type === 'stage') m.p = Math.max(m.p, v); else m.p += v;
      changed = true;
      if (isDone(m)) { SS.toast('Görev tamamlandı!'); SS.sfx('coin'); }
    }
    if (changed) refresh();
  }

  // ---------------- tracking
  let lastEarned = 0, lastEarnT = 0, tick = 0, lastStage = save.stage;
  SS.HOOKS.kill.push(() => bump('kill', 1));
  SS.HOOKS.buy.push(() => bump('buy', 1));
  SS.HOOKS.bossWin.push(() => bump('boss', 1));
  SS.HOOKS.update.push(dt => {
    const R = SS.R;
    // money earned: R.earned accumulates and is reset every ~10s by the core (detected via R.earnT)
    const e = R.earned || 0, et = R.earnT || 0;
    const delta = (et < lastEarnT || e < lastEarned) ? e : e - lastEarned;
    lastEarned = e; lastEarnT = et;
    if (delta > 0) bump('earn', delta);
    if (save.stage !== lastStage) { lastStage = save.stage; bump('stage', save.stage); }
    tick += dt;
    if (tick >= 0.4) { tick = 0; refresh(); }
  });

  // ---------------- side button + badge
  const btn = SS.addSideButton({ side: 'right', label: 'Görev', icon: 'assets/ui/ic_missions.png', color: 'purple', id: 'missionsBtn', onClick: open });
  btn.classList.add('fa-missions-btn');
  const dot = document.createElement('i'); dot.className = 'dot fa-dot'; btn.appendChild(dot);

  let panelRefs = null; // live element refs while our panel is open
  function panelOpen() { const p = document.getElementById('panel'); return !!(panelRefs && p && !p.classList.contains('hidden') && panelRefs.body.isConnected); }

  function refresh() {
    const s = state();
    const can = s.list.some(isDone);
    dot.style.display = can ? '' : 'none';
    btn.classList.toggle('fa-glow', can);
    if (panelOpen()) {
      let rebuild = false;
      for (const m of s.list) {
        const r = panelRefs.rows[m.id];
        if (!r) { rebuild = true; break; }
        if (isDone(m) !== r.done) { rebuild = true; break; }
        r.fill.style.width = (pct(m) * 100).toFixed(1) + '%';
        r.txt.textContent = progTxt(m);
      }
      panelRefs.timer.textContent = hms(msToMidnight());
      if (rebuild) open(true);
    }
  }

  function claim(m) {
    const s = state();
    const i = s.list.indexOf(m);
    if (i < 0 || !isDone(m)) return;
    save.gems = (save.gems || 0) + m.gems;
    if (m.cash > 0) { try { SS.addMoney(m.cash, SS.W / 2, SS.H / 2, 14); } catch (e) { save.money += m.cash; } }
    s.claimed++;
    s.list.splice(i, 1, newMission(s.list.filter(x => x !== m).map(x => x.type)));
    SS.sfx('win');
    SS.toast(`+${m.gems} elmas${m.cash > 0 ? ' · +' + SS.fmt(m.cash) + ' altın' : ''}`);
    if (save.vibrate !== false && navigator.vibrate) { try { navigator.vibrate(30); } catch (e) { /* ignore */ } }
    SS.persist(); SS.refreshUI();
    open(true);
  }

  function open(keep) {
    const s = state();
    const prevScroll = keep ? document.getElementById('pBody').scrollTop : 0;
    SS.openPanel('Görevler', 'purple', body => {
      if (SS.hub) SS.hub.tabs(body, 'missions');
      const rows = {};
      const wrap = SS.el('<div class="fa-mwrap"></div>');
      const head = SS.el(`<div class="fa-mhead"><div><b>Günlük görevler</b><small>Tamamla, elmas kazan!</small></div>
        <div class="fa-timer"><img src="assets/ui/ic_time.png" alt=""><span></span></div></div>`);
      wrap.appendChild(head);
      // claimable first
      const list = s.list.slice().sort((a, b) => (isDone(b) ? 1 : 0) - (isDone(a) ? 1 : 0));
      for (const m of list) {
        const done = isDone(m);
        const row = SS.el(`<div class="row-card fa-mission ${done ? 'fa-done' : ''}">
          <div class="ico ${m.type === 'kill' || m.type === 'boss' ? 'face' : ''}"><img src="${icon(m.type)}" alt=""></div>
          <div class="info"><h4>${TYPES[m.type].text(m)}</h4>
            <div class="fa-bar ${done ? 'full' : ''}"><i style="width:${(pct(m) * 100).toFixed(1)}%"></i><span>${progTxt(m)}</span></div>
            <div class="fa-rew"><span><img src="assets/ui/gem.png" alt="">${m.gems}</span>${m.cash > 0 ? `<span><img src="assets/ui/coin.png" alt="">${SS.fmt(m.cash)}</span>` : ''}</div>
          </div>
          ${done ? '<button class="btn green fa-claim">AL</button>' : '<button class="btn grey off fa-claim">AL</button>'}</div>`);
        if (done) row.querySelector('.fa-claim').onclick = () => claim(m);
        rows[m.id] = { fill: row.querySelector('.fa-bar i'), txt: row.querySelector('.fa-bar span'), done };
        wrap.appendChild(row);
      }
      wrap.appendChild(SS.el(`<p class="big-note">Bugün alınan ödül: <b class="fa-gold">${s.claimed}</b></p>`));
      body.appendChild(wrap);
      panelRefs = { body: wrap, rows, timer: head.querySelector('.fa-timer span') };
      panelRefs.timer.textContent = hms(msToMidnight());
    });
    if (keep) document.getElementById('pBody').scrollTop = prevScroll;
  }

  state(); refresh();
  SS.missions = { open, state, bump };
})();
