# Shuriken Squad — Google Play'e çıkış rehberi

Mac gerekmez. Uygulama paketi (.aab) GitHub'ın bulut sunucusunda derlenir; senin bilgisayarına Android Studio
kurman bile gerekmez. Aşağıdaki adımlar sırayla.

## 0. Hazır olanlar (bu klasörde)

| Dosya | Ne işe yarar |
|---|---|
| `../android/` | Android projesi (uygulama kimliği `com.shurikensquad.game`, dikey ekran, ikonlar, açılış ekranı, imzalama ayarı) |
| `/.github/workflows/android-release.yml` | Bulutta imzalı `.aab` üreten iş |
| `icon-512.png` | Mağaza ikonu (512×512) — `python3 tools/build_store_art.py` ile üretilir (uygulama ikonları da) |
| `feature-graphic-1024x500.png` / `-en.png` | Mağaza tanıtım görseli (Türkçe / İngilizce) |
| `screenshots/tr/*.png`, `screenshots/en/*.png` | 8'er telefon ekran görüntüsü (1080×1920, başlıklı) — `node tools/store_shots.js` ile oyunun kendisinden çekilir |
| `privacy-policy.html` | Gizlilik politikası (Türkçe + İngilizce) |
| Bu dosyanın sonu | Mağaza metinleri, Veri güvenliği ve içerik derecelendirme cevapları |

> **Uygulama kimliği kalıcıdır.** `com.shurikensquad.game` ilk yüklemeden sonra değiştirilemez. Başka bir kimlik
> istiyorsan ilk yüklemeden önce `capacitor.config.json` içindeki `appId`'yi değiştirip `android/` klasörünü
> yeniden oluşturmak gerekir (`npx cap add android`).

## 1. Google Play geliştirici hesabı

1. <https://play.google.com/console> → hesap aç, **25 $** tek seferlik ücret, kimlik doğrulaması.
2. **Kişisel hesaplarda zorunlu test:** üretime (herkese açık yayın) geçmeden önce **en az 12 test kullanıcısı**
   uygulamayı **14 gün kesintisiz** kapalı testte tutmalı. Bu yüzden takvim: hesap → kapalı test → 14 gün →
   üretim başvurusu. 12 kişiyi (arkadaş, aile, topluluk) şimdiden ayarla; biri ayrılırsa süre baştan başlayabilir.
   (Şirket/kuruluş hesabı bu kuraldan muaf.)

## 2. İmza anahtarı ve GitHub sırları (bir kez)

Sana gönderdiğim dosyalar: `upload.jks` (yükleme anahtarı), `upload.jks.base64.txt`, `secrets.txt`.
**Bunları güvenli bir yerde sakla** (şifre yöneticisi / bulut sürücü). Anahtar repoya konmaz.

GitHub'da repo → **Settings → Secrets and variables → Actions → New repository secret**, dört sır:

| Ad | Değer |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | `upload.jks.base64.txt` dosyasının içeriği |
| `ANDROID_KEYSTORE_PASSWORD` | `secrets.txt`'teki şifre |
| `ANDROID_KEY_PASSWORD` | aynı şifre |
| `ANDROID_KEY_ALIAS` | `upload` |

Play Console ilk yüklemede **Play App Signing**'i önerir: kabul et. Google asıl imza anahtarını kendisi saklar;
yükleme anahtarını kaybedersen destekten sıfırlatabilirsin.

## 3. Paketi derle

`game/release.json` dosyasındaki sürüm adı (`version_name`) değişince derleme kendiliğinden başlar
(`monetization`: `free` = reklamsız ve satın almasız kapalı test sürümü, `full` = reklam + satın alma).
Ana dalda (`main`) ise GitHub → **Actions → Shuriken Squad Android → Run workflow** ile de başlatılabilir.
~10 dakika sonra çalıştırma sayfasında **Artifacts** altında `shuriken-squad-1.0.0-N` (içinde `app-release.aab`).
Her çalıştırmada sürüm kodu (versionCode) otomatik artar.

## 4. Play Console'da uygulamayı oluştur

1. **Uygulama oluştur:** ad `Shuriken Squad`, varsayılan dil Türkçe, **Oyun**, **Ücretsiz**.
2. **Uygulama içeriği** bölümünü doldur (cevaplar en altta): gizlilik politikası URL'si, uygulama erişimi (giriş
   gerekmiyor), içerik derecelendirmesi, hedef kitle (**13+**, çocuklara yönelik değil), veri güvenliği, devlet
   uygulaması değil, finansal özellik yok.
   - **`free` sürümü (kapalı test):** reklamlar **Hayır**, reklam kimliği **Hayır** (reklam kütüphanesi pakette yok).
   - **`full` sürümü (ileride):** reklamlar **Evet**, reklam kimliği **Evet, reklam için**.
