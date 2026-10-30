// CATION homepage, section 03: curiosity becomes capability.
//
// A path in the theme's Soft Gold and Periwinkle links the four stages. It is drawn through the stage markers
// whenever the layout changes: on wide screens it climbs across the cards from the left edge of the page to the
// right, and in the stacked layout it runs down a rail beside them. Only the drawn stretch shows: the stroke follows
// the scroll position, each stage appears as the stroke comes to it, and its marker lights once the stroke arrives.
// The leading point is a light: as it passes beneath the headline's outlined "capability.", rays stream off the
// letters away from it and the outline nearest it burns bright, and the word keeps a stronger glow once it has passed. On wide screens, where the section fits
// the window, it holds still while the path draws, so the whole picture stays in view until it is complete.
// Reduced motion shows the finished path and the word's glow, without the moving light, and nothing holds.

const NS = 'http://www.w3.org/2000/svg';
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)');
const WIDE = matchMedia('(min-width: 1080px)');
const DRAW = 0.8; // share of the held scroll spent drawing; the rest holds the finished path before moving on
const READ = 0.62; // the stacked layout's reading line, as a share of the window height
const TRAIL = 180; // length of the brighter glow behind the leading point, in px
const RAYS = 14; // copies of the word that make its rays
const REACH = 3.5; // how far the light reaches the word, in ems of the headline

const section = document.querySelector('.route');
if (section) init(section);

