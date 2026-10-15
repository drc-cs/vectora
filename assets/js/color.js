/* Light/dark theme toggle. All color math lives in CSS (tokens.css); this
   just flips the data-theme attribute the token stylesheet reads. */
(function () {
  'use strict';

  var root = document.documentElement;

  /* ---- Theme toggle ------------------------------------------------- */
  var STORAGE_KEY = 'vectora-theme';
  var toggle = document.getElementById('theme-toggle');

  function applyTheme(theme) {
    if (theme === 'light' || theme === 'dark') {
      root.setAttribute('data-theme', theme);
    } else {
      root.removeAttribute('data-theme');
    }
    if (toggle) {
      var isDark = theme === 'dark' || (theme !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      toggle.setAttribute('aria-pressed', String(isDark));
      toggle.setAttribute('aria-label', isDark ? 'Switch to light theme' : 'Switch to dark theme');
    }
  }

  var stored = null;
  try { stored = window.localStorage.getItem(STORAGE_KEY); } catch (e) { /* storage unavailable */ }
  applyTheme(stored);

  if (toggle) {
    toggle.addEventListener('click', function () {
      var current = root.getAttribute('data-theme');
      var isDark = current === 'dark' || (!current && window.matchMedia('(prefers-color-scheme: dark)').matches);
      var next = isDark ? 'light' : 'dark';
      applyTheme(next);
      try { window.localStorage.setItem(STORAGE_KEY, next); } catch (e) { /* storage unavailable */ }
    });
  }
})();
