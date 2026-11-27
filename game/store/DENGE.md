# Shuriken Squad — Denge Rehberi

Oyunun zorluğu ve ekonomisi birkaç ana sayıya bağlı. Bu sayılar **yeni sürüm çıkarmadan**, GameAnalytics
panelinden değiştirilebilir (Remote Configs). Oyuncu oyunu bir sonraki açışında yeni değerlerle oynar.

## 1. Sayıyı uzaktan değiştirmek (Remote Configs)
1. gameanalytics.com → oyunu seç → sol menü **Remote Configs** (bazen **Configure → Remote Configs**).
2. **Create config** → **Key**: aşağıdaki tablodan bir anahtar, örneğin `tune_earlyHp`.
3. **Value**: sayı, örneğin `2.2`. Ondalık ayırıcı nokta olmalı (`2.2`, virgül değil).
4. **Save / Publish**. Değer birkaç dakika içinde oyunculara gider.
5. Eski değere dönmek için config'i sil. Oyun kendi varsayılanına döner.

Güvenlik: Oyun her değeri bir güvenli aralıkta tutar; aralık dışındaki bir değer en yakın sınıra çekilir. Yanlış
yazılan anahtar veya sayı olmayan değer görmezden gelinir. Tek seferde **tek bir** sayıyı değiştir, bir hafta ölç.

## 2. Ayarlanabilir sayılar

| Anahtar | Varsayılan | Aralık | Ne yapar |
|---|---|---|---|
| `tune_hpGrowth` | 1.3 | 1.2–1.4 | Her aşamada düşman canı çarpanı (bölüm = 5 aşama). Uzun vadeli zorluk. **Çok hassas**: 0.01 bile büyük fark. |
| `tune_goldGrowth` | 1.28 | 1.2–1.4 | Her aşamada altın çarpanı. hpGrowth'tan küçük olmalı yoksa oyun hiç zorlaşmaz. |
| `tune_earlyHp` | 2.4 | 1–4 | İlk bölümlerde her bölüme eklenen düşman canı çarpanı. Erken oyun zorluğu. |
| `tune_earlyGold` | 1.691 | 1–3 | İlk bölümlerde ek altın çarpanı. earlyHp'den küçük olmalı. |
| `tune_earlyCap` | 8 | 0–15 | Erken zorluk kaç bölüm sürer. |
| `tune_bossMul` | 22 | 8–60 | Boss canı = son aşamadaki bir düşmanın bu katı. |
| `tune_bossTime` | 30 | 15–60 | Boss için süre (saniye). Boss kaybetme oranını doğrudan etkiler. |
| `tune_waveBase` | 10 | 4–30 | 1. bölümde dalgadaki düşman sayısı. |
| `tune_waveGrow` | 0.9 | 0–3 | Her bölümde dalgaya eklenen düşman. |
| `tune_waveMax` | 14 | 0–40 | Eklenen düşman üst sınırı. |
| `tune_hordeChance` | 0.25 | 0–0.6 | Dalgaların ne kadarı "SÜRÜ!" (0.25 = 4'te 1). |
| `tune_lungeDmg` | 0.08 | 0–0.3 | Saldıran düşmanın vuruşu (takım canının oranı). Nakavt sıklığı. |
| `tune_offEff` | 0.5 | 0.1–1 | Çevrimdışı kazanç = aktif kazancın bu oranı. |

## 3. Neye bakacağız (GameAnalytics)

| Soru | Nerede | Hedef |
|---|---|---|
| Oyuncular geri geliyor mu? | Overview → Retention | 1. gün %35+, 7. gün %12+ |
| Nerede bırakıyorlar? | Progression → `stage` funnel | Ani düşüş olan bölüm = sorunlu boss |
| Hangi boss çok zor? | Progression → Fail / Start oranı | Normal %10–20, duvar %40–60 |
| Boss süresi yetiyor mu? | Design → `Boss:Time:<bölüm>` | Ortalama 12–22 sn (30 sn'lik sürede) |
| Bölüm ne kadar sürüyor? | Design → `Stage:Time:<bölüm>` (dakika) | İlk 5 bölüm 1–3 dk, sonra kademeli artış |
| İlk Doğuş ne zaman? | Design → `Rebirth:Done` | 30–45. dakika |
| Nakavt çok mu? | Design → `Squad:KO` | Oyuncu başına günde birkaç; her bölümde değil |
| Yükseltme dengesi | Design → `Upgrade:power/speed/money` | Üçü de kullanılıyor olmalı; biri hiç alınmıyorsa zayıf |
| Kart dengesi | Design → `Perk:<id>` ÷ `Perk:Offer:<id>` | Seçilme oranı %15–50; %70+ fazla güçlü, %5- işe yaramıyor |
| Silahlar | Design → `Weapon:Unlock:<n>` | 2. silah ilk 10 dk içinde |

## 4. Belirtiye göre ne değiştirilir

| Belirti | İlk denenecek |
|---|---|
| İlk 5 dakikada bırakıyorlar | `tune_earlyHp` ↓ (2.4 → 2.1) |
| İlk bölümler hâlâ çok kolay | `tune_earlyHp` ↑ (2.4 → 2.7) |
| Belli bir bölümde herkes takılıyor | `tune_bossTime` ↑ (30 → 35) |
| Uzun vadede çok yavaş / sıkıcı | `tune_hpGrowth` ↓ (1.3 → 1.29) |
| Uzun vadede çok hızlı, duvar yok | `tune_hpGrowth` ↑ (1.3 → 1.31) |
| Sürü hissi yok | `tune_waveGrow` ↑ veya `tune_hordeChance` ↑ |
| Çok sık nakavt | `tune_lungeDmg` ↓ (0.08 → 0.06) |
| Oyuncular geri gelmiyor | `tune_offEff` ↑ (0.5 → 0.6): dönüşte daha çok ödül |

Kartların, silahların ve maliyetlerin değişmesi yeni sürüm gerektirir (koddaki tablolar). Bir değişiklik yapmadan
önce `node tools/economy-sim.js '{"ex":2.1}'` ile 10 saatlik ilerlemeyi simüle edebiliriz.

## 5. Döngü
Haftada bir: verilere bak → en büyük sorunu seç → **tek** sayıyı değiştir → bir hafta ölç → tekrar.
Anlamlı sonuç için en az 15–20 aktif oyuncu ve birkaç gün veri gerekir.
