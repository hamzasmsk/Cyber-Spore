/* Shuriken Squad feature: Günlük Giriş (7-day login calendar) + local notifications.
   Calendar: one reward per calendar day, growing to a day-7 chest. A missed day never resets the streak, it
   only waits (nobody is punished for a weekend away); each finished week raises the gem rewards a little.
   Notifications (native app only, opt-in, at most 2 a day, never at night 22:00-09:00):
     mine storage full · offline earnings at their cap · daily reward ready · Ninja Yolu season ending. */
'use strict';
(() => {
  const SS = window.SS;
  if (!SS) { console.warn('daily: SS missing'); return; }
  const save = SS.save;
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
  if (!save.login || typeof save.login !== 'object') save.login = { day: 0, week: 0, last: '' };
  const L = save.login;
  // day rewards; gem amounts grow +20% per finished week (capped at x2)
  const DAYS = [
    { gems: 20 },
    { storm: 1, goldMin: 20 },
    { gems: 30 },
    { star: 1 },
    { ticket: 2, gems: 30 },
    { boostMin: 60 },
    { gems: 80, star: 2, storm: 1, chest: true },
  ];
  const wk = () => Math.min(2, 1 + 0.2 * L.week);
  const scaled = r => Object.assign({}, r, r.gems ? { gems: Math.round(r.gems * wk()) } : {});
  const ready = () => L.last !== today();
  const parts = r => [
    r.gems && [`${r.gems} elmas`, 'gem'], r.star && [`${r.star} Yıldız Taşı`, 'ic_luck'], r.storm && [`${r.storm} Fırtına Tılsımı`, 'ic_explosion'],
    r.ticket && [`${r.ticket} Boss Bileti`, 'ic_shield'], r.boostMin && [`${r.boostMin / 60} sa x2 güç`, 'ic_boost'], r.goldMin && [`${r.goldMin} dk altın`, 'coin'],
  ].filter(Boolean);
  function give(r) {
    const inv = save.inv = save.inv || {}, b = save.boost = save.boost || {}, now = Date.now();
    if (r.gems) save.gems += r.gems;
    for (const k of ['star', 'storm', 'ticket']) if (r[k]) inv[k] = (inv[k] || 0) + r[k];
    if (r.boostMin) { b.adEnd = Math.max(now, b.adEnd || 0) + r.boostMin * 60000; b.adCd = Math.max(b.adCd || 0, b.adEnd); }
    if (r.goldMin) { const inc = SS.shop ? SS.shop.income() : 1; SS.addMoney(inc * r.goldMin * 60, SS.W / 2, SS.H / 2, 12); }
  }
  function claim() {
    if (!ready()) return;
    const r = scaled(DAYS[L.day]);
    give(r); L.last = today();
    SS.sfx(r.chest ? 'win' : 'bonus', 0); SS.banner(r.chest ? 'HAFTA TAMAM!' : `${L.day + 1}. GÜN`, parts(r).map(p => p[0]).join(' · '));
    L.day++; if (L.day >= DAYS.length) { L.day = 0; L.week++; }
    SS.persist(); SS.refreshUI(); paint();
    SS.closePanel();
    if (!save.notifyAsked && Notif.native) setTimeout(askNotify, 2600);
  }
  function open() {
    SS.openPanel('Günlük Ödül', 'green', body => {
      body.appendChild(SS.el(`<p class="big-note">Her gün gir, ödülün büyüsün. Kaçırdığın gün sıfırlamaz, seni bekler.${L.week ? ` · <b>${L.week + 1}. hafta: elmaslar x${wk().toFixed(1).replace('.0', '')}</b>` : ''}</p>`));
      const g = SS.el('<div class="lg-grid"></div>');
      DAYS.forEach((d, i) => {
        const r = scaled(d), done = i < L.day, cur = i === L.day, p = parts(r);
        const c = SS.el(`<div class="lg-day ${done ? 'done' : ''} ${cur ? (ready() ? 'now' : 'next') : ''} ${d.chest ? 'big' : ''}"><small>${i + 1}. gün</small>
          <div class="lg-ico">${d.chest ? '<img src="assets/ui/chest.png" alt="">' : `<img src="assets/ui/${p[0][1]}.png" alt="">`}</div>
          <span>${p.map(x => x[0]).join('<br>')}</span>${done ? '<i class="lg-ok"></i>' : ''}</div>`);
        g.appendChild(c);
      });
      body.appendChild(g);
      const b = SS.el(`<button class="btn ${ready() ? 'green' : 'grey off'} wide">${ready() ? 'ÖDÜLÜ AL' : 'Yarın tekrar gel'}</button>`);
      b.onclick = claim; body.appendChild(b);
      if (Notif.native) {
        const t = SS.el(`<button class="toggle ${save.notify ? 'on' : ''}"><img src="assets/ui/ic_missions.png" alt=""><span>Hatırlatıcılar<small>Ödül hazır, maden dolu… (günde en fazla 2)</small></span><em>${save.notify ? 'AÇIK' : 'KAPALI'}</em><b></b></button>`);
        t.onclick = async () => { if (save.notify) { save.notify = false; Notif.cancel(); } else await Notif.enable(); SS.persist(); open(); };
        body.appendChild(t);
      }
    });
  }
  const btn = SS.addSideButton({ side: 'right', label: 'Ödül', icon: 'assets/ui/ic_daily.png', color: 'green', id: 'dailyBtn', onClick: open });
  function paint() { btn.classList.toggle('notify', ready()); }
  paint(); setInterval(paint, 30000);
  // show the calendar once per day on start (after the welcome-back panel, never on top of another panel)
  if (ready()) {
    const tryOpen = (n) => { if (!ready()) return; if (!document.getElementById('panel').classList.contains('hidden') || document.querySelector('.pk-ov,.mz-ov')) { if (n < 40) setTimeout(() => tryOpen(n + 1), 1500); return; } open(); };
    setTimeout(() => tryOpen(0), 2500);
  }

  // ---------------- local notifications (Capacitor @capacitor/local-notifications)
  const cap = window.Capacitor, LN = cap && cap.isNativePlatform && cap.isNativePlatform() && cap.Plugins && cap.Plugins.LocalNotifications;
  const Notif = {
    native: !!LN,
    async enable() {
      if (!LN) return false;
      try { let p = await LN.checkPermissions(); if (p.display !== 'granted') p = await LN.requestPermissions(); save.notify = p.display === 'granted'; } catch (e) { save.notify = false; }
      save.notifyAsked = true; SS.persist();
      if (save.notify) SS.toast('Hatırlatıcılar açık'); else SS.toast('Bildirim izni verilmedi · telefon ayarlarından açabilirsin');
      return save.notify;
    },
    cancel() { if (!LN) return; LN.getPending().then(r => { if (r && r.notifications && r.notifications.length) LN.cancel({ notifications: r.notifications.map(n => ({ id: n.id })) }); }).catch(() => {}); },
    // pick the soonest events, push night-time ones to 09:30, keep at most 2 within any day
    plan() {
      const now = Date.now(), H = 3.6e6, ev = [];
      const M = save.mine;
      if (M && SS.mine) { const left = (SS.mine.capOf(M.lv) - M.stored) / SS.mine.perHour(M.lv) * H; if (left > 30 * 60000) ev.push({ pr: 3, at: now + left, title: 'Maden doldu', body: 'Deponda elmaslar seni bekliyor. Toplamazsan üretim durur.' }); }
      const offH = 8 + (SS.modAdd ? SS.modAdd('offH') : 0);
      ev.push({ pr: 4, at: now + offH * H, title: 'Takımın yoruldu', body: `${offH} saattir savaşıyorlar; çevrimdışı kazanç sınıra ulaştı. Topla ve devam et!` });
      const tm = new Date(); tm.setDate(tm.getDate() + (ready() ? 0 : 1)); tm.setHours(19, 0, 0, 0);
      if (tm.getTime() < now + H) tm.setDate(tm.getDate() + 1);
      ev.push({ pr: 1, at: tm.getTime(), title: 'Günlük ödülün hazır', body: L.day === 6 ? '7. gün sandığı seni bekliyor!' : `${L.day + 1}. gün ödülünü almayı unutma.` });
      if (SS.pass && SS.pass.endsAt) { const e = SS.pass.endsAt() - 36 * H; if (e > now) ev.push({ pr: 2, at: e, title: 'Ninja Yolu bitiyor', body: 'Sezon yarın bitiyor: ödüllerini topla.' }); }
      for (const e of ev) { const d = new Date(e.at), h = d.getHours() + d.getMinutes() / 60; if (h >= 22 || h < 9) { if (h >= 22) d.setDate(d.getDate() + 1); d.setHours(9, 30, 0, 0); e.at = d.getTime(); } }
      ev.sort((a, b) => a.pr - b.pr);   // most useful first; then at most 2 a day, 3 hours apart
      const out = [], perDay = {};
      for (const e of ev) { const k = new Date(e.at).toDateString(); if ((perDay[k] || 0) >= 2 || out.some(o => Math.abs(o.at - e.at) < 3 * H)) continue; perDay[k] = (perDay[k] || 0) + 1; out.push(e); }
      return out.sort((a, b) => a.at - b.at);
    },
    async schedule() {
      if (!LN || !save.notify) return;
      try {
        const p = await LN.getPending(); if (p && p.notifications && p.notifications.length) await LN.cancel({ notifications: p.notifications.map(n => ({ id: n.id })) });
        const list = Notif.plan().map((e, i) => ({ id: 100 + i, title: e.title, body: e.body, schedule: { at: new Date(e.at), allowWhileIdle: true } }));
        if (list.length) await LN.schedule({ notifications: list });
      } catch (e) { /* plugin missing or denied */ }
    },
  };
  function askNotify() {
    if (save.notifyAsked || !Notif.native) return;
    if (!document.getElementById('panel').classList.contains('hidden')) { setTimeout(askNotify, 3000); return; }
    SS.openPanel('Hatırlatıcı', 'green', body => {
      body.appendChild(SS.el('<p class="big-note">Günlük ödülün hazır olunca ya da maden dolunca haber verelim mi? Günde en fazla 2 bildirim, gece asla.</p>'));
      const r = SS.el('<div class="btnrow"><button class="btn grey">Hayır</button><button class="btn green">Evet</button></div>');
      r.children[0].onclick = () => { save.notifyAsked = true; SS.persist(); SS.closePanel(); };
      r.children[1].onclick = async () => { SS.closePanel(); await Notif.enable(); };
      body.appendChild(r);
    });
  }
  // reschedule whenever the app goes to the background; clear when it comes back
  document.addEventListener('visibilitychange', () => { if (document.hidden) Notif.schedule(); else Notif.cancel(); });
  if (LN) Notif.cancel();
  SS.daily = { open, claim, ready, Notif };
})();
