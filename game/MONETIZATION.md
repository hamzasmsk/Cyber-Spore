# Shuriken Squad — Para kazanma sistemi

Bu belge oyundaki gelir sistemlerini, neden böyle kurulduklarını ve mağazaya çıkmak için yapılması gerekenleri anlatır.
Tüm ayarlar `monetize.config.js` dosyasındadır; kodu değiştirmeden fiyat, sınır ve ürün kimlikleri değiştirilebilir.

## İlkeler

1. **Zorunlu reklam yok.** Yalnızca oyuncunun kendi seçtiği *ödüllü* reklamlar var (izle → ödül). Araya giren
   (interstitial) reklamlar idle oyunlarda oyuncu tutmayı ve mağaza puanını düşürür; bu yüzden kullanılmadı.
2. **Kumar yok.** Rastgele içerikli ücretli sandık/loot box satılmaz; her ürünün içeriği yazılıdır. (Apple/Google
   kurallarına ve bazı AB ülkelerindeki loot box düzenlemelerine takılmaz.)
3. **Oyun ücretsiz bitirilebilir.** Satın almalar hızlandırır; duvarlar elmas, Doğuş ve yıldızlarla da aşılır.
4. **Fiyatlar mağazadan gelir.** Ekranda yazan fiyat App Store / Google Play'in yerel fiyatıdır (config'deki fiyat
   yalnızca test modunda görünen yedek etikettir).
5. **Kalıcı ürünler geri yüklenebilir** (Mağaza → "Satın almaları geri yükle"; Apple bunu zorunlu tutar).

## Gelir kaynakları

### Uygulama içi satın almalar

| Ürün kimliği | Tür | İçerik | Fiyat (TR) | Değer* |
|---|---|---|---|---|
| `ss_gems_1` | tüketilebilir | 120 elmas | ₺29,99 | x1,0 |
| `ss_gems_2` | tüketilebilir | 650 elmas | ₺149,99 | x1,08 |
| `ss_gems_3` | tüketilebilir | 1.400 elmas | ₺299,99 | x1,17 |
| `ss_gems_4` | tüketilebilir | 3.000 elmas | ₺599,99 | x1,25 |
| `ss_gems_5` | tüketilebilir | 8.000 elmas | ₺1.499,99 | x1,33 |
| `ss_starter` | kalıcı, tek sefer | 400 elmas + Altın Şövalye kostümü + 2 saat x2 güç | ₺49,99 | ~x4 |
| `ss_noads` | kalıcı | Tüm reklam ödülleri izlemeden anında + kalıcı +%10 altın | ₺149,99 | — |
| `ss_monthly` | tüketilebilir (30 gün) | Hemen 300 + 30 gün her gün 60 elmas (toplam 2.100) | ₺99,99 | ~x5 |
| `ss_pass` | tüketilebilir (sezonluk) | Ninja Yolu premium: ~850 elmas, 3 saat x2 güç, Usta kostümü | ₺149,99 | ~x2+ |
| `ss_piggy` | tüketilebilir | Kumbarayı kır (100–500 elmas) | ₺49,99 | x2–x2,5 |
| `ss_offer_power` | tüketilebilir | 500 elmas + 1 saat x2 güç (süreli teklif) | ₺79,99 | ~x1,6 |

\* Değer: ₺0,25/elmas taban fiyata göre. Basamaklı yapı küçük alıcıyı kaybetmeden büyük paketi daha avantajlı yapar.
**İlk ödemeyi** almak için en yüksek değer başlangıç paketinde, **tekrar gelen gelir** için aylık kart ve sezon
biletinde; kumbara ise "zaten biriktirdiğim elması al" hissiyle düşük eşikli bir ikinci satın alma noktasıdır.

### Ödüllü reklamlar (günde toplam en fazla 20)

| Yer | Ne zaman | Ödül | Günlük sınır |
|---|---|---|---|
| `bossReward` | Boss yenilince, 7 sn görünen küçük kart (oyunu durdurmaz) | Boss elmasları x2 | 10 |
| `continue` | Boss süresi bitince, boss %60'ın altındaysa (dövüş başına 1 kez) | +15 saniye | 5 |
| `offline` | Uzun aradan sonra hoş geldin ekranı | Çevrimdışı kazanç x2 | 3 |
| `boost` | x2 Güç butonu | 3 dk x2 hasar ve altın | 8 |
| `freeGems` | Mağaza → Ücretsiz | +3 elmas | 5 |

"Reklamsız" sahibi oyuncu bu ödülleri reklam izlemeden anında alır — en sık reklam izleyen oyuncuların seve seve
satın aldığı üründür.

### Bağlama göre teklifler (günde en fazla 1 açılır pencere)

- **Başlangıç Paketi:** 3. bölüme gelince bir kez gösterilir, sonra mağazanın en üstünde durur.
- **Güç Paketi:** 5. bölümden sonra aynı boss'a art arda 2 kez yenilince, 6 saat geçerli. Satın alındıysa 3 gün
  boyunca tekrar gösterilmez. Her pencerede "Belki sonra" vardır.

