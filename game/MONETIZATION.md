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
| `ss_pass` | tüketilebilir (sezonluk) | Ninja Yolu premium: 2 sezon kostümü, 2 atış izi, 630 elmas, 9 Yıldız Taşı, 9 Fırtına Tılsımı, 5 Boss Bileti, 4,5 sa x2 güç ve takviyeler | ₺149,99 | ~x3 |
| `ss_pass_plus` | tüketilebilir (sezonluk) | Premium yol + anında 10 seviye | ₺249,99 | — |
| `ss_piggy` | tüketilebilir | Kumbarayı kır (100–500 elmas) | ₺49,99 | x0,5–x2,5 |
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

30 seviye, seviye başına 150 XP. **XP kaynakları:** düşman +1, elit +4, hazine +10, boss +40, günün ilk girişi +60,
günlük görevler (her gün 5 görevden 3'ü, 60–120 XP) ve haftalık görevler (5 görev, 300–500 XP). Seviye 25 elmasla
atlanabilir; 30. seviyeden sonra her 300 XP bir bonus sandık.

**Sezon temaları** (4 sezonda bir döner; her temanın kendi kostümleri ve atış izleri vardır, o sezon dışında
alınamaz — "Sezonu bekle"):

| Tema | Kostümler (15. / 30. seviye) | Atış izleri (5. / 20. seviye) |
|---|---|---|
| Kızıl Ay | Kara Büyücü · Usta | Alev · Büyü |
| Buz Fırtınası | Kar Ninjası · Tengu | Buz · Altın |
| Bambu Ruhu | Rakun Maske · Kızıl Samuray | Yaprak · Altın |
| Gölge Dansı | Gölge Ninja · Vampir | Gölge · Büyü |

**Ödüller** (her 5 seviyede bir sandık):

| | Ücretsiz yol | Premium yol |
|---|---|---|
| Elmas | 221 | 630 |
| Yıldız Taşı (elmas yerine silah yıldızı) | 3 | 9 |
| Fırtına Tılsımı (dolmadan Fırtına) | 5 | 9 |
| Boss Bileti (reklamsız +15 sn) | 5 | 5 |
| Takviye | 15 dk x2 güç, 20 dk hazine avcısı, 8 sa maden, altın | 4,5 sa x2 güç, 30 dk hızlı ateş, 30 dk hazine avcısı, 8 sa maden, altın |
| Kozmetik | — | 2 kostüm, 2 atış izi |

Premium'u sezonun ortasında alan oyuncu ulaştığı seviyelerin ödüllerini hemen alır (geç almak cezalandırılmaz).
Premium+ ayrıca anında 10 seviye verir — sezonun son haftalarında alan oyuncu için.

### Kumbara

Her 40 düşmanda kumbaraya 1 elmas düşer (en fazla 500; aktif oyunda ~10 saatte dolar). En az 100 elmasta, sabit fiyatla kırılır. Para kazanma
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

## Denge (ekonomi simülasyonu)

`node tools/economy-sim.js` oyunun formüllerini (düşman canı, altın, geliştirme maliyetleri, silah/yıldız, takım,
Doğuş, elmas kaynakları) birebir çalıştırıp açgözlü bir oyuncunun ilerlemesini dakika dakika ölçer.

**Bulunan sorunlar ve çözümler**

| Sorun | Ölçüm (önce) | Çözüm | Sonra |
|---|---|---|---|
| Boss elması her geçişte, Doğuş sonrası tekrar tekrar | 8 saatte 5.837 elmas, tüm silahlar 5 saatte | Elmas yalnızca bölüm ilk kez geçilince (3 + bölüm/4) | 10 saatte ~2.200 elmas |
| Hazine canavarı çok sık (%16) ve 1–2 elmas | saatte ~100 elmas | %5, 1 elmas (25. bölümden sonra 2) | saatte ~20 |
| Maden 6 elmas/sa | günde 70–140 | 2 elmas/sa (+%15/seviye), 8 saat depo | günde ~16–40 |
| Doğuş puanı bölümle doğrusal | 4. Doğuştan sonra saatte 1–2 bölüm, oyun tıkanıyor | Puan bölüm başına x1,18 (8. bölümden itibaren) | Her Doğuş +10–17 bölüm |
| Takım 14 dakikada doluyor | uzun vadeli hedef yok | Maliyetler 800 / 5M / 500B / 5e17 | 3 / 8 / 15 / 28. dakika |
| Mağaza "altın paketi" gelir tahmini düşman canına bağlı | ileri bölümlerde gerçeğin binlerce katı altın | Ödül eğrisine bağlandı | tutarlı |

**Ücretsiz oyuncu, ilk 10 saat** (aktif oyun)

| Hedef | Dakika |
|---|---|
| Bölüm 10 / 20 / 30 | 9 / 18 / 34 |
| İlk duvar / ilk Doğuş | ~32 (bölüm 29) / ~41 |
| Kunai / Üçlü Ok / Büyük Kunai / Büyü Yıldızı | 2 / 8 / 16 / 48 |
| Buz Mızrağı / Ateş Topu | 140 / 333 |
| Doğuş başına duvar | 29 → 46 → 61 → 73 → 83 → 93 → 101 |

**Ödeme yapan oyuncu** (başlangıç paketi + 650 elmas, ~₺200): ilk 4 silah 3. dakikada, Ateş Topu 60. dakikada;
10. saatte ücretsiz oyuncudan ~%5 ileride. Para hızlandırır, oyunun sonunu satın almaz.
