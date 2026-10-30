// CATION homepage: the four discipline panels.
//
// Everything about the panels is drawn from one set of springs: where each gutter sits along the top
// and the bottom of the track (the bottom springs are a little softer, so panels lean as they move and
// settle into the fan of the approved design), plus one "activeness" spring per panel. Each frame turns
// those numbers into clip-path outlines with the divots and the shoulder around the headline, and
// moves the labels, arrows, divot dots and artwork to match.
//
// Geometry is worked out in stack coordinates: `a` runs along the row of panels and `c` across it.
// On desktop a is x and c is y; in the stacked phone layout they swap, so the same outline code makes
// horizontal gutters with the divots on each panel's lower edge. Lengths are reference pixels (see
// home.css) multiplied by the current scale `s`.

import { mount, play, pose, spokes } from './logo.js';

const DESKTOP = matchMedia('(min-width: 1080px) and (min-height: 600px)');
// Logo concept preview (/?logo=mark): the monogram sits in the divots and the wordmark opens on load.
const MARK = new URLSearchParams(location.search).get('logo') === 'mark';
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)');

const LAYOUT = {
  desktop: {
    gutter: 10,
    corner: 10,
    // Panel 1 steps out under the headline. [c, a] pairs, top to bottom, from the track's top-left.
    // It holds clear of the copy column (headline, line, button and facts), then steps out in one 45°
    // run below it; measure() finds where the copy ends. When the copy ends above the gallery there is
    // nothing to make room for, and the first panel is a plain column like the rest.
    shoulder: { a: 136, radius: 26, clear: 28 },
    divot: { at: 0.342, depth: 34, nose: 24, fillet: 30, ring: 12 },
    weights: {
      rest: { top: [1, 1, 1, 1], bottom: [1.05, 1.01, 0.98, 0.96] },
      active: { top: 1.8, bottom: 1.79 },
      // By distance from the active panel. The neighbour gives way at the top more than the bottom.
      near: { top: [0.9, 1.06, 1.06], bottom: [1, 0.93, 0.69] },
    },
  },
  stacked: {
    gutter: 8,
    corner: 14,
    collapsed: 96,
    divot: { at: 0.7, depth: 21, nose: 15, fillet: 19, ring: 7 },
    near: { top: [1, 1, 1], bottom: [1, 0.965, 0.93] },
  },
};

const SPRINGS = {
  top: { k: 210, c: 29 },
  bottom: { k: 150, c: 23.5 },
  act: { k: 170, c: 26 },
  parallax: { k: 80, c: 18 },
};

const NS = 'http://www.w3.org/2000/svg';
const add = (p, q) => [p[0] + q[0], p[1] + q[1]];
const sub = (p, q) => [p[0] - q[0], p[1] - q[1]];
const mul = (p, k) => [p[0] * k, p[1] * k];
const len = (p) => Math.hypot(p[0], p[1]);
const unit = (p) => mul(p, 1 / (len(p) || 1));
const cross = (p, q) => p[0] * q[1] - p[1] * q[0];
const lerp = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
const f2 = (n) => Math.round(n * 100) / 100;
const f4 = (n) => Math.round(n * 1e4) / 1e4;

const nav = document.querySelector('.disciplines');
if (nav) init(nav);
if (MARK) openWordmark();

// Concept preview: the header wordmark starts as the closed monogram and opens once the page has
// loaded. Phones keep the monogram, where the header is short of room.
function openWordmark() {
  const svg = document.querySelector('.site-header .wordmark svg');
  if (!svg) return;
  const letters = mount(svg);
  pose(letters, 0);
  const settle = () => (DESKTOP.matches ? play(letters, 1, 1600) : play(letters, 0, 600));
  setTimeout(settle, 500);
  DESKTOP.addEventListener('change', settle);
}