3. **Mağaza girişi:** metinler, `icon-512.png`, `feature-graphic-1024x500.png`, `screenshots/tr/` (Türkçe giriş) ve `screenshots/en/` + `feature-graphic-1024x500-en.png` (İngilizce çeviri girişine) — en az 2, hepsini yükle,
   kategori **Oyun → Aksiyon** (ya da Strateji), iletişim e-postası.
4. **Test → Kapalı test:** yeni kanal, `.aab`'yi yükle, test kullanıcılarının e-postalarını ekle, katılım linkini
   paylaş. 14 gün dolunca **Üretime başvur**.

## 5. Gizlilik politikası için herkese açık adres

Play, giriş gerektirmeyen bir URL ister. En kolayı: GitHub'da ayrı, herkese açık küçük bir repo (ör.
`shuriken-squad-site`) aç, `privacy-policy.html`'i `index.html` olarak koy, **Settings → Pages**'i aç. Adres:
`https://<kullanıcı-adın>.github.io/shuriken-squad-site/`. Dosyadaki `[iletişim e-posta adresin]` kısmını doldur.
Aynı siteye AdMob'un istediği `app-ads.txt` dosyası da konur (adım 6).

## 6. Reklam (AdMob) — gerçek gelir için

Şu an Google'ın **test** reklam kimlikleri var (kapalı testte bu doğru olan). Üretimden önce:
1. <https://admob.google.com> → uygulama ekle (Android, Play'de yayınlanmış uygulamayı bağla).
2. Bir **Ödüllü (Rewarded)** reklam birimi oluştur.
3. `android/app/src/main/res/values/strings.xml` → `admob_app_id` = uygulama kimliğin (`ca-app-pub-...~...`).
4. `monetize.config.js` → `admob.rewarded.android` = reklam birimi kimliğin (`ca-app-pub-.../...`).
5. AdMob → Gizlilik ve mesajlaşma → **GDPR rıza mesajını** yayınla (kod formu kendisi açar).
6. `app-ads.txt` dosyasını AdMob'un verdiği satırla gizlilik sitenin köküne koy; Play mağaza girişinde web sitesi
   olarak o adresi yaz.

## 7. Satın almalar (isteğe bağlı, sonra da olur)

RevenueCat anahtarı girilmeden uygulama içi satın almalar **otomatik gizlenir** — ilk sürümü yalnızca reklamla
çıkarabilirsin. Satın alma açmak için:
1. Play Console → **Ödeme profili** (vergi/banka bilgileri).
2. **Para kazanma → Ürünler → Uygulama içi ürünler:** `monetize.config.js`'teki kimliklerle ürünleri oluştur
   (`ss_gems_1` … `ss_rebirth_pack`). Tek seferlik (non-consumable): `ss_starter`, `ss_noads`, `ss_fx_dragon`,
   `ss_fx_lotus`, `ss_neo_pack`, `ss_rebirth_pack`; diğerleri tüketilebilir.
   **Fiyat:** her ürünün ana fiyatını `usd` alanındaki dolar kademesinden gir (ör. $2.99); Play diğer ülkelerin
   para birimine ve yerel fiyat kademesine kendisi çevirir. Türkiye fiyatını `price` alanındaki değerle elle
   düzeltebilirsin. Oyun her zaman mağazanın gösterdiği yerel fiyatı yazar.

   | Kimlik | Tür | Dolar kademesi | İçerik |
   |---|---|---|---|
   | ss_fx_dragon | tek seferlik | $2.99 | Ejder Alevi efekt kaplaması |
   | ss_fx_lotus | tek seferlik | $2.99 | Yıldırım Lotus efekt kaplaması |
   | ss_neo_pack | tek seferlik | $4.99 | Ejder + Lotus + Neo Devre kaplaması + 800 elmas |
   | ss_rebirth_pack | tek seferlik | $1.99 | 600 elmas, 10 ruh, 2 sa x2 güç (ilk Doğuştan sonra 24 saat gösterilir) |
3. <https://www.revenuecat.com> → proje → Android uygulaması (Play hizmet hesabı bağlanır) → ürünleri içe aktar.
4. `monetize.config.js` → `revenuecat.android` = `goog_...` anahtarı. Yeni bir `.aab` derle.

