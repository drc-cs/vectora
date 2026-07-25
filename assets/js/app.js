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
  var RIPPLE_SELECTOR = '.btn, .chip, .work-card, .nav__link, .theme-toggle';
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

  /* ---- Testimonial scroll controls ---------------------------------------- */
  var track = document.getElementById('testimonials-track');
  var prevBtn = document.getElementById('testimonial-prev');
  var nextBtn = document.getElementById('testimonial-next');
  if (track && prevBtn && nextBtn) {
    var scrollByCard = function (dir) {
      var card = track.querySelector('.testimonial');
      var distance = card ? card.getBoundingClientRect().width + 20 : 340;
      track.scrollBy({ left: dir * distance, behavior: 'smooth' });
    };
    prevBtn.addEventListener('click', function () { scrollByCard(-1); });
    nextBtn.addEventListener('click', function () { scrollByCard(1); });
  }

  /* ---- Research & IP gallery ------------------------------------------------ */
  var grid = document.getElementById('works-grid');
  var emptyState = document.getElementById('gallery-empty');
  var categoryChips = document.querySelectorAll('.gallery-controls [data-filter]');
  var domainSelect = document.getElementById('domain-filter');
  var searchInput = document.getElementById('works-search');
  var works = [];
  var state = { type: 'All', domain: 'All', query: '' };

  function esc(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function externalIcon() {
    return '<svg class="work-card__ext" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14 4h6v6M20 4 10 14M19 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6"/></svg>';
  }

  function renderWorks() {
    if (!grid) return;
    var q = state.query.trim().toLowerCase();
    var visibleCount = 0;
    grid.innerHTML = '';
    works.forEach(function (w) {
      var matchesType = state.type === 'All' || w.type === state.type;
      var matchesDomain = state.domain === 'All' || (w.domain_tags || []).indexOf(state.domain) !== -1;
      var haystack = [w.title, w.venue, w.executive_summary].concat(w.domain_tags || []).join(' ').toLowerCase();
      var matchesQuery = !q || haystack.indexOf(q) !== -1;
      if (!(matchesType && matchesDomain && matchesQuery)) return;
      visibleCount++;

      var card = document.createElement('a');
      card.className = 'work-card reveal is-visible';
      card.href = w.external_url || '#';
      card.target = '_blank';
      card.rel = 'noopener noreferrer';
      card.innerHTML =
        '<div class="work-card__top">' +
          '<span class="work-type">' + esc(w.type) + '</span>' +
          externalIcon() +
        '</div>' +
        '<h3>' + esc(w.title) + '</h3>' +
        '<p class="work-card__venue">' + esc(w.venue) + ' &middot; ' + esc(String(w.year)) + '</p>' +
        '<p>' + esc(w.executive_summary) + '</p>' +
        '<div class="work-card__tags">' + (w.domain_tags || []).map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('') + '</div>';
      grid.appendChild(card);
    });
    if (emptyState) emptyState.hidden = visibleCount !== 0;
  }

  function populateDomains() {
    if (!domainSelect) return;
    var domains = [];
    works.forEach(function (w) {
      (w.domain_tags || []).forEach(function (t) {
        if (domains.indexOf(t) === -1) domains.push(t);
      });
    });
    domains.sort();
    domains.forEach(function (t) {
      var opt = document.createElement('option');
      opt.value = t;
      opt.textContent = t;
      domainSelect.appendChild(opt);
    });
  }

  if (grid) {
    fetch('assets/data/works.json')
      .then(function (res) { return res.json(); })
      .then(function (data) {
        works = data.sort(function (a, b) { return b.year - a.year; });
        populateDomains();
        renderWorks();
      })
      .catch(function () {
        if (emptyState) {
          emptyState.hidden = false;
          emptyState.textContent = 'Unable to load research and IP data right now.';
        }
      });

    categoryChips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        categoryChips.forEach(function (c) { c.setAttribute('aria-pressed', 'false'); });
        chip.setAttribute('aria-pressed', 'true');
        state.type = chip.getAttribute('data-filter');
        renderWorks();
      });
    });
    if (domainSelect) domainSelect.addEventListener('change', function () {
      state.domain = domainSelect.value;
      renderWorks();
    });
    if (searchInput) searchInput.addEventListener('input', function () {
      state.query = searchInput.value;
      renderWorks();
    });
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
    form.addEventListener('submit', function (e) {
      e.preventDefault();
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
          showSnackbar('Thank you — your inquiry has been sent. We respond within 24–48 hours.');
        } else {
          showSnackbar('Something went wrong. Please try again or email us directly.');
        }
      }).catch(function () {
        showSnackbar('Something went wrong. Please try again or email us directly.');
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