function init(section) {
  const svg = section.querySelector('.route-path');
  const run = section.closest('.route-run');
  const stages = [...section.querySelectorAll('.route-stage')];
  const markers = stages.map((s) => s.querySelector('.stage-marker'));
  const accent = section.querySelector('.route-title .hero-title-accent');
  const title = accent?.parentElement;
  const el = (parent, tag, attrs) => {
    const node = parent.appendChild(document.createElementNS(NS, tag));
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    return node;
  };

  // The lit stroke carries the theme's light, running from Soft Gold into Periwinkle from one end of the path to the
  // other; the colours are in the stylesheet.
  const sheen = el(el(svg, 'defs', {}), 'linearGradient', { id: 'route-sheen', class: 'route-sheen', gradientUnits: 'userSpaceOnUse' });
  for (const offset of [0, 0.38, 0.62, 0.82, 1]) el(sheen, 'stop', { offset });

  // The glow is a blurred layer under the path: a wide periwinkle wash and a tighter copy of the lit stroke, a
  // brighter trail over its last stretch (faded toward the back by a gradient that follows the tip), and at the
  // leading point a bloom inside a wider aura.
  const halo = section.insertBefore(document.createElementNS(NS, 'svg'), svg);
  halo.setAttribute('class', 'route-path route-halo');
  halo.setAttribute('aria-hidden', 'true');
  const defs = el(halo, 'defs', {});
  const fade = el(defs, 'linearGradient', { id: 'route-trail-fade', gradientUnits: 'userSpaceOnUse' });
  el(fade, 'stop', { class: 'route-trail-from', offset: 0 });
  el(fade, 'stop', { class: 'route-trail-to', offset: 1 });
  const falloff = el(defs, 'radialGradient', { id: 'route-aura-fade' });
  el(falloff, 'stop', { class: 'route-aura-core', offset: 0 });
  el(falloff, 'stop', { class: 'route-aura-mid', offset: 0.45 });
  el(falloff, 'stop', { class: 'route-aura-edge', offset: 1 });
  const wash = el(halo, 'path', { class: 'route-line route-line-wash' });
  const glow = el(halo, 'path', { class: 'route-line route-line-glow' });
  const trail = el(halo, 'path', { class: 'route-line route-line-trail' });
  const aura = el(halo, 'circle', { class: 'route-aura', r: 30 });
  const bloom = el(halo, 'circle', { class: 'route-bloom', r: 9 });

  const guide = el(svg, 'path', { class: 'route-line' }); // unstroked: the route, to measure along
  const lit = el(svg, 'path', { class: 'route-line route-line-lit' });
  const tip = el(svg, 'circle', { class: 'route-tip', r: 2.5 });

  // The word's light (see the stylesheet), all drawn with copies of the word, so each part takes the colour of the
  // letters it copies: behind it, a glow and the rays, which the stylesheet scales out from the light, each further,
  // more blurred and fainter; over it, a rim.
  const copies = [];
  if (accent) {
    const copy = (parent, cls, style = '') => {
      const node = parent.appendChild(document.createElement('span'));
      node.className = `hero-title-accent route-copy ${cls}`.trim();
      node.textContent = accent.textContent;
      node.style.cssText = style;
      node.setAttribute('aria-hidden', 'true');
      copies.push(node);
    };
    copy(title, 'route-glow');
    copy(title, 'route-glow route-glow-wide');
    const rays = title.appendChild(document.createElement('span'));
    rays.className = 'route-rays';
    rays.setAttribute('aria-hidden', 'true');
    for (let i = 1; i <= RAYS; i++) {
      const f = i / RAYS;
      copy(rays, '', `--s: ${1 + 0.02 * i}; --a: ${(0.5 * (1 - f) ** 1.3 + 0.03).toFixed(3)}; --b: ${(0.6 + 0.5 * i).toFixed(2)}px`);
    }
    copy(title, 'route-rim');
  }

  let length = 0;
  let stops = []; // path length at each marker
  let span = [0, 0]; // the path's top and bottom within the section
  let shown = 0; // progress drawn, 0 to 1
  let word = { x: 0, y: 0, w: 1, h: 1, em: 1 }; // the accent word's box within the section, and its font size
  let passed = 0; // how far the light has passed the word, 0 to 1
  let pinned = false;
  let pinTop = 0; // where the held section's top sits in the window
  let held = 0; // scroll distance the section is held for
  let raf = 0;

  section.classList.add('is-live');

  // Hold the section on wide screens when its content fits the window: centred, with the top padding (and the
  // rule above it) free to slip off the top of the screen.
  function pin() {
    const pad = parseFloat(getComputedStyle(section).paddingTop) + section.clientTop;
    const content = section.offsetHeight - pad;
    const fits = Boolean(run) && WIDE.matches && !REDUCED.matches && content <= innerHeight;
    run?.classList.toggle('is-pinned', fits);
    pinTop = Math.round((innerHeight - content) / 2 - pad);
    section.style.setProperty('--pin-top', `${pinTop}px`);
    held = fits ? run.offsetHeight - section.offsetHeight : 0;
    pinned = held > 0;
  }

  function layout() {
    pin();
    const box = section.getBoundingClientRect();
    for (const layer of [svg, halo]) layer.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
    const pts = markers.map((m) => {
      const r = m.getBoundingClientRect();
      return { x: r.left + r.width / 2 - box.left, y: r.top + r.height / 2 - box.top };
    });
    const segs = WIDE.matches ? climb(pts, box.width) : rail(pts);

    // Measure each segment on the guide, then give every path the whole route.
    let total = 0;
    stops = [];
    segs.forEach((d, i) => {
      guide.setAttribute('d', `M${d.from.x} ${d.from.y}${d.c}`);
      if (WIDE.matches ? i > 0 : true) stops.push(total);
      total += guide.getTotalLength();
    });
    if (!WIDE.matches) stops.push(total);
    length = total;
    const d = `M${segs[0].from.x} ${segs[0].from.y}${segs.map((s) => s.c).join('')}`;
    for (const path of [guide, lit, wash, glow, trail]) path.setAttribute('d', d);
    lit.style.strokeDasharray = wash.style.strokeDasharray = glow.style.strokeDasharray = `${length} ${length}`;
    trail.style.strokeDasharray = `${TRAIL} ${length + TRAIL}`;
    const [a, b] = [segs[0].from, segs[segs.length - 1].to];
    for (const [k, v] of Object.entries({ x1: a.x, y1: a.y, x2: b.x, y2: b.y })) sheen.setAttribute(k, v);
    const ys = segs.flatMap((s) => [s.from.y, s.to.y]);
    span = [Math.min(...ys), Math.max(...ys)];
    if (accent) {
      // Offsets rather than the box on screen, which the headline's rise into view would move.
      let x = section.clientLeft;
      let y = section.clientTop;
      for (let n = accent; n && n !== section; n = n.offsetParent) {
        x += n.offsetLeft;
        y += n.offsetTop;
      }
      word = { x, y, w: accent.offsetWidth || 1, h: accent.offsetHeight || 1, em: parseFloat(getComputedStyle(accent).fontSize) };
      // The light's layers sit over the word to the fraction of a pixel; the headline's rise moves both boxes alike.
      const a = accent.getBoundingClientRect();
      const t = title.getBoundingClientRect();
      const at = { '--x': a.left - t.left, '--y': a.top - t.top, '--w': word.w, '--h': word.h };
      for (const [k, v] of Object.entries(at)) title.style.setProperty(k, `${v.toFixed(2)}px`);
    }
    sync();
    requestAnimationFrame(sync); // in case the word's drift had only just restarted
    shown = target();
    passed = passTarget();
    paint();
  }

  // Wide: lead in from the page's left edge, through the four markers, and out to the right edge, leaving the
  // edges at the slopes the reference does: steep where it enters, level where it leaves.
  function climb(pts, width) {
    const first = pts[0];
    const last = pts[pts.length - 1];
    const start = { x: -2, y: first.y + 0.53 * (first.x + 2) };
    const end = { x: width + 2, y: last.y - 0.29 * (width + 2 - last.x) };
    const P = [start, ...pts, end];
    const T = P.map((p, i) => {
      if (i === 0) { const d = P[1].x - p.x; return { x: d * 0.55, y: -d * 0.95 }; }
      if (i === P.length - 1) return { x: p.x - P[i - 1].x, y: 0 };
      return { x: (P[i + 1].x - P[i - 1].x) / 2, y: (P[i + 1].y - P[i - 1].y) / 2 };
    });
    return P.slice(0, -1).map((a, i) => {
      const b = P[i + 1];
      const c = `C${a.x + T[i].x / 3} ${a.y + T[i].y / 3} ${b.x - T[i + 1].x / 3} ${b.y - T[i + 1].y / 3} ${b.x} ${b.y}`;
      return { from: a, to: b, c };
    });
  }

  // Stacked: a straight rail from the first marker to the last.
  function rail(pts) {
    return pts.slice(0, -1).map((a, i) => ({ from: a, to: pts[i + 1], c: `L${a.x} ${pts[i + 1].y}` }));
  }

  // How much of the path the scroll position has reached. Held: the stroke draws over the first part of the held
  // scroll. Wide but not held: it starts once the whole path is on screen and finishes as it nears the top, so
  // every marker lights while it is in view. Stacked: it follows a reading line a little below the middle of the
  // screen.
  function target() {
    if (REDUCED.matches || !length) return 1;
    if (pinned) return clamp((pinTop - run.getBoundingClientRect().top) / (DRAW * held));
    const top = section.getBoundingClientRect().top;
    const vh = innerHeight;
    if (WIDE.matches) {
      const mid = top + (span[0] + span[1]) / 2;
      const travel = Math.max(0.55 * vh, 320);
      return clamp(0.5 + (vh / 2 - mid) / travel);
    }
    return clamp((READ * vh - (top + span[0])) / (span[1] - span[0]));
  }

  // How far each stage has appeared, from hidden. Wide: over the stretch of path that leads to its marker, so it is
  // fully shown as the stroke arrives. Stacked: as its marker rises from the foot of the screen to the reading line,
  // where the rail reaches it.
  function reveal(i, reach) {
    if (REDUCED.matches) return 1;
    if (WIDE.matches) {
      const from = i ? stops[i - 1] : 0;
      return clamp((reach - from) / Math.max(stops[i] - from, 1));
    }
    return clamp((innerHeight - markers[i].getBoundingClientRect().top) / ((1 - READ) * innerHeight));
  }

  // How far the light has passed the accent word. Wide: how far across it the leading point has gone. Stacked, where
  // the rail starts below the headline: as the word rises to the reading line, just before the rail.
  function passTarget() {
    if (!accent) return 0;
    if (REDUCED.matches) return 1;
    if (WIDE.matches) return length ? clamp((guide.getPointAtLength(shown * length).x - word.x) / word.w) : 0;
    return clamp((0.92 * innerHeight - accent.getBoundingClientRect().bottom) / (0.3 * innerHeight));
  }

  function paint() {
    const reach = shown * length;
    lit.style.strokeDashoffset = wash.style.strokeDashoffset = glow.style.strokeDashoffset = String(length - reach);
    trail.style.strokeDashoffset = String(TRAIL - reach);
    // The trail's gradient runs from a trail's length back up to the tip, so the glow fades toward the back.
    const head = guide.getPointAtLength(reach);
    const back = guide.getPointAtLength(Math.max(0, reach - TRAIL));
    fade.setAttribute('x1', back.x);
    fade.setAttribute('y1', back.y);
    fade.setAttribute('x2', head.x);
    fade.setAttribute('y2', head.y);
    // The leading point shows while the stroke is moving and fades out at either end of the path.
    const on = clamp(Math.min(shown, 1 - shown) * 25);
    for (const dot of [tip, bloom, aura]) {
      dot.setAttribute('cx', head.x);
      dot.setAttribute('cy', head.y);
      dot.style.opacity = String(on);
    }
    trail.style.opacity = String(on);
    stages.forEach((s, i) => {
      s.classList.toggle('is-reached', reach + 0.5 >= stops[i]);
      s.style.setProperty('--reveal', reveal(i, reach).toFixed(3));
    });
    if (accent) shine(head, on);
  }

  // Keep the copies' light drifting in step with the word's.
  function sync() {
    const [drift] = accent?.getAnimations() ?? [];
    if (drift?.startTime == null) return;
    for (const node of copies) for (const a of node.getAnimations()) a.startTime = drift.startTime;
  }

  // Where the light sits against the word, in the word's own box, and how strongly it reaches it. Wide: the leading
  // point, fading out with its distance from the word. Stacked: a light that passes beneath the word as it rises.
  function shine(head, on) {
    let x = 0;
    let y = 0;
    let k = 0;
    if (REDUCED.matches) k = 0;
    else if (WIDE.matches) {
      x = head.x - word.x;
      y = head.y - word.y;
      const away = Math.hypot(Math.max(-x, 0, x - word.w), Math.max(-y, 0, y - word.h));
      k = on * clamp(1 - away / (REACH * word.em));
    } else {
      x = word.w * (1.3 * passed - 0.15);
      y = word.h + 1.1 * word.em;
      k = Math.sin(Math.PI * passed);
    }
    title.style.setProperty('--k', k.toFixed(3));
    if (k) {
      title.style.setProperty('--lx', `${x.toFixed(1)}px`);
      title.style.setProperty('--ly', `${y.toFixed(1)}px`);
    }
    title.style.setProperty('--lit', passed.toFixed(4));
  }

  // Ease toward the scroll position over a few frames, so wheel steps and key jumps don't snap. On wide screens
  // the word's light follows the eased stroke; stacked, it eases toward its own goal.
  function step() {
    const goal = target();
    shown += (goal - shown) * 0.24;
    if (Math.abs(goal - shown) < 0.0008) shown = goal;
    const want = passTarget();
    passed = WIDE.matches ? want : passed + (want - passed) * 0.24;
    if (Math.abs(want - passed) < 0.0008) passed = want;
    paint();
    raf = shown === goal && passed === want ? 0 : requestAnimationFrame(step);
  }
  const follow = () => { if (!raf) raf = requestAnimationFrame(step); };

  addEventListener('scroll', follow, { passive: true });
  addEventListener('resize', layout); // the window's height decides whether the section is held
  REDUCED.addEventListener('change', layout);
  WIDE.addEventListener('change', layout);
  new ResizeObserver(layout).observe(section);
  document.fonts?.ready.then(layout);
  layout();
}

function clamp(v) {
  return Math.max(0, Math.min(1, v));
}
