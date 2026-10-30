// Logo concept, drawn from the letters of the project's earlier name, AXIOM: the wordmark folds into a
// monogram.
//
// Closed, the X and I sit inside the O as six spokes, with A and M either side of it. Open, the
// letters spread back into the AXIOM wordmark: A and M part, the O rolls off to its place, the I is
// left standing and the X slides out, turning back from spokes into a letter as it goes.
// Coordinates are the wordmark's own (viewBox 0 0 125 22).

const NS = 'http://www.w3.org/2000/svg';
const R = 11.3; // radius of the O
const GAP = 8; // between letters when closed
const HOME = { x: 40, i: 62, o: 86 }; // centres when open
const X_OPEN = [9.5, 11]; // half-width and half-height of the open X
export const EVEN = 60; // spokes 60° apart
export const LETTER = 40.8; // the open X's own angle from vertical

const clamp01 = (n) => Math.max(0, Math.min(1, n));
const span = (t, a, b) => clamp01((t - a) / (b - a));
const ease = (n) => (n < 0.5 ? 4 * n ** 3 : 1 - (-2 * n + 2) ** 3 / 2);
const mix = (a, b, k) => a + (b - a) * k;
const f2 = (n) => Math.round(n * 100) / 100;

// The six spokes on their own, centred on (cx, cy), for the mark at any size.
export function spokes(r, angle = EVEN, cx = 0, cy = 0) {
  const a = (angle * Math.PI) / 180;
  const sx = f2(r * Math.sin(a)), sy = f2(r * Math.cos(a));
  return `M${cx} ${cy - r}V${cy + r}M${cx - sx} ${cy - sy}L${cx + sx} ${cy + sy}M${cx + sx} ${cy - sy}L${cx - sx} ${cy + sy}`;
}

// Replace an SVG's contents with the five posable letters. `anchor` sets where the closed monogram
// sits: 'left' keeps the A in place (for headers), 'centre' closes towards the middle.
export function mount(svg, { anchor = 'left', angle = EVEN } = {}) {
  svg.setAttribute('viewBox', '0 0 125 22');
  svg.replaceChildren();
  const add = (name, attrs) => {
    const node = document.createElementNS(NS, name);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    return svg.appendChild(node);
  };
  const parts = {
    a: add('path', { d: 'M0 22 10.5 0 21 22M3.1 15.5h14.8' }),
    x: add('path', {}),
    i: add('path', {}),
    o: add('circle', { cy: 11, r: R }),
    m: add('path', { d: 'M106 22V0l9.5 15L125 0v22' }),
    centre: anchor === 'left' ? 21 + GAP + R : 62.5,
    angle,
    t: 1,
    raf: 0,
  };
  pose(parts, 1);
  return parts;
}

// Pose the letters: 0 is the closed monogram, 1 the open wordmark.
export function pose(p, t) {
  p.t = t;
  const doors = ease(span(t, 0, 0.7));
  const roll = ease(span(t, 0.12, 0.85));
  const slide = ease(span(t, 0.2, 1));
  const c = p.centre;
  p.a.setAttribute('transform', `translate(${f2(mix(c - R - GAP - 21, 0, doors))} 0)`);
  p.m.setAttribute('transform', `translate(${f2(mix(c + R + GAP - 106, 0, doors))} 0)`);
  p.o.setAttribute('cx', f2(mix(c, HOME.o, roll)));
  const a = (p.angle * Math.PI) / 180;
  const hx = mix(R * Math.sin(a), X_OPEN[0], slide);
  const hy = mix(R * Math.cos(a), X_OPEN[1], slide);
  const xc = mix(c, HOME.x, slide);
  p.x.setAttribute('d', `M${f2(xc - hx)} ${f2(11 - hy)}L${f2(xc + hx)} ${f2(11 + hy)}M${f2(xc + hx)} ${f2(11 - hy)}L${f2(xc - hx)} ${f2(11 + hy)}`);
  const ih = mix(R, 11, roll), ix = mix(c, HOME.i, roll);
  p.i.setAttribute('d', `M${f2(ix)} ${f2(11 - ih)}V${f2(11 + ih)}`);
}

// Animate to `to` (0 or 1). Resolves when it gets there; reduced motion jumps straight there.
export function play(p, to, duration = 1500) {
  cancelAnimationFrame(p.raf);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    pose(p, to);
    return Promise.resolve();
  }
  const from = p.t, start = performance.now(), length = duration * Math.abs(to - from);
  return new Promise((resolve) => {
    const step = (now) => {
      const k = length ? Math.min(1, (now - start) / length) : 1;
      pose(p, mix(from, to, k));
      if (k < 1) p.raf = requestAnimationFrame(step);
      else resolve();
    };
    p.raf = requestAnimationFrame(step);
  });
}
