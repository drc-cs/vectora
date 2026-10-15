/* Selected work strip (Leadership section).
 *
 * Publications are fetched live from the Crossref REST API (free, no key,
 * CORS-enabled — safe to call directly from the browser). Patents have no
 * equivalent public, keyless API (USPTO's PatentsView requires an
 * authenticated key, which can't be embedded on a static site), so they are
 * curated by hand in patents.json and always lead the strip.
 */
(function () {
  'use strict';

  var PRINCIPALS = [
    { name: "Joshua D'Arcy", familyName: 'darcy' },
    { name: 'Shaina Alexandria', familyName: 'alexandria' }
  ];

  var CROSSREF_FIELDS = 'DOI,title,author,container-title,issued,published-print,published-online,URL';
  var CACHE_KEY = 'vectora-selected-work-v1';
  var CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
  var FETCH_TIMEOUT_MS = 6000;
  var MAX_PUBLICATIONS = 5;

  var strip = document.getElementById('works-strip');
  if (!strip) return;

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

  function normalizeName(str) {
    return String(str || '').toLowerCase().replace(/[^a-z]/g, '');
  }

  function matchesPrincipal(w, principal) {
    if (!Array.isArray(w.author)) return false;
    return w.author.some(function (a) {
      return a.family && normalizeName(a.family).indexOf(principal.familyName) !== -1;
    });
  }

  function fetchPublicationsFor(principal) {
    // Crossref's default relevance sort puts the best author-name matches
    // first; sorting by date instead can push a principal's real papers out
    // of the row limit entirely.
    var url = 'https://api.crossref.org/works?query.author=' +
      encodeURIComponent(principal.name) +
      '&rows=20&select=' + CROSSREF_FIELDS;
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, FETCH_TIMEOUT_MS);
    return fetch(url, { signal: controller.signal })
      .then(function (res) {
        if (!res.ok) throw new Error('Crossref request failed: ' + res.status);
        return res.json();
      })
      .then(function (data) {
        return ((data.message && data.message.items) || [])
          .filter(function (w) { return w.title && w.title[0] && matchesPrincipal(w, principal); })
          .map(function (w) {
            return {
              id: 'doi-' + w.DOI,
              title: stripTags(w.title[0]),
              type: 'Publication',
              venue: (w['container-title'] && w['container-title'][0]) || 'Preprint',
              year: yearFromWork(w),
              external_url: w.URL || ('https://doi.org/' + w.DOI)
            };
          });
      })
      .finally(function () { clearTimeout(timer); });
  }

  function readCache() {
    try {
      var parsed = JSON.parse(window.sessionStorage.getItem(CACHE_KEY));
      if (!parsed || Date.now() - parsed.ts > CACHE_TTL_MS) return null;
      return parsed.items;
    } catch (e) { return null; }
  }

  function writeCache(items) {
    try {
      window.sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), items: items }));
    } catch (e) { /* storage unavailable or full — non-fatal */ }
  }

  function loadPublications() {
    var cached = readCache();
    if (cached) return Promise.resolve(cached);
    return Promise.all(PRINCIPALS.map(function (p) {
      return fetchPublicationsFor(p).catch(function () { return null; });
    })).then(function (results) {
      if (results.every(function (r) { return r === null; })) throw new Error('All Crossref requests failed');
      var seen = Object.create(null);
      var merged = [].concat.apply([], results.filter(Boolean)).filter(function (w) {
        if (seen[w.id]) return false;
        seen[w.id] = true;
        return true;
      });
      merged.sort(function (a, b) { return (b.year || 0) - (a.year || 0); });
      merged = merged.slice(0, MAX_PUBLICATIONS);
      writeCache(merged);
      return merged;
    });
  }

  function loadPatents() {
    return fetch('assets/data/patents.json').then(function (res) {
      if (!res.ok) throw new Error('patents.json request failed');
      return res.json();
    }).catch(function () { return []; });
  }

  function card(w) {
    return '<a class="work-card' + (w.type === 'Patent' ? ' work-card--patent' : '') + '" href="' + esc(w.external_url) + '" target="_blank" rel="noopener noreferrer">' +
      '<span class="work-card__top"><span class="work-type">' + esc(w.type) + '</span>' + externalIcon() + '</span>' +
      '<h4>' + esc(w.title) + '</h4>' +
      '<span class="work-card__venue">' + esc(w.venue) + (w.year ? ' · ' + esc(String(w.year)) : '') + '</span>' +
    '</a>';
  }

  strip.innerHTML = new Array(4).join('<div class="work-card work-card--skeleton" aria-hidden="true"></div>');

  Promise.all([
    loadPatents(),
    loadPublications().catch(function () { return null; })
  ]).then(function (results) {
    var patents = results[0] || [];
    var pubs = results[1];
    var html = patents.concat(pubs || []).map(card).join('');
    if (pubs === null) {
      html += '<p class="works-strip__fallback">Live publication lookup is unavailable right now. Browse on ' +
        '<a href="https://search.crossref.org/?q=' + encodeURIComponent(PRINCIPALS.map(function (p) { return p.name; }).join(' ')) +
        '" target="_blank" rel="noopener noreferrer">Crossref</a>.</p>';
    }
    strip.innerHTML = html;
  });
})();
