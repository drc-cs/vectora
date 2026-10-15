/* Network constellation: a decorative, gently drifting graph of the vectora
 * network — a hub, six practice areas, and the people around them. Every
 * ~1.4s a "match" pulse travels from a member through their practice to the
 * hub. Animation runs only while on screen and not under reduced motion.
 */
(function () {
  'use strict';

  var svg = document.getElementById('constellation');
  if (!svg) return;

  var NS = 'http://www.w3.org/2000/svg';
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var CX = 240, CY = 220;
  var ROLES = ['Backend', 'Platform', 'Data & ML', 'Security', 'Mobile', 'Leaders'];
  var LETTERS = 'ABCDEFGHJKLMNPRSTVWY';

  // Small seeded PRNG so the layout is identical on every load.
  var seed = 7;
  function rand() {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  }

  function el(name, attrs, parent) {
    var node = document.createElementNS(NS, name);
    Object.keys(attrs).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    if (parent) parent.appendChild(node);
    return node;
  }

  var linkLayer = el('g', {}, svg);
  var pulseLayer = el('g', {}, svg);
  var nodeLayer = el('g', {}, svg);

  var nodes = [];
  var links = [];

  function addNode(x, y, r, label, kind) {
    var g = el('g', { class: 'node node--' + kind }, nodeLayer);
    var c = el('circle', { r: r }, g);
    var t = el('text', {}, g);
    t.textContent = label;
    var node = {
      bx: x, by: y, x: x, y: y, r: r, g: g, circle: c,
      amp: kind === 'hub' ? 0 : (kind === 'role' ? 4 : 6),
      phase: rand() * Math.PI * 2,
      speed: 0.0004 + rand() * 0.0005
    };
    nodes.push(node);
    return node;
  }
  function addLink(a, b) {
    var line = el('line', { class: 'link' }, linkLayer);
    var link = { a: a, b: b, line: line };
    links.push(link);
    return link;
  }

  var hub = addNode(CX, CY, 40, 'vectora', 'hub');
  var roles = ROLES.map(function (label, i) {
    var ang = (i / ROLES.length) * Math.PI * 2 - Math.PI / 2;
    var role = addNode(CX + Math.cos(ang) * 118, CY + Math.sin(ang) * 112, 33, label, 'role');
    role.ang = ang;
    role.link = addLink(hub, role);
    return role;
  });

  var members = [];
  roles.forEach(function (role, i) {
    for (var k = 0; k < 4; k++) {
      var ang = role.ang + (k - 1.5) * 0.26 + (rand() - 0.5) * 0.12;
      var dist = 178 + rand() * 30;
      var x = CX + Math.cos(ang) * dist;
      var y = CY + Math.sin(ang) * dist * 0.92;
      x = Math.max(20, Math.min(460, x));
      y = Math.max(20, Math.min(420, y));
      var idx = i * 4 + k;
      var label = LETTERS[(idx * 7) % LETTERS.length] + LETTERS[(idx * 13 + 5) % LETTERS.length];
      var m = addNode(x, y, 15, label, 'member');
      m.role = role;
      m.link = addLink(role, m);
      members.push(m);
    }
  });
  // A few cross-practice links so it reads as a network, not a tree.
  for (var i = 0; i < members.length; i += 3) {
    addLink(members[i], members[(i + 5) % members.length]);
  }

  function layout(now) {
    nodes.forEach(function (n) {
      if (n.amp) {
        n.x = n.bx + Math.sin(now * n.speed + n.phase) * n.amp;
        n.y = n.by + Math.cos(now * n.speed * 1.3 + n.phase) * n.amp;
      }
      n.g.setAttribute('transform', 'translate(' + n.x.toFixed(1) + ',' + n.y.toFixed(1) + ')');
    });
    links.forEach(function (l) {
      l.line.setAttribute('x1', l.a.x.toFixed(1));
      l.line.setAttribute('y1', l.a.y.toFixed(1));
      l.line.setAttribute('x2', l.b.x.toFixed(1));
      l.line.setAttribute('y2', l.b.y.toFixed(1));
    });
  }

  /* ---- Match pulses ------------------------------------------------------ */
  var pulses = [];
  var lastSpawn = 0;
  var spawnIndex = 0;
  var ORDER = [5, 17, 2, 21, 10, 14, 7, 19, 0, 12, 23, 8];

  function spawn(now) {
    var m = members[ORDER[spawnIndex++ % ORDER.length] % members.length];
    var dot = el('circle', { class: 'pulse', r: 5 }, pulseLayer);
    m.g.classList.add('is-hot');
    m.role.g.classList.add('is-hot');
    m.link.line.classList.add('is-hot');
    m.role.link.line.classList.add('is-hot');
    pulses.push({ member: m, dot: dot, t0: now });
  }

  function stepPulses(now) {
    pulses = pulses.filter(function (p) {
      var t = (now - p.t0) / 1300;
      var m = p.member, r = m.role;
      var x, y;
      if (t < 0.5) {
        var a = t / 0.5;
        x = m.x + (r.x - m.x) * a; y = m.y + (r.y - m.y) * a;
      } else {
        var b = Math.min(1, (t - 0.5) / 0.5);
        x = r.x + (hub.x - r.x) * b; y = r.y + (hub.y - r.y) * b;
      }
      p.dot.setAttribute('cx', x.toFixed(1));
      p.dot.setAttribute('cy', y.toFixed(1));
      if (t >= 1) {
        p.dot.remove();
        m.g.classList.remove('is-hot');
        r.g.classList.remove('is-hot');
        m.link.line.classList.remove('is-hot');
        r.link.line.classList.remove('is-hot');
        return false;
      }
      return true;
    });
  }

  var running = false;
  var raf = null;
  function frame(now) {
    layout(now);
    if (now - lastSpawn > 1400) { spawn(now); lastSpawn = now; }
    stepPulses(now);
    if (running) raf = requestAnimationFrame(frame);
  }

  layout(0);
  if (reduceMotion) return;

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting && !running) {
          running = true;
          raf = requestAnimationFrame(frame);
        } else if (!entry.isIntersecting && running) {
          running = false;
          cancelAnimationFrame(raf);
        }
      });
    }, { threshold: 0.1 }).observe(svg);
  }
})();