function init(nav) {
  const panels = [...nav.querySelectorAll('.panel')];
  const N = panels.length;
  const links = panels.map((p) => p.querySelector('.panel-link'));
  const arts = panels.map((p) => p.querySelector('.panel-art'));
  const labels = panels.map((p) => p.querySelector('.panel-label'));
  const gos = panels.map((p) => p.querySelector('.panel-go'));
  const svg = nav.querySelector('.panel-rims');

  const rims = panels.map(() => svg.appendChild(el('path', { class: 'rim' })));
  // Autoplay's timer on the panel itself (see Autoplay): two strokes per panel, one over the top and
  // one under the bottom, from its leading edge to the deepest point of its divot.
  const traces = panels.map(() => [0, 1].map(() => svg.appendChild(el('path', { class: 'trace', pathLength: 1 }))));
  // Where each outline starts, and each divot's shape, for the drop that carries the light across.
  const leads = panels.map(() => [0, 0]), bays = panels.map(() => null);
  const dropBody = svg.appendChild(el('path', { class: 'drop' }));
  const dropEdge = svg.appendChild(el('path', { class: 'drop-edge' }));
  const divots = panels.map(() => {
    const g = svg.appendChild(el('g', { class: 'divot' }));
    const marker = MARK
      ? [el('circle', { class: 'divot-ring', r: 9 }), el('path', { class: 'divot-spokes', d: spokes(9) })]
      : [el('circle', { class: 'divot-ring', r: 7 }), el('circle', { class: 'divot-core', r: 2.4 })];
    g.append(el('circle', { class: 'divot-glow', r: MARK ? 20 : 17, fill: 'url(#divot-glow)' }),
      el('circle', { class: 'divot-pulse', r: MARK ? 9 : 7 }), ...marker);
    return g;
  });

  // One reference pixel, measured rather than recomputed so it always matches the CSS.
  const probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;left:0;top:0;visibility:hidden;pointer-events:none;height:0;width:calc(100 * var(--s))';
  nav.append(probe);

  const spring = (x) => ({ x, v: 0, t: x });
  const top = panels.map(() => spring(1));
  const bottom = panels.map(() => spring(1));
  const act = panels.map(() => spring(0));
  const par = [spring(0), spring(0)];
  const all = [...top, ...bottom, ...act, ...par];

  let mode = null;
  let lowered = 0;   // how far the gallery sits below the top of the hero (--gallery-top in home.css), reference pixels
  let copyEnd = 0;   // where the copy beside the first panel ends (the counts), from the top of the hero, reference pixels
  let stepped = true;   // whether the first panel steps out round the copy (see LAYOUT.desktop.shoulder)
  const copy = document.querySelector('.hero-copy');
  let s = 1, A = 0, C = 0, expanded = 0;
  let artSize = [];
  let labelWidth = [];
  let active = null;
  let raf = 0, last = 0;

  for (const img of nav.querySelectorAll('.panel-art img')) {
    const shown = () => img.classList.add('is-loaded');
    if (img.complete && img.naturalWidth) shown();
    else img.addEventListener('load', shown, { once: true });
    img.addEventListener('error', () => img.remove(), { once: true });
  }

  // ---------- Targets ----------

  function weights(i, side) {
    if (mode === 'desktop') {
      const w = LAYOUT.desktop.weights;
      if (i == null) return w.rest[side];
      return panels.map((_, j) => (j === i ? w.active[side] : w.near[side][Math.abs(j - i) - 1]));
    }
    const k = expanded / LAYOUT.stacked.collapsed;
    return panels.map((_, j) => (j === i ? k : LAYOUT.stacked.near[side][Math.abs(j - i) - 1]));
  }

  function aim(i) {
    weights(i, 'top').forEach((w, j) => (top[j].t = w));
    weights(i, 'bottom').forEach((w, j) => (bottom[j].t = w));
    act.forEach((sp, j) => (sp.t = j === i ? 1 : 0));
  }

  function setActive(i, { snap = false } = {}) {
    if (i === active && !snap) return;
    const prev = active;
    active = i;
    aim(i);
    if (i == null) delete nav.dataset.active;
    else nav.dataset.active = String(i);
    panels.forEach((p, j) => p.classList.toggle('is-active', j === i));
    rims.forEach((r, j) => r.classList.toggle('is-active', j === i));
    divots.forEach((d, j) => d.classList.toggle('is-active', j === i));
    if (i !== prev) handOff(prev, i);
    if (snap || REDUCED.matches) {
      for (const sp of all) { sp.x = sp.t; sp.v = 0; }
      render();
    } else {
      kick();
    }
  }

  // ---------- Layout ----------

  function measure() {
    const next = DESKTOP.matches ? 'desktop' : 'stacked';
    const changed = next !== mode;
    mode = next;
    s = probe.getBoundingClientRect().width / 100 || 1;
    const hero = nav.parentElement.getBoundingClientRect();
    // From the layout, not the painted box: on load the counts are still easing up into place (site.js).
    const facts = copy.querySelector('.hero-facts') || copy;
    let factsEnd = facts.offsetHeight;
    for (let n = facts; n && n !== nav.parentElement; n = n.offsetParent) factsEnd += n.offsetTop;
    copyEnd = factsEnd / s;
    lowered = (nav.getBoundingClientRect().top - hero.top) / s;
    stepped = copyEnd + LAYOUT.desktop.shoulder.clear - lowered > LAYOUT.desktop.shoulder.radius * 2;
    const box = nav.getBoundingClientRect();
    if (mode === 'desktop') {
      A = box.width;
      C = box.height;
      nav.style.removeProperty('--stack-h');
    } else {
      const cfg = LAYOUT.stacked;
      C = box.width;
      expanded = Math.round(Math.min(Math.max(innerHeight * 0.5, 330), 440, C * 1.15));
      A = expanded + (N - 1) * (cfg.collapsed + cfg.gutter);
      nav.style.setProperty('--stack-h', `${A}px`);
    }
    sizeArt();
    labelWidth = labels.map((l) => l.offsetWidth);
    if (changed) {
      nav.classList.add('is-shaped');
      setActive(mode === 'desktop' ? null : (active ?? 0), { snap: true });
    } else {
      aim(active);
      for (const sp of all) { sp.x = sp.t; sp.v = 0; }
      render();
    }
    syncAutoplay();
  }

  // The art box for each panel is as large as that panel ever gets, so only its position animates.
  function sizeArt() {
    const states = [null, ...panels.map((_, i) => i)].filter((i) => mode === 'desktop' || i != null);
    artSize = panels.map(() => 0);
    for (const i of states) {
      const et = edges(weights(i, 'top')), eb = edges(weights(i, 'bottom'));
      panels.forEach((_, j) => {
        const hi = Math.max(et[j][1], eb[j][1]);
        // The first panel's art is centred a quarter-shoulder right of its full width (see render).
        const span = j === 0 && mode === 'desktop' ? hi + et[0][0] / 2 : hi - Math.min(et[j][0], eb[j][0]);
        artSize[j] = Math.max(artSize[j], span);
      });
    }
    arts.forEach((art, j) => {
      art.style.setProperty('--art-w', mode === 'desktop' ? `${Math.ceil(artSize[j] + 2)}px` : '');
      art.style.setProperty('--art-h', mode === 'desktop' ? '' : `${Math.ceil(artSize[j] + 2)}px`);
    });
  }

  function edges(ws) {
    const cfg = LAYOUT[mode];
    const g = cfg.gutter * (mode === 'desktop' ? s : 1);
    const a0 = mode === 'desktop' && stepped ? cfg.shoulder.a * s : 0;
    const total = ws.reduce((m, w) => m + w, 0);
    const span = A - a0 - (N - 1) * g;
    let a = a0;
    return ws.map((w) => {
      const start = a;
      a += (span * w) / total;
      const end = a;
      a += g;
      return [start, end];
    });
  }

  // ---------- Drawing ----------

  function render() {
    const desk = mode === 'desktop';
    const cfg = LAYOUT[mode];
    const u = desk ? s : 1;
    const flip = !desk;
    const xy = desk ? (p) => `${f2(p[0])} ${f2(p[1])}` : (p) => `${f2(p[1])} ${f2(p[0])}`;
    const toScreen = desk ? (p) => p : (p) => [p[1], p[0]];
    const et = edges(top.map((sp) => sp.x));
    const eb = edges(bottom.map((sp) => sp.x));
    const r = cfg.corner * u;
    const startAt = (i, c) => (i === 0 && desk ? et[0][0] : et[i][0] + ((eb[i][0] - et[i][0]) * c) / C);
    const endAt = (i, c) => et[i][1] + ((eb[i][1] - et[i][1]) * c) / C;

    for (let i = 0; i < N; i++) {
      const P1 = [et[i][1], 0], P2 = [eb[i][1], C];
      let pts = [[et[i][0], 0], P1, P2, [eb[i][0], C]];
      let radii = [r, r, r, r];
      if (i === 0 && desk && stepped) {
        const sh = cfg.shoulder;
        const from = Math.max(copyEnd + sh.clear - lowered, sh.radius * 2);
        const steps = [[sh.a, from], [0, from + sh.a]].map(([a, c]) => [a * u, c * u]).reverse();
        pts = [[et[0][0], 0], P1, P2, [0, C], ...steps];
        radii = [r, r, r, r, ...steps.map(() => sh.radius * u)];
      }
      const bay = divot(P1, P2, cfg.divot, u, flip, xy);
      const cs = corners(pts, radii, flip);
      const d = outline(cs, bay.d, xy);
      links[i].style.clipPath = `path('${d}')`;
      rims[i].setAttribute('d', d);
      const ring = toScreen(bay.ring);
      divots[i].setAttribute('transform', `translate(${f2(ring[0])} ${f2(ring[1])}) scale(${f2(u)})`);

      const k = act[i].x;
      if (desk) {
        leads[i] = i === 0 ? cs[0].b : lerp(pts[0], pts[3], cfg.divot.at);
        bays[i] = bay.geo;
        halves(cs, bay, i === 0 ? null : leads[i], xy).forEach((h, j) => traces[i][j].setAttribute('d', h));

        const lx = startAt(i, 40 * u) + 23 * u;
        const scale = 1 + 0.12 * k;
        labels[i].style.transform = `translate3d(${f2(lx)}px, ${f2(38 * u)}px, 0) scale(${f2(scale)})`;
        const gx = endAt(i, 47 * u) - 35 * u - 17.5 * u;
        gos[i].style.transform = `translate3d(${f2(gx)}px, ${f2(29.5 * u)}px, 0)`;
        // When a panel is squeezed (or a fallback font runs wide) the arrow steps aside for the label.
        gos[i].style.opacity = lx + labelWidth[i] * scale > gx - 6 * u ? '0' : '';
        // The first panel's art is centred between its full width and the part beside the headline.
        const hi = Math.max(et[i][1], eb[i][1]);
        const mid = i === 0 ? hi / 2 + et[0][0] / 4 : (Math.min(et[i][0], eb[i][0]) + hi) / 2;
        const tx = mid - artSize[i] / 2 - 1 + par[0].x * k;
        arts[i].style.transform = `translate3d(${f2(tx)}px, ${f2(par[1].x * k)}px, 0) scale(${(1 + 0.07 * (1 - k)).toFixed(4)})`;
      } else {
        const ly = startAt(i, 20) + 28;
        labels[i].style.transform = `translate3d(20px, ${f2(ly)}px, 0)`;
        const gy = startAt(i, C - 37) + 18;
        gos[i].style.transform = `translate3d(${f2(C - 18 - 38)}px, ${f2(gy)}px, 0)`;
        const mid = (Math.min(et[i][0], eb[i][0]) + Math.max(et[i][1], eb[i][1])) / 2;
        arts[i].style.transform = `translate3d(0, ${f2(mid - artSize[i] / 2 - 1)}px, 0) scale(${(1 + 0.05 * (1 - k)).toFixed(4)})`;
      }
    }
  }

  // Rounded corners for an outline through `pts` (stack coordinates, clockwise when a is x).
  function corners(pts, radii, flip) {
    const n = pts.length;
    return pts.map((p, i) => {
      const prev = pts[(i + n - 1) % n], next = pts[(i + 1) % n];
      const v1 = unit(sub(prev, p)), v2 = unit(sub(next, p));
      const angle = Math.acos(Math.max(-1, Math.min(1, v1[0] * v2[0] + v1[1] * v2[1])));
      const tan = Math.tan(angle / 2);
      let t = radii[i] / tan;
      const room = 0.5 * Math.min(len(sub(prev, p)), len(sub(next, p)));
      if (t > room) t = room;
      const turn = cross(sub(p, prev), sub(next, p)) > 0;
      return { a: add(p, mul(v1, t)), b: add(p, mul(v2, t)), r: f2(t * tan), sweep: turn !== flip ? 1 : 0 };
    });
  }

  // The closed outline through those corners, with the divot inserted on the edge from corner 1 to 2.
  function outline(cs, bay, xy) {
    let d = `M${xy(cs[0].b)}`;
    for (let k = 1; k <= cs.length; k++) {
      if (k === 2) d += bay;
      d += turn(cs[k % cs.length], xy);
    }
    return `${d}Z`;
  }

  const turn = (c, xy) => `L${xy(c.a)}A${c.r} ${c.r} 0 0 ${c.sweep} ${xy(c.b)}`;

  const unturn = (c, xy) => `L${xy(c.b)}A${c.r} ${c.r} 0 0 ${1 - c.sweep} ${xy(c.a)}`;

  // The outline as two open strokes from `lead`, a point on the panel's leading edge, to the deepest
  // point of its divot: one over the top, one under the bottom. Without a lead (the first panel,
  // whose leading edge is the shoulder) they start at the end of the first corner.
  function halves(cs, bay, lead, xy) {
    let over = `M${xy(lead || cs[0].b)}`, under = over;
    if (lead) over += turn(cs[0], xy);
    else under += `A${cs[0].r} ${cs[0].r} 0 0 ${1 - cs[0].sweep} ${xy(cs[0].a)}`;
    over += turn(cs[1], xy) + bay.over;
    for (let k = cs.length - 1; k >= 2; k--) under += unturn(cs[k], xy);
    return [over, under + bay.under];
  }

  // The divot: a round bay cut into the panel's trailing edge, joined to it by two fillets.
  function divot(P1, P2, cfg, u, flip, xy) {
    const depth = cfg.depth * u, R = cfg.nose * u, rf = cfg.fillet * u;
    const P = lerp(P1, P2, cfg.at);
    const dir = unit(sub(P2, P1));
    const inward = [-dir[1], dir[0]];
    const reach = Math.sqrt((R + rf) ** 2 - (depth - R - rf) ** 2);
    const nose = add(P, mul(inward, depth - R));
    const side = (sign) => {
      const tangent = add(P, mul(dir, sign * reach));
      const centre = add(tangent, mul(inward, rf));
      return { tangent, meet: lerp(centre, nose, rf / (R + rf)) };
    };
    const a = side(-1), b = side(1);
    const convex = flip ? 0 : 1, concave = 1 - convex;
    const d = `L${xy(a.tangent)}A${f2(rf)} ${f2(rf)} 0 0 ${convex} ${xy(a.meet)}`
      + `A${f2(R)} ${f2(R)} 0 0 ${concave} ${xy(b.meet)}`
      + `A${f2(rf)} ${f2(rf)} 0 0 ${convex} ${xy(b.tangent)}`;
    // For autoplay: each half of the bay down to its deepest point, in from the top and in from below.
    const deep = add(P, mul(inward, depth));
    const over = `L${xy(a.tangent)}A${f2(rf)} ${f2(rf)} 0 0 ${convex} ${xy(a.meet)}A${f2(R)} ${f2(R)} 0 0 ${concave} ${xy(deep)}`;
    const under = `L${xy(b.tangent)}A${f2(rf)} ${f2(rf)} 0 0 ${concave} ${xy(b.meet)}A${f2(R)} ${f2(R)} 0 0 ${convex} ${xy(deep)}`;
    return { d, over, under, ring: add(P, mul(inward, cfg.ring * u)), geo: { P, dir, out: mul(inward, -1), depth, R, rf, reach } };
  }

  // ---------- Animation ----------

  function kick() {
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
  }

  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const steps = Math.ceil(dt / (1 / 240));
    const h = dt / steps;
    let moving = false;
    const groups = [[top, SPRINGS.top], [bottom, SPRINGS.bottom], [act, SPRINGS.act], [par, SPRINGS.parallax]];
    for (const [list, { k, c }] of groups) {
      for (const sp of list) {
        for (let n = 0; n < steps; n++) {
          sp.v += (-k * (sp.x - sp.t) - c * sp.v) * h;
          sp.x += sp.v * h;
        }
        if (Math.abs(sp.x - sp.t) > 1e-4 || Math.abs(sp.v) > 1e-4) moving = true;
        else { sp.x = sp.t; sp.v = 0; }
      }
    }
    render();
    raf = moving ? requestAnimationFrame(tick) : 0;
  }

  // ---------- Input ----------

  // Touch and pen taps preview a panel first and open it on the second tap; mouse hover previews,
  // so a click always opens. Keyboard focus previews; Enter opens.
  let pointer = { type: 'mouse', at: -1e9 };
  let restTimer = 0;
  const indexOf = (node) => panels.indexOf(node?.closest?.('.panel'));
  const recentPress = () => performance.now() - pointer.at < 900;
  const hovers = () => mode === 'desktop' && pointer.type === 'mouse';
  // Call after setActive, so a trace that is cut short is read while it is still running.
  const holdRest = () => { clearTimeout(restTimer); hold(true); };
  const toRest = () => {
    clearTimeout(restTimer);
    if (mode !== 'desktop') return;
    restTimer = setTimeout(() => {
      if (!nav.contains(document.activeElement)) {
        // With autoplay on, the visitor's last choice stays open and the cycle carries on from it.
        if (autoplay) hold(false);
        else setActive(null);
      }
      par.forEach((sp) => (sp.t = 0));
      kick();
    }, 180);
  };

  nav.addEventListener('pointerdown', (e) => { pointer = { type: e.pointerType, at: performance.now() }; });
  nav.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse' || mode !== 'desktop') return;
    pointer.type = 'mouse';
    const i = indexOf(e.target);
    if (i >= 0) { setActive(i); holdRest(); }
  });
  nav.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') toRest(); });
  nav.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || mode !== 'desktop' || active == null || REDUCED.matches) return;
    const box = nav.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * 2 - 1;
    const py = ((e.clientY - box.top) / box.height) * 2 - 1;
    par[0].t = Math.max(-1, Math.min(1, px)) * -9 * s;
    par[1].t = Math.max(-1, Math.min(1, py)) * -6 * s;
    kick();
  });

  links.forEach((link, i) => {
    link.addEventListener('click', (e) => {
      const previewFirst = mode === 'stacked' ? recentPress() : recentPress() && pointer.type !== 'mouse';
      if (previewFirst && active !== i) {
        e.preventDefault();
        setActive(i);
        if (mode === 'stacked') reveal(i);
        return;
      }
      links.forEach((l, j) => (l.style.viewTransitionName = j === i ? 'plate' : ''));
    });
    link.addEventListener('focus', () => {
      rims[i].classList.toggle('is-focus', link.matches(':focus-visible'));
      if (recentPress() && (mode === 'stacked' || pointer.type !== 'mouse')) return;
      setActive(i);
      holdRest();
      if (mode === 'stacked') reveal(i);
    });
    link.addEventListener('blur', () => rims[i].classList.remove('is-focus'));
    link.addEventListener('keydown', (e) => {
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!step) return;
      e.preventDefault();
      links[(i + step + N) % N].focus();
    });
  });
  nav.addEventListener('focusout', (e) => { if (!nav.contains(e.relatedTarget)) toRest(); });

  // ---------- Autoplay ----------
  // On desktop the hero steps through the disciplines by itself, left to right, a few seconds after
  // the page lands at rest. The current panel's edge lights up as its timer: from its leading edge,
  // round its top and bottom, closing on its divot. When the time is up the light runs together in
  // the divot as a drop of liquid. The drop wets the divot's curved walls, bulges out across the
  // gutter (fuller low down, as gravity would have it) until it touches the next panel, and wicks
  // onto that panel's edge, draining away as it goes; the next panel's edge carries on from there.
  // The drop exists only for that hand-over. (The first panel's edge starts from its top-left corner,
  // so the drop from the last panel simply drains.) Hovering or focusing a panel lights its edge in
  // full and holds the cycle; leaving hands it on. It pauses while the hero is off screen and never
  // runs with reduced motion or in the stacked layout.
  const DWELL = 3.3;    // seconds each edge takes to light; with the hand-over, under 4 s per discipline
  const XFER = 0.6;     // seconds for the drop to gather, bridge the gutter and wick across
  const ease = (x, to, dt, k) => x + (to - x) * (1 - Math.exp(-dt * k));
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const smooth = (x) => x * x * (3 - 2 * x);
  const burst = (x) => 1 - (1 - x) ** 3;
  const pull = (x) => x ** 2.4;   // surface tension: slow to start, quick to close
  const mix = (a, b, t) => a + (b - a) * t;
  let autoplay = false, held = false, onScreen = true, startTimer = 0;
  let clock = 0, lastFrame = 0, elapsed = 0;
  // The current panel's run: where each half of its edge (over the top, under the bottom) starts
  // lit, set by the drop that hands it over, and the timer `tau` that carries both on to the divot.
  // Then the hand-over in progress: the panel whose divot holds the drop, the panel it wicks into,
  // and how far along it is.
  let run = null, xfer = null, handing = false;
  const lit = panels.map(() => [0, 0]), fading = panels.map(() => 0);   // edges left part-lit by a hover
  const litTo = (r, k) => r.p0[k] + (1 - r.p0[k]) * r.tau;

  function hold(on) {
    held = on;
    if (on) clearTimeout(startTimer);
    else if (run && run.tau >= 1) run.linger = 0.3;
    else if (run) elapsed = run.tau * DWELL;
    else if (autoplay && active == null) setActive(0);
    wake();
  }

  function syncAutoplay() {
    const on = mode === 'desktop' && !REDUCED.matches;
    if (on === autoplay) return;
    autoplay = on;
    nav.classList.toggle('is-cycling', on);
    clearTimeout(startTimer);
    if (on && active == null) startTimer = setTimeout(() => { if (autoplay && !held && active == null) setActive(0); }, 2600);
    if (!on) {
      run = null;
      xfer = null;
      dropBody.setAttribute('d', '');
      dropEdge.setAttribute('d', '');
      divots.forEach((d) => d.classList.remove('is-wet'));
    }
    wake();
  }

  function handOff(from, to) {
    if (!autoplay) return;
    if (!handing) {
      // A hover: the edge it leaves fades where it got to, and a hand-over under way drains back
      // into its divot.
      if (xfer && !xfer.cancel) xfer.cancel = { reach: xfer.reach ?? 0, lo: drained(xfer), t: 0 };
      else if (from != null && run && run.panel === from) { lit[from] = [litTo(run, 0), litTo(run, 1)]; fading[from] = 1; }
    }
    run = to == null ? null : { panel: to, tau: 0, p0: [0, 0], linger: 0 };
    if (to != null) fading[to] = 0;
    elapsed = 0;
    wake();
  }

  // The hand-over runs on its own clock, t from 0 to 1 over XFER: the drop gathers until 0.34,
  // swells across the gutter until 0.5 (the next panel opens as it touches, at 0.44), then empties
  // through the divot's mouth onto the next panel's edge.
  function handOn() {
    const from = run.panel, to = (from + 1) % N;
    xfer = { from, to, bridge: to === from + 1, t: 0, switched: false, cancel: null, reach: null };
  }

  const drained = (x) => (x.cancel ? mix(x.cancel.lo, 1, clamp01(x.cancel.t / 0.3)) : pull(clamp01(x.t / 0.34)));

  function wake() {
    if (!clock && autoplay && onScreen) { lastFrame = performance.now(); clock = requestAnimationFrame(frame); }
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - lastFrame) / 1000);
    lastFrame = now;
    if (!autoplay || !onScreen) { clock = 0; return; }
    if (xfer?.cancel) {
      xfer.cancel.t += dt;
      if (xfer.cancel.t >= 0.3) xfer = null;
    } else if (xfer) {
      xfer.t = Math.min(1, xfer.t + dt / XFER);
      if (!xfer.switched && xfer.t >= 0.44) {
        xfer.switched = true;
        handing = true;
        setActive(xfer.to);
        handing = false;
      }
    }
    const live = xfer && !xfer.cancel;
    if (run) {
      if (live) {
        // The drop is still handing over: it sets where this edge starts (see paint).
      } else if (run.tau < 1) {
        if (held) run.tau = Math.min(1, ease(run.tau, 1.03, dt, 3.2));
        else { elapsed += dt; run.tau = Math.min(1, Math.max(run.tau, elapsed / DWELL)); }
      } else if (!held && !xfer && (run.linger -= dt) <= 0) {
        handOn();
      }
    }
    if (live && xfer.t >= 1) xfer = null;
    fading.forEach((f, j) => { if (f > 0) fading[j] = Math.max(0, f - dt / 0.5); });
    paint();
    clock = requestAnimationFrame(frame);
  }

  function paint() {
    let wet = null, shape = { body: '', edge: '', contact: null };
    if (xfer && bays[xfer.from]) {
      const g = bays[xfer.from], t = xfer.t, dry = -g.depth - 2 * s;
      // `reach` is how far the drop's free surface stands out from the divot's mouth, and `back` how
      // far its trailing surface has come forward from the back of the divot as it empties.
      const gap = xfer.bridge ? dot(sub(leads[xfer.to], g.P), g.out) : null;
      const top = gap == null ? 3 * s : gap + 6 * s;
      let reach, back = null;
      if (xfer.cancel) reach = mix(xfer.cancel.reach, dry, pull(clamp01(xfer.cancel.t / 0.3)));
      else {
        reach = t < 0.34 ? mix(-g.depth, 3 * s, burst(t / 0.34)) : mix(3 * s, top, smooth(clamp01((t - 0.34) / 0.16)));
        if (t > 0.5) {
          const x = pull((t - 0.5) / 0.5);
          // With a panel to feed, the drop empties forwards through the mouth into its edge; with
          // none beside it, it drains back into the divot.
          if (gap == null) reach = mix(top, dry, x);
          else back = mix(dry, gap + s, x);
        }
        xfer.reach = reach;
      }
      shape = drop(g, reach, gap, back);
      if (reach > -g.depth + 6 * s && (back == null || back < -14 * s)) wet = xfer.from;

      // The new edge lights only where the drop touches it, and only runs on beyond that as the drop
      // runs dry, reaching the timer's pace just as it empties.
      if (!xfer.cancel && xfer.switched && run && run.panel === xfer.to) {
        const x = clamp01((t - 0.5) / 0.5), flowed = (0.5 * XFER * x ** 4) / 4;
        const at = dot(sub(leads[xfer.to], g.P), g.dir);
        const band = shape.contact ? [at - shape.contact[0], shape.contact[1] - at] : [0, 0];
        traces[xfer.to].forEach((path, k) => {
          const L = path.getTotalLength() || 1;
          run.p0[k] = Math.max(run.p0[k], (Math.max(0, band[k]) + (L / DWELL) * flowed) / L);
        });
      }
    }
    dropBody.setAttribute('d', shape.body);
    dropEdge.setAttribute('d', shape.edge);
    divots.forEach((d, k) => d.classList.toggle('is-wet', k === wet));

    traces.forEach((pair, j) => {
      pair.forEach((t, k) => {
        let lo = 0, hi = lit[j][k], alpha = fading[j];
        // The edge being handed on runs back into its divot as the drop gathers.
        if (xfer && xfer.from === j) { hi = 1; lo = drained(xfer); alpha = 1; }
        else if (run && run.panel === j) { hi = litTo(run, k); alpha = 1; }
        t.style.strokeDasharray = `${f4(hi - lo)} 3`;
        t.style.strokeDashoffset = f4(-lo);
        t.style.opacity = hi - lo > 0.001 ? f2(alpha) : '0';
      });
    });
  }

  // The drop in a divot, as the liquid between the divot's wall and a free surface standing `reach`
  // out from the divot's mouth. The free surface is a gentle arc, flatter and fuller below its middle;
  // where it meets the wall is where the liquid wets it. Given `gap`, the next panel's edge caps the
  // surface, so the two touch along a short line instead of overlapping. Given `back`, a trailing
  // surface of the same curve has pulled forward off the wall, leaving the back of the divot dry.
  function drop(g, reach, gap, back) {
    const k = Math.max(reach, 4 * s) / (g.reach * g.reach), mid = 0.1 * g.reach;
    const curve = (e) => (e < mid ? k : k * 0.7) * (e - mid) ** 2;
    const surface = (e) => {
      const f = reach - curve(e);
      return gap == null ? f : softMin(f, gap, 0.6 / s);
    };
    const span = g.reach * 1.3, n = 72, rows = [];
    for (let i = 0; i <= n; i++) {
      const e = -span + (2 * span * i) / n, f = surface(e);
      const w = back == null ? wall(g, e) : Math.max(wall(g, e), back + curve(e));
      if (f > w) rows.push([e, w, f]);
    }
    if (rows.length < 2) return { body: '', edge: '', contact: null };
    const touching = gap == null ? [] : rows.filter(([, , f]) => f > gap - 0.6 * s);
    const contact = touching.length ? [touching[0][0], touching[touching.length - 1][0]] : null;
    const at = (e, h) => add(g.P, add(mul(g.dir, e), mul(g.out, h)));
    const line = (pts) => pts.map((q, i) => `${i ? 'L' : 'M'}${f2(q[0])} ${f2(q[1])}`).join('');
    const free = rows.map(([e, , f]) => at(e, f));
    return { body: `${line([...free, ...rows.map(([e, w]) => at(e, w)).reverse()])}Z`, edge: line(free), contact };
  }

  // How far the divot's wall lies behind its mouth at `e` along the edge: the nose arc, the two
  // fillets either side of it, and the straight edge beyond.
  function wall(g, e) {
    const x = Math.abs(e);
    if (x >= g.reach) return 0;
    const meet = (g.reach * g.R) / (g.R + g.rf);
    if (x <= meet) return -(g.depth - g.R) - Math.sqrt(Math.max(0, g.R * g.R - x * x));
    return -g.rf + Math.sqrt(Math.max(0, g.rf * g.rf - (x - g.reach) ** 2));
  }

  const softMin = (a, b, k) => Math.min(a, b) - Math.log(1 + Math.exp(-k * Math.abs(a - b))) / k;
  const dot = (p, q) => p[0] * q[0] + p[1] * q[1];

  new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; wake(); }, { threshold: 0.25 }).observe(nav);
  REDUCED.addEventListener('change', syncAutoplay);

  // After a tap opens a panel in the stacked layout, bring all of it into view.
  function reveal(i) {
    const et = edges(weights(i, 'top'));
    const box = nav.getBoundingClientRect();
    const bottomEdge = box.top + et[i][1];
    const topEdge = box.top + et[i][0];
    const overflow = bottomEdge - (innerHeight - 16);
    const delta = overflow > 0 ? Math.min(overflow, topEdge - 80) : topEdge < 72 ? topEdge - 80 : 0;
    if (Math.abs(delta) > 4) scrollBy({ top: delta, behavior: REDUCED.matches ? 'auto' : 'smooth' });
  }

  new ResizeObserver(() => measure()).observe(nav);
  DESKTOP.addEventListener('change', measure);
  document.fonts?.ready.then(measure);
  measure();
}

function el(name, attrs) {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}
