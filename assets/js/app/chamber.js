// The bubble chamber the lesson's experiment runs in, and the drawings Q and the study room share with it. Everything is
// drawn from the physics rather than sketched: a photon is a wave whose wavelength shortens as its energy rises; a pair
// appears only near a nucleus and only from 1.022 MeV, twice the electron's rest energy; each particle's track curves
// in the magnetic field with a radius proportional to its momentum (r = p / qB), positive one way and negative the
// other, and tightens into a spiral as it slows; the positron, once slow, meets an electron and annihilates into two
// photons back to back. Photons leave no track in a real chamber: they're drawn as wavy lines, as in diagrams.
// Lengths are in the composition's pixels (--z in app.css), so the drawing keeps its proportions with the window.

export const ME = 0.511;                                         // the electron's rest energy, MeV
export const PAIR = 2 * ME;                                      // the least a photon needs to make a pair near a nucleus
export const momentum = (T) => Math.sqrt(T * T + 2 * T * ME);    // MeV/c, for a kinetic energy T in MeV
export const mev = (v, d = 2) => `${v.toFixed(d)} MeV`;
export const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const NS = 'http://www.w3.org/2000/svg';
const r1 = (v) => Math.round(v * 10) / 10;
export const line = (pts) => 'M' + pts.map(([x, y]) => `${r1(x)} ${r1(y)}`).join('L');

// A photon as a wave from a to b, tapered at its ends.
export function wave([x0, y0], [x1, y1], energy, amp = 5) {
  const len = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / len, uy = (y1 - y0) / len;
  const lambda = Math.max(7, 22 / Math.sqrt(energy));
  const pts = [];
  for (let s = 0; s <= len; s += 1.25) {
    const k = Math.sin((s / lambda) * 2 * Math.PI) * amp * Math.min(1, s / 14, (len - s) / 14);
    pts.push([x0 + ux * s - uy * k, y0 + uy * s + ux * k]);
  }
  return line(pts);
}

// A charged track in a magnetic field into the screen. It turns at 1/r per unit length (sign 1 turns clockwise on the
// screen, as an electron does; -1 anticlockwise, as a positron does), and r shrinks as the particle loses energy to
// the liquid, so it winds into a spiral. It stops once nearly at rest or out of the box.
export function track([x, y], heading, R, sign, [W, H]) {
  const loss = 2.1 * R, pts = [[x, y]];
  let a = heading, s = 0, r = R;
  while (r > 2.2 && s < 5000) {
    r = R * Math.exp(-s / loss);
    a += sign / r; x += Math.cos(a); y += Math.sin(a); s += 1;
    if (s % 2 === 0) pts.push([x, y]);
    if (x < -30 || y < -30 || x > W + 30 || y > H + 30) return { pts, out: true };
  }
  pts.push([x, y]);
  return { pts, out: false };
}

// Small crosses, the sign for a magnetic field pointing into the screen.
export function field(W, H, gap = 46) {
  let d = '';
  for (let x = gap / 2; x < W; x += gap) for (let y = gap / 2; y < H; y += gap) d += `M${r1(x - 2.2)} ${r1(y - 2.2)}l4.4 4.4M${r1(x + 2.2)} ${r1(y - 2.2)}l-4.4 4.4`;
  return `<path class="field" d="${d}"/>`;
}

