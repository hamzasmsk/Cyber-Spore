/* Layout integration (loads last): the settings gear replaces the top-left sound button,
   since sound is a toggle inside Ayarlar, which frees a slot in the side columns. */
(function () {
  function place() {
    const gear = document.getElementById('settingsBtn'), sound = document.getElementById('soundBtn');
    if (!gear || !sound) return false;
    const icon = gear.querySelector('img, svg');
    const btn = document.createElement('button');
    btn.className = 'rbtn grey'; btn.id = 'settingsTop'; btn.setAttribute('aria-label', 'Ayarlar');
    if (icon) btn.appendChild(icon.cloneNode(true));
    btn.addEventListener('click', () => gear.click());
    sound.replaceWith(btn);
    gear.style.display = 'none';
    return true;
  }
  if (!place()) window.addEventListener('load', place);
})();
