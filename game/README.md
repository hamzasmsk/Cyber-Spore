# Swarm Squad

Telefon için yandan görünümlü bir **koş-ve-vur** (run-and-gun) aksiyon oyunu. Saf HTML5 Canvas + JavaScript,
hiçbir kütüphane yok. `game/` klasörü tek başına çalışır, ayrı bir depoya olduğu gibi taşınabilir.
Telefonda yatay oynanır; "Ana ekrana ekle" ile uygulama gibi tam ekran açılır (PWA).

## Oynanış
- Sağa doğru ilerle, düşmanları vur, **bitiş bayrağına** ulaş. Ekrandaki tuşlar: ◀ ▶ hareket, yeşil zıpla, kırmızı ateş,
  el bombası, atılma (dash), silah değiştir. Masaüstü: A/D veya oklar, Boşluk zıpla, J ateş, G bomba, L/Shift dash, R silah.
- Ateş, öndeki düşmana hafifçe kendiliğinden nişan alır (uçan düşmanlar için). Ayarlardan tam otomatik ateş açılabilir.
- **Kafesteki esirleri** yanlarında durarak kurtar; takımına katılıp seninle birlikte ateş ederler (en fazla 3).
- Kasaları kır: altın, can, el bombası, **özel silahlar** (pompalı, makineli, lazer, roketatar) ve **kaykay** (çift zıplama + hız) çıkar.
- Düşmanların üstüne zıplayarak ezebilirsin. **"SAVAŞ!"** bölgelerinde kamera kilitlenir, dalgaları temizlemeden ilerleyemezsin.
- Dikenler, çukurlar, yaylar ve kontrol noktaları var. Ölünce altınla bir kez dirilebilirsin.
- **5 dünya × 5 bölüm = 25 bölüm**, her dünyanın sonunda farklı saldırı kalıplarına sahip bir boss var.
  Dünya haritasında bölüm bölüm ilerlersin; her bölümden 3 yıldız alınır (bitir, tüm esirleri kurtar, canın yarısından fazlasıyla bitir).
- Altınla 5 kahraman (her birinin özelliği farklı) ve 6 kalıcı geliştirme (Atölye) alınır.

## Görseller
Kenney (CC0, ticari kullanım serbest): New Platformer Pack (karakterler, düşmanlar, zeminler, arka planlar, eşyalar),
Monster Builder Pack (bosslar parçalardan birleştirilir), Explosion Pack, Smoke Particles, Particle Pack, Game Icons.
Yazı tipi: Baloo 2 (OFL). Butonlar ve paneller CSS ile çizilir.

`tools/build_assets.py` bu paketlerden `assets/atlas.png` + `assets/atlas.js` ve `assets/ui/` dosyalarını üretir:

```
git clone --depth 1 https://github.com/shorepine/kenney /tmp/kenney   # Kenney paketlerinin aynası
python3 game/tools/build_assets.py /tmp/kenney
```

## Kod
`game.js` içinde veri tabloları en üstte: `WORLDS` (dünya teması, düşman havuzu, boss saldırı kalıbı), `EDEF` (düşmanlar),
`WPN` (silahlar), `HEROES`, `UPG`. Bölümler `genLevel(g)` ile her bölüm numarası için aynı şekilde (tohumlu rastgele) üretilir.

## Yol haritası
1. Gerçek telefonda his ve denge ayarı; müzik.
2. Daha fazla binek (motor, robot), yeni silahlar, günlük görevler.
3. Capacitor ile Android/iOS uygulaması; ödüllü reklamla diriliş, uygulama içi satın alma.
