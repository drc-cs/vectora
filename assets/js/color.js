/* Dynamic color: plays the seed-hue "spin to green" intro once per visit,
   and manages the light/dark theme toggle. All actual color math lives in
   CSS (tokens.css) — this just triggers the animation and flips the
   data-theme attribute the token stylesheet reads. */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function playIntro(target, duration, quick) {
    if (reduceMotion) return;
    target.classList.remove('vec-hue-intro', 'vec-hue-intro--quick');
    // Force reflow so the class can be re-added to restart the animation.
    void target.offsetWidth;
    target.classList.add('vec-hue-intro');
    if (quick) target.classList.add('vec-hue-intro--quick');
    window.clearTimeout(target._vecHueTimer);
    target._vecHueTimer = window.setTimeout(function () {
      target.classList.remove('vec-hue-intro', 'vec-hue-intro--quick');
    }, duration || 5300);
  }

  document.addEventListener('DOMContentLoaded', function () {
    playIntro(root, 5300);

    // Fun, opt-in easter egg: replay the three-color drift when the
    // wordmark is clicked, and a quicker version on hover/focus — timed to
    // match the brand mark's blob speeding up (see .brand:hover in
    // styles.css) so the color wash and the spinning blob land together.
    var brand = document.querySelector('.brand');
    if (brand) {
      brand.addEventListener('click', function () {
        playIntro(root, 5300);
      });
      brand.addEventListener('mouseenter', function () {
        playIntro(root, 3100, true);
      });
      brand.addEventListener('focus', function () {
        playIntro(root, 3100, true);
      });
    }
  });

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
