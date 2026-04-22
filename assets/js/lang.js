/**
 * Language switcher & auto-redirect.
 *
 * Behavior:
 *  - Exposes window.switchLang() for the in-page "中 / EN" toggle. Clicking saves
 *    the user's choice in localStorage and jumps to the corresponding file.
 *  - On first visit to the Chinese index.html (no stored preference), checks the
 *    user's IP geolocation via ipapi.co. If NOT in Greater China (CN/HK/MO/TW),
 *    redirects to index_en.html. Failure (blocked API / offline) silently keeps
 *    the Chinese version.
 *  - Subpages never auto-redirect on load to avoid surprising context switches.
 *  - If the user has already chosen a language (stored), visiting the "other"
 *    index.html will auto-route to their saved version.
 */
(function () {
  const path = location.pathname;
  const file = (path.split('/').pop() || 'index.html').toLowerCase();
  const CURRENT = /_en\.html$/.test(file) ? 'en' : 'zh';

  function otherFile(lang) {
    if (lang === 'en') {
      return (file === '' || file === 'index.html' || !file)
        ? 'index_en.html'
        : file.replace(/\.html$/, '_en.html');
    }
    return file.replace(/_en\.html$/, '.html') || 'index.html';
  }

  function goTo(lang) {
    const target = otherFile(lang);
    location.href = path.replace(/[^\/]*$/, target);
  }

  // Exposed for the nav toggle button
  window.switchLang = function () {
    const target = CURRENT === 'en' ? 'zh' : 'en';
    try { localStorage.setItem('lang-pref', target); } catch (_) {}
    goTo(target);
  };

  // -------- Auto-route logic (only on the home page) --------
  const isHomeZH = file === 'index.html' || file === '';
  const isHomeEN = file === 'index_en.html';
  if (!isHomeZH && !isHomeEN) return;

  const pref = (function () {
    try { return localStorage.getItem('lang-pref'); } catch (_) { return null; }
  })();

  // If user has previously chosen a language, respect it.
  if (pref && pref !== CURRENT && (pref === 'en' || pref === 'zh')) {
    location.replace(path.replace(/[^\/]*$/, otherFile(pref)));
    return;
  }

  // No stored preference — only the Chinese index auto-detects and may redirect outside users.
  if (!pref && isHomeZH) {
    // Timeout guard so the page isn't held up if the geo API is slow.
    const controller = (typeof AbortController === 'function') ? new AbortController() : null;
    const timer = setTimeout(function () { if (controller) controller.abort(); }, 2500);
    fetch('https://ipapi.co/json/', controller ? { signal: controller.signal } : {})
      .then(function (r) { clearTimeout(timer); return r.json(); })
      .then(function (d) {
        if (!d || !d.country_code) return;
        const greaterChina = ['CN', 'HK', 'MO', 'TW'];
        if (greaterChina.indexOf(d.country_code) === -1) {
          location.replace(path.replace(/[^\/]*$/, 'index_en.html'));
        }
      })
      .catch(function () { /* stay on zh */ });
  }
})();
