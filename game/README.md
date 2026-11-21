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

## Dosyalar
- `index.html`, `game.css`, `game.js` — oyun çekirdeği ve eklenti API'si (`window.SS`)
- `features/*.js|css` — ek modüller
- `assets/` — üretilmiş varlıklar ve lisanslar (`assets/LICENSE-ASSETS.txt`)
