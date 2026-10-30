// CATION homepage, section 02: one lesson, taught four ways.
//
// The bridge is a real model: a 12 m Warren truss with equilateral panels, solved with the direct
// stiffness method every time the load moves, so each bar force, the sag and every joint's balance
// on screen are computed. The tutor is simulated: a few rules turn what the learner does (answers,
// pauses, dragging the load, asking why) into a change of approach, and a scripted learner can play
// a session through those same rules. Visitors can take over at any point.

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)');
const NS = 'http://www.w3.org/2000/svg';

// ---------------------------------------------------------------- the bridge model

const PANEL = 2; // m
const BAYS = 6;
const SPAN = PANEL * BAYS;
const DEPTH = Math.sqrt(3); // equilateral panels
const CAPACITY = 55; // kN a bar can take before it would yield
const FULL = 60; // kN at which a bar is drawn at full weight

const nodes = [];
for (let i = 0; i <= BAYS; i++) nodes.push([i * PANEL, DEPTH]); // deck joints 0–6
for (let j = 0; j < BAYS; j++) nodes.push([j * PANEL + PANEL / 2, 0]); // lower joints 7–12
const DECK = (i) => i;
const LOW = (j) => BAYS + 1 + j;

const bars = [];
for (let i = 0; i < BAYS; i++) bars.push({ a: DECK(i), b: DECK(i + 1), kind: 'deck', n: i + 1 });
for (let j = 0; j < BAYS - 1; j++) bars.push({ a: LOW(j), b: LOW(j + 1), kind: 'bottom', n: j + 1 });
for (let i = 0; i < BAYS; i++) {
  bars.push({ a: DECK(i), b: LOW(i), kind: 'diagonal', n: 2 * i + 1 });
  bars.push({ a: LOW(i), b: DECK(i + 1), kind: 'diagonal', n: 2 * i + 2 });
}
for (const bar of bars) {
  const [xa, ya] = nodes[bar.a], [xb, yb] = nodes[bar.b];
  bar.L = Math.hypot(xb - xa, yb - ya);
  bar.c = (xb - xa) / bar.L;
  bar.s = (yb - ya) / bar.L;
}
const SUPPORTS = [DECK(0), DECK(BAYS)];
const FIXED = new Set([2 * DECK(0), 2 * DECK(0) + 1, 2 * DECK(BAYS) + 1]); // pin left, roller right

// Solve for a load of P kN at x m along the deck. Every bar has the same stiffness, which sets the
// shape of the sag; the forces of a determinate truss don't depend on it.
function solve(x, P) {
  const N = nodes.length * 2;
  const K = Array.from({ length: N }, () => new Float64Array(N));
  for (const bar of bars) {
    const k = 1 / bar.L;
    const m = [bar.c * bar.c, bar.c * bar.s, bar.s * bar.s];
    const dof = [2 * bar.a, 2 * bar.a + 1, 2 * bar.b, 2 * bar.b + 1];
    for (let r = 0; r < 4; r++) {
      for (let q = 0; q < 4; q++) {
        const sign = (r < 2) === (q < 2) ? 1 : -1;
        const term = (r % 2) + (q % 2); // 0: cc, 1: cs, 2: ss
        K[dof[r]][dof[q]] += sign * k * m[term];
      }
    }
  }
  const bay = Math.min(BAYS - 1, Math.floor(x / PANEL));
  const f = x / PANEL - bay;
  const loads = new Map([[DECK(bay), P * (1 - f)], [DECK(bay + 1), P * f]]);
  const F = new Float64Array(N);
  for (const [node, p] of loads) F[2 * node + 1] -= p;

  const free = [];
  for (let d = 0; d < N; d++) if (!FIXED.has(d)) free.push(d);
  const n = free.length;
  const A = free.map((r) => Float64Array.from(free, (q) => K[r][q]));
  const b = Float64Array.from(free, (r) => F[r]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(A[r][col]) > Math.abs(A[pivot][col])) pivot = r;
    [A[col], A[pivot]] = [A[pivot], A[col]];
    [b[col], b[pivot]] = [b[pivot], b[col]];
    for (let r = col + 1; r < n; r++) {
      const m = A[r][col] / A[col][col];
      if (!m) continue;
      for (let q = col; q < n; q++) A[r][q] -= m * A[col][q];
      b[r] -= m * b[col];
    }
  }
  const z = new Float64Array(n);
  for (let r = n - 1; r >= 0; r--) {
    let acc = b[r];
    for (let q = r + 1; q < n; q++) acc -= A[r][q] * z[q];
    z[r] = acc / A[r][r];
  }
  const u = new Float64Array(N);
  free.forEach((d, i) => (u[d] = z[i]));
  const force = bars.map((bar) => ((u[2 * bar.b] - u[2 * bar.a]) * bar.c + (u[2 * bar.b + 1] - u[2 * bar.a + 1]) * bar.s) / bar.L);
  return { u, force, loads, reactions: [P * (SPAN - x) / SPAN, P * x / SPAN] };
}

