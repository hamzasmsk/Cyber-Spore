/* Swarm Squad feature: Ayarlar (settings panel). Requires window.SS. Load after the other feature files so the gear button sits last. */
'use strict';
(() => {
  const SS = window.SS;
  if (!SS) { console.warn('settings: SS missing'); return; }
  const save = SS.save;
  const SAVE_KEY = 'swarmsquad_idle_v1';

  if (typeof save.eco !== 'boolean') save.eco = false;
  if (typeof save.vibrate !== 'boolean') save.vibrate = true;
  if (typeof save.sound !== 'boolean') save.sound = true;

  if (typeof SS.vibrate !== 'function') {
    SS.vibrate = ms => { if (save.vibrate && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) { /* ignore */ } } };
  }
  SS.HOOKS.bossWin.push(() => SS.vibrate(80));

  const GEAR = 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><g stroke="#1b2033" stroke-width="5" stroke-linejoin="round">' +
    '<path fill="#ffffff" d="M27 4h10l2 8 6 3 7-4 7 7-4 7 3 6 8 2v10l-8 2-3 6 4 7-7 7-7-4-6 3-2 8H27l-2-8-6-3-7 4-7-7 4-7-3-6-8-2V27l8-2 3-6-4-7 7-7 7 4 6-3z" transform="translate(0 -1) scale(1)"/>' +
    '<circle cx="32" cy="31" r="10" fill="#8e97ad"/></g></svg>');

  const btn = SS.addSideButton({ side: 'left', label: 'Ayarlar', icon: GEAR, color: 'grey', id: 'settingsBtn', onClick: () => open() });
  btn.classList.add('fa-settings-btn');

  const ITEMS = [
    { key: 'sound', label: 'Ses', icon: 'assets/ui/ic_sound_on.png', iconOff: 'assets/ui/ic_sound_off.png', note: 'Efektler ve müzik' },
    { key: 'eco', label: 'Eko mod', icon: 'assets/ui/ic_power.png', note: 'Daha az efekt, daha az pil' },
    { key: 'vibrate', label: 'Titreşim', icon: 'assets/ui/ic_dash.png', note: 'Önemli anlarda titret' },
  ];

  function resetAll() {
    const keep = { sound: save.sound, eco: save.eco, vibrate: save.vibrate };
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
          SS.persist(); SS.refreshUI();
          open(confirming);
        };
        tg.appendChild(t);
      }
      wrap.appendChild(tg);

      const zone = SS.el('<div class="fa-danger"></div>');
      if (!confirming) {
        const r = SS.el('<button class="btn red fa-reset"><img src="assets/ui/ic_retry.png" alt="">İlerlemeyi sıfırla</button>');
        r.onclick = () => { SS.sfx('no'); open(true); };
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
      wrap.appendChild(SS.el('<p class="fa-credits">Grafikler: Kenney (CC0) · Yazı tipi: Baloo 2 (OFL)</p>'));
      body.appendChild(wrap);
    });
  }

  SS.settings = { open };
})();
