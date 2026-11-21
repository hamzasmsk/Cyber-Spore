# Swarm Squad

Telefon için yandan görünümlü bir **koş-ve-vur** (run-and-gun) aksiyon oyunu. Saf HTML5 Canvas + JavaScript,
hiçbir kütüphane yok. `game/` klasörü tek başına çalışır, ayrı bir depoya olduğu gibi taşınabilir.
Telefonda yatay oynanır; "Ana ekrana ekle" ile uygulama gibi tam ekran açılır (PWA).

## Oynanış (dikey, tek dokunuş)
- Telefon **dik** tutulur. Karakter kendiliğinden sağa koşar ve otomatik nişan alıp ateş eder.
- Önüne düşman, kasa veya kafes çıkınca durur ve vurur; temizlenince koşmaya devam eder.
- **Ekrana dokun = zıpla**, havada tekrar dokun = çift zıplama (basılı tutarsan daha yüksek). Dikenler, çukurlar ve boss'un şok dalgaları zıplanarak aşılır.
- **Kafesleri vurup kır**: içindeki esir takımına katılır ve seninle ateş eder (en fazla 3).
- Kasalardan altın, can, **özel silahlar** (pompalı, makineli, lazer, roketatar; otomatik takılır) ve **kaykay** (kalkan + hız + ekstra zıplama) çıkar. Düşmanların üstüne düşerek ezebilirsin.
- **5 dünya × 5 bölüm**, her dünyanın sonunda boss. Dünya haritasında bölüm bölüm ilerlenir; her bölümden 3 yıldız.
- Altınla 5 kahraman ve 5 kalıcı geliştirme (Atölye). Ölünce altınla bir kez dirilme.
- Masaüstünde Boşluk / W / yukarı ok = zıpla.

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