## 7b. Dünya sıralaması (Google Play Games) — isteğe bağlı, yayından sonra da olur
Oyunda **Görev → Sıralama** sekmesi hazır (rütbe, rekorlar, dönemler, yolculuk). "Dünya sıralaması" kartı, aşağıdaki
kimlikler girilene kadar "Yakında" yazar; oyun bunlar olmadan da sorunsuz çalışır.
1. Play Console → uygulaman → **Büyüme → Play Games Hizmetleri → Kurulum ve yönetim → Yapılandırma**.
   "Hayır, oyunum Google API'lerini kullanmıyor" → oyunun adını yaz → **Oluştur**.
2. **Kimlik bilgileri → Android kimlik bilgisi ekle**: paket adı `com.shurikensquad.game`; SHA-1 için
   Play Console → **Test ve yayınla → Uygulama bütünlüğü → Uygulama imzalama anahtarı sertifikası**'ndaki SHA-1'i kullan.
3. **Skor tabloları → Skor tablosu oluştur**: ad "En iyi bölüm", biçim **Sayısal**, sıralama **Yüksek puan daha iyi**,
   simge isteğe bağlı (store/icon-512.png kullanılabilir).
4. Sayfanın üstündeki **Proje kimliği** (yalnızca rakamlar) ile skor tablosunun kimliğini (`Cgk...`) bana gönder;
   ya da kendin `game/android/app/src/main/res/values/games-ids.xml` dosyasındaki iki boş satıra yaz.
5. Play Games projesini **Yayınla** (test kullanıcıları önce de görebilir: **Test kullanıcıları** listesine e-posta ekle).
Oyun en iyi bölümü her yükseldiğinde skor tablosuna gönderir; oyuncu ilk açılışta Play Games'e otomatik giriş yapar.

## 8. Yayından önce son kontrol

- [ ] `monetize.config.js` → `webMode: 'off'` gerekmiyor (uygulama içinde `auto` gerçek SDK kullanır); ama oyunu
      ayrıca web'de yayınlayacaksan orada `off` yap.
- [ ] Gerçek AdMob kimlikleri (adım 6) — kapalı testte test kimlikleri kalabilir.
- [ ] Gizlilik politikası URL'si çalışıyor ve iletişim e-postası dolu.
- [ ] Kapalı testte 12+ kişi, 14 gün.
- [ ] Sürüm notları yazıldı.

Sonraki güncellemeler: kodu değiştir → Actions'ta workflow'u çalıştır (sürüm adı `1.0.1` gibi) → `.aab`'yi
Play Console'da yeni sürüme yükle. İstersen `PLAY_SERVICE_ACCOUNT_JSON` sırrını ekleyip workflow'da
`upload_track: internal` seçerek yüklemeyi de otomatik yapabilirsin.

---

## Mağaza metinleri

**Uygulama adı (en fazla 30):** Shuriken Squad: Ninja Takımı

**Kısa açıklama (en fazla 80):** Ninja takımını kur, sürüleri biç, dev bossları devir! Idle aksiyon RPG.

**Tam açıklama (Türkçe):**

> Shuriken Squad'da ninja takımın yolda ilerlerken canavar sürülerine otomatik olarak shuriken, kunai, ok ve
> büyü fırlatır. Sen takımı güçlendir, silahlarını evrimleştir, bossları devir!
>
> ⚔️ OTOMATİK AKSİYON — Takım kendi savaşır; istediğin an parmağınla kontrolü al.
> 🌀 SÜRÜLER VE KOMBOLAR — Kalabalık dalgaları biç, kombo yap, ekstra altın kazan.
> 👹 DEV BOSSLAR — Zıplama, ışın, hücum, yağmur… Her bossun kendi saldırıları var.
> 🗡️ 13 SİLAH VE EVRİM — Shuriken'den Ruh Küresi'ne, oradan Neo Ninja'nın plazma ve lazer silahlarına.
>    5 yıldızda her silah evrimleşir.
> ✨ EFEKT KAPLAMALARI — Ejder alevi, yıldırım lotus, sakura fırtınası… Her silahta çalışan görsel şölen.
> 🃏 YETENEK KARTLARI — Her boss sonrası 3 karttan birini seç: delen, seken, donduran, yakan atışlar.
> 🌳 RUH AĞACI — Doğuş yap, ruh topla, kalıcı güçler aç.
> 🏯 KULE VE ARENA — Her katta yeni kural, arenada hayatta kalma rekoru.
> 🧑‍🤝‍🧑 TAKIM, TILSIMLAR, YOLDAŞLAR — 5 ninja, her biri ayrı yetenek.
> 🎁 GÜNLÜK ÖDÜLLER VE FESTİVALLER — 7 günlük giriş takvimi, hafta sonu Fener Festivali.
> 💤 SEN YOKKEN DE KAZAN — Takımın sen yokken de altın toplar, maden elmas üretir.
>
> Zorunlu reklam yok. Rastgele ücretli sandık yok. Piksel sanat ve sakin müzikler.

