# Shuriken Squad — Ajan Ofisi

Her gün zamanlanmış bir görev yeni bir oturum açar ve **günün ajanı** oyunu analiz edip iyileştirir. Bu dosya
ajanların ortak kurallarıdır; her çalıştırmada önce bu dosya, sonra `BACKLOG.md` ve `LOG.md` okunur.

## Günün ajanı (İstanbul saatine göre haftanın günü)

| Gün | Ajan | Odak |
|---|---|---|
| Pazartesi | **Test & Hata** | Tüm testleri çalıştır, oyunu farklı ekran boylarında (360×640, 390×844, 412×915, tablet 768×1024) oynat, hata/konsol uyarısı/taşan arayüz/üst üste binen öğe ara ve düzelt. Kaydın eski sürümlerden yüklenmesini (`save` alanları eksik) dene. |
| Salı | **Denge & Ekonomi** | `node tools/economy-sim.js` çalıştır; ilk 10 dk / 1 sa / 10 sa ilerleme, duvarlar, elmas akışı, Doğuş zamanlaması. Bir şey kötüleştiyse veya yeni sistem dengeyi bozduysa küçük, ölçülü ayar yap ve önce/sonra sayıları LOG'a yaz. |
| Çarşamba | **Görsel & Arayüz** | Ekran görüntüleri al (tools/tests/out), okunabilirlik, hizalama, piksel tutarlılığı, panel düzeni, efekt yoğunluğu. Pixel-perfect kurallarına uy (ölçek 0,5'in katları, `snap`). |
| Perşembe | **His & Ses** | Vuruş hissi, geri bildirim, ses seviyeleri ve uyumu (sesler D majör pentatonik), müzik geçişleri, titreşim. Seviye ölçümü için `SS._audio` ile analiz yapılabilir. |
| Cuma | **İçerik** | `BACKLOG.md`'den en değerli, tek oturumda bitebilecek bir özelliği yap (yeni silah, boss saldırısı, kart, başarım, etkinlik…). |
| Cumartesi | **Oyuncu deneyimi** | Yeni oyuncu gibi sıfır kayıtla ilk 15 dakikayı oynat (testlerdeki gibi Playwright ile hızlandırarak): hedef zinciri, açılan menüler, pencere sırası, sıkıcı/boş anlar, kafa karıştıran yerler. Düzelt. |
| Pazar | **Haftalık rapor** | Haftanın LOG kayıtlarını özetle, `BACKLOG.md`'yi yeniden önceliklendir, küçük bir temizlik/yeniden düzenleme yap. |

## Kurallar

1. **Çalışma yeri:** repo `hamzasmsk/Cyber-Spore`, oyun `game/` klasöründe. Repo kökündeki site dosyalarına
   (index.html, privacy.html, style.css, terms.html …) **dokunma**; oyunun Cyber-Spore ile ilgisi yoktur.
2. **Dal:** `claude/hopeful-einstein-68rxe9`. Çalışmaya başlamadan `git fetch origin claude/hopeful-einstein-68rxe9`
   ve o dalın son haline geç. İş bitince aynı dala gönder (`git push origin HEAD:claude/hopeful-einstein-68rxe9`).
   Gönderim reddedilirse `git pull --rebase` yapıp testleri tekrar çalıştır, sonra gönder. Asla force-push yapma.
   PR açma (PR #1 zaten var, gönderimler onu günceller).
3. **Test zorunlu:** değişiklikten sonra `cd game && npm install --no-audit --no-fund` (gerekirse) ve
   `node tools/tests/run.js`. **Tüm testler geçmeden gönderme.** Kalan bir test varsa ya düzelt ya değişikliği geri al.
   Testleri yeni davranışa uydurmak gerekiyorsa sadece testin kendisi yanlışsa güncelle, oyunu bozmak için asla.
4. **Küçük ve güvenli:** bir çalıştırmada 1–3 odaklı iyileştirme. Büyük yeniden yazım yok. Oyuncu kayıtlarıyla geriye
   uyumluluğu koru (yeni `save` alanlarına varsayılan değer ver, eski alanları silme).
5. **Para kazanma kuralları:** zorunlu reklam yok, ücretli rastgele sandık yok, fiyatları/ürün kimliklerini değiştirme
   (`monetize.config.js` ürün kimlikleri mağazayla eşleşmeli).
6. **Sanat tutarlılığı:** tek sanat kaynağı (Ninja Adventure paketi, `assets/atlas.*`). Dışarıdan karışık stilde görsel
   ekleme. Var olan bir oyunun karakter/isim/görselini kopyalama.
7. **Dil:** oyun içi metinler Türkçe. Commit mesajları İngilizce, kısa; sonuna şu satırlar:
   ```
   Co-Authored-By: Claude <noreply@anthropic.com>
   ```
   Commit mesajında, kodda veya dosyalarda model adı yazma.
8. **Kayıt:** her çalıştırmanın sonunda `agents/LOG.md`'nin **en üstüne** bir kayıt ekle: tarih, ajan, ne buldun,
   ne değiştirdin, test sonucu, sonraki öneri. Yapılamayan iş varsa `BACKLOG.md`'ye ekle.
9. **Web sürümü:** gönderdikten sonra Artifact aracı varsa `game/index.html`'i
   https://claude.ai/artifact/1RZeKYt3MajpjDvNTAewNb adresine yeniden yayınla (root = `game`, değişen dosyaları
   `files` ile). Araç yoksa bu adımı atla.
10. **Test Paneli:** yeni bir özellik/olay eklersen `features/devtools.js`'e onu anında denemeye yarayan bir düğme
    ekle (oyun sahibi seviye kasmadan test edebilmeli).
11. Bir şey belirsizse veya riskliyse yapma; LOG'a "karar bekliyor" diye yaz.
