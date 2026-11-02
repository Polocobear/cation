// The learning path's chapter illustrations: fine line drawings of the physics each chapter teaches. The geometry is
// computed rather than sketched, so it is right: an alpha particle passing a nucleus follows a Coulomb orbit, a
// charged track losing energy in a magnetic field tightens into a spiral, a detector's tracks are arcs from the beam.
// Each returns SVG for a plate 120 units across, centred on 0,0. The plate's state (done, current, locked) is styled in
// app.css through the classes: ln (structure), fn (faint structure), au (gold), pw (periwinkle), wt (off-white),
// dot (gold fill), dep (a calorimeter deposit). Lines in au and pw carry pathLength="1" so the current chapter's can
// draw themselves in.

const n = (v) => Math.round(v * 100) / 100;
const poly = (pts, close = false) => 'M' + pts.map(([x, y]) => `${n(x)} ${n(y)}`).join('L') + (close ? 'Z' : '');
const path = (d, cls) => `<path class="${cls}" d="${d}"${/\b(au|pw)\b/.test(cls) ? ' pathLength="1"' : ''}/>`;
const circle = (r, cls, cx = 0, cy = 0) => `<circle class="${cls}" cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}"/>`;
const polar = (r, a) => [r * Math.cos(a), r * Math.sin(a)];
const DEG = Math.PI / 180;

// A charged track in a magnetic field: it turns at 1/R per unit length, and R shrinks as the particle loses energy
// (by e every `loss` units), so a slow particle winds into a spiral. Sign is the direction it turns.
function track([x, y], heading, { R, sign, loss = Infinity, until, step = 0.35, every = 3 }) {
  const pts = [[x, y]];
  let a = heading, s = 0;
  for (let i = 1; i < 4000; i++) {
    const r = R * Math.exp(-s / loss);
    a += (sign * step) / r;
    x += Math.cos(a) * step; y += Math.sin(a) * step; s += step;
    if (i % every === 0) pts.push([x, y]);
    if (until(x, y, s, r)) break;
  }
  pts.push([x, y]);
  return pts;
}

// 01 · Inside the atom. Rutherford's experiment: alpha particles crossing a gold foil. Almost all pass through the
// atom's empty space; the few that come close to the nucleus are thrown wide, and one comes nearly straight back.
// Each path is integrated under the nucleus's Coulomb repulsion (closest head-on approach: 6 units), screened by the
// atom's electrons so that it fades towards the atom's edge.
function scattering() {
  const k = 3, dt = 0.25, screen = 13;
  const paths = [-42, -33, -24.5, -16.5, -10, -5.4, -1.3, 2.4, 6.6, 11.8, 18.5, 26, 34.5, 43].map((b) => {
    let x = -66, y = b, vx = 1, vy = 0;
    const pts = [[x, y]];
    for (let i = 1; i < 3000; i++) {
      const r2 = x * x + y * y, r = Math.sqrt(r2), f = (k * (1 + r / screen) * Math.exp(-r / screen)) / (r2 * r);
      vx += f * x * dt; vy += f * y * dt;
      x += vx * dt; y += vy * dt;
      if (i % 6 === 0) pts.push([x, y]);
      if (r2 > 68 * 68 && x * vx + y * vy > 0) break;
    }
    pts.push([x, y]);
    return path(poly(pts), Math.abs(b) < 7 ? 'au' : 'ln');
  });
  return circle(47, 'fn dotted') + paths.join('') + circle(6, 'fn') + circle(2.3, 'dot');
}

// 02 · Antimatter and pair production. A photon, which leaves no track (drawn as a wave), passes a nucleus and becomes
// an electron and a positron. In the chamber's magnetic field they curve opposite ways and wind into tightening spirals
// as they slow. Two straight beam tracks cross the chamber behind them.
function pair() {
  const P = [-56, 30], V = [-4, 3];
  const len = Math.hypot(V[0] - P[0], V[1] - P[1]);
  const u = [(V[0] - P[0]) / len, (V[1] - P[1]) / len], nv = [-u[1], u[0]];
  const wave = [];
  for (let t = 0; t <= len - 1.5; t += 0.45) {
    const w = 1.6 * Math.sin((t / 4.2) * 2 * Math.PI) * Math.min(1, t / 8, (len - t) / 6);
    wave.push([P[0] + u[0] * t + nv[0] * w, P[1] + u[1] * t + nv[1] * w]);
  }
  const head = Math.atan2(u[1], u[0]);
  const stop = (x, y, s, r) => r < 0.9 || x * x + y * y > 62 * 62;
  const electron = track(V, head + 0.14, { R: 31, sign: 1, loss: 46, until: stop });
  const positron = track(V, head - 0.14, { R: 31, sign: -1, loss: 46, until: stop });
  const beam = (y, R) => track([-64, y], 0, { R, sign: 1, until: (x) => x > 64, every: 8 });
  return path(poly(beam(-40, 900)), 'fn') + path(poly(beam(43, -1400)), 'fn') +
    path(poly(wave), 'ln') + path(poly(electron), 'pw') + path(poly(positron), 'au') + circle(1.6, 'dot', ...V);
}

