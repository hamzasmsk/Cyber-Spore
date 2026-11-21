# Swarm Squad

Telefon için yandan görünümlü bir **koş-ve-vur** (run-and-gun) aksiyon oyunu. Saf HTML5 Canvas + JavaScript,
hiçbir kütüphane yok. `game/` klasörü tek başına çalışır, ayrı bir depoya olduğu gibi taşınabilir.
Telefonda yatay oynanır; "Ana ekrana ekle" ile uygulama gibi tam ekran açılır (PWA).

## Oynanış (dikey idle nişancı)
- Takım çapraz yolun ortasında durur ve sağdan gelen düşmanlara **otomatik ateş eder**; elinde telefon olmasa da savaşır.
- Her düşman **altın** düşürür (para banknotları cüzdana uçar). Alttaki 3 kartla geliştirme alınır:
  **Güç** (atış başına hasar), **Hız** (saniyedeki atış), **Para** (düşmanların verdiği altın çarpanı). Karta basılı tutunca art arda alır.
- **Bölüm X-Y**: her bölümde 5 aşama var; her aşamada 8 düşman. 5. aşamadan sonra **30 saniyelik boss** gelir.
  Süre içinde yenersen sonraki bölüm açılır ve **elmas** kazanırsın; yenemezsen güçlenip tekrar denersin (Oto açıksa kendisi dener).
- **Silah**: elmasla 8 silah kademesi (tabancadan plazma topuna, hasar x900'e kadar).
- **Takım**: altınla 5 astronota kadar; her biri bir silah daha demek.
- **Yeniden Doğuş**: 6. bölümden sonra; bölüm, seviyeler ve altın sıfırlanır, kalıcı hasar ve para bonusu kazanırsın.
- **Çevrimdışı kazanç**: oyunu kapattığında takım savaşmaya devam eder (8 saate kadar).
- Sayılar büyüdükçe K, M, B, T, aa, ab... şeklinde kısaltılır. 5 farklı bölge (çimen, mantar, çöl, buz, lav) döngüyle değişir.

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
