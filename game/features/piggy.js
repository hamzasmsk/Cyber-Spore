/* Shuriken Squad feature: "Kumbara" (piggy bank).
   Paid mode (monetization on): every 40 kills drop a gem into the bank (up to 500); once it holds 100+ gems it can
   be broken with a one-off purchase (SS.IAP 'ss_piggy') — the price is fixed, so the fuller it is, the better the deal.
   Free mode (monetization off, e.g. a public web build): 1 gem per 25 kills, up to 50, breaks free when full or
   after a boss win. */
(() => {
'use strict';
function boot() {
  const SS = window.SS; if (!SS || SS._piggyB) return; SS._piggyB = true;
  const save = SS.save, IAP = SS.IAP;
  const paid = !!(IAP && IAP.enabled);
  const KILLS_PER_GEM = paid ? 40 : 25, CAP = paid ? 500 : 50, MIN_PAID = 100;
  if (!save.piggy || typeof save.piggy !== 'object') save.piggy = {};
  const P = save.piggy;
  if (!(P.kills >= 0)) P.kills = 0;
  if (!(P.gems >= 0)) P.gems = 0;
  P.gems = Math.min(P.gems, CAP);
  P.unlocked = !!P.unlocked;
  if (!(P.opened >= 0)) P.opened = 0;

  const btn = SS.addSideButton({ side: 'right', label: 'Kumbara', icon: 'assets/ui/ic_piggy.png', color: 'purple', id: 'piggyBtn', onClick: open });
  btn.classList.add('fb-pig-btn');
  const meter = SS.el(`<div class="fb-pigmeter"><i></i><img src="assets/ui/gem.png" alt=""><b>0/${CAP}</b></div>`);
  btn.appendChild(meter);
  const canOpen = () => paid ? P.gems >= MIN_PAID : P.gems > 0 && (P.gems >= CAP || P.unlocked);
  let lastKey = '';
  function refreshBtn() {
    const key = P.gems + '|' + canOpen();
    if (key === lastKey) return; lastKey = key;
    meter.querySelector('i').style.width = (P.gems / CAP * 100) + '%';
    meter.querySelector('b').textContent = P.gems + '/' + CAP;
    btn.classList.toggle('full', P.gems >= CAP);
  }
  function bump() { btn.classList.remove('fb-bump'); void btn.offsetWidth; btn.classList.add('fb-bump'); }

  SS.HOOKS.kill.push(() => {
    if (P.gems >= CAP) return;
    if (++P.kills >= KILLS_PER_GEM) {
      P.kills = 0; P.gems++; bump();
      if (P.gems === CAP) SS.toast(paid ? 'Kumbara doldu! Daha fazla elmas sığmıyor' : 'Kumbara doldu! Kırmak için dokun');
      if (paid && P.gems === MIN_PAID) SS.toast('Kumbara kırılmaya hazır');
    }
    refreshBtn();
  });
  if (!paid) SS.HOOKS.bossWin.push(() => { if (P.gems > 0 && !P.unlocked) { P.unlocked = true; refreshBtn(); setTimeout(() => SS.toast('Kumbara açılabilir!'), 2200); } });

  // breaking animation + payout (used by the purchase grant in paid mode)
  function smash(root, done) {
    const n = P.gems;
    P.gems = 0; P.unlocked = false; P.opened++;
    save.gems += n; SS.sfx('magic'); SS.sfx('win');
    if (root) {
      const stg = root.querySelector('.fb-pigstage');
      if (stg) {
        stg.classList.add('smash'); stg.querySelector('.fb-bigpig').src = 'assets/ui/chest_open.png';
        const r = stg.getBoundingClientRect();
        for (let i = 0; i < 12; i++) {
          const g = SS.el('<img class="fb-fly" src="assets/ui/gem.png" alt="">');
          g.style.left = (r.left + r.width / 2) + 'px'; g.style.top = (r.top + r.height / 2) + 'px';
          g.style.setProperty('--dx', (Math.random() * 200 - 100) + 'px'); g.style.setProperty('--dy', (-40 - Math.random() * 90) + 'px');
          g.style.animationDelay = (i * 0.04) + 's';
          document.body.appendChild(g); setTimeout(() => g.remove(), 1200);
        }
        const sb = root.querySelector('.fb-store b'); if (sb) sb.textContent = '+' + n;
      }
    }
    SS.persist(); SS.refreshUI(); refreshBtn();
    setTimeout(() => { SS.closePanel(); SS.banner('KUMBARA!', `+${n} elmas`); if (done) done(); }, root ? 1100 : 0);
  }
  let openRoot = null;
  function breakPaid() { smash(openRoot); }

  function open() {
    SS.openPanel('Kumbara', 'purple', body => {
      const root = SS.el(`<div class="fb-piggy">
        <div class="fb-pigstage"><img class="fb-bigpig" src="assets/ui/chest.png" alt=""></div>
        <div class="fb-store"><img src="assets/ui/gem.png" alt=""><b>${P.gems}</b><small>/ ${CAP}</small></div>
        <div class="fb-bar pink"><i style="width:${P.gems / CAP * 100}%"></i><span>${P.gems >= CAP ? 'KUMBARA DOLU!' : `Sonraki elmas: ${KILLS_PER_GEM - P.kills} düşman`}</span></div>
      </div>`);
      body.appendChild(root); openRoot = root;
      if (paid) {
        body.appendChild(SS.el(`<p class="big-note">Her ${KILLS_PER_GEM} düşmanda kumbaraya 1 elmas düşer (en fazla ${CAP}). En az ${MIN_PAID} elmas olunca tek seferlik ödemeyle kırılır — fiyat sabit, kumbara ne kadar doluysa o kadar kârlı.</p>`));
        const ok = canOpen();
        const b = SS.el(`<button class="btn wide ${ok ? 'yellow' : 'grey off'}">${ok ? `<img src="assets/ui/key.png" alt="">Kır · ${IAP.price('ss_piggy')}` : `<img src="assets/ui/lock.png" alt="">${MIN_PAID} elmasta açılır`}</button>`);
        b.onclick = () => { if (canOpen()) IAP.buy('ss_piggy'); };
        body.appendChild(b);
      } else {
        body.appendChild(SS.el(`<p class="big-note">Her ${KILLS_PER_GEM} düşmanda kumbaraya 1 elmas düşer (en fazla ${CAP}). Kumbara <b class="fb-hl">dolunca</b> ya da bir <b class="fb-hl">boss yenince</b> ücretsiz kırılır.</p>`));
        const ok = canOpen();
        const b = SS.el(`<button class="btn wide ${ok ? 'yellow' : 'grey off'}">${ok ? '<img src="assets/ui/key.png" alt="">KIR VE AL' : (P.gems === 0 ? 'KUMBARA BOŞ' : '<img src="assets/ui/lock.png" alt="">KİLİTLİ')}</button>`);
        b.onclick = () => { if (canOpen()) { b.className = 'btn wide grey off'; b.textContent = 'TOPLANDI'; smash(root); } };
        body.appendChild(b);
      }
    });
  }
  refreshBtn();
  SS.piggy = { open, refresh: refreshBtn, breakPaid };
}
if (window.SS) boot(); else window.addEventListener('load', boot);
})();
