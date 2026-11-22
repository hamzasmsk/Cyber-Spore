/* Shuriken Squad — native app glue (only active inside the Capacitor app; a no-op in the browser).
   - Save backup: iOS can evict WebView storage, so the save is mirrored to @capacitor/preferences and restored
     on launch if localStorage came back empty.
   - Android back button closes the open panel, otherwise sends the app to the background.
   - Vibration uses @capacitor/haptics (navigator.vibrate does not exist on iOS). */
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
    setInterval(mirror, 15000);
    document.addEventListener('visibilitychange', () => { if (document.hidden) { SS.persist(); mirror(); } });
    SS.HOOKS.purchase && SS.HOOKS.purchase.push(() => { SS.persist(); mirror(); });
  }
  if (App && App.addListener) App.addListener('backButton', () => {
    if (!document.getElementById('panel').classList.contains('hidden')) SS.closePanel();
    else if (App.minimizeApp) App.minimizeApp();
  });
  if (Haptics) SS.vibrate = ms => { if (SS.save.vibrate !== false) Haptics.impact({ style: ms > 60 ? 'HEAVY' : 'LIGHT' }).catch(() => {}); };
})();
