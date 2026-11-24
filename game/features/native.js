/* Shuriken Squad — native app glue (only active inside the Capacitor app; a no-op in the browser).
   - Save backup: iOS can evict WebView storage, so the save is mirrored to @capacitor/preferences and restored
     on launch if localStorage came back empty.
   - Android back button closes the open panel, otherwise sends the app to the background.
   - Vibration uses @capacitor/haptics (navigator.vibrate does not exist on iOS).
   - Store rating: once, at a happy moment (a boss beaten, stage 12+, from the third session on) the system's own
     in-app review sheet is requested (@capacitor-community/in-app-review). The store decides whether it shows.
   - Cloud save: the save mirrored into Preferences is included in Android Auto Backup (res/xml/*_rules.xml). */
'use strict';
(() => {
  const cap = window.Capacitor, SS = window.SS;
  if (!cap || !cap.isNativePlatform || !cap.isNativePlatform() || !SS) return;
  const KEY = 'swarmsquad_idle_v1', Pl = n => cap.Plugins && cap.Plugins[n];
  const Prefs = Pl('Preferences'), App = Pl('App'), Haptics = Pl('Haptics');
  if (Prefs) {
    let local = null; try { local = localStorage.getItem(KEY); } catch (e) { /* ignore */ }
    if (!local) Prefs.get({ key: KEY }).then(r => { if (r && r.value) { try { localStorage.setItem(KEY, r.value); location.reload(); } catch (e) { /* ignore */ } } });
    const mirror = () => { try { const v = localStorage.getItem(KEY); if (v) Prefs.set({ key: KEY, value: v }); } catch (e) { /* ignore */ } };
    setInterval(mirror, 4000);   // the app's own copy follows the save within seconds
    document.addEventListener('visibilitychange', () => { if (document.hidden) { SS.persist(); mirror(); } });
    window.addEventListener('pagehide', () => { SS.persist(); mirror(); });
    SS.HOOKS.purchase && SS.HOOKS.purchase.push(() => { SS.persist(); mirror(); });
  }
  if (App && App.addListener) App.addListener('backButton', () => {
    if (SS.powersave && SS.powersave.on) SS.powersave.exit();
    else if (!document.getElementById('panel').classList.contains('hidden')) SS.closePanel();
    else if (App.minimizeApp) App.minimizeApp();
  });
  const Review = Pl('InAppReview');
  if (Review && SS.HOOKS.bossWin) SS.HOOKS.bossWin.push(() => {
    const s = SS.save;
    if (s.reviewAsked || (s.best || 1) < 12 || (s.sessions || 1) < 3) return;
    s.reviewAsked = Date.now(); SS.persist();
    const ask = () => { Review.requestReview().catch(() => {}); };
    setTimeout(() => { if (SS.flow) SS.flow.request('review', ask, 8, false); else ask(); }, 2500);
  });
  if (Haptics) SS.vibrate = ms => { if (SS.save.vibrate !== false) Haptics.impact({ style: ms > 60 ? 'HEAVY' : 'LIGHT' }).catch(() => {}); };
})();