### Ninja Yolu (28 günlük sezon bileti)

30 seviye; XP: düşman +1, elit +4, hazine +10, boss +40, günün ilk girişi +60. Her seviyede ücretsiz ödül (elmas
veya altın), premium yolda daha büyük ödüller ve 30. seviyede yalnızca bilette olan **Usta** kostümü. Premium'u
sezonun ortasında alan oyuncu ulaştığı seviyelerin ödüllerini hemen alır (geç almak cezalandırılmaz).

### Kumbara

Her 10 düşmanda kumbaraya 1 elmas düşer (en fazla 500). En az 100 elmasta, sabit fiyatla kırılır. Para kazanma
kapalı (`mode: 'off'`) bir yayında eski ücretsiz kurala döner.

## Teknik yapı

- `monetize.config.js` — mod, ürünler, reklam birimleri, sınırlar.
- `features/monetize.js` — tek API: `SS.Ads.show(yer)`, `SS.IAP.buy(id)`, `SS.IAP.restore()`. Uygulamada gerçek
  SDK'lar, tarayıcıda açıkça "TEST MODU" yazan simülasyon (gerçek ödeme/reklam yok).
- `features/shop.js`, `features/pass.js`, `features/piggy.js` — mağaza, sezon bileti, kumbara arayüzü.
- `features/native.js` — uygulama içinde: kayıt yedeği (Preferences), Android geri tuşu, titreşim (Haptics).
- Satın alma doğrulaması **RevenueCat** üzerinden yapılır (makbuzları sunucu tarafında doğrular); ödüller
  cihazda verilir. İleride hile önemli hale gelirse elmas bakiyesi bir sunucuya taşınabilir.

Mod seçimi (`monetize.config.js`):
- `mode: 'auto', webMode: 'test'` — geliştirme: uygulamada gerçek SDK, tarayıcıda test modu (şu anki ayar).
- `webMode: 'off'` — herkese açık web sürümü: hiçbir şey satılmaz/simüle edilmez.

## Mağazaya çıkış adımları

1. **Kurulum** (bilgisayarında, Node 20+):
   ```
   cd game
   npm install
   npx cap add ios        # macOS + Xcode gerekir
   npx cap add android    # Android Studio gerekir
   npm run sync
   ```
   `capacitor.config.json` içindeki `appId` değerini kendi kimliğinle değiştir (ör. `com.adin.shurikensquad`).
2. **App Store Connect / Google Play Console:** yukarıdaki tablodaki ürün kimlikleriyle uygulama içi ürünleri oluştur.
   `ss_starter` ve `ss_noads` kalıcı (non-consumable), diğerleri tüketilebilir (consumable).
3. **RevenueCat:** proje oluştur, iOS ve Android uygulamalarını bağla, ürünleri içe aktar; API anahtarlarını
   `monetize.config.js` → `revenuecat` alanına yaz.
4. **AdMob:** iOS ve Android uygulamalarını ekle, birer "Rewarded" reklam birimi oluştur ve kimlikleri
   `admob.rewarded` alanına yaz (şu an Google'ın resmi test birimleri var). Uygulama kimliğini ekle:
   - iOS `Info.plist`: `GADApplicationIdentifier`, `SKAdNetworkItems`, `NSUserTrackingUsageDescription`
     (ör. "Sana daha uygun reklamlar gösterebilmek için").
   - Android `AndroidManifest.xml`: `com.google.android.gms.ads.APPLICATION_ID` meta-data.
5. **Gizlilik:** AB/İngiltere için AdMob'da UMP rıza mesajını yayınla (kod rıza formunu otomatik açar); iOS'ta ATT
   izni istenir. Gizlilik politikasında reklam (AdMob) ve satın alma (RevenueCat) hizmetlerini belirt.
6. **Yaş derecelendirmesi:** Oyun çocukları hedefliyorsa (Google Families / Apple Kids) `admob.childDirected: true`
   yap; bu durumda kişiselleştirilmiş reklam kapanır ve gelir düşer, ama kurallara uyulur.
7. **Test:** Apple sandbox test hesabı, Google lisans test hesabı ve AdMob test cihazlarıyla dene. Gerçek reklam
   birimini kendi cihazında test cihazı tanımlamadan tıklama (hesap askıya alınabilir).

## İzlenecek metrikler ve ayar kolları

- **Dönüşüm oranı** (ödeme yapan / aktif oyuncu) → başlangıç paketinin ne zaman gösterildiği (`stage >= 3`).
- **ARPDAU** ve reklam izleme/gün → `ads.placements[*].cap`, `dailyCap`.
- **1/7/30. gün tutma** → reklam sıklığı arttıkça izle; düşerse sınırları azalt.
- **Ninja Yolu tamamlama oranı** → `XP_PER` (pass.js) ve XP kaynakları.
- **Kumbara kırma oranı** → kapasite ve elmas/düşman oranı (piggy.js).
