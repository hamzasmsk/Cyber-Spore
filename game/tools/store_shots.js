// Store screenshots from the real game: node tools/store_shots.js
// 1080x1920 (9:16) phone shots in Turkish and English with a caption bar, into store/screenshots/{tr,en}/.
const { chromium } = require('playwright'), path = require('path'), fs = require('fs');
const URL = 'file://' + path.resolve(__dirname, '../index.html');
const CAP = {
  tr: ['Ninja takımın sürüleri kendi biçer', 'Zayıf noktaya dokun, bossu devir', 'Her boss sonrası bir yetenek seç', '13 silah · Neo Ninja serisi', 'Efekt kaplamalarıyla görsel şölen', 'Doğuş yap, Ruh Ağacı\'nı büyüt', 'Kule: her katta yeni bir kural', 'Sen yokken de takımın kazanır'],
  en: ['Your ninja squad mows down hordes', 'Tap the weak spot, topple the boss', 'Pick a new skill after every boss', '13 weapons · the Neo Ninja line', 'Effect skins light up every throw', 'Rebirth and grow your Soul Tree', 'Tower: a new rule on every floor', 'Your squad earns while you\'re away'],
};
// green Bambu Vadisi (stage 1-10 look) with readable numbers; the best record keeps every menu open
const BASE = { money: 4.2e9, gems: 4200, stage: 7, sub: 3, best: 40, lv: { power: 34, speed: 30, money: 40 }, gun: 9, wbest: 10, team: 5, rebirths: 4, rp: 40, tut: { power: true } };
(async () => {
  const b = await chromium.launch();
  for (const lang of ['tr', 'en']) {
    const dir = path.resolve(__dirname, `../store/screenshots/${lang}`); fs.mkdirSync(dir, { recursive: true });
    const ctx = await b.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, locale: lang === 'tr' ? 'tr-TR' : 'en-US', isMobile: true, hasTouch: true });
    const p = await ctx.newPage();
    await p.goto(URL); await p.waitForFunction(() => window.SS && SS.R.heroes.length > 0);
    await p.evaluate(s => { const d = new Date(); Object.assign(SS.save, JSON.parse(JSON.stringify(s))); SS.save.login.last = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; SS.save.wstar[9] = 3; SS.unlock.all(); SS.setupHeroes(); SS.fxskins.give('sakura', true); SS.fxskins.equip('sakura'); SS.save.mon.offers.ss_starter = { shown: 1 }; SS.save.mon.offers.ss_neo_pack = { shown: 1 }; SS.save.wsSeen = 1;
      SS.save.tree.souls = 46; Object.assign(SS.save.tree.lv, { blade: 6, hand: 3, gold: 5, hunt: 2, body: 3 }); SS.save.tower.best = 14; }, BASE);
    const clean = () => p.evaluate(() => { SS.closePanel(); document.querySelectorAll('.un-card,.fl-card,.pk-ov,.ch-ov,.mz-ov,#toast').forEach(x => x.classList.contains('show') ? x.classList.remove('show') : x.id !== 'toast' && x.remove()); SS.R.paused = false; });
    const shot = async (i) => {
      await p.evaluate(t => {
        let c = document.getElementById('shotCap'); if (!c) { c = document.createElement('div'); c.id = 'shotCap'; document.body.appendChild(c); }
        c.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:99;padding:16px 14px 26px;text-align:center;font:700 23px/1.12 var(--font);color:#ffe18d;background:linear-gradient(#131b1bf5 0%,#131b1be6 70%,#131b1b00 100%);text-shadow:-2px 0 0 #131b1b,2px 0 0 #131b1b,0 -2px 0 #131b1b,0 2px 0 #131b1b,3px 3px 0 #8f3e56';
        c.textContent = t;
        if (!document.getElementById('shotCss')) { const st = document.createElement('style'); st.id = 'shotCss'; st.textContent = '#toast,#banner,#goal,#evoTag,.fl-card,.un-card{visibility:hidden!important}'; document.head.appendChild(st); }
      }, CAP[lang][i]);
      await p.screenshot({ path: `${dir}/${i + 1}.png` });
      await p.evaluate(() => { for (const id of ['shotCap', 'shotCss']) { const c = document.getElementById(id); if (c) c.remove(); } });
    };
    // 1 horde
    await clean(); await p.waitForTimeout(1500); await p.waitForFunction(() => SS.R.en.filter(e => !e.dead).length >= 8, null, { timeout: 20000 }).catch(() => {}); await clean(); await shot(0);
    // 2 boss + weak spot
    await p.evaluate(() => { SS.save.bossReady = true; SS.startBoss(); const b = SS.R.boss; b.maxHp = b.hp = SS.dmgPerShot() * 900; b.t = 99; }); await p.waitForFunction(() => SS.weakspot.spot, null, { timeout: 15000 }); await p.waitForTimeout(400); await shot(1);
    await p.evaluate(() => { if (SS.R.boss) SS.bossWin(); });
    // 3 perks: the card choice opens by itself after a boss win
    await p.waitForSelector('.pk-ov .pk-card', { timeout: 12000 }); await p.waitForTimeout(700); await shot(2);
    await p.evaluate(() => { const c = document.querySelector('.pk-ov .pk-card'); if (c) c.click(); }); await p.waitForTimeout(1500); await clean();
    // 4 weapons (Neo section)
    await p.evaluate(() => SS.PANELS.guns()); await p.waitForTimeout(400); await p.evaluate(() => { const h = document.querySelector('#pBody .neo-sec'); if (h) h.scrollIntoView({ block: 'start' }); }); await p.waitForTimeout(200); await shot(3); await clean();
    // 5 effect skin on the field
    await p.waitForTimeout(2500); await shot(4);
    // 6 soul tree
    await p.evaluate(() => SS.PANELS.rebirth('t')); await p.waitForTimeout(400); await shot(5); await clean();
    // 7 tower
    await p.evaluate(() => SS.tower && SS.tower.open()); await p.waitForTimeout(400); await p.evaluate(() => { document.getElementById('pBody').scrollTop = 0; }); await p.waitForTimeout(100); await shot(6); await clean();
    // 8 offline reward
    await p.evaluate(() => { SS.save.t = Date.now() - 4 * 3600e3; SS.save.rate = SS.save.rate || 1e12; SS.offlineReward(); }); await p.waitForTimeout(700); await shot(7);
    await ctx.close();
  }
  await b.close(); console.log('screenshots done');
})();
