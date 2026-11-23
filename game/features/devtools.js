/* Shuriken Squad — Test Paneli (developer tools for the owner).
   Open: Ayarlar → "Test Paneli", or long-press the stage name at the top for ~0.7 s.
   Only active while monetize.config.js has devTools: true (the release workflow switches it off for the store build).
   Everything here changes the save directly so any system can be tried at once without grinding. */
'use strict';
(() => {
  const SS = window.SS, C = window.MONETIZE || {};
  if (!SS || !C.devTools) return;
  const save = SS.save, R = SS.R;
  if (!save.dev || typeof save.dev !== 'object') save.dev = {};
  const D = save.dev;
  // persistent cheats
  SS.MODS.taken.push(() => D.god ? 0 : 1);
  SS.MODS.dmg.push(() => D.dmg10 ? 10 : 1);
  SS.MODS.money.push(() => D.gold10 ? 10 : 1);
  R.timeScale = D.speed || 1;
  if (D.fest) SS.forceEvent = true;

  const ok = msg => { SS.sfx('accept', 0); SS.toast(msg); SS.persist(); SS.refreshUI(); };
  const closeAnd = f => () => { SS.closePanel(); setTimeout(f, 150); };
  const rebirthOpen = t => SS.PANELS.rebirth(t);

  const SECTIONS = [
    ['Hızlı', [
      ['Tüm menüleri aç', () => { SS.unlock && SS.unlock.all(); ok('Tüm menüler açık'); }],
      ['Menüleri yeniden kilitle', () => { save.unl = {}; ok('Menü kilitleri sıfırlandı · yeniden yükle'); setTimeout(() => location.reload(), 600); }],
      ['+1.000 elmas', () => { save.gems += 1000; ok('+1.000 elmas'); }],
      ['Bol altın', () => { save.money += Math.max(1e6, SS.reward() * 5000); ok('Altın eklendi'); }],
      ['+10 ruh', () => { save.tree = save.tree || { lv: {} }; save.tree.souls = (save.tree.souls || 0) + 10; ok('+10 ruh'); }],
      ['+5 taş / bilet', () => { save.inv = save.inv || {}; save.inv.star = (save.inv.star || 0) + 5; save.inv.ticket = (save.inv.ticket || 0) + 5; ok('+5 Yıldız Taşı, +5 Boss Bileti'); }],
    ]],
    ['İlerleme', [
      ['Bölüm seç…', () => { const v = parseInt(prompt('Hangi bölüm?', save.stage), 10); if (v > 0) { save.stage = v; save.sub = 1; save.kills = 0; save.bossReady = false; save.best = Math.max(save.best || 1, v); R.en.length = 0; ok(`Bölüm ${v}`); } }],
      ['Aşamayı bitir', () => { save.kills = SS.KILLS_PER_SUB - 1; ok('Bir düşman daha: aşama biter'); }],
      ['Boss\'u başlat', closeAnd(() => { save.sub = SS.SUBS; save.bossReady = true; SS.startBoss(); })],
      ['Boss\'u öldür', closeAnd(() => { if (R.boss) { R.boss.hp = 0; SS.bossWin(); } else SS.toast('Boss yok'); })],
      ['Doğuşa hazırla (bölüm 30)', () => { save.stage = 30; save.best = Math.max(save.best || 1, 30); ok('Bölüm 30: Doğuş paneline bak'); }],
      ['Ruh Ağacı', closeAnd(() => rebirthOpen('t'))],
    ]],
    ['Silah & Takım', [
      ['Tüm silahları aç', () => { save.wbest = SS.GUNS.length - 1; ok('Tüm silahlar açık'); }],
      ['Takılı silah: 5 yıldız (evrim)', () => { save.wstar[save.gun] = 5; ok('Evrim açıldı'); }],
      ['Sonraki silahı tak', () => { save.wbest = Math.max(save.wbest, (save.gun + 1) % SS.GUNS.length); save.gun = (save.gun + 1) % SS.GUNS.length; ok(SS.GUNS[save.gun].name); }],
      ['5 ninja', () => { save.team = 5; SS.setupHeroes(); ok('Takım tam'); }],
      ['Ninjalar maks seviye', () => { save.hlv = SS.TEAM.map(() => SS.HERO_MAX); ok('Tüm ninjalar maks'); }],
      ['Tılsım ver (3×Sv1 her yuva)', () => { for (const s of SS.charms.SLOTS) SS.charms.give(s.k, 1, 3); ok('Tılsımlar eklendi · Takım → Tılsımlar'); }],
      ['Sandık açılışı', closeAnd(() => SS.chest([{ icon: 'gem', label: '50 elmas', apply: () => { save.gems += 50; } }, { icon: 'ic_power', label: 'Saldırı Tılsımı 2', apply: () => SS.charms.give('atk', 2) }, { icon: 'ic_luck', label: '1 Yıldız Taşı' }], 'Test sandığı'))],
      ['+20 parşömen', () => { SS.giveScroll(20); SS.persist(); }],
    ]],
    ['Oyun anları', [
      ['Hava: yağmur / kar / kül …', () => { const ks = ['rain', 'snow', 'ash', 'fireflies', 'dust'], i = (ks.indexOf(SS.visuals && SS.visuals.current) + 1) % ks.length; SS.visuals && SS.visuals.weather(ks[i]); ok('Hava: ' + ks[i]); }],
      ['Yeni düşman türleri', closeAnd(() => { R.phase = 'fight'; for (const v of Object.keys(SS.VAR)) for (let i = 0; i < 2; i++) SS.spawnEnemy(v); })],
      ['Boss 2. aşama', closeAnd(() => { if (!R.boss) { save.sub = SS.SUBS; save.bossReady = true; SS.startBoss(); } setTimeout(() => { if (R.boss) R.boss.hp = R.boss.maxHp * 0.31; }, 1700); })],
      ['Hayatta Kal (ücretsiz)', closeAnd(() => { save.surv.day = ''; SS.survival.start(); })],
      ['Yolculuk haritası', closeAnd(() => SS.journey.openMap())],
      ['Paylaşım kartı', closeAnd(() => SS.journey.share())],
      ['Haftalık meydan okuma', closeAnd(() => { save.week = {}; SS.journey.weeklyFight(); })],
      ['Tüm yoldaşları aç', () => { save.best = Math.max(save.best || 1, 10); save.tower.best = Math.max(save.tower.best || 0, 10); save.surv.best = Math.max(save.surv.best || 0, 150); save.rebirths = Math.max(save.rebirths || 0, 3); ok('Yoldaşlar: Kostüm panelinde'); }],
      ['Sürü dalgası', closeAnd(() => { R.horde = true; R.toSpawn = 16; R.spawnT = 0; R.phase = 'fight'; })],
      ['Yetenek kartları', closeAnd(() => SS.perks && SS.perks.offer())],
      ['Hazine canavarı', closeAnd(() => { R.phase = 'fight'; SS.spawnTreasure(); })],
      ['Nakavt ol', closeAnd(() => SS.knockout())],
      ['Çevrimdışı kazanç (3 sa)', () => { SS.closePanel(); save.t = Date.now() - 3 * 3600e3; save.rate = Math.max(save.rate || 0, SS.reward() * 2); SS.offlineReward(); }],
      ['Günlük ödülü yenile', () => { if (save.login) save.login.last = ''; ok('Ödül butonuna bak'); }],
      ['Kule haklarını yenile', () => { if (save.tower) save.tower.used = 0; ok('3 hak'); }],
      ['Ninja Yolu +1.500 XP', () => { SS.pass && SS.pass.addXp(1500); ok('+1.500 XP'); }],
      ['Ninja Yolu Premium (test)', () => { SS.pass && SS.pass.unlockPremium(0); ok('Premium açık'); }],
      ['Başlangıç paketi teklifini göster', closeAnd(() => { const M = save.mon || {}; if (M.offers) delete M.offers.ss_starter; M.lastPopup = 0; SS.mon && SS.mon.offerOpen('ss_starter', { title: 'Başlangıç Paketi', img: 'face_KnightGold.png' }); })],
    ]],
  ];
  const TOGGLES = [
    ['god', 'Ölümsüz takım', 'Hasar alınmaz'],
    ['dmg10', 'x10 hasar', 'Her şeyi hızlı geç'],
    ['gold10', 'x10 altın', 'Geliştirmeleri hızlı al'],
    ['fest', 'Festival hep açık', 'Fener Festivali hafta içi de'],
  ];

  function open() {
    SS.openPanel('Test Paneli', 'grey', body => {
      body.appendChild(SS.el('<p class="big-note">Sadece test için. Mağaza sürümünde bu panel kapalıdır (<b>devTools</b>).</p>'));
      // toggles
      const tg = SS.el('<div class="toggles"></div>');
      for (const [k, label, note] of TOGGLES) {
        const t = SS.el(`<button class="toggle ${D[k] ? 'on' : ''}"><img src="assets/ui/ic_gear.png" alt=""><span>${label}<small>${note}</small></span><em>${D[k] ? 'AÇIK' : 'KAPALI'}</em><b></b></button>`);
        t.onclick = () => { D[k] = !D[k]; if (k === 'fest') SS.forceEvent = !!D[k]; SS.sfx('click'); SS.persist(); SS.refreshUI(); open(); };
        tg.appendChild(t);
      }
      // game speed
      const sp = SS.el(`<div class="dv-speed"><span>Oyun hızı</span>${[1, 2, 4, 8].map(v => `<button class="btn ${R.timeScale === v ? 'purple' : 'grey'}" data-v="${v}">x${v}</button>`).join('')}</div>`);
      sp.querySelectorAll('button').forEach(b => b.onclick = () => { R.timeScale = D.speed = +b.dataset.v; SS.sfx('click'); SS.persist(); open(); });
      tg.appendChild(sp);
      body.appendChild(tg);
      for (const [title, items] of SECTIONS) {
        body.appendChild(SS.el(`<h3 class="dv-h">${title}</h3>`));
        const g = SS.el('<div class="dv-grid"></div>');
        for (const [label, fn] of items) { const b = SS.el(`<button class="btn grey">${label}</button>`); b.onclick = () => { try { fn(); } catch (e) { SS.toast('Hata: ' + e.message); } }; g.appendChild(b); }
        body.appendChild(g);
      }
      body.appendChild(SS.el('<h3 class="dv-h">Sıfırlama</h3>'));
      const rs = SS.el('<div class="dv-grid"><button class="btn red">Yeni oyuncu gibi başla</button><button class="btn grey">Hedef zincirini sıfırla</button></div>');
      rs.children[0].onclick = () => { if (!confirm('Tüm ilerleme silinsin mi?')) return; SS.R.noSave = true; try { localStorage.removeItem('swarmsquad_idle_v1'); } catch (e) { /* ignore */ } location.reload(); };
      rs.children[1].onclick = () => { save.goals = { done: {} }; SS.R.noSave = false; SS.persist(); location.reload(); };
      body.appendChild(rs);
    });
  }
  SS.dev = { open };
  // long-press the stage name (top centre) to open
  const lbl = document.getElementById('stageLbl');
  if (lbl) {
    let tm = 0;
    lbl.style.pointerEvents = 'auto';
    lbl.addEventListener('pointerdown', () => { tm = setTimeout(() => { SS.sfx('open', 0); open(); }, 700); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => lbl.addEventListener(ev, () => clearTimeout(tm)));
  }
  // entry at the top of Ayarlar (added whenever that panel is built)
  new MutationObserver(() => {
    if (document.getElementById('pTitle').textContent !== 'Ayarlar') return;
    const w = document.querySelector('#pBody .fa-mwrap'); if (!w || w.querySelector('.dv-open')) return;
    const b = SS.el('<button class="btn purple wide dv-open">TEST PANELİ</button>'); b.onclick = () => { SS.sfx('click'); open(); }; w.insertBefore(b, w.firstChild);
  }).observe(document.getElementById('pBody'), { childList: true });
})();