const SAG_REF = (() => { // displacement at the reference case, used to scale the drawn sag
  const { u } = solve(SPAN / 2, 20);
  let max = 0;
  for (let i = 1; i < u.length; i += 2) max = Math.max(max, Math.abs(u[i]));
  return max;
})();

// Plain-language names for bars and the directions they meet a joint from.
const barName = (bar) => (bar.kind === 'deck' ? `Deck bar ${bar.n}` : bar.kind === 'bottom' ? `Bottom bar ${bar.n}` : `Diagonal ${bar.n}`);
const strain = (N) => (N < 0 ? 'squeezed' : 'stretched');
const kN = (v) => `${Math.abs(v).toFixed(1)} kN`;

// ---------------------------------------------------------------- the lesson

const MODES = {
  brief: { name: 'Short explanation', button: 'Short' },
  picture: { name: 'Picture', button: 'Picture' },
  experiment: { name: 'Experiment', button: 'Try it' },
  depth: { name: 'In depth', button: 'In depth' },
};

const root = document.querySelector('.lesson');
if (root) init(root);

function init(root) {
  const svg = root.querySelector('.truss');
  const readout = root.querySelector('.stage-readout');
  const body = root.querySelector('.lesson-body');
  const modeButtons = [...root.querySelectorAll('.lesson-modes button')];
  const list = root.querySelector('.trace-list');
  const who = root.querySelector('[data-who]');
  const replay = root.querySelector('.trace-replay');

  // ---------- drawing ----------

  const VB = { w: 1000, h: 460 };
  const SC = 62;
  const OX = (VB.w - SPAN * SC) / 2;
  const OY = 300;
  const X = (x) => OX + x * SC;
  const Y = (y) => OY - y * SC;
  const DECK_Y = Y(DEPTH);
  let ui = 1; // grows on narrow screens so text, handles and strokes stay legible

  const el = (name, attrs = {}, parent = svg) => {
    const node = document.createElementNS(NS, name);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    parent.appendChild(node);
    return node;
  };

  const defs = el('defs');
  const hatch = el('pattern', { id: 'abut-hatch', width: 9, height: 9, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
  el('path', { d: 'M0 0v9', class: 'hatch-line' }, hatch);

  const grid = el('g', { class: 'stage-grid' });
  for (let gx = OX % 31; gx < VB.w; gx += 31) el('path', { d: `M${gx} 0V${VB.h}` }, grid);
  for (let gy = OY % 31; gy < VB.h; gy += 31) el('path', { d: `M0 ${gy}H${VB.w}` }, grid);

  const ground = el('g', { class: 'abutments' });
  el('path', { d: `M${X(0) - 108} ${DECK_Y + 16}H${X(0) + 8}V${VB.h - 52}H${X(0) - 108}Z`, class: 'abut' }, ground);
  el('path', { d: `M${X(SPAN) - 8} ${DECK_Y + 16}H${X(SPAN) + 108}V${VB.h - 52}H${X(SPAN) - 8}Z`, class: 'abut' }, ground);
  el('path', { d: `M${X(0) + 8} ${VB.h - 70}H${X(SPAN) - 8}`, class: 'water' }, ground);
  el('path', { d: `M${X(0)} ${DECK_Y + 2}l-10 14h20z`, class: 'support' }, ground);
  el('path', { d: `M${X(SPAN)} ${DECK_Y + 2}l-10 11h20z`, class: 'support' }, ground);
  el('path', { d: `M${X(SPAN) - 11} ${DECK_Y + 16}h22`, class: 'support-line' }, ground);

  const dims = el('g', { class: 'dims' });
  const dimY = VB.h - 30;
  el('path', { d: `M${X(0)} ${dimY - 6}v12M${X(SPAN)} ${dimY - 6}v12M${X(0)} ${dimY}H${X(SPAN) / 2 + OX / 2 - 26}M${X(SPAN) / 2 + OX / 2 + 26} ${dimY}H${X(SPAN)}` }, dims);
  el('text', { x: (X(0) + X(SPAN)) / 2, y: dimY + 4, 'text-anchor': 'middle' }, dims).textContent = '12 m';

  const barLayer = el('g', { class: 'bars' });
  const barEls = bars.map(() => el('line', { class: 'bar' }, barLayer));
  const chevLayer = el('g', { class: 'chevrons' });
  const chevEls = bars.map(() => el('path', {}, chevLayer));

  const labels = el('g', { class: 'force-labels' });
  const labelTop = el('text', { class: 'flabel flabel-squeeze', 'text-anchor': 'middle' }, labels);
  labelTop.textContent = 'Squeezed';
  const labelBottom = el('text', { class: 'flabel flabel-stretch', 'text-anchor': 'middle' }, labels);
  labelBottom.textContent = 'Stretched';

  const hardest = el('g', { class: 'hardest' });
  const hardestLine = el('path', {}, hardest);
  const hardestText = el('text', { 'text-anchor': 'middle' }, hardest);

  const fbd = el('g', { class: 'fbd' });
  const reactionLayer = el('g', { class: 'reactions' });

  const jointLayer = el('g', { class: 'joints' });
  const jointEls = nodes.map((_, i) => {
    const g = el('g', { class: 'joint', tabindex: '-1', role: 'button', 'aria-label': `Check the balance at joint ${i + 1}` }, jointLayer);
    el('circle', { r: 16, class: 'joint-hit' }, g);
    el('circle', { r: 6.5, class: 'joint-ring' }, g);
    el('circle', { r: 2.2, class: 'joint-core' }, g);
    return g;
  });

  const load = el('g', { class: 'load', tabindex: '0', role: 'slider', 'aria-label': 'Position of the load on the deck', 'aria-valuemin': '0', 'aria-valuemax': String(SPAN) });
  el('rect', { class: 'load-hit', x: -72, y: DECK_Y - 112, width: 144, height: 112 }, load);
  el('path', { class: 'load-stem', d: `M0 ${DECK_Y - 54}V${DECK_Y - 9}M-6 ${DECK_Y - 16}l6 7 6-7` }, load);
  el('rect', { class: 'load-pill', x: -46, y: DECK_Y - 96, width: 92, height: 40, rx: 20 }, load);
  const loadText = el('text', { class: 'load-text', x: 0, y: DECK_Y - 70.5, 'text-anchor': 'middle' }, load);
  el('path', { class: 'load-grip', d: `M-58 ${DECK_Y - 80}l-5 4 5 4M58 ${DECK_Y - 80}l5 4-5 4` }, load);

  // ---------- state ----------

  const st = {
    mode: 'brief',
    x: 3,
    P: 20,
    joint: DECK(3),
    who: 'sim',
    moves: 0,
    found: false,
    overloaded: false,
    clock: 0,
    clockStart: performance.now(),
    session: 0,
    entries: [],
    answered: false,
    result: solve(3, 20),
  };
  const anim = { force: 0, sag: 0, chev: 0, depth: 0, labels: 0, x: st.x };
  const target = { force: 0, sag: 0, chev: 0, depth: 0, labels: 0 };
  let raf = 0, last = 0;

  const visuals = {
    brief: { force: 0, sag: 0, chev: 0, depth: 0, labels: 0 },
    picture: { force: 1, sag: 1, chev: 1, depth: 0, labels: 1 },
    experiment: { force: 1, sag: 1, chev: 0, depth: 0, labels: 0 },
    depth: { force: 1, sag: 0, chev: 0, depth: 1, labels: 0 },
  };

  function kick() {
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
  }
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    let moving = false;
    const k = REDUCED.matches ? 1 : 1 - Math.exp(-dt * 7.5);
    for (const key of Object.keys(target)) {
      anim[key] += (target[key] - anim[key]) * k;
      if (Math.abs(target[key] - anim[key]) > 0.002) moving = true;
      else anim[key] = target[key];
    }
    draw();
    raf = moving ? requestAnimationFrame(frame) : 0;
  }

  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const NEUTRAL = [214, 214, 210], SQUEEZE = [169, 139, 245], STRETCH = [108, 200, 255], OVER = [255, 139, 107];

  function draw() {
    const { u, force, reactions } = st.result;
    const sagPx = 28 / SAG_REF; // the reference case sags 28 px; heavier loads sag more
    const pos = nodes.map(([x, y], i) => [X(x) + u[2 * i] * sagPx * anim.sag, Y(y) - u[2 * i + 1] * sagPx * anim.sag]);

    let worst = 0;
    bars.forEach((bar, i) => {
      const N = force[i];
      if (Math.abs(N) > Math.abs(force[worst])) worst = i;
      const t = Math.min(1, Math.abs(N) / FULL);
      const over = st.mode === 'experiment' && Math.abs(N) > CAPACITY;
      const hue = over ? OVER : N < 0 ? SQUEEZE : STRETCH;
      const c = mix(NEUTRAL, hue, anim.force * (0.3 + 0.7 * t));
      const line = barEls[i];
      const [a, b] = [pos[bar.a], pos[bar.b]];
      line.setAttribute('x1', a[0].toFixed(1)); line.setAttribute('y1', a[1].toFixed(1));
      line.setAttribute('x2', b[0].toFixed(1)); line.setAttribute('y2', b[1].toFixed(1));
      line.setAttribute('stroke', `rgb(${c})`);
      line.setAttribute('stroke-width', ((1.8 + anim.force * 4.6 * t) * ui).toFixed(2));

      // Chevrons: pointing in where a bar is squeezed, out where it is stretched.
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      const ang = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
      const d = Math.abs(N) < 1.5 ? '' : N < 0
        ? 'M-16 -4.5l5 4.5-5 4.5M16 -4.5l-5 4.5 5 4.5'
        : 'M-8 -4.5l-5 4.5 5 4.5M8 -4.5l5 4.5-5 4.5';
      chevEls[i].setAttribute('d', d);
      chevEls[i].setAttribute('transform', `translate(${mx.toFixed(1)} ${my.toFixed(1)}) rotate(${ang.toFixed(1)}) scale(${ui.toFixed(2)})`);
      chevEls[i].setAttribute('stroke', `rgb(${N < 0 ? SQUEEZE : STRETCH})`);
    });
    chevLayer.style.opacity = anim.chev.toFixed(3);

    // Labels sit on the side of the bridge away from the load.
    const lx = st.x > SPAN / 2 ? SPAN * 0.27 : SPAN * 0.73;
    const deckMid = (pos[DECK(Math.round(lx / PANEL))][1]);
    labelTop.setAttribute('x', X(lx)); labelTop.setAttribute('y', (deckMid - 16 * ui).toFixed(1));
    labelBottom.setAttribute('x', X(SPAN / 2)); labelBottom.setAttribute('y', (pos[LOW(2)][1] + 34 * ui).toFixed(1));
    labels.style.opacity = anim.labels.toFixed(3);

    // In the experiment, the bar doing the most work is marked.
    const showHardest = st.mode === 'experiment' ? 1 : 0;
    const hb = bars[worst];
    const ha = pos[hb.a], hbb = pos[hb.b];
    const below = hb.kind !== 'deck';
    const hx = (ha[0] + hbb[0]) / 2, hy = below ? Math.max(ha[1], hbb[1]) : Math.min(ha[1], hbb[1]);
    hardestLine.setAttribute('d', below ? `M${hx} ${hy + 8 * ui}V${hy + 24 * ui}` : `M${hx} ${hy - 8 * ui}V${hy - 24 * ui}`);
    hardestText.setAttribute('x', hx);
    hardestText.setAttribute('y', below ? hy + 40 * ui : hy - 30 * ui);
    hardestText.textContent = `Hardest: ${kN(force[worst])}`;
    hardest.style.opacity = showHardest;

    // The load.
    load.setAttribute('transform', `translate(${X(anim.x).toFixed(1)} ${(DECK_Y + sagAt(pos, anim.x)).toFixed(1)}) scale(${ui.toFixed(2)}) translate(0 ${-DECK_Y})`);
    loadText.textContent = `${Math.round(st.P)} kN`;

    // Joints, the free-body diagram and the support reactions (in depth).
    jointEls.forEach((g, i) => {
      g.setAttribute('transform', `translate(${pos[i][0].toFixed(1)} ${pos[i][1].toFixed(1)}) scale(${ui.toFixed(2)})`);
      g.classList.toggle('is-selected', i === st.joint);
    });
    jointLayer.style.opacity = anim.depth.toFixed(3);
    jointLayer.style.pointerEvents = st.mode === 'depth' ? 'auto' : 'none';
    drawFbd(pos, force, reactions);
    fbd.style.opacity = anim.depth.toFixed(3);
    reactionLayer.style.opacity = anim.depth.toFixed(3);
  }

  // How far the deck under the load has sagged on screen, so the load rides with it.
  function sagAt(pos, x) {
    const bay = Math.min(BAYS - 1, Math.floor(x / PANEL));
    const f = x / PANEL - bay;
    return (pos[DECK(bay)][1] * (1 - f) + pos[DECK(bay + 1)][1] * f) - DECK_Y;
  }

  function arrow(parent, x1, y1, x2, y2, cls) {
    const ang = Math.atan2(y2 - y1, x2 - x1);
    const h = 7 * ui;
    const p1 = [x2 - h * Math.cos(ang - 0.45), y2 - h * Math.sin(ang - 0.45)];
    const p2 = [x2 - h * Math.cos(ang + 0.45), y2 - h * Math.sin(ang + 0.45)];
    el('path', { d: `M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}M${p1[0].toFixed(1)} ${p1[1].toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}L${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`, class: cls }, parent);
  }

  function drawFbd(pos, force, reactions) {
    fbd.replaceChildren();
    reactionLayer.replaceChildren();
    if (st.mode !== 'depth' && anim.depth < 0.01) return;
    const j = st.joint;
    const [jx, jy] = pos[j];
    for (const [i, bar] of bars.entries()) {
      if (bar.a !== j && bar.b !== j) continue;
      const other = bar.a === j ? bar.b : bar.a;
      let ex = pos[other][0] - jx, ey = pos[other][1] - jy;
      const len = Math.hypot(ex, ey); ex /= len; ey /= len;
      const N = force[i];
      const L = (30 + Math.min(1, Math.abs(N) / FULL) * 36) * ui;
      const g0 = 10 * ui, g1 = 18 * ui;
      const cls = N < 0 ? 'fbd-arrow squeeze' : 'fbd-arrow stretch';
      // A stretched bar pulls the joint towards itself; a squeezed bar pushes it away.
      if (N >= 0) arrow(fbd, jx + ex * g0, jy + ey * g0, jx + ex * (g0 + L), jy + ey * (g0 + L), cls);
      else arrow(fbd, jx + ex * (g0 + L), jy + ey * (g0 + L), jx + ex * g0, jy + ey * g0, cls);
      // Values sit just past each arrow, nudged off the line (always upwards) so neighbours don't collide.
      let nx = -ey, ny = ex;
      if (ny > 0) { nx = -nx; ny = -ny; }
      const tx = jx + ex * (g1 + L) + nx * 10 * ui, ty = jy + ey * (g1 + L) + ny * 10 * ui + 4 * ui;
      const t = el('text', { x: tx.toFixed(1), y: ty.toFixed(1), 'text-anchor': 'middle', class: 'fbd-value' }, fbd);
      t.textContent = Math.abs(N).toFixed(1);
    }
    // The load handle's own arrow already shows the load on this joint; the table lists it.
    SUPPORTS.forEach((s, k) => {
      const [sx, sy] = pos[s];
      const dx = (k === 0 ? -34 : 34) * ui;
      arrow(reactionLayer, sx + dx, sy + 62 * ui, sx + dx, sy + 22 * ui, 'fbd-arrow reaction');
      const t = el('text', { x: sx + dx, y: sy + 80 * ui, 'text-anchor': 'middle', class: 'fbd-value reaction' }, reactionLayer);
      t.textContent = `${reactions[k].toFixed(1)} kN`;
    });
  }

  // ---------- the panel ----------

  function worstBar() {
    const { force } = st.result;
    let w = 0;
    force.forEach((N, i) => { if (Math.abs(N) > Math.abs(force[w])) w = i; });
    return w;
  }
  function bottomWorst() {
    const { force } = st.result;
    let w = -1;
    force.forEach((N, i) => { if (bars[i].kind === 'bottom' && (w < 0 || N > force[w])) w = i; });
    return w;
  }

  const panels = {
    brief: () => `
      <p>A load on the deck doesn’t stay in one place. The bridge’s frame turns it into pushes and pulls that travel along every bar to the supports.</p>
      <p>Some bars end up squeezed and others stretched, depending on where they sit.</p>
      <div class="check">
        <p class="check-q" id="check-q">Quick check: which part is being stretched?</p>
        <div class="check-options" role="group" aria-labelledby="check-q">
          <button type="button" data-answer="deck">The deck</button>
          <button type="button" data-answer="bottom">The bottom bars</button>
          <button type="button" data-answer="neither">Neither</button>
        </div>
        <p class="check-feedback" role="status"></p>
      </div>`,
    picture: () => `
      <p>Same bridge, with the forces drawn in. The thicker the line, the harder that bar is working.</p>
      <ul class="legend">
        <li><span class="swatch squeeze"></span><b>Squeezed</b> The deck, pushed together from both ends</li>
        <li><span class="swatch stretch"></span><b>Stretched</b> The bottom bars, pulled apart</li>
      </ul>
      <p class="aside">The sag is exaggerated so you can see it. A real deck would move a few millimetres.</p>
      <div class="feedback">
        <p>Does this make sense now?</p>
        <div class="feedback-options">
          <button type="button" data-feedback="clear">Yes, I see it</button>
          <button type="button" data-feedback="unclear">Not yet</button>
        </div>
      </div>`,
    experiment: () => `
      <p>Your turn. Drag the load along the deck and watch the forces follow it.</p>
      <p class="task"><span class="task-mark" aria-hidden="true"></span>Find the spot where the bottom bars work hardest.</p>
      <div class="meter" aria-live="polite"><span class="meter-label">Bottom bars, hardest</span><span class="meter-value" data-meter></span><span class="meter-bar"><span data-meter-fill></span></span></div>
      <label class="weight"><span>Load</span><input type="range" min="5" max="45" step="1" value="${Math.round(st.P)}" data-weight><output data-weight-out>${Math.round(st.P)} kN</output></label>
      <p class="task-result" data-result hidden></p>
      <button type="button" class="btn-why" data-why hidden>Why there?</button>`,
    depth: () => `
      <p>Every joint is in balance: the pushes, pulls and loads on it add up to zero, across and up. Engineers size each bar by working joint to joint.</p>
      <p class="task"><span class="task-mark" aria-hidden="true"></span>Tap any joint on the bridge to check its sums.</p>
      <div class="sums" data-sums></div>
      <p class="aside" data-reactions></p>`,
  };

  function renderPanel() {
    root.dataset.mode = st.mode;
    modeButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === st.mode)));
    body.classList.remove('is-in');
    body.innerHTML = panels[st.mode]();
    void body.offsetWidth;
    body.classList.add('is-in');
    updatePanel();
  }

  function updatePanel() {
    const { force, reactions } = st.result;
    load.setAttribute('aria-valuenow', st.x.toFixed(1));
    load.setAttribute('aria-valuetext', `Load at ${st.x.toFixed(1)} metres`);
    const w = worstBar();
    readout.textContent = st.mode === 'brief'
      ? `Load ${Math.round(st.P)} kN at ${st.x.toFixed(1)} m`
      : `Load ${Math.round(st.P)} kN at ${st.x.toFixed(1)} m · hardest bar: ${barName(bars[w]).toLowerCase()}, ${kN(force[w])} ${strain(force[w])}`;

    if (st.mode === 'experiment') {
      const b = bottomWorst();
      const meter = body.querySelector('[data-meter]');
      if (meter) {
        meter.textContent = `${barName(bars[b])} · ${kN(force[b])}`;
        body.querySelector('[data-meter-fill]').style.width = `${Math.min(100, (force[b] / FULL) * 100).toFixed(1)}%`;
      }
      const over = force.some((N) => Math.abs(N) > CAPACITY);
      const res = body.querySelector('[data-result]');
      if (res && over) {
        res.hidden = false;
        res.classList.add('is-warn');
        res.textContent = `Over ${CAPACITY} kN: a real bar this size would start to give way. It’s shown in coral.`;
      } else if (res && st.found) {
        res.hidden = false;
        res.classList.remove('is-warn');
        res.textContent = 'Mid-span. That’s where the bridge bends most, so the bottom bars stretch most.';
      } else if (res) res.hidden = true;
      const why = body.querySelector('[data-why]');
      if (why) why.hidden = !st.found;
    }

    if (st.mode === 'depth') {
      const j = st.joint;
      const rows = [];
      let sx = 0, sy = 0;
      const [jx, jy] = nodes[j];
      bars.forEach((bar, i) => {
        if (bar.a !== j && bar.b !== j) return;
        const other = bar.a === j ? bar.b : bar.a;
        const ex = (nodes[other][0] - jx) / bar.L, ey = (nodes[other][1] - jy) / bar.L;
        const fx = force[i] * ex, fy = force[i] * ey;
        sx += fx; sy += fy;
        rows.push([barName(bar), `${kN(force[i])} ${strain(force[i])}`, fx, fy]);
      });
      const p = st.result.loads.get(j) || 0;
      if (p > 0.05) { rows.push(['Load on the deck', kN(p), 0, -p]); sy -= p; }
      const si = SUPPORTS.indexOf(j);
      if (si >= 0) { rows.push(['Support', kN(reactions[si]), 0, reactions[si]]); sy += reactions[si]; }
      const num = (v) => `${v < -0.05 ? '−' : v > 0.05 ? '+' : ''}${Math.abs(v) < 0.05 ? '0.0' : Math.abs(v).toFixed(1)}`;
      const sums = body.querySelector('[data-sums]');
      if (sums) {
        sums.innerHTML = `
          <table>
            <caption>Joint ${j + 1}${j <= BAYS ? ', on the deck' : ', underneath'}</caption>
            <thead><tr><th scope="col">Force on the joint</th><th scope="col">Across</th><th scope="col">Up</th></tr></thead>
            <tbody>${rows.map((r) => `<tr><th scope="row">${r[0]}<span>${r[1]}</span></th><td>${num(r[2])}</td><td>${num(r[3])}</td></tr>`).join('')}</tbody>
            <tfoot><tr><th scope="row">Sum</th><td>${num(sx)}</td><td>${num(sy)}</td></tr></tfoot>
          </table>`;
      }
      const reac = body.querySelector('[data-reactions]');
      if (reac) reac.textContent = `The supports share the load by distance: ${kN(reactions[0])} on the left and ${kN(reactions[1])} on the right.`;
    }
  }

  function setMode(mode) {
    st.mode = mode;
    Object.assign(target, visuals[mode]);
    if (mode === 'depth') {
      const bay = Math.min(BAYS, Math.round(st.x / PANEL));
      st.joint = DECK(bay);
    }
    renderPanel();
    armHesitation();
    kick();
  }

  // ---------- the trace: what the tutor noticed, and what it changed ----------

  const stamp = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  function now() {
    return st.who === 'sim' ? st.clock : st.clock + (performance.now() - st.clockStart) / 1000;
  }
  function note(noticed, changed) {
    st.entries.push({ t: stamp(now()), noticed, changed });
    const li = document.createElement('li');
    li.className = 'trace-item';
    li.innerHTML = `<span class="trace-time">${st.entries.at(-1).t}</span><p class="trace-noticed"><span>Noticed</span>${noticed}</p><p class="trace-changed"><span>Changed</span>${changed}</p>`;
    list.appendChild(li);
    while (list.children.length > 5) list.firstElementChild.remove();
    [...list.children].forEach((item, i, all) => item.classList.toggle('is-latest', i === all.length - 1));
    requestAnimationFrame(() => li.classList.add('is-in'));
  }
  function adapt(noticed, changed, mode) {
    note(noticed, changed);
    if (mode && mode !== st.mode) setMode(mode);
  }

  // ---------- the rules ----------

  const answers = { deck: 'The deck', bottom: 'The bottom bars', neither: 'Neither' };
  function answer(choice) {
    if (st.answered) return;
    st.answered = true;
    const fb = body.querySelector('.check-feedback');
    body.querySelectorAll('[data-answer]').forEach((b) => {
      b.disabled = true;
      b.classList.toggle('is-picked', b.dataset.answer === choice);
      b.classList.toggle('is-right', b.dataset.answer === 'bottom');
    });
    if (choice === 'bottom') {
      if (fb) fb.textContent = 'Right: the bottom bars are stretched and the deck is squeezed.';
      later(() => adapt('Answered the check correctly, first time', 'Skipped the picture and went straight to trying it', 'experiment'), 1400);
    } else {
      if (fb) fb.textContent = 'Not quite. Here’s what’s actually happening.';
      later(() => adapt(`Answered “${answers[choice]}” for the stretched part`, 'Drew the forces on the bridge instead of describing them', 'picture'), 1100);
    }
  }
  function feedback(kind) {
    if (kind === 'clear') adapt('Said the picture made sense', 'Handed over the load: find where it’s worst', 'experiment');
    else adapt('Said the picture hadn’t clicked yet', 'Switched to trying it: move the load and watch', 'experiment');
  }
  function why() {
    adapt('Asked why, after finding the answer', 'Added the maths: balancing one joint at a time', 'depth');
  }
  function choose(mode) {
    if (mode === st.mode) return;
    adapt(`Chose “${MODES[mode].button}” directly`, 'Switched now, and will offer it first when this idea comes back', mode);
  }
  function moved() {
    st.moves += 1;
    if (st.mode === 'brief' || st.mode === 'picture') {
      adapt('Started moving the load without being asked', 'Turned the lesson into an experiment', 'experiment');
      return;
    }
    if (st.mode === 'experiment' && !st.found && Math.abs(st.x - SPAN / 2) <= 0.5 && st.moves >= 2) {
      st.found = true;
      note(`Found the worst spot, mid-span, after ${st.moves} moves`, 'Confirmed it, and offered the reason behind it');
      updatePanel();
    }
  }
  function overloadCheck() {
    if (st.overloaded || st.mode !== 'experiment') return;
    if (st.result.force.some((N) => Math.abs(N) > CAPACITY)) {
      st.overloaded = true;
      note('Pushed the load past what a bar can carry', 'Showed which bar would give way first');
    }
  }

  // A long pause on the check, with nothing else happening, is a signal too.
  let hesitation = 0;
  function armHesitation() {
    clearTimeout(hesitation);
    if (st.who !== 'you' || st.mode !== 'brief' || st.answered) return;
    hesitation = setTimeout(() => {
      if (st.mode === 'brief' && !st.answered && inView) adapt('Paused on the check for a while', 'Showed the forces as a picture to help', 'picture');
    }, 16000);
  }

  // ---------- input ----------

  function setLoad(x, { count = false } = {}) {
    st.x = Math.max(0, Math.min(SPAN, Math.round(x * 4) / 4));
    st.result = solve(st.x, st.P);
    updatePanel();
    overloadCheck();
    if (count) moved();
  }
  function animateLoadTo(x, ms) {
    return new Promise((resolve) => {
      const from = anim.x, start = performance.now();
      const step = (t) => {
        const k = Math.min(1, (t - start) / ms);
        const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
        anim.x = from + (x - from) * e;
        setLoad(anim.x);
        draw();
        if (k < 1 && st.who === 'sim') requestAnimationFrame(step);
        else { setLoad(x, { count: true }); anim.x = st.x; draw(); resolve(); }
      };
      requestAnimationFrame(step);
    });
  }

  let dragging = false;
  const toModel = (e) => {
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse());
    return (pt.x - OX) / SC;
  };
  load.addEventListener('pointerdown', (e) => {
    takeOver();
    dragging = true;
    load.setPointerCapture(e.pointerId);
    load.classList.add('is-dragging');
  });
  load.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    anim.x = Math.max(0, Math.min(SPAN, toModel(e)));
    setLoad(anim.x);
    draw();
  });
  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    load.classList.remove('is-dragging');
    anim.x = st.x;
    moved();
    draw();
  };
  load.addEventListener('pointerup', endDrag);
  load.addEventListener('pointercancel', endDrag);
  load.addEventListener('keydown', (e) => {
    const step = { ArrowLeft: -0.5, ArrowDown: -0.5, ArrowRight: 0.5, ArrowUp: 0.5 }[e.key];
    if (step === undefined && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    takeOver();
    const x = e.key === 'Home' ? 0 : e.key === 'End' ? SPAN : st.x + step;
    setLoad(x, { count: true });
    anim.x = st.x;
    draw();
  });

  jointEls.forEach((g, i) => {
    const pick = () => { takeOver(); st.joint = i; updatePanel(); draw(); };
    g.addEventListener('click', pick);
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
  });

  body.addEventListener('click', (e) => {
    const a = e.target.closest('[data-answer]');
    const f = e.target.closest('[data-feedback]');
    const w = e.target.closest('[data-why]');
    if (!a && !f && !w) return;
    if (e.isTrusted) takeOver();
    if (a) answer(a.dataset.answer);
    if (f) feedback(f.dataset.feedback);
    if (w) why();
  });
  body.addEventListener('input', (e) => {
    if (!e.target.matches('[data-weight]')) return;
    takeOver();
    st.P = Number(e.target.value);
    body.querySelector('[data-weight-out]').textContent = `${st.P} kN`;
    setLoad(st.x);
    draw();
  });
  modeButtons.forEach((b) => b.addEventListener('click', () => { takeOver(); choose(b.dataset.mode); }));
  root.addEventListener('pointerdown', () => armHesitation(), { passive: true });

  // Joints are reachable by keyboard only in depth.
  const syncJointFocus = () => jointEls.forEach((g) => g.setAttribute('tabindex', st.mode === 'depth' ? '0' : '-1'));
  new MutationObserver(syncJointFocus).observe(root, { attributes: true, attributeFilter: ['data-mode'] });

  // ---------- sessions ----------

  const pending = new Set();
  function later(fn, ms) {
    const id = setTimeout(() => { pending.delete(id); fn(); }, ms);
    pending.add(id);
  }
  const wait = (ms, token) => new Promise((resolve, reject) => {
    later(() => (token === st.session && st.who === 'sim' ? resolve() : reject(new Error('stopped'))), ms);
  });

  function reset(whoNow) {
    st.session += 1;
    for (const id of pending) clearTimeout(id);
    pending.clear();
    clearTimeout(hesitation);
    Object.assign(st, { who: whoNow, moves: 0, found: false, overloaded: false, answered: false, entries: [], P: 20, clock: 0, clockStart: performance.now() });
    who.textContent = whoNow === 'sim' ? 'Simulated learner' : 'You';
    root.classList.toggle('is-sim', whoNow === 'sim');
    list.replaceChildren();
    anim.x = 3;
    setLoad(3);
    setMode('brief');
    note('New topic, with nothing to go on yet', 'Opened with a short explanation and a quick check');
  }

  function takeOver() {
    if (st.who !== 'sim') return;
    st.session += 1;
    for (const id of pending) clearTimeout(id);
    pending.clear();
    st.clock = now();
    st.clockStart = performance.now();
    st.who = 'you';
    who.textContent = 'You';
    root.classList.remove('is-sim');
    note('You took over the lesson', 'Following your lead from here');
    armHesitation();
  }

  function press(selector) {
    const b = body.querySelector(selector) || root.querySelector(selector);
    if (!b) return;
    b.classList.add('is-pressed');
    later(() => b.classList.remove('is-pressed'), 420);
    b.click();
  }

  // A scripted learner: gets the check wrong, isn't helped by the picture alone, finds the answer
  // by experimenting, then asks why. Times on the trace are the session's, compressed for the demo.
  async function playSession() {
    reset('sim');
    const token = st.session;
    try {
      await wait(2800, token);
      st.clock = 38; press('[data-answer="deck"]');
      await wait(5200, token);
      st.clock = 71; press('[data-feedback="unclear"]');
      await wait(2200, token);
      for (const [x, ms, clock] of [[9.5, 1500, 96], [4, 1300, 104], [7.5, 900, 111], [6, 800, 118]]) {
        st.clock = clock;
        await animateLoadTo(x, ms);
        if (token !== st.session) return;
        await wait(350, token);
      }
      await wait(3000, token);
      st.clock = 151; press('[data-why]');
      await wait(3600, token);
      st.joint = LOW(2); updatePanel(); draw();
      await wait(2600, token);
      st.joint = DECK(3); updatePanel(); draw();
      await wait(1200, token);
      if (token === st.session) {
        st.clock = 175;
        note('Checked two joints and both balanced', 'Session complete. Your turn: everything here responds to you');
        st.who = 'you';
        st.clockStart = performance.now();
        who.textContent = 'You';
        root.classList.remove('is-sim');
      }
    } catch { /* the visitor took over */ }
  }

  replay.addEventListener('click', () => (REDUCED.matches ? reset('you') : playSession()));

  // Start the scripted session the first time the lesson comes into view.
  let inView = false, started = false;
  new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    if (inView && !started) {
      started = true;
      if (REDUCED.matches) reset('you');
      else playSession();
    }
  }, { threshold: 0.35 }).observe(root);

  // Scale the drawing's furniture up on narrow screens, and give the load handle room above.
  new ResizeObserver(() => {
    const s = svg.clientWidth / VB.w || 1;
    ui = Math.max(1, Math.min(2.6, 0.85 / s));
    svg.style.setProperty('--ui', ui.toFixed(3));
    const top = Math.min(0, Math.floor(DECK_Y - 112 * ui));
    const narrow = ui > 1.4; // the span dimension is dropped on phones to make room for the labels
    svg.classList.toggle('is-narrow', narrow);
    svg.setAttribute('viewBox', `0 ${top} ${VB.w} ${VB.h - (narrow ? 56 : 0) - top}`);
    draw();
  }).observe(svg);

  reset('sim');
  syncJointFocus();
}
