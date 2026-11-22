# Shuriken Squad

Telefon için **dikey idle nişancı**. Saf HTML5 Canvas + JavaScript, hiçbir kütüphane yok. `game/` klasörü tek başına
çalışır; "Ana ekrana ekle" ile uygulama gibi tam ekran açılır (PWA).

## Oynanış
- Beş kişilik ninja mangası yolun alt yarısında durur ve yukarıdan gelen canavarlara **otomatik shuriken atar**.
  Ekranı sürükleyerek (veya WASD/ok tuşları) mangayı hareket ettirip mermilerden kaçabilirsin.
- Düşmanlar **altın** düşürür; alttaki 3 kartla geliştirme alınır: **Güç**, **Hız**, **Para** (basılı tut = art arda al).
- **Bölüm X-Y**: her bölümde 5 aşama, her aşamada 8 düşman, sonunda **30 saniyelik boss** (10 farklı boss).
- **Silah** (elmasla 8 kademe: shuriken → kunai → üçlü ok → … → ruh küresi), **Takım** (altınla 5 ninja),
  **Yeniden Doğuş** (6. bölümden sonra kalıcı bonus), **çevrimdışı kazanç** (8 saate kadar).
- Ek modüller (`features/`): görevler, maden, kumbara, güçlendirmeler, mağaza, kostüm (lider karakteri), ayarlar.
- 5 bölge döngüyle değişir: Bambu Vadisi, Kara Orman, Kızıl Kanyon, Buz Geçidi, Kül Diyarı.

## Uzun vadeli sistemler
- **Ruh Ağacı** (Doğuş → Ruh Ağacı): her Doğuş ruh verir; Saldırı / Servet / Ustalık dalları ve Gölge Yolu usta düğümü (`features/tree.js`).
- **Yetenek kartları**: her boss sonrası 3 karttan biri (delme, sekme, buz, alev, şimşek, patlama, çifte bıçak…); Doğuşa kadar geçerli (`features/perks.js`).
- **Kahraman seviyeleri**: bosslardan düşen parşömen + altınla her ninja 20 seviyeye kadar (Takım paneli).
- **Kule**: sabit zorlukta sonsuz boss katları, her katın kuralı farklı, günde 3 hak (`features/tower.js`).
- **Başarımlar**: kademeli hedefler; her kademe elmas + kalıcı %2 hasar (`features/achievements.js`). Görevler · Kule · Başarım tek panelde (`features/hub.js`).
- **Günlük ödül takvimi** (7 gün, kaçırılan gün sıfırlamaz) ve isteğe bağlı **hatırlatıcı bildirimler** (günde en fazla 2, gece yok) (`features/daily.js`).
- **Fener Festivali**: her hafta sonu fener düşer, festival mağazasında özel kostüm ve eşyalar (`features/events.js`).
- **Kayıt kodu**: Ayarlar → Kayıt kodu ile ilerleme başka cihaza taşınır.

## Sanat yönü: tek kaynak, piksel-mükemmel
Bütün grafik, efekt, arayüz çerçevesi, ikon, ses ve müzik **tek bir paketten** gelir:
**Ninja Adventure** — Pixel-boy & AAA, CC0 (ticari kullanım serbest). Böylece palet, piksel yoğunluğu ve kontur
stili her yerde aynıdır.
- Sprite'lar 1x yerel boyutta atlasa konur ve tek bir tam-sayı ölçekle (`P`, cihaz pikseline oturtulmuş) yumuşatmasız çizilir.
  Piksel sanatı serbestçe döndürülmez (dönen yıldızlar kare değiştirir, diğerleri 16 yöne oturur).
- Arayüz paketin ahşap 9-dilim çerçeveleri, buton rampaları ve ikon karolarıyla yapılır; gradyan / bulanık gölge yok.
- Yazı: Pixelify Sans (OFL, Türkçe karakterler) + rakamlar için paketin kendi piksel fontu.
- Ses: paketin en yumuşak efektleri seçilip tiz kısmı kesilir ve ses seviyesi eşitlenir; her bölgede sakin bir müzik çalar
  (yavaş geçişli). Oyun içinde yumuşak bir kompresör ve alçak geçiren filtre üst üste binen sesleri törpüler.

`tools/build_assets.py` paketten `assets/atlas.png` + `assets/atlas.js`, `assets/ui/`, `assets/sfx.js`, `assets/music/`
ve `assets/fonts/` dosyalarını üretir:

```
# Ninja Adventure paketi (CC0) ve @fontsource/pixelify-sans (npm pack) gerekir
python3 game/tools/build_assets.py "<.../Ninja Adventure - Asset Pack>" <pixelify-sans paket klasörü>
```

## Para kazanma
Ödüllü reklamlar (yalnızca isteğe bağlı), uygulama içi satın almalar, Ninja Yolu sezon bileti, kumbara ve bağlama göre
teklifler. Ayrıntılar ve mağaza kurulumu: [MONETIZATION.md](MONETIZATION.md). Ayarlar: `monetize.config.js`.
Tarayıcıda her şey açıkça etiketli **TEST MODU**nda çalışır (gerçek ödeme/reklam yok).

## Uygulama olarak paketleme (Capacitor)
```
npm install
npx cap add ios && npx cap add android
npm run ios        # veya: npm run android
```

## Dosyalar
- `index.html`, `game.css`, `game.js` — oyun çekirdeği ve eklenti API'si (`window.SS`)
- `features/*.js|css` — ek modüller (görevler, maden, kumbara, güçlendirme, mağaza, kostüm, koleksiyon, Ninja Yolu, Ruh Ağacı, yetenek kartları, Kule, başarımlar, günlük ödül, festival, ayarlar, para kazanma, uygulama köprüsü)
- `monetize.config.js`, `package.json`, `capacitor.config.json`, `tools/build-www.js` — para kazanma ayarları ve uygulama paketleme
- `assets/` — üretilmiş varlıklar ve lisanslar (`assets/LICENSE-ASSETS.txt`)
