/* Shuriken Squad — monetization configuration (edit this file, not the code).
   See MONETIZATION.md for the store / AdMob / RevenueCat setup that goes with it.

   mode
     'auto'  inside the native app (Capacitor) use the real SDKs; in a browser use the test mode below
     'test'  always test mode: purchases and ads are simulated behind a clearly labelled "TEST" dialog
     'off'   no ads, no purchases (for a public web build: nothing is sold or simulated)
     'free'  no ads, no purchases, but every ad reward is given directly (closed tests: same game balance, nothing
             sold; the release workflow's "monetization: free" option sets this)
   webMode: what 'auto' does in a browser ('test' while developing, 'off' for a public web release) */
window.MONETIZE = {
  mode: 'auto',
  // Test Paneli (Ayarlar → TEST PANELİ, or long-press the stage name). The store release workflow sets this to false.
  devTools: true,
  webMode: 'test',

  // ---- RevenueCat (handles App Store / Google Play billing and receipt validation)
  revenuecat: { ios: 'appl_REPLACE_ME', android: 'goog_REPLACE_ME' },

  // ---- AdMob rewarded video units. The values below are Google's official TEST units: replace them with
  //      your own before release (and keep testing on your own devices with test devices enabled).
  admob: {
    rewarded: { ios: 'ca-app-pub-3940256099942544/1712485313', android: 'ca-app-pub-3940256099942544/5224354917' },
    childDirected: false,        // set true if the store listing targets children (Families policy / COPPA)
    underAgeOfConsent: false,
    requestConsent: true,        // GDPR/UMP consent form in the EEA/UK
    requestTracking: true,       // iOS App Tracking Transparency prompt (needs NSUserTrackingUsageDescription)
  },

  // ---- rewarded ad placements: per-day caps (and a global cap); "noads" owners get the reward instantly
  ads: {
    dailyCap: 20,
    placements: {
      boost:      { cap: 8, label: 'x2 Güç (3 dk)' },
      offline:    { cap: 3, label: 'Çevrimdışı kazanç x2' },
      bossReward: { cap: 10, label: 'Boss elması x2' },
      continue:   { cap: 5, label: 'Boss +15 saniye' },
      freeGems:   { cap: 5, label: 'Ücretsiz elmas', gems: 3 },
      revive:     { cap: 5, label: 'Nakavttan hemen kalk' },
    },
  },

  // ---- products. ids must match App Store Connect / Google Play Console product ids.
  //      price / usd = fallback labels only (Turkish / other languages; usd also names the Play price tier); the real localized price comes from the store at runtime.
  //      Grants: gems, skin (hero id), boostMin (x2 power minutes), flag, monthly{days,daily}, pass, piggy
  products: [
    { id: 'ss_gems_1', kind: 'consumable', title: 'Avuç Elmas', gems: 120, price: '₺29,99', usd: '$0.99', img: 'gem.png' },
    { id: 'ss_gems_2', kind: 'consumable', title: 'Elmas Kesesi', gems: 650, price: '₺149,99', usd: '$4.99', img: 'gem_big.png', tag: '+%8' },
    { id: 'ss_gems_3', kind: 'consumable', title: 'Elmas Sandığı', gems: 1400, price: '₺299,99', usd: '$9.99', img: 'chest.png', tag: '+%17' },
    { id: 'ss_gems_4', kind: 'consumable', title: 'Elmas Hazinesi', gems: 3000, price: '₺599,99', usd: '$19.99', img: 'chest_open.png', tag: '+%25' },
    { id: 'ss_gems_5', kind: 'consumable', title: 'Ejderha Hazinesi', gems: 8000, price: '₺1.499,99', usd: '$49.99', img: 'cup.png', tag: 'En iyi değer' },
    { id: 'ss_starter', kind: 'non_consumable', title: 'Başlangıç Paketi', gems: 400, skin: 'KnightGold', boostMin: 120, price: '₺49,99', usd: '$1.99',
      desc: '400 elmas · Altın Şövalye kostümü · 2 saat x2 güç' },
    { id: 'ss_noads', kind: 'non_consumable', title: 'Reklamsız', flag: 'noads', price: '₺149,99', usd: '$4.99',
      desc: 'Tüm reklam ödülleri anında, izlemeden · kalıcı +%10 altın' },
    { id: 'ss_monthly', kind: 'consumable', title: 'Aylık Kart', gems: 300, monthly: { days: 30, daily: 60 }, price: '₺99,99', usd: '$2.99',
      desc: 'Hemen 300 elmas + 30 gün boyunca her gün 60 elmas (toplam 2100)' },
    { id: 'ss_pass', kind: 'consumable', title: 'Ninja Yolu Premium', pass: true, price: '₺149,99', usd: '$4.99',
      desc: 'Bu sezonun premium yolu: 2 özel kostüm, 2 atış izi, 600+ elmas, Yıldız Taşları, Boss Biletleri, hızlı ateş, takviyeler' },
    { id: 'ss_pass_plus', kind: 'consumable', title: 'Ninja Yolu Premium+', pass: true, passLevels: 10, price: '₺249,99', usd: '$7.99',
      desc: 'Premium yol + anında 10 seviye' },
    { id: 'ss_piggy', kind: 'consumable', title: 'Kumbarayı Kır', piggy: true, price: '₺49,99', usd: '$1.99' },
    { id: 'ss_offer_power', kind: 'consumable', title: 'Güç Paketi', gems: 500, boostMin: 60, price: '₺79,99', usd: '$2.99',
      desc: '500 elmas · 1 saat x2 güç — takıldığın boss için' },
    // effect skins (cosmetic, every weapon) and one-time packs — see features/fxskins.js
    { id: 'ss_fx_dragon', kind: 'non_consumable', title: 'Ejder Alevi', fx: 'dragon', price: '₺79,99', usd: '$2.99', img: 'fxi_dragon.png',
      desc: 'Efekt kaplaması: alev kuyruğu, kor patlaması, ateş çemberi · her silahta' },
    { id: 'ss_fx_lotus', kind: 'non_consumable', title: 'Yıldırım Lotus', fx: 'lotus', price: '₺79,99', usd: '$2.99', img: 'fxi_lotus.png',
      desc: 'Efekt kaplaması: elektrik izi, dallanan şimşek, ışık halkası · her silahta' },
    { id: 'ss_neo_pack', kind: 'non_consumable', title: 'Neo Ninja Paketi', gems: 800, fx: ['dragon', 'lotus', 'neon'], price: '₺149,99', usd: '$4.99', img: 'ic_neo.png',
      desc: 'Ejder Alevi + Yıldırım Lotus + pakete özel Neo Devre kaplaması + 800 elmas' },
    { id: 'ss_rebirth_pack', kind: 'non_consumable', title: 'Doğuş Paketi', gems: 600, souls: 10, boostMin: 120, price: '₺59,99', usd: '$1.99', img: 'ic_rebirth.png',
      desc: '600 elmas · 10 ruh (Ruh Ağacı) · 2 saat x2 güç — ilk Doğuşa özel, 24 saat' },
  ],
};
