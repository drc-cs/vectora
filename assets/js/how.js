/* How it works: a five-step, auto-advancing walkthrough of a vectora sprint.
 *
 * Each step owns a small "scene" controller with start() / reset() / finish().
 * The stepper is an ARIA tablist: clicking or arrowing to a step takes manual
 * control (autoplay stops), and the play/pause button hands control back.
 * Autoplay only runs while the section is on screen, and never under
 * prefers-reduced-motion — there, every scene renders its finished frame.
 */
(function () {
  'use strict';

  var section = document.getElementById('how');
  if (!section) return;

  var tabs = [].slice.call(section.querySelectorAll('.how-step'));
  var panels = [].slice.call(section.querySelectorAll('.scene'));
  var weekLabel = document.getElementById('how-week');
  var playBtn = document.getElementById('how-play');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var WEEKS = ['Weeks 0–2', 'Weeks 0–2', 'Week 2', 'Weeks 2–26', 'Week 26'];
  var DURATIONS = [8500, 7500, 8000, 11000, 7500];

  var current = 0;
  var autoplay = !reduceMotion;
  var inView = false;
  var advanceTimer = null;
  var sceneTimers = [];

  function later(fn, ms) {
    var id = window.setTimeout(fn, ms);
    sceneTimers.push(id);
    return id;
  }
  function clearSceneTimers() {
    sceneTimers.forEach(window.clearTimeout);
    sceneTimers = [];
  }
  function replayCss(scene) {
    scene.classList.remove('is-playing');
    void scene.offsetWidth; // restart CSS keyframes
    scene.classList.add('is-playing');
  }
  function relRect(el, container) {
    var a = el.getBoundingClientRect();
    var b = container.getBoundingClientRect();
    return { x: a.left - b.left, y: a.top - b.top, w: a.width, h: a.height };
  }

  /* ---- Scene 1: priority sort ------------------------------------------- */
  var backlog = (function () {
    var scene = section.querySelector('[data-scene="backlog"]');
    var list = scene.querySelector('.backlog');
    var items = [].slice.call(list.children);
    var hint = scene.querySelector('.scene__hint');
    var score = function (el) { return parseFloat(el.getAttribute('data-score')); };

    function setSlots(order) {
      order.forEach(function (el, slot) { el.style.setProperty('--slot', slot); });
    }
    function swapSteps() {
      // Bubble sort, recording only the swaps so the animation stays brisk.
      var order = items.slice();
      var steps = [];
      for (var i = 0; i < order.length; i++) {
        for (var j = 0; j < order.length - 1 - i; j++) {
          if (score(order[j]) < score(order[j + 1])) {
            steps.push([order[j], order[j + 1]]);
            var t = order[j]; order[j] = order[j + 1]; order[j + 1] = t;
          }
        }
      }
      return { steps: steps, sorted: order };
    }
    function markSorted(sorted) {
      list.classList.add('is-sorted');
      sorted.forEach(function (el, idx) {
        el.querySelector('.backlog__rank').setAttribute('data-rank', String(idx + 1));
      });
      if (hint) hint.textContent = 'Sorted · top item becomes the sprint goal';
    }
    function markGoal(sorted) {
      sorted[0].classList.add('is-goal');
      sorted.slice(1).forEach(function (el) { el.classList.add('is-later'); });
    }

    return {
      reset: function () {
        list.classList.remove('is-sorted');
        items.forEach(function (el) { el.classList.remove('is-compare', 'is-goal', 'is-later'); });
        setSlots(items);
        if (hint) hint.textContent = 'Sorting by value ÷ effort';
      },
      start: function () {
        var plan = swapSteps();
        var order = items.slice();
        var t = 700;
        plan.steps.forEach(function (pair) {
          later(function () {
            pair[0].classList.add('is-compare');
            pair[1].classList.add('is-compare');
            var a = order.indexOf(pair[0]);
            var b = order.indexOf(pair[1]);
            order[a] = pair[1]; order[b] = pair[0];
            setSlots(order);
          }, t);
          later(function () {
            pair[0].classList.remove('is-compare');
            pair[1].classList.remove('is-compare');
          }, t + 520);
          t += 640;
        });
        later(function () { markSorted(plan.sorted); }, t + 200);
        later(function () { markGoal(plan.sorted); }, t + 800);
      },
      finish: function () {
        var plan = swapSteps();
        setSlots(plan.sorted);
        markSorted(plan.sorted);
        markGoal(plan.sorted);
      }
    };
  })();

  /* ---- Scene 2: sprint design (pure CSS, keyed off .is-playing) ------------ */
  var design = (function () {
    var scene = section.querySelector('[data-scene="design"]');
    return {
      reset: function () { scene.classList.remove('is-playing'); },
      start: function () { replayCss(scene); },
      finish: function () { scene.classList.add('is-playing'); }
    };
  })();

  /* ---- Scene 3: staffing from the network -------------------------------- */
  var staff = (function () {
    var scene = section.querySelector('[data-scene="staff"]');
    var pool = scene.querySelector('.pool');
    var rows = [].slice.call(scene.querySelectorAll('.roster__row'));
    var hint = scene.querySelector('.scene__hint');
    var LETTERS = 'ABCDEFGHJKLMNPRSTVWY';
    var dots = [];

    for (var i = 0; i < 20; i++) {
      var dot = document.createElement('span');
      dot.className = 'pool__dot';
      dot.textContent = LETTERS[(i * 7) % LETTERS.length] + LETTERS[(i * 11 + 3) % LETTERS.length];
      pool.appendChild(dot);
      dots.push(dot);
    }
    // A fixed, scattered pick order looks random but stays deterministic.
    var PICKS = [13, 2, 17, 8, 5, 11];
    var SCANS = [[4, 9, 13], [0, 7, 2], [19, 15, 17], [3, 12, 8], [10, 1, 5], [16, 6, 11]];

    function fill(row, dot) {
      row.classList.add('is-filled');
      row.querySelector('.roster__seat').textContent = dot.textContent;
      dot.classList.add('is-picked');
    }
    function clearFlyers() {
      [].slice.call(scene.querySelectorAll('.flyer')).forEach(function (f) { f.remove(); });
    }

    return {
      reset: function () {
        clearFlyers();
        dots.forEach(function (d) { d.classList.remove('is-scan', 'is-picked'); });
        rows.forEach(function (r) {
          r.classList.remove('is-filled');
          r.querySelector('.roster__seat').textContent = '';
        });
        if (hint) hint.textContent = 'Matching';
      },
      start: function () {
        var t = 500;
        rows.forEach(function (row, idx) {
          var dot = dots[PICKS[idx]];
          SCANS[idx].forEach(function (s, k) {
            later(function () { dots[s].classList.add('is-scan'); }, t + k * 150);
            later(function () { dots[s].classList.remove('is-scan'); }, t + k * 150 + 140);
          });
          later(function () {
            var from = relRect(dot, scene);
            var seat = row.querySelector('.roster__seat');
            var to = relRect(seat, scene);
            var flyer = document.createElement('span');
            flyer.className = 'flyer';
            flyer.textContent = dot.textContent;
            flyer.style.left = from.x + 'px';
            flyer.style.top = from.y + 'px';
            scene.appendChild(flyer);
            dot.classList.add('is-picked');
            requestAnimationFrame(function () {
              requestAnimationFrame(function () {
                flyer.style.transform = 'translate(' + (to.x - from.x) + 'px,' + (to.y - from.y) + 'px)';
              });
            });
            later(function () { flyer.remove(); fill(row, dot); }, 720);
          }, t + 480);
          t += 1050;
        });
        later(function () { if (hint) hint.textContent = 'Team matched'; }, t + 300);
      },
      finish: function () {
        rows.forEach(function (row, idx) { fill(row, dots[PICKS[idx]]); });
        if (hint) hint.textContent = 'Team matched';
      }
    };
  })();

  /* ---- Scene 4: two-week iterations -------------------------------------- */
  var iterate = (function () {
    var scene = section.querySelector('[data-scene="iterate"]');
    var cols = [].slice.call(scene.querySelectorAll('.board__cards'));
    var ceremonies = [].slice.call(scene.querySelectorAll('.ceremony'));
    var countEl = scene.querySelector('.iterate__count b');
    var burn = scene.querySelector('.burndown');
    var STORIES = [
      ['Ledger event schema', '3 pts', 'YL'], ['Payout reconciliation job', '5 pts', 'TM'],
      ['Idempotent retry worker', '3 pts', 'SW'], ['Region cutover flag', '2 pts', 'SW'],
      ['Partner webhook v2', '5 pts', 'TM'], ['Shadow-traffic compare', '3 pts', 'YL'],
      ['Audit trail export', '2 pts', 'YL'], ['Load test at 3× peak', '5 pts', 'TM']
    ];

    function story(data) {
      var el = document.createElement('div');
      el.className = 'story';
      el.innerHTML = '<span class="story__title"></span><span class="story__meta"><span></span><span class="story__who"></span></span>';
      el.querySelector('.story__title').textContent = data[0];
      el.querySelector('.story__meta span').textContent = data[1];
      el.querySelector('.story__who').textContent = data[2];
      return el;
    }
    function ceremony(idx) {
      ceremonies.forEach(function (c, i) { c.classList.toggle('is-on', i === idx); });
    }
    function setBurn(v) { burn.style.setProperty('--burn', v); }
    function flipMove(el, target) {
      var all = [].slice.call(scene.querySelectorAll('.story'));
      var first = all.map(function (s) { return s.getBoundingClientRect(); });
      target.appendChild(el);
      all.forEach(function (s, i) {
        var last = s.getBoundingClientRect();
        var dx = first[i].left - last.left;
        var dy = first[i].top - last.top;
        if (!dx && !dy) return;
        s.style.transition = 'none';
        s.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
        void s.offsetWidth;
        s.style.transition = 'transform 420ms var(--md-sys-motion-easing-emphasized)';
        s.style.transform = '';
      });
    }
    function deal(n) {
      cols.forEach(function (c) { c.innerHTML = ''; });
      var offset = ((n - 1) * 4) % STORIES.length;
      var cards = [];
      for (var i = 0; i < 4; i++) {
        var el = story(STORIES[(offset + i) % STORIES.length]);
        cols[0].appendChild(el);
        cards.push(el);
      }
      countEl.textContent = String(n);
      setBurn(0);
      return cards;
    }
    function runIteration(n, t0) {
      var cards;
      later(function () { cards = deal(n); ceremony(0); }, t0);
      var t = t0 + 900;
      for (var i = 0; i < 4; i++) {
        (function (i) {
          later(function () { ceremony(1); flipMove(cards[i], cols[1]); }, t);
          later(function () { flipMove(cards[i], cols[2]); setBurn((i + 1) / 4); }, t + 520);
        })(i);
        t += 900;
      }
      later(function () { ceremony(2); }, t);
      later(function () { ceremony(3); }, t + 700);
      return t + 1400;
    }

    return {
      reset: function () {
        cols.forEach(function (c) { c.innerHTML = ''; });
        ceremony(-1);
        countEl.textContent = '1';
        setBurn(0);
      },
      start: function () {
        var t = runIteration(1, 200);
        runIteration(2, t);
      },
      finish: function () {
        var cards = deal(3);
        cols[2].appendChild(cards[0]);
        cols[2].appendChild(cards[1]);
        cols[1].appendChild(cards[2]);
        setBurn(0.6);
        ceremony(1);
      }
    };
  })();

  /* ---- Scene 5: ship & hand off ------------------------------------------ */
  var ship = (function () {
    var scene = section.querySelector('[data-scene="ship"]');
    var week = scene.querySelector('.ship__week');
    var raf = null;
    return {
      reset: function () {
        scene.classList.remove('is-playing');
        if (raf) cancelAnimationFrame(raf);
        week.textContent = '0';
      },
      start: function () {
        replayCss(scene);
        var t0 = performance.now() + 300;
        var tick = function (now) {
          var p = Math.max(0, Math.min(1, (now - t0) / 3000));
          var eased = 1 - Math.pow(1 - p, 3);
          week.textContent = String(Math.round(eased * 26));
          if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      finish: function () {
        scene.classList.add('is-playing');
        week.textContent = '26';
      }
    };
  })();

  var controllers = [backlog, design, staff, iterate, ship];
  controllers.forEach(function (c) { c.reset(); });

  /* ---- Stepper ------------------------------------------------------------ */
  function scheduleAdvance() {
    window.clearTimeout(advanceTimer);
    if (!autoplay || !inView) return;
    advanceTimer = window.setTimeout(function () {
      activate((current + 1) % tabs.length);
    }, DURATIONS[current]);
  }

  function activate(index, opts) {
    opts = opts || {};
    clearSceneTimers();
    controllers.forEach(function (c) { c.reset(); });

    current = index;
    tabs.forEach(function (tab, i) {
      var on = i === index;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
    });
    panels.forEach(function (panel, i) {
      var on = i === index;
      panel.hidden = !on;
      panel.classList.toggle('is-active', on);
    });
    if (weekLabel) weekLabel.textContent = WEEKS[index];
    section.style.setProperty('--step-dur', DURATIONS[index] + 'ms');

    // Restart the active tab's progress bar even when re-selecting it.
    var bar = tabs[index].querySelector('.how-step__progress');
    if (bar) { bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = ''; }

    if (reduceMotion || opts.still) {
      controllers[index].finish();
    } else {
      controllers[index].start();
    }
    if (opts.focus) tabs[index].focus();
    scheduleAdvance();
  }

  function setAutoplay(on) {
    autoplay = on;
    section.classList.toggle('is-autoplay', on);
    if (playBtn) {
      playBtn.setAttribute('aria-pressed', String(on));
      playBtn.setAttribute('aria-label', on ? 'Pause walkthrough' : 'Play walkthrough');
    }
  }

  tabs.forEach(function (tab, i) {
    tab.addEventListener('click', function () {
      setAutoplay(false);
      activate(i);
    });
    tab.addEventListener('keydown', function (e) {
      var next = null;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = (i + 1) % tabs.length;
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = tabs.length - 1;
      if (next === null) return;
      e.preventDefault();
      setAutoplay(false);
      activate(next, { focus: true });
      tabs[next].scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    });
  });

  if (playBtn) {
    if (reduceMotion) playBtn.hidden = true;
    playBtn.addEventListener('click', function () {
      setAutoplay(!autoplay);
      if (autoplay) activate(current);
      else window.clearTimeout(advanceTimer);
    });
  }

  setAutoplay(autoplay);

  // Start (and resume) only while the stage is visible; pause when it isn't.
  var stage = section.querySelector('.how__stage');
  var started = false;
  if ('IntersectionObserver' in window && stage) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        inView = entry.isIntersecting;
        section.classList.toggle('is-paused', !inView);
        if (inView) {
          if (!started) { started = true; activate(current); }
          else if (autoplay) activate(current);
        } else {
          window.clearTimeout(advanceTimer);
        }
      });
    }, { threshold: 0.35 }).observe(stage);
  } else {
    inView = true;
    activate(0);
  }

  // Positions inside the staffing scene depend on layout; replay on resize.
  var resizeTimer;
  window.addEventListener('resize', function () {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(function () {
      if (current === 2 && started) activate(current, { still: !autoplay });
    }, 250);
  });
})();
