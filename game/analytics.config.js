/* Shuriken Squad — analytics settings (GameAnalytics, features/analytics.js).
   The keys identify the game to GameAnalytics; they ship inside every copy of the app, like any analytics key.
   enabled: 'native' = only inside the Android/iOS app (web previews and tests send nothing),
            'always' = everywhere, 'off' = never. A browser can be switched on for a test with ?ga=1. */
window.SS_ANALYTICS = {
  enabled: 'native',
  gameKey: '81f9b39bfbfbb5ef4110081f727feb5e',
  secretKey: 'e770f4579aab2fae28d5633a2387bd73c5272139',
};
