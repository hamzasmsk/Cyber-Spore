# Swarm Squad

Mobil öncelikli bir hayatta kalma nişancısı (survivor shooter): sevimli hayvan kahramanlar canavar sürülerine karşı.
Saf HTML5 Canvas + JavaScript, hiçbir kütüphane bağımlılığı yok. `game/` klasörü tek başına çalışır ve ayrı bir depoya
olduğu gibi taşınabilir. Telefonda "Ana ekrana ekle" ile uygulama gibi tam ekran açılır (PWA).

## Oynanış
- Ekrana dokun ve sürükle: hareket (masaüstünde WASD / ok tuşları). Ateş otomatik, en yakın düşmana nişan alır.
- Düşmanlardan düşen kristallerle seviye atla ve 3 güçten birini seç (14 güç).
- Her bölümde süre dolunca boss gelir; bossu yenince sonraki bölüm açılır (5 bölüm / 5 biyom / 5 boss).
- Altınla kalıcı geliştirmeler (7) ve yeni kahramanlar (4) alınır.

## Görseller
Tüm grafikler [Kenney](https://kenney.nl) paketlerinden (CC0, ticari kullanım serbest):
Animal Pack Remastered (kahramanlar), Monster Builder Pack (canavarlar parçalardan birleştirilir),
Topdown Shooter (zemin), Background Elements Remastered (ağaç/çalı), Particle Pack, Splat Pack,
New Platformer Pack (kristal/altın/kalp), UI Pack ve Game Icons. Yazı tipi: Baloo 2 (OFL).

`tools/build_assets.py` bu paketlerden `assets/atlas.png` + `assets/atlas.js` ve `assets/ui/` dosyalarını üretir:

```
git clone --depth 1 https://github.com/shorepine/kenney /tmp/kenney   # Kenney paketlerinin aynası
python3 game/tools/build_assets.py /tmp/kenney
```

Yeni canavar eklemek için betikteki `MONSTERS` tablosuna bir tarif (gövde + göz + ağız + boynuz) eklemek yeterli.

## Dosyalar
| Dosya | İçerik |
|---|---|
| `index.html`, `game.css` | Ekranlar ve arayüz |
| `game.js` | Oyun motoru: veri tabloları (CHARS, META, ENEMIES, BOSSES, STAGES, UPGRADES), güncelleme, çizim |
| `assets/` | Atlas, arayüz görselleri, yazı tipi |
| `sw.js`, `manifest.webmanifest`, `icon.png` | PWA |

## Yol haritası
1. Gerçek telefonda test, zorluk dengesi, ses efektleri ve müzik.
2. İçerik: yeni silahlar, güç evrimleri, günlük görevler, daha fazla bölüm; kurbağa ve penguen kahramanları hazır.
3. Capacitor ile Android/iOS uygulaması; ödüllü reklam ve uygulama içi satın alma.
