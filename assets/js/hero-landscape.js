/* Hero background: an optimizer planning and running a sprint across a loss
 * landscape.
 *
 * The terrain is a topographic loss surface. Each loop mirrors the sprint card
 * in the hero (and is synced to its 16s CSS animation):
 *   Plan     – the optimizer probes a few candidate routes, commits to one,
 *              and lays down twelve iteration milestones along it; the team
 *              (five small orbiters) assembles around it.
 *   Execute  – twelve iterations, each a move to the next milestone followed
 *              by a short review pause; reached milestones fill in and get a pin.
 *   Ship     – the optimizer settles in the global minimum and a ripple runs
 *              out across the contours.
 * Every color is read from the Material 3 color roles in tokens.css, so the
 * scene follows the light/dark theme. Rendering pauses off screen; under
 * reduced motion a single finished frame is drawn.
 */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';

const hero = document.querySelector('.hero');
const canvas = hero && hero.querySelector('.hero__bg');
const card = hero && hero.querySelector('.sprint-card');

if (canvas) init();

function init() {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch (e) {
    return; // No WebGL: the hero simply keeps its plain surface.
  }
  // Colors come straight from CSS as sRGB; blend them in that space too.
  THREE.ColorManagement.enabled = false;
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 120);

  /* ---- Loss landscape --------------------------------------------------- */
  function bump(x, z, cx, cz, s) {
    const dx = x - cx, dz = z - cz;
    return Math.exp(-(dx * dx + dz * dz) / (2 * s * s));
  }
  function loss(x, z) {
    return 0.018 * (x * x + z * z) - 0.05 * x - 0.02 * z
      - 2.8 * bump(x, z, 4.2, 2.2, 2.6)   // global minimum
      - 1.3 * bump(x, z, -1.5, -5.5, 1.8) // local minimum: the tempting wrong answer
      + 2.0 * bump(x, z, -0.6, 3.8, 2.3)
      + 1.7 * bump(x, z, 3.2, -4.6, 2.4)
      + 1.2 * bump(x, z, -6.5, 5, 2.6)
      + 0.28 * Math.sin(0.55 * x + 0.4) * Math.cos(0.5 * z - 0.3);
  }
  function grad(x, z) {
    const e = 1e-3;
    return [(loss(x + e, z) - loss(x - e, z)) / (2 * e), (loss(x, z + e) - loss(x, z - e)) / (2 * e)];
  }
  // Drawn with some vertical exaggeration so the relief reads at a glance.
  const RELIEF = 1.5;
  const elevation = (x, z) => loss(x, z) * RELIEF;
  function normalAt(x, z) {
    const [gx, gz] = grad(x, z);
    return new THREE.Vector3(-gx * RELIEF, 1, -gz * RELIEF).normalize();
  }

  // Gradient descent with momentum, optionally kicked off in a direction.
  function descend(x, z, kick) {
    const pts = [[x, z]];
    let vx = kick ? kick[0] : 0, vz = kick ? kick[1] : 0;
    for (let i = 0; i < 600; i++) {
      const [gx, gz] = grad(x, z);
      vx = 0.9 * vx - 0.05 * gx;
      vz = 0.9 * vz - 0.05 * gz;
      x += vx; z += vz;
      pts.push([x, z]);
      if (i > 20 && Math.hypot(vx, vz) < 2e-4) break;
    }
    return pts;
  }

  // Even arc-length spacing; drops the tiny momentum spiral at the very end.
  function resample(pts, spacing, maxLength) {
    const end = pts[pts.length - 1];
    let cut = pts.findIndex((p) => Math.hypot(p[0] - end[0], p[1] - end[1]) < 0.12);
    const src = pts.slice(0, Math.max(cut, 1)).concat([end]);
    const out = [src[0]];
    let carry = 0, total = 0;
    for (let i = 1; i < src.length; i++) {
      const [ax, az] = src[i - 1], [bx, bz] = src[i];
      const seg = Math.hypot(bx - ax, bz - az);
      let d = spacing - carry;
      while (d <= seg) {
        const u = d / seg;
        out.push([ax + (bx - ax) * u, az + (bz - az) * u]);
        total += spacing;
        if (maxLength && total >= maxLength) return out;
        d += spacing;
      }
      carry = seg - (d - spacing);
    }
    if (!maxLength) out.push(end);
    return out;
  }

  const LIFT = 0.07;
  const toSurface = (p, lift = LIFT) => new THREE.Vector3(p[0], elevation(p[0], p[1]) + lift, p[1]);

  /* ---- Terrain mesh --------------------------------------------------- */
  const SIZE = 30, SEG = 200;
  const terrainGeo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  terrainGeo.rotateX(-Math.PI / 2);
  const pos = terrainGeo.attributes.position;
  let hMin = Infinity, hMax = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    const h = elevation(pos.getX(i), pos.getZ(i));
    pos.setY(i, h);
    if (Math.hypot(pos.getX(i), pos.getZ(i)) < 11) { hMin = Math.min(hMin, h); hMax = Math.max(hMax, h); }
  }
  terrainGeo.computeBoundingSphere();

  const terrainUniforms = {
    uFillLow: { value: new THREE.Color() },
    uFillHigh: { value: new THREE.Color() },
    uGrid: { value: new THREE.Color() },
    uContour: { value: new THREE.Color() },
    uAccent: { value: new THREE.Color() },
    uFillOpacity: { value: 0.5 },
    uGridOpacity: { value: 0.5 },
    uContourOpacity: { value: 0.6 },
    uShadeOpacity: { value: 0.3 },
    uHeight: { value: new THREE.Vector2(hMin, hMax) },
    uOpt: { value: new THREE.Vector3() },
    uOptGlow: { value: 0 },
    uGoal: { value: new THREE.Vector3() },
    uShip: { value: 0 },
    uFar: { value: new THREE.Vector2(30, 46) },
  };

  const TERRAIN_VERT = /* glsl */ `
    varying vec3 vPos;
    varying float vDist;
    void main() {
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vPos = wp.xyz;
      vec4 mv = viewMatrix * wp;
      vDist = -mv.z;
      gl_Position = projectionMatrix * mv;
    }`;
  // Soft circular edge, plus a fade into the distance.
  const TERRAIN_FADE = /* glsl */ `
    uniform vec2 uFar;
    varying vec3 vPos;
    varying float vDist;
    float terrainFade() {
      float edge = 1.0 - smoothstep(9.0, 14.0, length(vPos.xz));
      float far = 1.0 - smoothstep(uFar.x, uFar.y, vDist);
      return edge * far;
    }`;

  const terrainMat = new THREE.ShaderMaterial({
    uniforms: terrainUniforms,
    transparent: true,
    depthWrite: false,
    depthFunc: THREE.LessEqualDepth,
    vertexShader: TERRAIN_VERT,
    fragmentShader: /* glsl */ `
      ${TERRAIN_FADE}
      uniform vec3 uFillLow, uFillHigh, uGrid, uContour, uAccent;
      uniform float uFillOpacity, uGridOpacity, uContourOpacity, uShadeOpacity;
      uniform vec2 uHeight;
      uniform vec3 uOpt, uGoal;
      uniform float uOptGlow, uShip;

      // Anti-aliased 1px line at integer values of v; fades out where the
      // lines would crowd together.
      float lineOf(float v) {
        float w = fwidth(v);
        float g = abs(fract(v - 0.5) - 0.5) / w;
        return (1.0 - min(g, 1.0)) * (1.0 - smoothstep(0.25, 0.6, w));
      }

      void main() {
        float h = clamp((vPos.y - uHeight.x) / (uHeight.y - uHeight.x), 0.0, 1.0);
        float basin = 1.0 - smoothstep(0.0, 0.6, h);

        vec3 col = mix(uFillHigh, uFillLow, basin);
        float a = uFillOpacity * (0.25 + 0.75 * basin);

        // Slope shading from a low key light, tinted toward the contour color.
        vec3 n = normalize(cross(dFdx(vPos), dFdy(vPos)));
        n *= sign(n.y);
        float shade = 1.0 - clamp(dot(n, normalize(vec3(0.55, 0.7, -0.45))), 0.0, 1.0);
        shade = smoothstep(0.05, 0.75, shade);
        col = mix(col, uContour, shade * 0.35);
        a = max(a, shade * uShadeOpacity);

        // Graph-paper grid on the ground plane, faint.
        float grid = max(lineOf(vPos.x), lineOf(vPos.z)) * uGridOpacity;
        col = mix(col, uGrid, grid);
        a = max(a, grid);

        // Contour lines, with every fifth one heavier.
        float iso = lineOf(vPos.y * 2.0) * 0.5;
        float isoMajor = lineOf(vPos.y * 0.5);
        float contour = max(iso, isoMajor) * uContourOpacity;
        col = mix(col, uContour, contour);
        a = max(a, contour);

        // Where the optimizer is, the ground lights up.
        float d = distance(vPos.xz, uOpt.xz);
        float glow = exp(-d * d * 0.5) * uOptGlow;
        col = mix(col, uAccent, glow * 0.35);
        a = max(a, glow * 0.3);

        // Ship ripple out from the minimum.
        float dg = distance(vPos.xz, uGoal.xz);
        float ring = exp(-pow((dg - uShip * 8.0) * 3.0, 2.0)) * (1.0 - uShip) * step(0.001, uShip);
        col = mix(col, uAccent, ring);
        a = max(a, ring * 0.7);

        gl_FragColor = vec4(col, a * terrainFade());
      }`,
  });

  // Depth pre-pass so the translucent terrain doesn't show its own far side.
  // Faded-out edges are left out so they can't hide anything behind them.
  const terrainDepth = new THREE.Mesh(terrainGeo, new THREE.ShaderMaterial({
    uniforms: { uFar: terrainUniforms.uFar },
    colorWrite: false,
    // Sit a hair behind the color pass so the two never z-fight.
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
    vertexShader: TERRAIN_VERT,
    fragmentShader: /* glsl */ `
      ${TERRAIN_FADE}
      void main() {
        if (terrainFade() < 0.6) discard;
        gl_FragColor = vec4(0.0);
      }`,
  }));
  terrainDepth.renderOrder = -2;
  const terrain = new THREE.Mesh(terrainGeo, terrainMat);
  terrain.renderOrder = -1;
  scene.add(terrainDepth, terrain);

  /* ---- Sprint scenarios ------------------------------------------------- */
  // Three starts that roll into the global minimum (start a little further
  // round and the descent settles in the local one instead).
  const STARTS = [140, 115, 128].map((deg) => [9.5 * Math.cos(deg * Math.PI / 180), 9.5 * Math.sin(deg * Math.PI / 180)]);
  const ITERATIONS = 12;
  const TRAIL_SEGMENTS = 360, TRAIL_RADIAL = 8;

  function buildScenario(start) {
    const route = resample(descend(start[0], start[1]), 0.22);
    const curve = new THREE.CatmullRomCurve3(route.map((p) => toSurface(p)), false, 'centripetal');

    // Big early steps, smaller later ones — the way an optimizer (and a
    // sprint) actually converges.
    const marks = [0];
    for (let k = 1; k <= ITERATIONS; k++) marks.push(1 - Math.pow(1 - k / ITERATIONS, 1.5));

    // Candidate routes considered during planning: the same start, kicked off
    // in other directions. Several of them roll into the local minimum.
    const [gx, gz] = grad(start[0], start[1]);
    const heading = Math.atan2(-gz, -gx);
    const probes = [-1.5, -0.75, 0.75, 1.5].map((off) => {
      const a = heading + off;
      const path = resample(descend(start[0], start[1], [0.22 * Math.cos(a), 0.22 * Math.sin(a)]), 0.12, 7);
      return path.map((p) => toSurface(p, LIFT + 0.02));
    });

    return { start, curve, marks, probes, goal: curve.getPointAt(1) };
  }
  const scenarios = STARTS.map(buildScenario);

  /* ---- Scene objects ---------------------------------------------------- */
  const sprite = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.35, 'rgba(255,255,255,0.35)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();

  const mat = {
    trail: new THREE.MeshBasicMaterial({ transparent: true }),
    route: new THREE.LineDashedMaterial({ transparent: true, dashSize: 0.22, gapSize: 0.16 }),
    probe: new THREE.LineDashedMaterial({ transparent: true, dashSize: 0.12, gapSize: 0.12 }),
    ring: new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide }),
    pin: new THREE.LineBasicMaterial({ transparent: true }),
    optimizer: new THREE.MeshBasicMaterial({ transparent: true }),
    halo: new THREE.SpriteMaterial({ map: sprite, transparent: true, depthWrite: false }),
    team: new THREE.MeshBasicMaterial({ transparent: true }),
  };

  const sceneGroup = new THREE.Group();
  scene.add(sceneGroup);

  const trail = new THREE.Mesh(undefined, mat.trail);
  const route = new THREE.Line(undefined, mat.route);
  const probeLines = [0, 1, 2, 3].map(() => new THREE.Line(undefined, mat.probe));
  sceneGroup.add(trail, route, ...probeLines);

  // Milestones: an outlined ring that fills in when its iteration lands,
  // plus a pin planted on top.
  const ringGeo = new THREE.RingGeometry(0.15, 0.21, 40).rotateX(-Math.PI / 2);
  const discGeo = new THREE.CircleGeometry(0.15, 40).rotateX(-Math.PI / 2);
  const pinGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.6, 0)]);
  const headGeo = new THREE.SphereGeometry(0.055, 16, 12);
  const milestones = [];
  for (let k = 0; k < ITERATIONS; k++) {
    const g = new THREE.Group();
    const ringMat = mat.ring.clone();
    const discMat = mat.ring.clone();
    const pinMat = mat.pin.clone();
    const headMat = mat.optimizer.clone();
    const ring = new THREE.Mesh(ringGeo, ringMat);
    const disc = new THREE.Mesh(discGeo, discMat);
    const pin = new THREE.Group();
    pin.add(new THREE.Line(pinGeo, pinMat));
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 0.6;
    pin.add(head);
    g.add(ring, disc, pin);
    sceneGroup.add(g);
    milestones.push({ group: g, ring, disc, pin, mats: { ringMat, discMat, pinMat, headMat } });
  }

  const optimizer = new THREE.Mesh(new THREE.SphereGeometry(0.17, 32, 20), mat.optimizer);
  const halo = new THREE.Sprite(mat.halo);
  halo.scale.setScalar(1.3);
  sceneGroup.add(optimizer, halo);

  // The team: five orbiters, like the five avatars on the sprint card.
  const teamGeo = new THREE.SphereGeometry(0.075, 16, 12);
  const team = [0, 1, 2, 3, 4].map((i) => {
    const m = new THREE.Mesh(teamGeo, mat.team.clone());
    sceneGroup.add(m);
    const a = (i / 5) * Math.PI * 2 + 0.6;
    return { mesh: m, from: new THREE.Vector3(Math.cos(a) * 3.2, 2.2 + (i % 2) * 0.8, Math.sin(a) * 3.2) };
  });

  let active = null;
  function useScenario(index) {
    const s = scenarios[index % scenarios.length];
    if (active === s) return;
    active = s;

    trail.geometry.dispose();
    trail.geometry = new THREE.TubeGeometry(s.curve, TRAIL_SEGMENTS, 0.045, TRAIL_RADIAL, false);

    route.geometry.dispose();
    route.geometry = new THREE.BufferGeometry().setFromPoints(s.curve.getSpacedPoints(400));
    route.computeLineDistances();

    probeLines.forEach((line, i) => {
      line.geometry.dispose();
      line.geometry = new THREE.BufferGeometry().setFromPoints(s.probes[i]);
      line.computeLineDistances();
    });

    const up = new THREE.Vector3(0, 1, 0);
    milestones.forEach((m, k) => {
      const p = s.curve.getPointAt(s.marks[k + 1]);
      const n = normalAt(p.x, p.z);
      m.group.position.set(p.x, elevation(p.x, p.z), p.z).addScaledVector(n, 0.035);
      m.ring.quaternion.setFromUnitVectors(up, n);
      m.disc.quaternion.copy(m.ring.quaternion);
    });

    terrainUniforms.uGoal.value.copy(s.goal);
  }

  /* ---- Material 3 colors from tokens.css ------------------------------ */
  const swatch = document.createElement('span');
  swatch.hidden = true;
  hero.appendChild(swatch);
  const px = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  px.canvas.width = px.canvas.height = 1;

  function role(name) {
    swatch.style.color = `var(--md-sys-color-${name})`;
    const css = getComputedStyle(swatch).color; // may be oklch(); the canvas converts it
    px.clearRect(0, 0, 1, 1);
    px.fillStyle = '#000';
    px.fillStyle = css;
    px.fillRect(0, 0, 1, 1);
    const [r, g, b] = px.getImageData(0, 0, 1, 1).data;
    return new THREE.Color(r / 255, g / 255, b / 255);
  }

  function applyColors() {
    const surface = role('surface');
    const dark = surface.r + surface.g + surface.b < 1.5;
    const primary = role('primary');
    const container = role('primary-container');
    const outline = role('outline');
    const outlineVariant = role('outline-variant');
    const highest = role('surface-container-highest');
    const secondary = role('secondary-container');

    terrainUniforms.uFillLow.value.copy(container);
    terrainUniforms.uFillHigh.value.copy(highest);
    terrainUniforms.uGrid.value.copy(dark ? outlineVariant : outline);
    terrainUniforms.uContour.value.copy(primary);
    terrainUniforms.uAccent.value.copy(primary);
    terrainUniforms.uFillOpacity.value = dark ? 0.55 : 0.6;
    terrainUniforms.uGridOpacity.value = dark ? 0.5 : 0.3;
    terrainUniforms.uContourOpacity.value = dark ? 0.55 : 0.5;
    terrainUniforms.uShadeOpacity.value = dark ? 0.35 : 0.22;

    mat.trail.color.copy(primary);
    mat.route.color.copy(outline);
    mat.probe.color.copy(primary);
    mat.optimizer.color.copy(primary);
    mat.halo.color.copy(primary);
    milestones.forEach(({ mats }) => {
      mats.ringMat.color.copy(outline);
      mats.discMat.color.copy(primary);
      mats.pinMat.color.copy(primary);
      mats.headMat.color.copy(primary);
    });
    team.forEach(({ mesh }) => mesh.material.color.copy(dark ? role('on-primary-container') : secondary.clone().lerp(primary, 0.55)));
  }

  /* ---- Timeline (matches the sprint card's hero-loop keyframes) -------- */
  const LOOP_MS = 16000;
  const PLAN_END = 0.31, EXEC_END = 0.84;
  const ITER = (EXEC_END - PLAN_END) / ITERATIONS;

  const clamp01 = (v) => Math.min(Math.max(v, 0), 1);
  const span = (t, a, b) => clamp01((t - a) / (b - a));
  const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const easeOut = (x) => 1 - Math.pow(1 - x, 3);
  const backOut = (x) => (x <= 0 ? 0 : 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2));

  const tmp = new THREE.Vector3();

  function update(t, ms) {
    const s = active;
    const fade = span(t, 0, 0.03) * (1 - span(t, 0.955, 0.995));

    // Progress along the route.
    let progress = 0;
    if (t >= EXEC_END) progress = 1;
    else if (t > PLAN_END) {
      const k = Math.min(Math.floor((t - PLAN_END) / ITER), ITERATIONS - 1);
      const q = (t - PLAN_END - k * ITER) / ITER;
      progress = s.marks[k] + (s.marks[k + 1] - s.marks[k]) * easeInOut(clamp01(q / 0.72));
    }
    const at = s.curve.getPointAt(progress);

    // Plan: probes fan out, then the chosen route is drawn dashed.
    const probeDraw = easeOut(span(t, 0.03, 0.12));
    probeLines.forEach((line) => {
      line.geometry.setDrawRange(0, Math.floor(line.geometry.attributes.position.count * probeDraw));
    });
    mat.probe.opacity = 0.85 * (1 - span(t, 0.15, 0.22)) * fade;
    probeLines.forEach((l) => { l.visible = mat.probe.opacity > 0.01; });

    const routeCount = route.geometry.attributes.position.count;
    route.geometry.setDrawRange(0, Math.floor(routeCount * easeInOut(span(t, 0.1, 0.2))));
    mat.route.opacity = 0.75 * fade;

    // Execute: the solid trail follows the optimizer.
    trail.geometry.setDrawRange(0, Math.floor(progress * TRAIL_SEGMENTS) * TRAIL_RADIAL * 6);
    mat.trail.opacity = 0.9 * fade;

    milestones.forEach((m, k) => {
      const appear = backOut(span(t, 0.17 + k * 0.011, 0.215 + k * 0.011));
      const done = backOut(span(t, PLAN_END + (k + 0.72) * ITER, PLAN_END + (k + 1) * ITER));
      m.group.visible = appear > 0.001;
      m.group.scale.setScalar(Math.max(appear, 0.001));
      m.mats.ringMat.opacity = 0.9 * fade;
      m.mats.discMat.opacity = 0.95 * fade * clamp01(done);
      m.disc.scale.setScalar(Math.max(done, 0.001));
      m.pin.visible = done > 0.001;
      m.pin.scale.set(1, Math.max(done, 0.001), 1);
      m.mats.pinMat.opacity = 0.7 * fade;
      m.mats.headMat.opacity = fade;
    });

    // The optimizer, with a soft pulse while it reviews each iteration.
    const ship = span(t, EXEC_END + 0.005, 0.97);
    optimizer.position.copy(at).y += 0.12;
    mat.optimizer.opacity = fade;
    halo.position.copy(optimizer.position);
    const breathe = 1 + 0.08 * Math.sin(ms * 0.004);
    halo.scale.setScalar((1.25 + 0.9 * Math.sin(Math.PI * ship)) * breathe);
    mat.halo.opacity = 0.45 * fade;

    // The team assembles while the sprint is staffed, then travels along.
    team.forEach(({ mesh, from }, i) => {
      const arrive = easeOut(span(t, 0.15 + i * 0.018, 0.25 + i * 0.018));
      const a = (i / 5) * Math.PI * 2 + ms * 0.0011;
      tmp.set(Math.cos(a) * 0.42, 0.1 + 0.05 * Math.sin(ms * 0.003 + i), Math.sin(a) * 0.42).add(optimizer.position);
      mesh.position.copy(from).add(s.curve.getPointAt(0)).lerp(tmp, arrive);
      mesh.material.opacity = fade * span(t, 0.14 + i * 0.018, 0.17 + i * 0.018);
      mesh.visible = mesh.material.opacity > 0.01;
    });

    terrainUniforms.uOpt.value.copy(at);
    terrainUniforms.uOptGlow.value = fade * (0.55 + 0.45 * span(t, 0.0, 0.05));
    terrainUniforms.uShip.value = ship;
  }

  /* ---- Camera ------------------------------------------------------------ */
  // The camera orbits the global minimum and pins it to a screen anchor:
  // below and left of the sprint card on wide screens, centered under the
  // copy on narrow ones. The landscape swings gently around that point.
  const VIEW = { distance: 25, polar: 0.9, azimuth: 2.0, wide: [0.72, 0.84], narrow: [0.5, 0.72] };
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  let width = 1, height = 1;

  function placeCamera(ms) {
    const aspect = width / height;
    const goal = scenarios[0].goal;
    const [ax, ay] = aspect >= 1.2 ? VIEW.wide : VIEW.narrow;
    const distance = VIEW.distance * Math.min(Math.max(1.35 / aspect, 1), 1.6);
    const azimuth = VIEW.azimuth + 0.12 * Math.sin(ms / 23000) + pointer.x * 0.06;
    const polar = VIEW.polar + pointer.y * 0.03;
    camera.position.set(
      goal.x + distance * Math.sin(polar) * Math.sin(azimuth),
      goal.y + distance * Math.cos(polar),
      goal.z + distance * Math.sin(polar) * Math.cos(azimuth),
    );
    camera.lookAt(goal);
    terrainUniforms.uFar.value.set(distance + 6, distance + 22);
    camera.setViewOffset(width, height, -(ax - 0.5) * width, -(ay - 0.5) * height, width, height);
  }

  function resize() {
    width = Math.max(hero.clientWidth, 1);
    height = Math.max(hero.clientHeight, 1);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  /* ---- Clock --------------------------------------------------------------- */
  // Follow the sprint card's own CSS animation so the two tell one story.
  const epoch = performance.now();
  function loopClock(now) {
    const anim = card && card.getAnimations && card.getAnimations().find((a) => a.animationName === 'hero-loop');
    const ms = anim && anim.playState === 'running' && anim.currentTime != null ? Number(anim.currentTime) : now - epoch;
    return { index: Math.floor(ms / LOOP_MS), t: (ms % LOOP_MS) / LOOP_MS, ms };
  }

  function frame(now) {
    const { index, t, ms } = loopClock(now);
    useScenario(index);
    pointer.x += (pointer.tx - pointer.x) * 0.04;
    pointer.y += (pointer.ty - pointer.y) * 0.04;
    placeCamera(ms);
    update(t, ms);
    renderer.render(scene, camera);
  }

  function renderStill() {
    useScenario(0);
    placeCamera(0);
    update(0.845, 0); // finished sprint, before the ship ripple
    renderer.render(scene, camera);
  }

  /* ---- Lifecycle ----------------------------------------------------------- */
  let visible = true, raf = 0;
  function loop(now) {
    frame(now);
    raf = requestAnimationFrame(loop);
  }
  function sync() {
    const animate = visible && !document.hidden && !reduceMotion.matches;
    if (animate && !raf) raf = requestAnimationFrame(loop);
    if (!animate && raf) { cancelAnimationFrame(raf); raf = 0; }
    if (reduceMotion.matches) renderStill();
  }

  new ResizeObserver(() => { resize(); if (!raf) renderStill(); }).observe(hero);
  new IntersectionObserver((entries) => { visible = entries[0].isIntersecting; sync(); }).observe(hero);
  document.addEventListener('visibilitychange', sync);
  reduceMotion.addEventListener('change', sync);

  const recolor = () => { applyColors(); if (!raf) renderStill(); };
  new MutationObserver(recolor).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', recolor);

  if (window.matchMedia('(pointer: fine)').matches) {
    window.addEventListener('pointermove', (e) => {
      pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });
  }

  applyColors();
  resize();
  useScenario(0);
  sync();
  if (!raf) renderStill();
  canvas.classList.add('is-ready');
}
