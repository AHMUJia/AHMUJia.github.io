(function () {
  const themeToggle = document.getElementById('themeToggle');
  const icon = themeToggle ? themeToggle.querySelector('i') : null;

  function setTheme(isDark) {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    if (icon) {
      icon.classList.toggle('fa-sun', isDark);
      icon.classList.toggle('fa-moon', !isDark);
    }
  }

  // Follow OS (live)
  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  setTheme(mql.matches);
  if (typeof mql.addEventListener === 'function') {
    mql.addEventListener('change', function (e) { setTheme(e.matches); });
  } else if (typeof mql.addListener === 'function') {
    mql.addListener(function (e) { setTheme(e.matches); });
  }

  // Discard any old persisted preference — site now tracks OS.
  try { localStorage.removeItem('theme'); } catch (_) {}

  // Toggle = temporary override (not persisted, next OS change / reload re-syncs)
  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      setTheme(!isDark);
    });
  }

  // Footer year
  const yearEl = document.querySelector('[data-year]');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
})();
