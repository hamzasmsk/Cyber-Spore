/* Layout integration (loads last): the top-left square button opens Ayarlar (settings), so the
   settings side button added by settings.js is hidden to keep the side columns short. */
(function () {
  function place() {
    const gear = document.getElementById('settingsBtn'), top = document.getElementById('soundBtn');
    if (!gear || !top) return false;
    top.id = 'settingsTop';
    top.addEventListener('click', () => gear.click());
    gear.style.display = 'none';
    return true;
  }
  if (!place()) window.addEventListener('load', place);
})();
