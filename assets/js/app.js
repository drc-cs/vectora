(function () {
  'use strict';

  /* ---- Mobile navigation drawer -------------------------------------- */
  var navToggle = document.getElementById('nav-toggle');
  var nav = document.getElementById('primary-nav');
  var scrim = document.getElementById('nav-scrim');

  function closeNav() {
    if (!nav) return;
    nav.classList.remove('is-open');
    if (scrim) scrim.classList.remove('is-open');
    if (navToggle) navToggle.setAttribute('aria-expanded', 'false');
  }
  function openNav() {
    if (!nav) return;
    nav.classList.add('is-open');
    if (scrim) scrim.classList.add('is-open');
    if (navToggle) navToggle.setAttribute('aria-expanded', 'true');
  }
  if (navToggle && nav) {
    navToggle.addEventListener('click', function () {
      var isOpen = nav.classList.contains('is-open');
      if (isOpen) closeNav(); else openNav();
    });
  }
  if (scrim) scrim.addEventListener('click', closeNav);
  nav && nav.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', closeNav);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeNav();
  });

  /* ---- App bar tonal elevation on scroll ------------------------------ */
  var appBar = document.querySelector('.app-bar');
  if (appBar) {
    var onScroll = function () {
      appBar.classList.toggle('is-elevated', window.scrollY > 8);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---- Smooth anchor scroll with app-bar offset ------------------------ */
  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      var id = this.getAttribute('href').slice(1);
      var target = id && document.getElementById(id);
      if (!target) return;
      e.preventDefault();
      var offset = appBar ? appBar.offsetHeight : 0;
      var top = target.getBoundingClientRect().top + window.pageYOffset - offset - 12;
      window.scrollTo({ top: top, behavior: 'smooth' });
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    });
  });

  /* ---- Ripple state-layer feedback -------------------------------------- */
  var RIPPLE_SELECTOR = '.btn, .nav__link, .theme-toggle, .icon-btn, .how-step, .nav__toggle';
  document.addEventListener('pointerdown', function (e) {
    var el = e.target.closest(RIPPLE_SELECTOR);
    if (!el) return;
    var rect = el.getBoundingClientRect();
    var size = Math.max(rect.width, rect.height) * 1.6;
    var span = document.createElement('span');
    span.className = 'ripple';
    span.style.width = span.style.height = size + 'px';
    span.style.left = (e.clientX - rect.left - size / 2) + 'px';
    span.style.top = (e.clientY - rect.top - size / 2) + 'px';
    var prevPosition = getComputedStyle(el).position;
    if (prevPosition === 'static') el.style.position = 'relative';
    el.style.overflow = 'hidden';
    el.appendChild(span);
    span.addEventListener('animationend', function () { span.remove(); });
  });

  /* ---- Reveal-on-scroll -------------------------------------------------- */
  var revealTargets = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && revealTargets.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
    revealTargets.forEach(function (el) { io.observe(el); });
  } else {
    revealTargets.forEach(function (el) { el.classList.add('is-visible'); });
  }

  /* ---- Contact form -------------------------------------------------------- */
  var form = document.getElementById('contact-form');
  var snackbar = document.getElementById('snackbar');
  var snackbarText = document.getElementById('snackbar-text');
  var snackbarTimer;

  function showSnackbar(message) {
    if (!snackbar || !snackbarText) return;
    snackbarText.textContent = message;
    snackbar.classList.add('is-visible');
    window.clearTimeout(snackbarTimer);
    snackbarTimer = window.setTimeout(function () {
      snackbar.classList.remove('is-visible');
    }, 6000);
  }
  var snackbarClose = document.getElementById('snackbar-close');
  if (snackbarClose) snackbarClose.addEventListener('click', function () {
    snackbar.classList.remove('is-visible');
    window.clearTimeout(snackbarTimer);
  });

  if (form) {
    var formError = document.getElementById('form-error');
    var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    function fieldValid(input) {
      var value = input.value.trim();
      if (!value) return false;
      return input.type !== 'email' || EMAIL_RE.test(value);
    }

    form.querySelectorAll('[required]').forEach(function (input) {
      var clear = function () {
        if (fieldValid(input)) input.closest('.field').classList.remove('is-invalid');
      };
      input.addEventListener('input', clear);
      input.addEventListener('change', clear);
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var invalid = [].filter.call(form.querySelectorAll('[required]'), function (input) {
        var bad = !fieldValid(input);
        input.closest('.field').classList.toggle('is-invalid', bad);
        input.setAttribute('aria-invalid', String(bad));
        return bad;
      });
      if (formError) formError.hidden = invalid.length === 0;
      if (invalid.length) {
        invalid[0].focus();
        return;
      }
      var submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;
      fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' }
      }).then(function (res) {
        if (res.ok) {
          form.reset();
          form.querySelectorAll('.field').forEach(function (f) { f.classList.remove('has-value'); });
          showSnackbar('Thanks, your note is on its way. We reply within 24–48 hours.');
        } else {
          showSnackbar('Something went wrong. Please try again in a moment.');
        }
      }).catch(function () {
        showSnackbar('Something went wrong. Please try again in a moment.');
      }).finally(function () {
        if (submitBtn) submitBtn.disabled = false;
      });
    });

    // Native <select> elements need a class hook to float their label,
    // since :not(:placeholder-shown) has no equivalent for <select>.
    form.querySelectorAll('select').forEach(function (select) {
      var field = select.closest('.field');
      var sync = function () { field.classList.toggle('has-value', !!select.value); };
      sync();
      select.addEventListener('change', sync);
    });
  }
})();
