# Shuriken Squad — Google Play'e çıkış rehberi

Mac gerekmez. Uygulama paketi (.aab) GitHub'ın bulut sunucusunda derlenir; senin bilgisayarına Android Studio
kurman bile gerekmez. Aşağıdaki adımlar sırayla.

## 0. Hazır olanlar (bu klasörde)

| Dosya | Ne işe yarar |
|---|---|
| `../android/` | Android projesi (uygulama kimliği `com.shurikensquad.game`, dikey ekran, ikonlar, açılış ekranı, imzalama ayarı) |
| `/.github/workflows/android-release.yml` | Bulutta imzalı `.aab` üreten iş |
| `icon-512.png` | Mağaza ikonu (512×512) |
| `feature-graphic-1024x500.png` | Mağaza tanıtım görseli |
| `screenshots/*.png` | 8 telefon ekran görüntüsü (1080×1920, başlıklı) |
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

GitHub → **Actions → Shuriken Squad Android → Run workflow** → sürüm adı `1.0.0` → çalıştır.
~10 dakika sonra çalıştırma sayfasında **Artifacts** altında `shuriken-squad-1.0.0-N` (içinde `app-release.aab`).
Her çalıştırmada sürüm kodu (versionCode) otomatik artar.

## 4. Play Console'da uygulamayı oluştur

1. **Uygulama oluştur:** ad `Shuriken Squad`, varsayılan dil Türkçe, **Oyun**, **Ücretsiz**.
2. **Uygulama içeriği** bölümünü doldur (cevaplar en altta): gizlilik politikası URL'si, reklamlar (**Evet**),
   uygulama erişimi (giriş gerekmiyor), içerik derecelendirmesi, hedef kitle (**13+**, çocuklara yönelik değil),
   veri güvenliği, reklam kimliği (**Evet, reklam için**), devlet uygulaması değil, finansal özellik yok.
3. **Mağaza girişi:** metinler, `icon-512.png`, `feature-graphic-1024x500.png`, `screenshots/` (en az 2, hepsini yükle),
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
   (`ss_gems_1` … `ss_offer_power`; `ss_starter` ve `ss_noads` tek seferlik, diğerleri tüketilebilir).
3. <https://www.revenuecat.com> → proje → Android uygulaması (Play hizmet hesabı bağlanır) → ürünleri içe aktar.
4. `monetize.config.js` → `revenuecat.android` = `goog_...` anahtarı. Yeni bir `.aab` derle.

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

**Kısa açıklama (en fazla 80):** Ninja takımını kur, sürüleri biç, bossları devir! Idle aksiyon RPG.

**Tam açıklama:**

> Shuriken Squad'da beş kişilik ninja takımın yolda ilerlerken canavar sürülerine otomatik olarak shuriken,
> kunai, ok ve büyü fırlatır. Sen takımı güçlendir, silahlarını evrimleştir, bossları devir!
>
> ⚔️ OTOMATİK AKSİYON — Takım kendi savaşır; istediğin an parmağınla kontrolü al, bıraktığında yine kendi devam eder.
> 🌀 SÜRÜLER VE KOMBOLAR — Kalabalık dalgaları biç, kombo yap, ekstra altın kazan.
> 👹 DEV BOSSLAR — Her bossun kendine özel saldırıları var: zıplama, ışın, hücum, yağmur. Kaç, vur, kazan!
> 🗡️ 8 SİLAH VE EVRİM — Shuriken'den Ruh Küresi'ne; yıldız yükselt, 5 yıldızda silahını evrimleştir.
> 🃏 YETENEK KARTLARI — Her boss sonrası 3 karttan birini seç: delen, seken, donduran, yakan atışlar. Her tur farklı.
> 🌳 RUH AĞACI — Doğuş yap, ruh topla, üç daldan kalıcı güçler aç.
> 🏯 KULE — Her katta yeni bir kural; ne kadar yükseğe çıkabilirsin?
> 🧑‍🤝‍🧑 TAKIM VE KAHRAMANLAR — 5 ninja, her biri ayrı yetenek; parşömenlerle seviye atlat.
> 🎁 NİNJA YOLU, GÜNLÜK ÖDÜLLER, FESTİVALLER — Sezonluk kostümler, hafta sonu Fener Festivali.
> 💤 SEN YOKKEN DE KAZAN — Çevrimdışı kazanç ve elmas madeni.
>
> Zorunlu reklam yok: yalnızca kendi seçtiğin ödüllü reklamlar. Rastgele ücretli sandık yok.
> Sakin, rahatlatıcı müzikler ve piksel sanat.

**İngilizce (isteğe bağlı çeviri):**
- Short: *Build your ninja squad, mow down hordes and topple giant bosses! Idle action RPG.*
- Full: aynı yapıda; Play Console'un çeviri hizmetini de kullanabilirsin.

**Etiketler / kategori:** Oyun → Aksiyon (alternatif: Rol yapma). Etiketler: Idle, Aksiyon, Piksel, Tek oyunculu, Çevrimdışı.

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
- Konum, kişiler, fotoğraf, mesaj, e-posta, ad **toplanmaz**.

## İçerik derecelendirmesi (IARC anketi) — önerilen cevaplar

Şiddet: **çizgi film/fantastik şiddet, kan yok** (canavarlar piksel efektle kaybolur). Cinsellik, küfür,
uyuşturucu, kumar: **yok** (ücretli rastgele sandık yok). Kullanıcılar arası iletişim: **yok**.
Satın alma: **evet (dijital ürünler)**. Beklenen sonuç: PEGI 7 / ESRB Everyone 10+ civarı.

## Hedef kitle

**13 ve üzeri** seç (13–15, 16–17, 18+). 13 altını seçersen Aileler politikası devreye girer:
`monetize.config.js` → `admob.childDirected: true` yapılmalı ve kişiselleştirilmiş reklam kapanır.
