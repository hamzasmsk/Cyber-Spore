/* Shuriken Squad feature: Sıralama (stage ranking). The "Sıralama" tab of the Görev hub.
   - Rütbe: the best stage reached gives a ninja rank (Çırak → Efsane) with a bar to the next one.
   - Rekorlar: best stage, best of this rebirth, Kule floor, Arena wave, rebirths, bosses, enemies, play time.
   - Dönemler: the peak stage of the last rebirth cycles as a small bar chart (is every run going further?).
   - Yolculuk: the date each 5-stage milestone was first reached.
   - Dünya sıralaması: in the Android app, the Google Play Games leaderboard "En iyi bölüm" (PlayGamesPlugin.java;
     switched off until res/values/games-ids.xml holds the ids). In the claude.ai test page, the players of that
     page (features/cloudsave.js provides SS.board). Elsewhere the card says where it is available.
   The best stage is sent to the leaderboard whenever it grows (once signed in). */
'use strict';
(() => {
  const SS = window.SS;
  if (!SS) return;
  const save = SS.save, R = SS.R;
  if (!save.rank || typeof save.rank !== 'object') save.rank = {};
  const K = save.rank;
  if (!Array.isArray(K.hist)) K.hist = [];
  if (!Array.isArray(K.lives)) K.lives = [];
  if (typeof K.life !== 'number') K.life = save.stage || 1;
  if (typeof K.play !== 'number') K.play = 0;
  if (typeof K.sent !== 'number') K.sent = 0;
  // older saves: the milestones already passed are known, only their date is not
  if (!K.hist.length) for (let s = 5; s <= (save.best || 1); s += 5) K.hist.push({ s, t: 0 });

  const TIERS = [
    { at: 1, name: 'Çırak', col: '#9aa3b5' }, { at: 10, name: 'Genin', col: '#7fbf6a' }, { at: 25, name: 'Chunin', col: '#5fb3d6' },
    { at: 50, name: 'Jonin', col: '#b083e0' }, { at: 80, name: 'Usta', col: '#f08a5d' }, { at: 120, name: 'Kage', col: '#f1c471' },
    { at: 180, name: 'Efsane', col: '#ff5d73' },
  ];
  const tierOf = b => { let i = 0; while (i + 1 < TIERS.length && b >= TIERS[i + 1].at) i++; return i; };
  const T = s => (SS.t ? SS.t(s) : s);

  // ---------------- tracking
  let lastBest = save.best || 1, playAcc = 0;
  SS.HOOKS.update.push(dt => {
    if (!document.hidden) { playAcc += dt; if (playAcc >= 1) { K.play += Math.floor(playAcc); playAcc %= 1; } }
    if (!R.mode && save.stage > K.life) K.life = save.stage;
    const b = save.best || 1;
    if (b > lastBest) {
      const t0 = tierOf(lastBest), t1 = tierOf(b);
      for (let s = Math.floor(lastBest / 5) * 5 + 5; s <= b; s += 5) if (!K.hist.some(h => h.s === s)) K.hist.push({ s, t: Date.now() });
      lastBest = b;
      if (t1 > t0) setTimeout(() => SS.banner(T('YENİ RÜTBE!'), `${T(TIERS[t1].name)} · ${T('Bölüm')} ${b}`), 1600);
      submit();
    }
  });
  SS.HOOKS.rebirth.push(() => {
    K.lives.push({ n: (save.rebirths || 0) + 1, best: Math.max(K.life, save.stage || 1), t: Date.now() });
    if (K.lives.length > 12) K.lives.splice(0, K.lives.length - 12);
    K.life = 1;
  });

  // ---------------- world leaderboard providers
  const cap = window.Capacitor;
  const native = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
  const PG = native ? (cap.registerPlugin ? cap.registerPlugin('PlayGames') : cap.Plugins && cap.Plugins.PlayGames) : null;
  let pg = { configured: false, ready: false, signedIn: false };
  function pgStatus() { return PG ? PG.status().then(r => { pg = r || pg; return pg; }).catch(() => pg) : Promise.resolve(pg); }
  function submit() {
    const b = save.best || 1;
    if (PG && pg.ready && pg.signedIn && b > K.sent) PG.submitBestStage({ score: b }).then(() => { K.sent = b; }).catch(() => {});
    if (SS.board && SS.board.submit) SS.board.submit(b);
  }
  if (PG) pgStatus().then(s => { if (s.ready && !s.signedIn) PG.signIn().then(r => { pg.signedIn = !!(r && r.signedIn); submit(); }).catch(() => {}); else submit(); });

  // ---------------- panel
  const dur = s => { const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); const en = save.lang === 'en'; return h ? `${h}${en ? 'h' : 'sa'} ${m}${en ? 'm' : 'dk'}` : `${m}${en ? 'm' : 'dk'}`; };
  const ago = t => {
    if (!t) return '—';
    const d = Math.floor((Date.now() - t) / 86400000);
    if (d <= 0) return T('Bugün'); if (d === 1) return T('Dün');
    return new Date(t).toLocaleDateString(save.lang === 'en' ? 'en-US' : 'tr-TR', { day: 'numeric', month: 'short' });
  };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function open() {
    SS.openPanel('Sıralama', 'purple', body => {
      if (SS.hub) SS.hub.tabs(body, 'rank');
      const b = save.best || 1, ti = tierOf(b), tier = TIERS[ti], next = TIERS[ti + 1];
      const pct = next ? (b - tier.at) / (next.at - tier.at) : 1;
      body.appendChild(SS.el(`<div class="rk-hero" style="--rc:${tier.col}">
        <div class="rk-badge"><img src="assets/ui/ic_rank.png" alt=""><i>${ti + 1}</i></div>
        <div class="rk-info"><small>Rütbe</small><b>${tier.name}</b>
          <div class="fa-bar rk-bar"><i style="width:${(pct * 100).toFixed(1)}%"></i><span>${next ? `${T('Bölüm')} ${b} / ${next.at} · ${T(next.name)}` : T('En yüksek rütbe!')}</span></div></div>
        <div class="rk-best"><small>En iyi</small><b>${b}</b></div></div>`));

      const st = save.stats || {}, surv = save.surv || {}, tw = save.tower || {};
      const recs = [
        ['ic_explore', 'En iyi bölüm', b], ['ic_reborn', 'Bu dönem', Math.max(K.life, save.stage || 1)],
        ['ic_towerach', 'Kule katı', tw.best || 0], ['ic_wave', 'Arena dalgası', surv.best || 0],
        ['ic_rebirth', 'Doğuş', save.rebirths || 0], ['ic_bosshunt', 'Boss', SS.fmt(st.bosses || 0)],
        ['ic_reap', 'Düşman', SS.fmt(st.kills || 0)], ['ic_clock', 'Oyun süresi', dur(K.play)],
      ];
      body.appendChild(SS.el(`<h3 class="rk-h">Rekorlar</h3>`));
      body.appendChild(SS.el(`<div class="rk-grid">${recs.map(([ic, l, v]) => `<div><img src="assets/ui/${ic}.png" alt=""><small>${l}</small><b>${v}</b></div>`).join('')}</div>`));

      // world leaderboard
      const wl = SS.el(`<div class="rk-world"><div class="rk-wh"><img src="assets/ui/ic_rank.png" alt=""><div><b>Dünya sıralaması</b><span class="rk-ws"></span></div><button class="btn grey off rk-wb">…</button></div><ol class="rk-list"></ol></div>`);
      body.appendChild(wl);
      paintWorld(wl);

      if (K.lives.length) {
        const mx = Math.max(...K.lives.map(l => l.best), 1);
        body.appendChild(SS.el(`<h3 class="rk-h">Dönemler <small>Her Doğuşta ulaşılan en iyi bölüm</small></h3>`));
        body.appendChild(SS.el(`<div class="rk-lives">${K.lives.slice(-8).map(l => `<div><i style="height:${Math.round(6 + l.best / mx * 58)}px"><b>${l.best}</b></i><small>${l.n}</small></div>`).join('')}</div>`));
      }
      const hist = K.hist.slice().sort((x, y) => y.s - x.s).slice(0, 12);
      if (hist.length) {
        body.appendChild(SS.el(`<h3 class="rk-h">Yolculuk</h3>`));
        body.appendChild(SS.el(`<div class="rk-hist">${hist.map(h => `<div class="${TIERS.some(t => t.at > 1 && t.at <= h.s && t.at > h.s - 5) ? 'tier' : ''}"><b>${T('Bölüm')} ${h.s}</b><span>${ago(h.t)}</span></div>`).join('')}</div>`));
      }
    });
  }

  function paintWorld(wl) {
    const st = wl.querySelector('.rk-ws'), btn = wl.querySelector('.rk-wb'), list = wl.querySelector('.rk-list');
    const set = (txt, label, on, fn) => { st.textContent = T(txt); btn.textContent = T(label); btn.className = `btn ${on ? 'blue' : 'grey off'} rk-wb`; btn.onclick = on ? () => { SS.sfx('click'); fn(); } : null; };
    if (PG) {
      wl.style.display = 'none';
      set('Bağlanıyor…', '…', false);
      pgStatus().then(s => {
        if (!s.configured || !s.ready) { wl.remove(); return; }   // not set up yet: no half-finished card
        wl.style.display = '';
        if (!s.signedIn) return set('Google Play Games ile giriş yap', 'GİRİŞ', true, () => PG.signIn().then(r => { pg.signedIn = !!(r && r.signedIn); submit(); paintWorld(wl); }).catch(() => SS.toast('Giriş yapılamadı')));
        set('Tüm oyuncular arasında yerini gör', 'AÇ', true, () => { submit(); PG.showLeaderboard().catch(() => SS.toast('Sıralama açılamadı')); });
      });
      return;
    }
    if (SS.board) {
      set('Bu sayfadaki oyuncular', '↻', true, () => paintWorld(wl));
      list.innerHTML = `<li class="rk-wait">${esc(T('Yükleniyor…'))}</li>`;
      SS.board.top(10).then(rows => {
        if (!rows || !rows.length) { list.innerHTML = `<li class="rk-wait">${esc(T('Henüz kimse yok, ilk sen ol!'))}</li>`; return; }
        list.innerHTML = rows.map((r, i) => `<li class="${r.me ? 'me' : ''} ${i < 3 ? 'p' + (i + 1) : ''}"><em>${i + 1}</em><span>${esc(r.name || T('Ninja'))}${r.me ? ` (${esc(T('sen'))})` : ''}</span><b>${r.best}</b></li>`).join('');
      }).catch(() => { list.innerHTML = `<li class="rk-wait">${esc(T('Sıralama yüklenemedi'))}</li>`; });
      return;
    }
    wl.remove();   // no leaderboard on this platform
  }

  SS.ranking = { open, tier: () => TIERS[tierOf(save.best || 1)], TIERS, submit };
})();
