/* Swarm Squad feature: "Kumbara" — piggy bank that fills with gems from kills. Opens when full or after a boss win. */
(() => {
'use strict';
function boot() {
  const SS = window.SS; if (!SS || SS._piggyB) return; SS._piggyB = true;
  const save = SS.save;
  const KILLS_PER_GEM = 25, CAP = 50;
  if (!save.piggy || typeof save.piggy !== 'object') save.piggy = {};
  const P = save.piggy;
  if (!(P.kills >= 0)) P.kills = 0;
  if (!(P.gems >= 0)) P.gems = 0;
  P.unlocked = !!P.unlocked;
  if (!(P.opened >= 0)) P.opened = 0;

  const btn = SS.addSideButton({ side: 'right', label: 'Kumbara', icon: 'assets/ui/ic_piggy.png', color: 'purple', id: 'piggyBtn', onClick: open });
  btn.classList.add('fb-pig-btn');
  const meter = SS.el('<div class="fb-pigmeter"><i></i><img src="assets/ui/gem.png" alt=""><b>0/50</b></div>');
  btn.appendChild(meter);
  const canOpen = () => P.gems > 0 && (P.gems >= CAP || P.unlocked);
  let lastKey = '';
  function refreshBtn() {
    const key = P.gems + '|' + canOpen();
    if (key === lastKey) return; lastKey = key;
    meter.querySelector('i').style.width = (P.gems / CAP * 100) + '%';
    meter.querySelector('b').textContent = P.gems + '/' + CAP;
    btn.classList.toggle('ready', canOpen());
    btn.classList.toggle('full', P.gems >= CAP);
  }
  function bump() { btn.classList.remove('fb-bump'); void btn.offsetWidth; btn.classList.add('fb-bump'); }

  SS.HOOKS.kill.push(() => {
    if (P.gems >= CAP) return;
    P.kills++;
    if (P.kills >= KILLS_PER_GEM) {
      P.kills = 0; P.gems++; bump();
      if (P.gems >= CAP) SS.toast('Kumbara doldu! Kırmak için dokun');
    }
    refreshBtn();
  });
  SS.HOOKS.bossWin.push(() => { if (P.gems > 0 && !P.unlocked) { P.unlocked = true; refreshBtn(); setTimeout(() => SS.toast('Kumbara açılabilir!'), 2200); } });

  function open() {
    SS.openPanel('Kumbara', 'purple', body => {
      const root = SS.el(`<div class="fb-piggy">
        <div class="fb-pigstage"><img class="fb-bigpig" src="assets/ui/chest.png" alt=""><div class="fb-coins"></div></div>
        <div class="fb-store"><img src="assets/ui/gem.png" alt=""><b>${P.gems}</b><small>/ ${CAP}</small></div>
        <div class="fb-bar pink"><i style="width:${P.gems / CAP * 100}%"></i><span>${P.gems >= CAP ? 'KUMBARA DOLU!' : `Sonraki elmas: ${KILLS_PER_GEM - P.kills} düşman`}</span></div>
      </div>`);
      body.appendChild(root);
      body.appendChild(SS.el(`<p class="big-note">Her ${KILLS_PER_GEM} düşmanda kumbaraya 1 elmas düşer (en fazla ${CAP}). Kumbara <b class="fb-hl">dolunca</b> ya da bir <b class="fb-hl">boss yenince</b> ücretsiz kırılır.</p>`));
      const ok = canOpen();
      const b = SS.el(`<button class="btn wide ${ok ? 'yellow pulse' : 'grey off'}">${ok ? '<img src="assets/ui/key.png" alt="">KIR VE AL' : (P.gems === 0 ? 'KUMBARA BOŞ' : '<img src="assets/ui/lock.png" alt="">KİLİTLİ')}</button>`);
      if (!ok && P.gems > 0) body.appendChild(SS.el('<p class="big-note fb-small">Doldur ya da bir boss yen!</p>'));
      body.appendChild(b);
      b.onclick = () => {
        if (!canOpen()) return;
        const n = P.gems;
        P.gems = 0; P.unlocked = false; P.opened++;
        save.gems += n; SS.sfx('magic'); SS.sfx('win');
        const st = root.querySelector('.fb-pigstage'); st.classList.add('smash'); st.querySelector('.fb-bigpig').src = 'assets/ui/chest_open.png';
        const cs = root.querySelector('.fb-coins');
        for (let i = 0; i < 14; i++) {
          const g = SS.el('<img src="assets/ui/gem.png" alt="">');
          g.style.setProperty('--dx', (Math.random() * 220 - 110) + 'px'); g.style.setProperty('--dy', (-40 - Math.random() * 110) + 'px');
          g.style.animationDelay = (Math.random() * 0.15) + 's'; cs.appendChild(g);
        }
        root.querySelector('.fb-store b').textContent = '+' + n;
        b.className = 'btn wide grey off'; b.textContent = 'TOPLANDI';
        SS.persist(); SS.refreshUI(); refreshBtn();
        setTimeout(() => { SS.closePanel(); SS.banner('KUMBARA!', `+${n} elmas`); }, 1100);
      };
    });
  }
  refreshBtn();
  SS.piggy = { open, refresh: refreshBtn };
}
if (window.SS) boot(); else window.addEventListener('load', boot);
})();
