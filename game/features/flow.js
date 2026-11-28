/* Shuriken Squad — player flow (based on mobile onboarding / retention guidance):
   1. One popup at a time: every interruption (new-menu cards, daily reward, offers, festival news, notification
      prompt, first-rebirth tip) goes through one queue, never during a boss fight or an open panel, with a calm gap
      between them. Too many popups early is one of the most common first-session failures.
   2. "Sonraki hedef": a single next goal is always shown under the stage label (tap = go there). The chain walks a
      new player through the first systems (first upgrade, first boss, first weapon, team, mine/offline loop, first
      rebirth, Ruh Ağacı, Kule) and every goal pays a few gems, so each session has a goal reachable in that session.
   3. First rebirth guidance: when the first wall is hit, a tip explains rebirth; the first rebirth gives bonus souls.
   4. Knock-out revive: right after a knock-out, an optional rewarded ad puts the squad back up at once and keeps the
      step's progress (a frustration moment, where a rewarded ad is genuinely welcome).
   5. Session counter: offers wait for the right moment (see monetize.js: the starter pack is never shown in the
      middle of a first session). */
'use strict';
(() => {
  const SS = window.SS;
  if (!SS) return;
  const save = SS.save, R = SS.R;
  save.sessions = (save.sessions || 0) + 1;
  save.sessStart = Date.now();

  // ---------------- 1. popup queue
  const GAP = 25000;   // calm time between two interruptions
  let queue = [], lastShown = 0, busy = false;
  // right after a boss win the card picker and the gem card come first: hold everything else for a few seconds
  let winAt = 0; SS.HOOKS.bossWin.push(() => { winAt = Date.now(); });
  const calm = () => document.getElementById('panel').classList.contains('hidden') && !document.querySelector('.pk-ov,.mz-ov,.mz-card,.un-card,.fl-card,#koCard') && !R.boss && !R.mode && !(R.sq && R.sq.ko > 0) && !R.paused && !R.psave && Date.now() - winAt > 3000;
  // fn() shows the popup (return false if it decided not to); prio: lower first; gap: true = 25 s calm before it, a number = that many ms, false = none
  function request(id, fn, prio = 5, gap = true) {
    if (queue.some(q => q.id === id)) return;
    queue.push({ id, fn, prio, gap }); queue.sort((a, b) => a.prio - b.prio);
  }
  setInterval(() => {
    if (busy || !queue.length || !calm()) return;
    const q = queue[0], gap = q.gap === true ? GAP : q.gap || 0;
    if (Date.now() - lastShown < gap) return;
    queue.shift();
    let shown = true;
    try { shown = q.fn() !== false; } catch (e) { console.error('popup', q.id, e); }
    if (shown) lastShown = Date.now();   // a popup that decided not to show does not start the calm gap
  }, 700);
  SS.flow = { get queue() { return queue.map(q => q.id); }, request, calm, get lastShown() { return lastShown; }, mark: () => { lastShown = Date.now(); } };

  // ---------------- 2. next goal chain
  if (!save.goals || typeof save.goals !== 'object') save.goals = { done: {} };
  const G = save.goals;
  const opened = id => !SS.unlocked || SS.unlocked(id);
  const open = k => () => { const b = document.getElementById(k) || document.querySelector(`[data-open="${k}"]`); if (b) b.click(); };
  const GOALS = [
    { id: 'power', txt: 'Güç kartına dokun: Güç Sv.3', ok: () => save.lv.power >= 3, gems: 2, go: () => document.querySelector('.ucard[data-up="power"]') },
    { id: 'boss1', txt: 'İlk boss\'u yen', ok: () => (save.best || 1) >= 2, gems: 3 },
    { id: 'kunai', txt: 'Silahlar: Kunai\'yi aç', ok: () => (save.wbest || 0) >= 1, gems: 3, when: () => opened('guns'), act: open('guns') },
    { id: 'speed', txt: 'Hız kartı: Sv.10', ok: () => save.lv.speed >= 10, gems: 2 },
    { id: 'team2', txt: 'Takım: Kızıl\'ı kat', ok: () => save.team >= 2, gems: 4, when: () => opened('team') && (!SS.teamOpen || SS.teamOpen(1)), act: open('team') },
    { id: 'daily', txt: 'Günlük ödülünü al', ok: () => !!(save.login && (save.login.day > 0 || save.login.week > 0)), gems: 2, when: () => opened('dailyBtn'), act: open('dailyBtn') },
    { id: 'stage5', txt: '5. bölüme ulaş', ok: () => (save.best || 1) >= 5, gems: 4 },
    { id: 'mine', txt: 'Madeni aç: sen yokken elmas üretir', ok: () => !!G.mineSeen, gems: 3, when: () => opened('mineBtn'), act: () => { G.mineSeen = true; open('mineBtn')(); } },
    { id: 'star', txt: 'Bir silahın yıldızını yükselt', ok: () => (save.wstar || []).some(v => v >= 2), gems: 4, when: () => opened('guns'), act: open('guns') },
    { id: 'team3', txt: 'Takım: Altın\'ı kat', ok: () => save.team >= 3, gems: 5, when: () => opened('team') && (!SS.teamOpen || SS.teamOpen(2)), act: open('team') },
    { id: 'stage8', txt: '8. bölüme ulaş: Doğuş açılır', ok: () => (save.best || 1) >= 8, gems: 5 },
    { id: 'pass', txt: 'Ninja Yolu\'ndan bir ödül al', ok: () => !!(save.pass && Object.keys(save.pass.free || {}).length), gems: 3, when: () => opened('passBtn'), act: open('passBtn') },
    { id: 'reb1', txt: 'İlk Doğuşunu yap (takıldığında)', ok: () => (save.rebirths || 0) >= 1, gems: 8, when: () => opened('rebirth') && (save.best || 1) >= 12, act: open('rebirth') },
    { id: 'tree', txt: 'Ruh Ağacı\'ndan bir düğüm al', ok: () => !!(save.tree && Object.values(save.tree.lv || {}).some(v => v > 0)), gems: 5, when: () => (save.rebirths || 0) >= 1, act: () => SS.PANELS.rebirth('t') },
    { id: 'hero', txt: 'Bir ninjanın seviyesini yükselt', ok: () => (save.hlv || []).some(v => v >= 2), gems: 5, when: () => opened('team') && (save.scrolls || []).some(v => v >= 2), act: open('team') },
    { id: 'tower', txt: 'Kule\'de 3. katı geç', ok: () => ((save.tower && save.tower.best) || 0) >= 3, gems: 6, when: () => (save.best || 1) >= 12, act: () => SS.tower && SS.tower.open() },
  ];
  const current = () => GOALS.find(g => !G.done[g.id] && (!g.when || g.when()));
  const chip = SS.el('<button id="goal" class="goal"><img src="assets/ui/ic_goal.png" alt=""><span></span><b></b></button>');
  document.getElementById('ui').appendChild(chip);
  let shown = null, foldT = 0;
  // the full text stays a few seconds, then folds to the icon so the top of the field stays clear
  function unfold() { chip.classList.remove('mini'); clearTimeout(foldT); foldT = setTimeout(() => chip.classList.add('mini'), 6000); }
  unfold();
  function tickGoals() {
    // completed goals pay out (also ones finished while another goal was shown)
    for (const g of GOALS) if (!G.done[g.id] && g.ok()) {
      G.done[g.id] = true; save.gems += g.gems; SS.persist(); SS.refreshUI();
      chip.classList.remove('done'); void chip.offsetWidth; chip.classList.add('done');
      SS.sfx('bonus', 0); SS.toast(`Hedef tamam! +${g.gems} elmas`);
    }
    const g = current();
    if (!g) {   // after the chain: an open-ended goal keeps the chip useful
      const nb = (save.best || 1) + 1;
      chip.querySelector('span').textContent = `${nb}. bölüme ulaş`;
      chip.querySelector('b').textContent = ''; shown = null; chip.onclick = () => { SS.sfx('click'); unfold(); }; return;
    }
    if (shown !== g.id) { shown = g.id; chip.classList.remove('new'); void chip.offsetWidth; chip.classList.add('new'); unfold(); }
    chip.querySelector('span').textContent = g.txt;
    chip.querySelector('b').innerHTML = `<img src="assets/ui/gem.png" alt="">${g.gems}`;
    chip.onclick = () => {
      SS.sfx('click');
      if (chip.classList.contains('mini')) { unfold(); return; }   // first tap only shows the text
      if (g.act) g.act();
      else if (g.go) { const t = g.go(); if (t) { t.classList.remove('fl-point'); void t.offsetWidth; t.classList.add('fl-point'); } }
      else SS.toast('Savaşmaya devam et: takım kendi ilerler');
    };
  }
  setInterval(tickGoals, 600); setTimeout(tickGoals, 0);
  chip.style.visibility = 'visible';
  SS.HOOKS.bossStart.push(() => chip.classList.add('hide'));
  SS.HOOKS.bossWin.push(() => setTimeout(() => chip.classList.remove('hide'), 1500));
  SS.HOOKS.bossFail.push(() => setTimeout(() => chip.classList.remove('hide'), 1500));
  SS.HOOKS.tower && SS.HOOKS.tower.push(() => chip.classList.remove('hide'));
  setInterval(() => { if (!R.boss) chip.classList.remove('hide'); }, 2000);

  // generic card used by the flow (tips): one at a time, through the queue
  function card(icon, title, text, btn, onBtn) {
    const c = SS.el(`<div class="un-card fl-card"><div class="un-ico"><img src="assets/ui/${icon}.png" alt=""></div><div class="un-txt"><small>İPUCU</small><b>${title}</b><span>${text}</span></div>${btn ? `<button class="btn green">${btn}</button>` : ''}</div>`);
    const done = () => { c.classList.add('out'); setTimeout(() => c.remove(), 250); };
    if (btn) c.querySelector('.btn').onclick = e => { e.stopPropagation(); done(); onBtn(); };
    c.onclick = done;
    document.getElementById('ui').appendChild(c); SS.sfx('bonus', 0);
    setTimeout(() => { if (c.isConnected) done(); }, 9000);
  }

  // ---------------- 3. first rebirth guidance + bonus
  SS.HOOKS.bossFail.push(() => {
    if ((save.rebirths || 0) > 0 || G.rebTip || !(SS.rebirthGain && SS.rebirthGain() > 0) || R.bossFails < 2) return;
    G.rebTip = true; SS.persist();
    request('rebTip', () => card('ic_rebirth', 'Takıldın mı? Doğuş zamanı', `Doğuş bölümü sıfırlar ama kalıcı x${SS.fmt(1 + (save.rp + SS.rebirthGain()) * 0.3)} güç, elmas ve Ruh Ağacı için ruh verir. Çok daha hızlı geri gelirsin!`, 'DOĞUŞ', () => SS.PANELS.rebirth()), 1, false);
  });
  SS.HOOKS.rebirth.push(() => {
    if ((save.rebirths || 0) === 0 && save.tree) { save.tree.souls = (save.tree.souls || 0) + 3; setTimeout(() => SS.toast('İlk Doğuş hediyesi: +3 ruh · Ruh Ağacı\'na bak'), 2400); }
  });

  // (4. the revive offer after a knock-out now lives on the knockout card in game.js)
})();
