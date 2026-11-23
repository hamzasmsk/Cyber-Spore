# Ajan Ofisi Kayıtları (en yeni en üstte)

## 2026-11-22 · Kurulum
- Ofis kuruldu: günlük zamanlanmış görev, `OFFICE.md` kuralları, `BACKLOG.md`, kalıcı test takımı
  (`node tools/tests/run.js`, 10 tarayıcı testi).
- Mevcut durum: tüm testler geçiyor; Android test APK'sı bulutta derleniyor.

## 2026-11-23 — Tam denetim
- i18n: '{s}' isim kalıpları, baş/son ' · ' ayırıcıları, süre birimleri (sa/dk/sn/g → h/m/s/d), Mr → b; ~40 eksik metin. tools/tests/i18nscan.js her paneli İngilizce tarar (run.js'e eklendi).
- Düzen: yükseltme kartlarında seviye etiketi kenarda (isim kesilmez), değer yazısı ekrana göre küçülür, hedef çipi genişledi, kilitli menü etiketi çevrilir.
- Tablet: HUD ve paneller bütün olarak ölçeklenir (html.uiz, layout.js); piksel-netleştirme ölçeği hesaba katar.
- tools/tests/audit.js: 5 ekran × 2 dil × tüm paneller + 3 dk x8 dayanıklılık (uzun sürdüğü için run.js dışında).
