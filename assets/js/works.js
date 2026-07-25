/* Research & IP gallery.
 *
 * Publications are fetched live from the Crossref REST API (free, no key,
 * CORS-enabled — safe to call directly from the browser). Patents have no
 * equivalent public, keyless API: Google Patents exposes no JSON endpoint,
 * and USPTO's PatentsView API began requiring an authenticated key in
 * February 2026, which cannot be embedded safely in client-side code on a
 * static site. Rather than fake that data, patents are surfaced as a live
 * search link straight to Google Patents. Technical Insights have no public
 * data source at all and stay manually curated in insights.json.
 */
(function () {
  'use strict';

  var PRINCIPALS = [
    {
      name: 'Joshua DeAndria',
      familyName: 'deandria',
      domainTags: ['Machine Learning'],
      patentsUrl: 'https://patents.google.com/?inventor=Joshua+DeAndria'
    },
    {
      name: 'Shaina Alexandria',
      familyName: 'alexandria',
      domainTags: ['Biostatistics', 'Clinical Trials'],
      patentsUrl: 'https://patents.google.com/?inventor=Shaina+Alexandria'
    }
  ];

  var CROSSREF_FIELDS = 'DOI,title,author,container-title,issued,published-print,published-online,type,abstract,URL';
  var CACHE_KEY = 'vectora-publications-cache-v1';
  var CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
  var FETCH_TIMEOUT_MS = 6000;

  var grid = document.getElementById('works-grid');
  var emptyState = document.getElementById('gallery-empty');
  var galleryStatus = document.getElementById('gallery-status');
  var categoryChips = document.querySelectorAll('.gallery-controls [data-filter]');
  var domainSelect = document.getElementById('domain-filter');
  var searchInput = document.getElementById('works-search');
  var patentsLinks = document.getElementById('patents-links');

  if (!grid) return;

  var items = [];
  var state = { type: 'All', domain: 'All', query: '' };

  function esc(str) {
    var div = document.createElement('div');
    div.textContent = str == null ? '' : str;
    return div.innerHTML;
  }

  function stripTags(html) {
    return String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function externalIcon() {
    return '<svg class="work-card__ext" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14 4h6v6M20 4 10 14M19 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6"/></svg>';
  }

  function yearFromWork(w) {
    var dateParts = (w['published-print'] && w['published-print']['date-parts']) ||
      (w['published-online'] && w['published-online']['date-parts']) ||
      (w.issued && w.issued['date-parts']);
    return dateParts && dateParts[0] && dateParts[0][0] ? dateParts[0][0] : null;
  }

  function authorsFromWork(w) {
    if (!Array.isArray(w.author)) return '';
    var names = w.author.map(function (a) {
      return [a.given, a.family].filter(Boolean).join(' ');
    }).filter(Boolean);
    if (names.length > 4) return names.slice(0, 3).join(', ') + ', et al.';
    return names.join(', ');
  }

  function matchesPrincipal(w, principal) {
    if (!Array.isArray(w.author)) return false;
    return w.author.some(function (a) {
      return a.family && a.family.toLowerCase().indexOf(principal.familyName) !== -1;
    });
  }

  function normalizeCrossrefWork(raw, principal) {
    var year = yearFromWork(raw);
    var venue = (raw['container-title'] && raw['container-title'][0]) || 'Preprint / working paper';
    var summary = stripTags(raw.abstract) || ('Peer-reviewed work published in ' + venue + '.');
    return {
      id: 'doi-' + raw.DOI,
      title: stripTags((raw.title && raw.title[0]) || 'Untitled work'),
      type: 'Publication',
      venue: venue,
      year: year,
      authors: authorsFromWork(raw),
      domain_tags: principal.domainTags,
      executive_summary: summary,
      external_url: raw.URL || ('https://doi.org/' + raw.DOI)
    };
  }

  function fetchPublicationsFor(principal) {
    var url = 'https://api.crossref.org/works?query.author=' +
      encodeURIComponent(principal.name) +
      '&rows=15&sort=published&order=desc&select=' + CROSSREF_FIELDS;
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, FETCH_TIMEOUT_MS);
    return fetch(url, { signal: controller.signal })
      .then(function (res) {
        if (!res.ok) throw new Error('Crossref request failed: ' + res.status);
        return res.json();
      })
      .then(function (data) {
        var results = (data.message && data.message.items) || [];
        return results
          .filter(function (w) { return w.title && w.title[0] && matchesPrincipal(w, principal); })
          .map(function (w) { return normalizeCrossrefWork(w, principal); });
      })
      .finally(function () { clearTimeout(timer); });
  }

  function dedupe(list) {
    var seen = Object.create(null);
    return list.filter(function (w) {
      if (seen[w.id]) return false;
      seen[w.id] = true;
      return true;
    });
  }

  function readCache() {
    try {
      var raw = window.sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
      return parsed.items;
    } catch (e) { return null; }
  }

  function writeCache(pubItems) {
    try {
      window.sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), items: pubItems }));
    } catch (e) { /* storage unavailable or full — non-fatal */ }
  }

  function loadInsights() {
    return fetch('assets/data/insights.json').then(function (res) {
      if (!res.ok) throw new Error('insights.json request failed');
      return res.json();
    }).catch(function () { return []; });
  }

  function loadPublications() {
    var cached = readCache();
    if (cached) return Promise.resolve(cached);
    return Promise.all(PRINCIPALS.map(function (p) {
      return fetchPublicationsFor(p).catch(function () { return null; }); // null = this principal's fetch failed
    })).then(function (results) {
      if (results.every(function (r) { return r === null; })) {
        throw new Error('All Crossref requests failed');
      }
      var merged = dedupe([].concat.apply([], results.filter(Boolean)));
      writeCache(merged);
      return merged;
    });
  }

  function renderPatentLinks() {
    if (!patentsLinks) return;
    patentsLinks.innerHTML = PRINCIPALS.map(function (p) {
      return '<a class="chip" href="' + p.patentsUrl + '" target="_blank" rel="noopener noreferrer">' +
        'Patents &middot; ' + esc(p.name) + externalIcon() + '</a>';
    }).join('');
  }

  function renderWorks() {
    var q = state.query.trim().toLowerCase();
    var visibleCount = 0;
    grid.innerHTML = '';
    items.forEach(function (w) {
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
        '<p class="work-card__venue">' + esc(w.venue) + (w.year ? ' &middot; ' + esc(String(w.year)) : '') + '</p>' +
        '<p>' + esc(w.executive_summary) + '</p>' +
        '<div class="work-card__tags">' + (w.domain_tags || []).map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('') + '</div>';
      grid.appendChild(card);
    });
    if (emptyState) emptyState.hidden = visibleCount !== 0;
  }

  function populateDomains() {
    if (!domainSelect) return;
    var domains = [];
    items.forEach(function (w) {
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

  function setStatus(message) {
    if (galleryStatus) galleryStatus.innerHTML = message;
  }

  renderPatentLinks();
  setStatus('Loading publications and technical insights…');

  Promise.all([
    loadPublications().catch(function (err) { return { error: err }; }),
    loadInsights()
  ]).then(function (results) {
    var pubResult = results[0];
    var insights = results[1] || [];

    if (pubResult && pubResult.error) {
      setStatus('Live publication lookup is temporarily unavailable — browse directly on ' +
        '<a href="https://search.crossref.org/?q=' + encodeURIComponent(PRINCIPALS.map(function (p) { return p.name; }).join(' ')) + '" target="_blank" rel="noopener noreferrer">Crossref</a>.');
      items = insights;
    } else {
      items = (pubResult || []).concat(insights);
      setStatus('');
    }

    populateDomains();
    renderWorks();
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
})();