// One photon arriving from the left at a nucleus at (x, y), or crossing empty space when there's none. `outcome` is
// 'pair', 'short' (not enough energy) or 'alone' (energy enough, but no nucleus to take up momentum); `pending` draws
// the photon on its way, before anything happens. `split` is the electron's share of the spare energy.
export function event({ W, H, energy, nucleus = true, split = 0.5, x = W * 0.34, y = H * 0.5, zoom = 1, scale = H * 0.24 * zoom,
  labels = true, notes = false, pending = false, seed = 0.18 }) {
  const outcome = pending ? 'pending' : energy < PAIR ? 'short' : nucleus ? 'pair' : 'alone';
  const out = [];
  const text = (tx, ty, s, cls = 'lbl') => out.push(`<text class="${cls}" x="${r1(tx)}" y="${r1(ty)}">${s}</text>`);
  const end = pending ? [x - 46, y] : outcome === 'pair' ? [x - 9, y] : [W + 10, y];
  out.push(`<path class="photon" d="${wave([-10, y], end, energy)}"/>`);
  if (labels) text(26, y - 22, `γ  ${mev(energy)}`);
  if (nucleus) {
    out.push(`<circle class="nuc-ring" cx="${r1(x)}" cy="${r1(y)}" r="11"/><circle class="nuc" cx="${r1(x)}" cy="${r1(y)}" r="4.2"/>`);
    if (labels && outcome !== 'pair') text(x, y + 36, 'lead nucleus', 'lbl mid');
  }
  if (outcome !== 'pair') return { markup: out.join(''), outcome };

  const T = energy - PAIR, Te = T * split, Tp = T - Te, theta = Math.min(0.5, ME / energy);
  const e = track([x, y], theta, Math.max(7, scale * momentum(Te)), 1, [W, H]);
  const p = track([x, y], -theta, Math.max(7, scale * momentum(Tp)), -1, [W, H]);
  out.push(`<circle class="flash" cx="${r1(x)}" cy="${r1(y)}" r="18"/>`);
  out.push(`<path class="trk e" d="${line(e.pts)}"/><path class="trk p" d="${line(p.pts)}"/>`);
  out.push(`<path class="recoil" d="M${r1(x - 3)} ${r1(y + 15)}l12 4M${r1(x + 5)} ${r1(y + 15.5)}l4 3.5-5 1.6"/>`);
  let ann = null;
  if (!p.out) {
    // The slowed positron meets an electron of the liquid: two photons of 0.511 MeV leave back to back.
    const [ax, ay] = p.pts[p.pts.length - 1], phi = seed * Math.PI * 2, dx = Math.cos(phi) * 34, dy = Math.sin(phi) * 34;
    ann = [ax, ay];
    out.push(`<path class="ann" d="${wave([ax, ay], [ax + dx, ay + dy], ME, 3)}"/><path class="ann" d="${wave([ax, ay], [ax - dx, ay - dy], ME, 3)}"/>`);
  }
  if (labels) {
    const at = (pts, k) => pts[Math.min(pts.length - 1, k)];
    const [ex, ey] = at(e.pts, 44), [px, py] = at(p.pts, 44);
    text(ex + 16, ey + 26, `e⁻  ${mev(Te)}`, 'lbl e');
    text(px + 16, py - 18, `e⁺  ${mev(Tp)}`, 'lbl p');
  }
  if (notes) {
    text(x - 22, y - 30, `${mev(PAIR, 3)} of its energy becomes mass`, 'note end');
    text(x - 22, y + 30, 'The nucleus recoils, taking up', 'note end');
    text(x - 22, y + 48, 'momentum but almost no energy', 'note end');
    if (ann) text(ann[0], Math.min(...p.pts.map(([, py]) => py)) - 16, 'Slowed, the positron annihilates', 'note mid');
  }
  return { markup: out.join(''), outcome, T, Te, Tp };
}

// A chamber filling `host`: fire() draws an event with its motion (the photon flies in, the pair spirals out); show()
// draws one at rest. The previous event stays as a faint trace to compare against.
export function createChamber(host, { at = (W, H) => ({ x: W * 0.34, y: H * 0.5 }), trace = false } = {}) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'chamber');
  svg.setAttribute('aria-hidden', 'true');
  const probe = document.createElement('span');
  probe.className = 'z-probe';                                   // 100 composition pixels wide (app.css)
  host.append(svg, probe);
  let W = 0, H = 0, now = null, before = null, moving = false, result = null;

  const draw = () => {
    if (!W || !now) return;
    const geo = { W, H, ...at(W, H) };
    result = event({ ...geo, ...now });
    svg.innerHTML = field(W, H) + (before ? `<g class="trace">${event({ ...geo, ...before, labels: false }).markup}</g>` : '')
      + `<g class="now">${result.markup}</g>`;
    if (moving && !reduced()) animate(svg.querySelector('.now'), result.outcome);
    moving = false;
  };
  new ResizeObserver(() => {
    const z = probe.getBoundingClientRect().width / 100 || 1;
    const r = host.getBoundingClientRect();
    if (!r.width || !r.height) return;
    W = r.width / z; H = r.height / z;
    svg.setAttribute('viewBox', `0 0 ${r1(W)} ${r1(H)}`);
    draw();
  }).observe(host);

  return {
    fire(opts) { if (trace && now && now.energy !== undefined && !now.pending) before = now; now = opts; moving = true; draw(); return event({ W: W || 800, H: H || 600, ...at(W || 800, H || 600), ...opts }); },
    show(opts) { now = opts; draw(); },
    clear() { before = null; },
  };
}

// The motion: the photon draws itself in, the nucleus flashes, the tracks unwind, and the labels arrive last.
function animate(g, outcome) {
  const run = (el, frames, opts) => el.animate(frames, { fill: 'both', ...opts });
  const dash = (el, duration, delay, easing) => {
    const L = el.getTotalLength();
    el.style.strokeDasharray = `${L} ${L}`;
    run(el, [{ strokeDashoffset: L }, { strokeDashoffset: 0 }], { duration, delay, easing });
  };
  const photon = g.querySelector('.photon'), tIn = Math.min(900, photon.getTotalLength() * 0.75);
  dash(photon, tIn, 0, 'linear');
  const later = outcome === 'pair' ? tIn + 1500 : tIn;
  for (const el of g.querySelectorAll('.lbl, .note')) run(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: later });
  if (outcome !== 'pair') return;
  const flash = g.querySelector('.flash');
  run(flash, [{ opacity: 0.9, transform: 'scale(0.2)' }, { opacity: 0, transform: 'scale(1.6)' }], { duration: 700, delay: tIn, easing: 'ease-out' });
  for (const t of g.querySelectorAll('.trk')) dash(t, 1500, tIn, 'cubic-bezier(0.2, 0.75, 0.35, 1)');
  for (const el of g.querySelectorAll('.ann, .recoil')) run(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: tIn + (el.matches('.ann') ? 1400 : 200) });
}
