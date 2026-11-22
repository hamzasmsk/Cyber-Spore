/* Layout integration (loads last).
   - The top-left square button opens Ayarlar; the settings side button from settings.js stays hidden.
   - Side columns are put in a fixed order: combat on the left, economy on the right (4 + 5 tiles). */
(function () {
  const LEFT = ['guns', 'team', 'skinBtn', 'passBtn', 'dexBtn', 'rebirth'];
  const RIGHT = ['missionsBtn', 'shopBtn', 'mineBtn', 'piggyBtn', 'boostBtn'];
  function key(b) {
    if (b.dataset.open) return b.dataset.open;
    if (b.id) return b.id;
    const t = (b.textContent || '').toLowerCase();
    if (t.includes('görev')) return 'missions';
    if (t.includes('mağaza')) return 'shop';
    if (t.includes('maden')) return 'mine';
    if (t.includes('kumbara')) return 'piggy';
    if (t.includes('boost') || t.includes('güç')) return 'boost';
    if (t.includes('kostüm')) return 'skinBtn';
    return '';
  }
  function place() {
    const gear = document.getElementById('settingsBtn'), top = document.getElementById('soundBtn');
    if (!gear || !top) return false;
    top.id = 'settingsTop';
    top.addEventListener('click', () => gear.click());
    gear.style.display = 'none';
    const all = Array.from(document.querySelectorAll('#ui .side .sbtn'));
    const L = document.querySelector('.side.left'), R = document.querySelector('.side.right');
    const byKey = {}; all.forEach(b => { byKey[key(b)] = b; });
    LEFT.forEach(k => { if (byKey[k]) L.appendChild(byKey[k]); });
    RIGHT.forEach(k => { if (byKey[k]) R.appendChild(byKey[k]); });
    all.forEach(b => { if (!LEFT.includes(key(b)) && !RIGHT.includes(key(b)) && b !== gear) R.appendChild(b); });
    return true;
  }
  if (!place()) window.addEventListener('load', place);
})();
