/* Shuriken Squad — account save for the web test page (claude.ai artifact).
   Browser storage in a shared web page can be wiped or partitioned, so inside the claude.ai viewer the save is
   also kept in the signed-in player's private document (data/users/<id>/save, readable only by them). On
   start, a newer account copy replaces the local one (once, then a reload); afterwards the save is written there
   when it has changed, at most every 20 s, and when the page is hidden. Outside that viewer (the Android app, a
   plain browser) window.claude does not exist and this file does nothing. */
'use strict';
(() => {
  const SS = window.SS;
  if (!SS || !window.claude || !window.claude.use) return;
  const KEY = SS.SAVE_KEY || 'swarmsquad_idle_v1';
  const localT = SS.save.t || 0;   // read before any await: saves made while we wait must not look newer than the cloud
  (async () => {
    let db = null, user = null;
    try { [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]); } catch (e) { return; }
    if (!db || !user) return;
    let id = null; try { id = await user.id(); } catch (e) { return; }
    if (!id) return;
    const ref = db.collection('data/users/' + id).doc('save');
    // 1. a newer copy in the account wins (e.g. a cleared browser or another device)
    try {
      const snap = await ref.get();
      const d = snap.exists ? snap.data() : null;
      let reloaded = false; try { reloaded = sessionStorage.getItem('ss_cloud_loaded') === '1'; } catch (e) { /* ignore */ }
      if (d && typeof d.json === 'string' && (d.t || 0) > localT + 10000 && !reloaded) {
        const o = JSON.parse(d.json);
        if (o && typeof o.stage === 'number') {
          SS.R.noSave = true;   // keep this run from overwriting what we are about to load
          localStorage.setItem(KEY, d.json);
          try { sessionStorage.setItem('ss_cloud_loaded', '1'); } catch (e) { /* ignore */ }
          SS.toast('Kayıt hesabından yüklendi');
          setTimeout(() => location.reload(), 900);
          return;
        }
      }
    } catch (e) { /* offline or not allowed: local save only */ }
    // 2. keep the account copy up to date (only when the save changed; one write at a time)
    let lastT = 0, writing = false;
    async function push() {
      if (writing || SS.R.noSave) return;
      const t = SS.save.t || 0; if (t === lastT) return;
      writing = true;
      try { await ref.set({ json: JSON.stringify(SS.save), t, stage: SS.save.stage, best: SS.save.best || 1 }); lastT = t; } catch (e) { /* try again later */ }
      writing = false;
    }
    setInterval(push, 20000);
    // 3. the page's own leaderboard (Sıralama tab): one row per player, written only by that player
    const board = db.collection('board');
    let sentBest = 0;
    SS.board = {
      submit(best) { if (best > sentBest) { sentBest = best; board.doc(id).set({ best, t: Date.now() }).catch(() => { sentBest = 0; }); } },
      async top(n) {
        const q = await board.orderBy('best', 'desc').limit(n).get();
        const rows = (q.docs || []).map(d => ({ id: d.id, best: (d.data() || {}).best | 0 })).filter(r => r.best > 0);
        let ps = {}; try { ps = await user.profiles(rows.map(r => r.id)); } catch (e) { /* names are optional */ }
        return rows.map(r => ({ best: r.best, me: r.id === id, name: (ps[r.id] && ps[r.id].name) || '' }));
      },
    };
    SS.board.submit(SS.save.best || 1);
    document.addEventListener('visibilitychange', () => { if (document.hidden) { SS.persist(); push(); } });
    setTimeout(push, 3000);
  })();
})();
