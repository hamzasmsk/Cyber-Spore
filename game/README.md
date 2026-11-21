# Neon Swarm

Mobil öncelikli bir hayatta kalma nişancısı (survivor shooter). Saf HTML5 Canvas + JavaScript, hiçbir bağımlılık yok.
Tamamen bağımsız bir projedir: `game/` klasörü tek başına çalışır, ayrı bir depoya olduğu gibi taşınabilir.
Telefonda "Ana ekrana ekle" ile uygulama gibi tam ekran açılır (PWA).

## Oynanış
- Ekrana dokun ve sürükle: hareket (masaüstünde WASD / ok tuşları). Ateş otomatik, en yakın düşmana nişan alır.
- Düşmanlardan düşen yeşil kürelerle seviye atla ve 3 güçten birini seç (14 farklı güç).
- Her bölümde süre dolunca boss gelir; bossu yenince sonraki bölüm açılır (5 bölüm, 5 boss).
- Toplanan altınla kalıcı geliştirmeler (7 adet) ve yeni karakterler (4 adet) alınır.

## Dosyalar
| Dosya | İçerik |
|---|---|
| `index.html` | Ekranlar (menü, bölümler, karakterler, mağaza, seviye atlama, sonuç) |
| `game.css` | Arayüz stili |
| `game.js` | Oyun motoru: veri tabloları (CHARS, META, ENEMIES, BOSSES, STAGES, UPGRADES), güncelleme, çizim |
| `sw.js`, `manifest.webmanifest`, `icon.svg` | PWA (çevrimdışı çalışma, ana ekrana ekleme) |

Yeni düşman, boss, bölüm veya güç eklemek için `game.js` başındaki tablolara bir satır eklemek yeterli.

## Yol haritası
1. **Denge ve his** – gerçek telefonda test, zorluk eğrisi, ses efektleri, titreşim ayarı.
2. **İçerik** – daha fazla bölüm, silah türleri (lazer, roket, alev), güç evrimleri, günlük görevler.
3. **Görsel** – sprite çizimleri / animasyonlar, bölüme özel arka planlar, müzik.
4. **Mağaza yayını** – Capacitor ile aynı kodu Android (Google Play) ve iOS (App Store) uygulamasına sarmak;
   ödüllü reklam ve uygulama içi satın alma eklemek.
5. **Gerekirse motor değişikliği** – oyun çok büyürse Godot veya Unity'ye taşımak.