**English — short (max 80):** Build your ninja squad, mow down hordes, topple giant bosses! Idle action RPG.

**English — full description:**

> Your ninja squad marches on and throws shuriken, kunai, arrows and spells at monster hordes all by itself.
> You power them up, evolve their weapons and take down giant bosses!
>
> ⚔️ AUTO ACTION — The squad fights on its own; take control with your finger any time.
> 🌀 HORDES AND COMBOS — Mow down crowds, chain combos, earn bonus gold.
> 👹 GIANT BOSSES — Leaps, beams, charges, rain: every boss has its own attacks.
> 🗡️ 13 WEAPONS AND EVOLUTIONS — From shuriken to spirit orbs, then the Neo Ninja plasma and laser arsenal.
>    Every weapon evolves at 5 stars.
> ✨ EFFECT SKINS — Dragon flame, thunder lotus, sakura storm… a light show that works on every weapon.
> 🃏 SKILL CARDS — After every boss pick 1 of 3: piercing, bouncing, freezing, burning throws.
> 🌳 SOUL TREE — Rebirth, collect souls, unlock permanent powers.
> 🏯 TOWER AND ARENA — A new rule on every floor, and a survival record to beat.
> 🧑‍🤝‍🧑 SQUAD, CHARMS, COMPANIONS — 5 ninjas, each with their own skill.
> 🎁 DAILY REWARDS AND FESTIVALS — A 7-day login calendar and the weekend Lantern Festival.
> 💤 EARN WHILE AWAY — Your squad keeps collecting gold and the mine keeps digging gems.
>
> No forced ads. No paid random loot boxes. Pixel art and calm music.

Not: Kapalı test sürümü (`monetization: free`) reklamsız ve satın almasızdır; o sürüm için "Reklam içeriyor: Hayır".

**Etiketler / kategori:** Oyun → Aksiyon (alternatif: Rol yapma). Etiketler: Idle, Aksiyon, Piksel, Tek oyunculu.

---

## Veri güvenliği (Data safety) formu

- **Veri topluyor veya paylaşıyor mu?** Evet (AdMob ve satın alma için).
- **Aktarım sırasında şifreleniyor mu?** Evet. **Silme talebi:** Kullanıcı uygulamadan silebilir (Ayarlar → Sıfırla).
- Toplanan veri türleri:
  - *Cihaz veya diğer kimlikler* (reklam kimliği) — toplanır ve paylaşılır, **Reklam veya pazarlama**, **Analiz**
    (AdMob), reklamlar isteğe bağlı olduğu için toplama **isteğe bağlı** (kullanıcı reklam izlemeyi seçerse) işaretlenebilir.
  - *Uygulama etkinliği → Uygulama etkileşimleri* (reklam etkileşimi) — AdMob, reklam amaçlı.
  - *Uygulama bilgileri ve performansı → Kilitlenme günlükleri / tanılama* — AdMob SDK, analiz.
  - *Finansal bilgi → Satın alma geçmişi* — yalnızca satın almalar açıksa (RevenueCat), uygulama işlevi.
  - *Uygulama etkinliği → Uygulama etkileşimleri* ve *Cihaz veya diğer kimlikler* (rastgele kurulum kimliği) —
    **GameAnalytics**, amaç **Analiz**, **isteğe bağlı** (oyuncu Ayarlar'dan kapatabilir), paylaşılmaz, anonim.
  - *Uygulama bilgileri ve performansı → Diğer performans verileri* (FPS / bellek özeti) — GameAnalytics, analiz.
- Konum, kişiler, fotoğraf, mesaj, e-posta, ad **toplanmaz**.

## İçerik derecelendirmesi (IARC anketi) — önerilen cevaplar

Şiddet: **çizgi film/fantastik şiddet, kan yok** (canavarlar piksel efektle kaybolur). Cinsellik, küfür,
uyuşturucu, kumar: **yok** (ücretli rastgele sandık yok). Kullanıcılar arası iletişim: **yok**.
Satın alma: **evet (dijital ürünler)**. Beklenen sonuç: PEGI 7 / ESRB Everyone 10+ civarı.

## Hedef kitle

**13 ve üzeri** seç (13–15, 16–17, 18+). 13 altını seçersen Aileler politikası devreye girer:
`monetize.config.js` → `admob.childDirected: true` yapılmalı ve kişiselleştirilmiş reklam kapanır.
