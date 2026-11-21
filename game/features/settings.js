/* Shuriken Squad feature: Ayarlar (settings panel). Requires window.SS. Load after the other feature files so the gear button sits last. */
'use strict';
(() => {
  const SS = window.SS;
  if (!SS) { console.warn('settings: SS missing'); return; }
  const save = SS.save;
  const SAVE_KEY = 'swarmsquad_idle_v1';

  if (typeof save.eco !== 'boolean') save.eco = false;
  if (typeof save.vibrate !== 'boolean') save.vibrate = true;
  if (typeof save.sound !== 'boolean') save.sound = true;
  if (typeof save.music !== 'boolean') save.music = true;

  if (typeof SS.vibrate !== 'function') {
    SS.vibrate = ms => { if (save.vibrate && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) { /* ignore */ } } };
  }
  SS.HOOKS.bossWin.push(() => SS.vibrate(80));

  // hidden side button: the top-left square (#settingsTop, see layout.js) clicks it
  const btn = SS.addSideButton({ side: 'left', label: 'Ayarlar', icon: 'assets/ui/ic_settings.png', color: 'grey', id: 'settingsBtn', onClick: () => open() });
  btn.classList.add('fa-settings-btn');

  const ITEMS = [
    { key: 'sound', label: 'Efektler', icon: 'assets/ui/ic_sound_on.png', iconOff: 'assets/ui/ic_sound_off.png', note: 'Atış, para ve boss sesleri' },
    { key: 'music', label: 'Müzik', icon: 'assets/ui/ic_book.png', note: 'Bölge müzikleri' },
    { key: 'eco', label: 'Eko mod', icon: 'assets/ui/ic_vision.png', note: 'Az efekt, az pil' },
    { key: 'vibrate', label: 'Titreşim', icon: 'assets/ui/ic_boot.png', note: 'Önemli anlarda titret' },
  ];

  function resetAll() {
    const keep = { sound: save.sound, music: save.music, eco: save.eco, vibrate: save.vibrate };
    for (const k of Object.keys(save)) delete save[k];
    Object.assign(save, {
      money: 0, gems: 0, stage: 1, sub: 1, kills: 0, bossReady: false, lv: { power: 0, speed: 0, money: 0 }, gun: 0, team: 1,
      rebirths: 0, rp: 0, auto: true, t: 0, rate: 0, best: 1,
    }, keep);
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* storage blocked */ }
    SS.persist();
    SS.closePanel();
    SS.banner('SIFIRLANDI', 'Yeniden başlıyor…');
    setTimeout(() => location.reload(), 700);
  }

  function open(confirming) {
    SS.openPanel('Ayarlar', 'grey', body => {
      const wrap = SS.el('<div class="fa-mwrap"></div>');
      const tg = SS.el('<div class="toggles fa-toggles"></div>');
      for (const it of ITEMS) {
        const on = !!save[it.key];
        const t = SS.el(`<button class="toggle fa-toggle ${on ? 'on' : ''}"><img src="${!on && it.iconOff ? it.iconOff : it.icon}" alt="">
          <span>${it.label}<small>${it.note}</small></span><em>${on ? 'AÇIK' : 'KAPALI'}</em><b></b></button>`);
        t.onclick = () => {
          save[it.key] = !save[it.key];
          SS.sfx('click');
          if (it.key === 'vibrate' && save.vibrate) SS.vibrate(40);
          if (it.key === 'music') { try { SS.audioInit && SS.audioInit(); } catch (e) { /* ignore */ } SS.musicUpdate && SS.musicUpdate(); }
          SS.persist(); SS.refreshUI();
          open(confirming);
        };
        tg.appendChild(t);
      }
      wrap.appendChild(tg);

      const zone = SS.el('<div class="fa-danger"></div>');
      if (!confirming) {
        const r = SS.el(`<div class="fa-resetrow"><img src="assets/ui/ic_rebirth.png" alt="">
          <span>İlerleme<small>Her şeye baştan başla</small></span><button class="btn red fa-reset">SIFIRLA</button></div>`);
        r.querySelector('.btn').onclick = () => { SS.sfx('no'); open(true); };
        zone.appendChild(r);
      } else {
        zone.classList.add('fa-confirm');
        zone.appendChild(SS.el('<p class="fa-warn"><b>Emin misin?</b>Altın, elmas, bölümler, silahlar ve takım silinir. Bu işlem geri alınamaz.</p>'));
        const row = SS.el('<div class="btnrow"><button class="btn grey">VAZGEÇ</button><button class="btn red">SIFIRLA</button></div>');
        row.children[0].onclick = () => { SS.sfx('click'); open(false); };
        row.children[1].onclick = resetAll;
        zone.appendChild(row);
      }
      wrap.appendChild(zone);
      wrap.appendChild(SS.el('<p class="fa-credits">Grafik, ses ve müzik: Ninja Adventure — Pixel-boy &amp; AAA (CC0) · Yazı tipi: Pixelify Sans (OFL)</p>'));
      body.appendChild(wrap);
    });
  }

  SS.settings = { open };
})();
