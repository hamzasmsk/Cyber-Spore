/* Shuriken Squad feature: Güç Tasarrufu (power-save screen), as in other idle games.
   The screen goes almost black (OLED pixels off), nothing is drawn and the sound is muted, while the squad keeps
   fighting. A calm summary shows the clock, battery, stage and what was earned since it started (time, gold,
   defeated enemies, gems, stages). Slide the handle to wake up (no accidental taps). Opens from the moon button
   next to the settings gear, from Ayarlar, or by itself after a few untouched minutes (Ayarlar: Kapalı / 2 / 5 dk).
   Never opens by itself over a panel, a popup or a Kule / Arena fight. */
'use strict';
(() => {
  const SS = window.SS;
  if (!SS) return;
  const save = SS.save, R = SS.R;
  if (![0, 2, 5].includes(save.psAuto)) save.psAuto = 0;
  // a run killed while the screen was on: give the player their sound back
  if (save.psPrev) { save.sound = save.psPrev.sound; save.music = save.psPrev.music; delete save.psPrev; }

  const ov = SS.el(`<section id="psave" class="hidden" aria-label="Güç Tasarrufu">
    <div class="ps-top"><b class="ps-clock">--:--</b><span class="ps-date"></span><span class="ps-batt hidden"><i></i><em></em></span></div>
    <div class="ps-mid">
      <div class="ps-hero"><canvas width="16" height="16"></canvas><i class="ps-zz">z</i><i class="ps-zz z2">z</i></div>
      <b class="ps-title">Takımın savaşıyor</b>
      <span class="ps-stage"></span>
      <div class="ps-stats">
        <div><small>Süre</small><b class="ps-time">0:00</b></div>
        <div><small>Bölüm</small><b class="ps-st">+0</b></div>
        <div><small>Altın</small><b class="ps-gold">+0</b></div>
        <div><small>Düşman</small><b class="ps-kills">0</b></div>
        <div><small>Elmas</small><b class="ps-gems">+0</b></div>
      </div>
    </div>
    <div class="ps-slide"><span>Devam etmek için kaydır</span><b class="ps-knob"><i></i></b></div>
    <small class="ps-note">Güç tasarrufu açık · ekran kararır, oyun devam eder</small>
  </section>`);
  document.body.appendChild(ov);
  const $ = c => ov.querySelector(c);

  let snap = null, tick = 0, battery = null;
  if (navigator.getBattery) navigator.getBattery().then(b => { battery = b; }).catch(() => {});
  const busy = () => !document.getElementById('panel').classList.contains('hidden') || document.querySelector('.pk-ov,.ch-ov,.mz-ov,.un-card,.fl-card')
    || R.mode || R.paused || (R.sq && R.sq.ko > 0);

  function enter(auto) {
    if (R.psave || (auto && busy())) return false;
    SS.closePanel && SS.closePanel();
    snap = { t: Date.now(), money: save.money, gems: save.gems, kills: (save.stats && save.stats.kills) || 0, best: save.best || 1, stage: save.stage };
    save.psPrev = { sound: save.sound, music: save.music }; save.sound = false; save.music = false;
    SS.musicUpdate && SS.musicUpdate(); SS.persist();
    // the captain's front frame from the game atlas (the squad member the player knows)
    const f = SS.AF && SS.AF[`h_${SS.heroId ? SS.heroId(0) : 'NinjaBlue'}_d0`], cv = $('.ps-hero canvas'), g = cv.getContext('2d');
    g.clearRect(0, 0, 16, 16); if (f && SS.atlasImg) g.drawImage(SS.atlasImg, f[0], f[1], f[2], f[3], 0, 0, 16, 16);
    R.psave = true; ov.classList.remove('hidden'); document.body.classList.add('ps-on');
    paint(); tick = setInterval(paint, 1000);
    if (SS.analytics) SS.analytics.send('addDesignEvent', auto ? 'PowerSave:Auto' : 'PowerSave:On');
    return true;
  }
  function exit() {
    if (!R.psave) return;
    R.psave = false; clearInterval(tick);
    if (save.psPrev) { save.sound = save.psPrev.sound; save.music = save.psPrev.music; delete save.psPrev; }
    SS.musicUpdate && SS.musicUpdate(); SS.refreshUI(); SS.persist();
    ov.classList.add('out'); setTimeout(() => { ov.classList.add('hidden'); ov.classList.remove('out'); }, 200);
    document.body.classList.remove('ps-on');
    const min = Math.round((Date.now() - snap.t) / 60000);
    if (min >= 1) SS.toast(`Güç tasarrufunda ${min} dk · +${SS.fmt(Math.max(0, save.money - snap.money))} altın`);
    lastTouch = Date.now();
  }
  const pad = n => String(n).padStart(2, '0');
  function paint() {
    const d = new Date(), s = Math.floor((Date.now() - snap.t) / 1000);
    $('.ps-clock').textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    $('.ps-date').textContent = d.toLocaleDateString(save.lang === 'en' ? 'en-US' : 'tr-TR', { weekday: 'long', day: 'numeric', month: 'long' });
    $('.ps-time').textContent = s >= 3600 ? `${Math.floor(s / 3600)}:${pad(Math.floor(s % 3600 / 60))}:${pad(s % 60)}` : `${Math.floor(s / 60)}:${pad(s % 60)}`;
    $('.ps-st').textContent = '+' + Math.max(0, (save.best || 1) - snap.best);
    $('.ps-gold').textContent = '+' + SS.fmt(Math.max(0, save.money - snap.money));
    $('.ps-kills').textContent = SS.fmt(Math.max(0, ((save.stats && save.stats.kills) || 0) - snap.kills));
    $('.ps-gems').textContent = '+' + Math.max(0, save.gems - snap.gems);
    const b = SS.biome ? SS.biome() : null;
    $('.ps-stage').textContent = `${b ? (SS.t ? SS.t(b.name) : b.name) : ''} · ${save.stage}-${save.sub}`;
    if (battery) { const bt = $('.ps-batt'); bt.classList.remove('hidden'); bt.querySelector('em').textContent = Math.round(battery.level * 100) + '%'; bt.style.setProperty('--b', Math.round(battery.level * 100) + '%'); bt.classList.toggle('chg', battery.charging); }
    if (R.boss) $('.ps-title').textContent = SS.t ? SS.t('Boss dövüşü!') : 'Boss dövüşü!';
    else $('.ps-title').textContent = SS.t ? SS.t('Takımın savaşıyor') : 'Takımın savaşıyor';
  }

  // slide to wake: drag the knob to the end of the track
  const track = $('.ps-slide'), knob = $('.ps-knob');
  let drag = null;
  track.addEventListener('pointerdown', e => { drag = { x0: e.clientX, w: track.clientWidth - knob.clientWidth - 8 }; track.setPointerCapture(e.pointerId); });
  track.addEventListener('pointermove', e => {
    if (!drag) return;
    const k = Math.max(0, Math.min(1, (e.clientX - drag.x0) / drag.w));
    knob.style.transform = `translateX(${Math.round(k * drag.w)}px)`; track.style.setProperty('--k', k);
    if (k >= 0.92) { drag = null; knob.style.transform = ''; track.style.setProperty('--k', 0); SS.sfx && SS.sfx('accept', 0); exit(); }
  });
  const end = () => { drag = null; knob.style.transform = ''; track.style.setProperty('--k', 0); };
  track.addEventListener('pointerup', end); track.addEventListener('pointercancel', end);

  // auto-enter after a few untouched minutes
  let lastTouch = Date.now();
  for (const ev of ['pointerdown', 'keydown', 'wheel']) window.addEventListener(ev, () => { lastTouch = Date.now(); }, true);
  setInterval(() => { if (save.psAuto && !R.psave && !document.hidden && Date.now() - lastTouch > save.psAuto * 60000) enter(true); }, 5000);

  // moon button next to the settings gear
  const btn = SS.el('<button class="tilebtn psbtn" id="psBtn" aria-label="Güç Tasarrufu"><img src="assets/ui/ic_psave.png" alt=""></button>');
  const gear = document.getElementById('settingsTop') || document.getElementById('soundBtn');
  if (gear && gear.parentNode) gear.parentNode.insertBefore(btn, gear.nextSibling);
  btn.onclick = () => { SS.sfx && SS.sfx('click'); enter(false); };

  // Ayarlar: the power-save row (open now + automatic)
  new MutationObserver(() => {
    if (document.getElementById('pTitle').dataset.k !== 'Ayarlar') return;
    const w = document.querySelector('#pBody .fa-mwrap'); if (!w || w.querySelector('.ps-set')) return;
    const row = SS.el(`<div class="dv-speed ps-set"><span>Güç tasarrufu</span>${[[0, 'Kapalı'], [2, '2 dk'], [5, '5 dk']].map(([v, l]) => `<button class="btn ${save.psAuto === v ? 'purple' : 'grey'}" data-v="${v}">${l}</button>`).join('')}<button class="btn blue ps-now">AÇ</button></div>`);
    row.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { save.psAuto = +b.dataset.v; SS.persist(); SS.sfx('click'); row.querySelectorAll('[data-v]').forEach(x => x.className = 'btn ' + (+x.dataset.v === save.psAuto ? 'purple' : 'grey')); });
    row.querySelector('.ps-now').onclick = () => { SS.sfx('click'); enter(false); };
    const gq = [...w.querySelectorAll('.dv-speed')].find(x => /Grafik|Graphics/.test(x.textContent));
    w.insertBefore(row, gq ? gq.nextSibling : w.firstChild);
  }).observe(document.getElementById('pBody'), { childList: true });

  SS.powersave = { enter, exit, get on() { return !!R.psave; } };
})();