// 03 · Reading tracks. A collider detector seen end-on: the beam pipe, the layers of the tracker, the calorimeter ring
// cut into cells and the muon chambers outside it. Charged tracks curve out from the collision; each stops in the
// calorimeter, where its energy shows as a deposit, except a muon, which passes through to the outer chambers, and a
// slow particle that curls up inside the tracker.
function detector() {
  let s = circle(3, 'ln');
  for (const r of [7.5, 11, 14.5, 18]) s += circle(r, 'fn');
  s += circle(25, 'ln') + circle(33, 'ln');
  let cells = '';
  for (let j = 0; j < 48; j++) {
    const [a, b] = [polar(25, j * 7.5 * DEG), polar(33, j * 7.5 * DEG)];
    cells += `M${n(a[0])} ${n(a[1])}L${n(b[0])} ${n(b[1])}`;
  }
  s += path(cells, 'fn');
  for (let j = 0; j < 8; j++) {
    const a = (j * 45 + 22.5) * DEG, w = 17 * DEG;
    s += path(poly([polar(39, a - w), polar(46, a - w), polar(46, a + w), polar(39, a + w)], true), 'fn');
  }
  const out = (r) => (x, y) => x * x + y * y >= r * r;
  for (const [deg, R, sign, energy] of [[-30, 80, 1, 6.5], [24, 44, -1, 3], [146, 34, 1, 2.4], [204, 62, -1, 5.2], [262, 120, -1, 7.5]]) {
    const pts = track([0, 0], deg * DEG, { R, sign, until: out(25) });
    const [x, y] = pts[pts.length - 1], a = Math.round(Math.atan2(y, x) / (7.5 * DEG)) * 7.5 * DEG, w = 3.75 * DEG;
    s += path(poly([polar(25, a - w), polar(25 + energy, a - w), polar(25 + energy, a + w), polar(25, a + w)], true), 'dep');
    s += path(poly(pts), 'pw');
  }
  s += path(poly(track([0, 0], 84 * DEG, { R: 190, sign: 1, until: out(46) })), 'au');
  s += path(poly(track([0, 0], 318 * DEG, { R: 6.5, sign: 1, loss: 120, until: (x, y, d) => d > 50 })), 'pw');
  return s;
}

// 04 · Quarks and the strong force. A proton: two up quarks and a down quark, held by gluons, drawn as the coils
// Feynman diagrams use. The three quarks carry the three colour charges, shown here in gold, periwinkle and white.
function quarks() {
  const Q = [[0, -20, 'u', 'au'], [17.3, 10, 'u', 'pw'], [-17.3, 10, 'd', 'wt']], qr = 6.6;
  const coil = (a, b, side) => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len], nv = [-u[1] * side, u[0] * side];
    const L = len - 2 * (qr + 1.6), loops = 6, r = 1.55, pts = [];
    for (let t = 0; t <= 1.0001; t += 0.005) {
      const ang = 2 * Math.PI * loops * t, along = qr + 1.6 + t * L - r * Math.sin(ang), off = r * (1 - Math.cos(ang)) - r * 0.5;
      pts.push([a[0] + u[0] * along + nv[0] * off, a[1] + u[1] * along + nv[1] * off]);
    }
    return path(poly(pts), 'ln');
  };
  let s = circle(39, 'ln') + circle(44, 'fn dotted');
  s += coil(Q[0], Q[1], 1) + coil(Q[1], Q[2], 1) + coil(Q[2], Q[0], 1);
  for (const [x, y, name, cls] of Q) {
    s += circle(qr, `${cls} quark`, x, y) + `<text class="q-name" x="${x}" y="${n(y + 2.9)}">${name}</text>`;
  }
  return s;
}

// 05 · The Higgs and open questions. The Higgs field's potential, the "Mexican hat": energy is highest at zero field
// and lowest in a ring around it, so the field settles off centre, and that is what gives particles mass. Drawn as a
// wire surface, V = (r² − 1)², with the trough in periwinkle and the field's value resting in it in gold.
function higgs() {
  const R = 32, tilt = 0.34, H = 34, oy = 13;
  const P = (r, a) => [R * r * Math.cos(a), oy + R * r * Math.sin(a) * tilt - H * (r * r - 1) ** 2];
  let back = '', front = '';
  for (const r of [0.3, 0.55, 0.78, 1, 1.18, 1.34]) {
    const half = (from) => { const pts = []; for (let i = 0; i <= 36; i++) pts.push(P(r, from + (i / 36) * Math.PI)); return poly(pts); };
    back += path(half(Math.PI), 'fn');
    front += path(half(0), r === 1 ? 'pw' : 'ln');
  }
  for (let j = 0; j < 12; j++) {
    const a = j * 30 * DEG, pts = [];
    for (let i = 0; i <= 40; i++) pts.push(P((i / 40) * 1.34, a));
    (Math.sin(a) < -0.01 ? (back += path(poly(pts), 'fn')) : (front += path(poly(pts), 'ln')));
  }
  const [bx, by] = P(1, 0.95);
  return back + front + `<ellipse class="fn" cx="${n(bx)}" cy="${n(by + 0.4)}" rx="4.2" ry="1.3"/>` + circle(2.7, 'dot', bx, by - 2.6);
}

export const ART = { scattering, pair, detector, quarks, higgs };
