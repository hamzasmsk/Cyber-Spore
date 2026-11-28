# Kapalı test rehberi (kişisel Play hesabı: 12 test kullanıcısı × 14 gün)

Kişisel hesaplarda Google, üretime (herkese açık yayına) geçmeden önce **en az 12 kişinin 14 gün boyunca
kesintisiz** kapalı teste katılmış olmasını ister. 2026'da gelen geri bildirimlere göre sadece sayı değil,
**gerçek kullanım** da kontrol ediliyor: kimse oynamazsa başvuru "yetersiz etkileşim" ile reddedilebilir ve
14 gün yeniden başlar. Bu yüzden 15–20 kişi davet et (biri çıkarsa 12'nin altına düşme).

## 1. Yükleme (Play Console)
1. **Uygulama oluştur** → ad: *Shuriken Squad*, Oyun, Ücretsiz.
2. GitHub → Actions → **Shuriken Squad Android** → Run workflow → `version_name: 1.0.0`,
   `monetization: free` (reklam ve satın alma yok, reklam ödülleri doğrudan verilir) → oluşan `.aab` dosyasını indir.
3. Play Console → **Test → Kapalı test → Kanal oluştur** → sürüm oluştur → `.aab`'yi yükle.
4. **Test kullanıcıları** → e-posta listesi oluştur → kişilerin Gmail adreslerini ekle.
5. Mağaza girişi (açıklamalar, ekran görüntüleri: `store/`), içerik derecelendirmesi, veri güvenliği
   (`PLAY_STORE.md`), hedef kitle (13+), reklam: **Hayır** (free sürümde reklam yok) → incelemeye gönder.
6. Onay gelince **katılım bağlantısını** test kullanıcılarına gönder.
   - 14 günlük sayaç, bir kişi katılımı kabul edip oyunu **Google Play'den** kurduğunda başlar (APK ile kuranlar sayılmaz).
   - 13 yaş altı Google hesapları test kullanıcısı olamaz.

## 2. Test kullanıcılarına gönderilecek mesaj (kopyala)

> Selam! Yaptığım oyunu Google Play'de yayınlamadan önce 14 gün test etmem gerekiyor, yardım eder misin? 🙏
> 1) Bu bağlantıya Gmail hesabınla gir ve "Test kullanıcısı ol"a bas: <KATILIM BAĞLANTISI>
> 2) Sayfadaki "Google Play'den indir" ile oyunu kur.
> 3) **14 gün boyunca uygulamayı silme** ve mümkünse her gün birkaç dakika aç (idle oyun, kapalıyken de ilerliyor).
> 4) Beğenmediğin ya da takıldığın bir şey olursa bana yaz ya da Play'deki oyun sayfasından "özel geri bildirim" bırak.
> Teşekkürler!

## 3. 14 gün boyunca
- Oyun her gün giriş ödülü, maden ve günlük görevlerle geri gelmeyi zaten teşvik ediyor; hatırlatıcı bildirimleri
  açmalarını söyle (oyun ilk günlerde soracak).
- GameAnalytics panelinden kaç kişinin her gün açtığını takip et (Genel Bakış → DAU). Biri hiç açmıyorsa yaz.
- Gelen geri bildirimle **en az bir güncelleme** yayınla (sürüm 1.0.1 gibi). Google bunu "testten öğrenilenler"
  olarak soruyor; güncelleme yapmış olmak başvuruyu güçlendirir.

## 4. Üretim erişimi başvurusu (14 gün dolunca)
Play Console → Ana sayfa → **Üretim erişimi için başvur**. Sorulanlar ve önerilen cevaplar:
- *Test kullanıcılarını nasıl buldun?* → Arkadaşlar, aile ve oyun toplulukları; kişisel davetle.
- *Ne kadar kolay oldu?* → Dürüstçe.
- *Kullanıcıların etkileşimini anlat* → Günlük açılış (GameAnalytics), oynanan bölümler, ortalama oturum.
- *Geri bildirimleri nasıl topladın, neler değişti?* → Gelen notlar ve yaptığın değişiklikler (sürüm notları).
- *Hedef kitle, değer önerisi* → Portre ekranda idle ninja takımı; kısa oturumlar, çevrimdışı ilerleme.
- *Üretime hazır mı, nasıl karar verdin?* → Kilitlenme yok (Play Console → Android vitals), geri bildirimler
  düzeltildi, 14 gün boyunca kullanıcılar geri döndü.

## 5. Test kullanıcısı bulmak için
- Arkadaş, aile, okul/iş grupları (en sağlamı: gerçekten oynarlar).
- Reddit: r/AndroidClosedTesting, r/TestersCommunity (karşılıklı test: sen onlarınkini, onlar seninkini).
- Karşılıklı test uygulamaları/siteleri (ör. "Testers Community"): hızlı ama etkileşim zayıf olabilir;
  yalnızca arkadaşlarla 12'yi dolduramazsan ek olarak kullan.
