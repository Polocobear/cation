// CATION homepage, the question in front of 04 · Subjects. The section is held in the window while it scrolls past,
// and how far it has scrolled sets where the viewpoint is: at rest it looks at "Every discovery begins with a ?", then
// it moves into the "?" and through its dot. The "?" is a window with a light behind it. Nearer things grow faster
// than farther ones: the words, the outline and its light sit on one plane, growing past the edges of the window,
// while the subjects section (atlas.css, atlas.js), as it is, sits further back, seen only through the glyph's
// hollow, and comes forward more slowly, out of the light, until the dot has opened past every edge and the section is
// the whole scene. Everything follows the scroll position, so it plays backwards, and at any speed.

const gate = document.querySelector('.gate');

if (gate) {
  const stage = gate.querySelector('.gate-stage');
  const plane = gate.querySelector('.gate-plane');
  const title = gate.querySelector('.gate-title');
  const box = gate.querySelector('.gate-mark-box');
  const svgs = [...gate.querySelectorAll('.gate-glow, .gate-line')];
  const paths = [...gate.querySelectorAll('.gate-glow path, .gate-line path')];
  const rim = gate.querySelector('.gate-rim');
  const win = gate.querySelector('.gate-window');
  const depth = gate.querySelector('.gate-depth');
  const fog = gate.querySelector('.gate-fog');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');

  // The glyph in its own units: Satoshi Black's "?", 1000 to the em, turned the right way up with its top left at the
  // origin. The dot is a circle; the viewpoint ends at its centre.
  const GLYPH_H = 767;
  const DOT = { x: 237, y: 676.5, r: 91 };
  const glyph = paths[0].getAttribute('d').match(/[MLQZ][^MLQZ]*/g)
    .map((s) => [s[0], s.slice(1).trim().split(/\s+/).filter(Boolean).map(Number)]);
  // The glyph's outline in window pixels, for the clip that lets the subjects show only through the hollow.
  const outline = (ox, oy, k) => glyph.map(([c, n]) => {
    let s = c;
    for (let i = 0; i < n.length; i += 2) s += `${(ox + n[i] * k).toFixed(1)} ${(oy + n[i + 1] * k).toFixed(1)} `;
    return s;
  }).join('');

  // The light, behind the window and up to its right, in glyph units. It fills the hollow as it fills a lit pane (the
  // fog, below) and streams out past the outline, away from itself. The streaming is drawn as "capability." in section
  // 03 draws its rays (route.js): copies of the outline, each scaled a little further out from the light, blurred and
  // fainter, over a soft beam of filled copies, with the accent's glow close in and wide. It is drawn once, at three
  // quarters of the screen's resolution since all of it is blurred, and moves with the words.
  const LIGHT = { x: 700, y: 110 };
  const REACH = [-1100, -300, 780, 1900]; // where the light can reach, in glyph units: left, top, right, bottom
  const rays = plane.insertBefore(document.createElement('canvas'), plane.firstChild);
  rays.className = 'gate-rays';
  rays.setAttribute('aria-hidden', 'true');
  const colours = [...gate.querySelectorAll('#gate-light stop')].map((n) => [Number(n.getAttribute('offset')), n.getAttribute('stop-color')]);
  const drawRays = () => {
    const [x0, y0, x1, y1] = REACH;
    const r = 0.75 * u; // canvas pixels per glyph unit
    Object.assign(rays.style, { left: `${bx + x0 * u}px`, top: `${by + y0 * u}px`, width: `${(x1 - x0) * u}px`, height: `${(y1 - y0) * u}px` });
    rays.width = Math.round((x1 - x0) * r);
    rays.height = Math.round((y1 - y0) * r);
    const ctx = rays.getContext('2d');
    // Without canvas blur the copies would show as steps, so the outline keeps only its own glow.
    if (!('filter' in ctx)) return;
    const shape = new Path2D(paths[0].getAttribute('d'));
    const light = ctx.createLinearGradient(0, 0, 515, 0);
    for (const [at, c] of colours) light.addColorStop(at, c);
    const width = line0 / u;
    const copy = (s, alpha, blur, fill, w = width) => {
      ctx.setTransform(r * s, 0, 0, r * s, (LIGHT.x * (1 - s) - x0) * r, (LIGHT.y * (1 - s) - y0) * r);
      ctx.globalAlpha = alpha;
      ctx.filter = `blur(${(blur * r).toFixed(1)}px)`;
      if (fill) { ctx.fillStyle = light; ctx.fill(shape); return; }
      ctx.strokeStyle = light;
      ctx.lineWidth = w;
      ctx.lineJoin = 'round';
      ctx.stroke(shape);
    };
    // The beam: the hollow carried out towards us, many faint filled copies, so it reads as a shaft of light, not a blur.
    for (let i = 1; i <= 72; i++) { const f = i / 72; copy(1 + 1.5 * f, 0.016 * (1 - f) ** 1.3, 2 + 16 * f, true); }
    // The rays off the outline, as "capability."'s.
    for (let i = 1; i <= 20; i++) { const f = i / 20; copy(1 + 0.18 * f, 0.34 * (1 - f) ** 1.5 + 0.02, 1 + 5 * f, false); }
    // The accent's glow, close and wide.
    copy(1, 0.38, 30, false);
    copy(1, 0.18, 110, false, 2 * width);
  };
  let drawn = '', later = 0;
  const lightUp = () => {
    if (!live || drawn === `${W}x${H}`) return;
    clearTimeout(later);
    later = setTimeout(() => { drawn = `${W}x${H}`; drawRays(); }, drawn ? 200 : 0);
  };

  const clamp = (x) => Math.min(1, Math.max(0, x));
  const smooth = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);

  let W = 0, H = 0, run = 1, bx = 0, by = 0, u = 1, line0 = 4, far = 1;
  let live = false, frame = 0, last = -1;

  const measure = () => {
    W = stage.clientWidth;
    H = stage.clientHeight;
    run = Math.max(1, gate.offsetHeight - H);
    bx = box.offsetLeft;
    by = box.offsetTop;
    u = box.offsetHeight / GLYPH_H;
    // The outline in the accent's proportion to its letter: --gate-line ems, at 1000 units to the em.
    line0 = parseFloat(getComputedStyle(gate).getPropertyValue('--gate-line')) * 1000 * u;
    // How large the dot must grow, centred, to cover the window.
    far = Math.hypot(W / 2, H / 2) / (DOT.r * u);
  };

  const draw = () => {
    frame = 0;
    const t = clamp(-gate.getBoundingClientRect().top / run);
    if (t === last) return;
    last = t;

    // A short hold at either end; between them the scale rises evenly in proportion, as a steady approach looks.
    // With Reduce Motion the viewpoint stays where it is.
    const still = reduce.matches;
    const k = still ? 0 : ease(clamp((t - 0.06) / 0.8));
    const S = (far * 1.7) ** k;
    const Cx = W / 2, Cy = H / 2;
    const Dx = bx + DOT.x * u, Dy = by + DOT.y * u;
    // The viewpoint turns towards the dot as it closes in, so the dot arrives at the middle of the window.
    const aim = 1 - (1 - k) / S;
    const Fx = Cx + (Dx - Cx) * aim, Fy = Cy + (Dy - Cy) * aim;

    // The near plane: the words and the outline. A point p at rest appears at C + (p − F) · S.
    plane.style.transform = k ? `translate(${(Cx - Fx * S).toFixed(2)}px, ${(Cy - Fy * S).toFixed(2)}px) scale(${S.toFixed(4)})` : '';
    // Left to the reveal (site.js) until the viewpoint moves.
    const fade = smooth(1.02, 1.8, S);
    title.style.opacity = fade ? 1 - fade : '';
    const ox = Cx + (bx - Fx) * S, oy = Cy + (by - Fy) * S, kk = u * S;
    // Nearer, the outline widens, but more slowly than the glyph, so the opening stays a line of light, not a band.
    const line = line0 * S ** 0.35;
    const vb = `${(-ox / kk).toFixed(3)} ${(-oy / kk).toFixed(3)} ${(W / kk).toFixed(3)} ${(H / kk).toFixed(3)}`;
    for (const s of svgs) s.setAttribute('viewBox', vb);
    for (const p of paths) p.setAttribute('stroke-width', (line / kk).toFixed(3));
    // The accent's glow is twice its outline's width.
    gate.style.setProperty('--glow', `${Math.min(64, line * 2).toFixed(1)}px`);
    // The pane: the light behind the window, seen through its hollow.
    gate.style.setProperty('--pane-x', `${(ox + LIGHT.x * kk).toFixed(1)}px`);
    gate.style.setProperty('--pane-y', `${(oy + LIGHT.y * kk).toFixed(1)}px`);
    gate.style.setProperty('--pane-r', `${(900 * kk).toFixed(1)}px`);

    if (still) {
      // The question gives way to the subjects in place.
      const f = smooth(0.35, 0.6, t);
      plane.style.opacity = 1 - f;
      for (const s of svgs) s.style.opacity = 1 - f;
      gate.classList.toggle('is-open', f > 0.5);
      win.style.clipPath = f > 0.5 ? 'none' : 'inset(50%)';
      depth.style.transform = '';
      depth.style.visibility = '';
      fog.style.opacity = 1 - f;
      rays.style.opacity = rim.style.opacity = '';
      return;
    }
    plane.style.opacity = '';
    for (const s of svgs) s.style.opacity = '';
    // Going in, the light's streaming and the bright rim give way first; the pane's light thins with the dark.
    rays.style.opacity = (1 - smooth(1.05, 2.4, S)).toFixed(3);
    rim.style.opacity = (1 - smooth(1.1, 1.9, S)).toFixed(3);

    // Through: the dot's hollow covers every corner of the window.
    const dx = ox + DOT.x * kk, dy = oy + DOT.y * kk;
    const open = Math.hypot(Math.max(dx, W - dx), Math.max(dy, H - dy)) < DOT.r * kk - line;
    gate.classList.toggle('is-open', open);
    win.style.clipPath = open ? 'none' : `path('${outline(ox, oy, kk)}')`;

    // The far plane: the subjects, which start at three-eighths of their size and arrive at their own, and come out of
    // the dark as they near.
    const E = 0.375 ** (1 - k);
    gate.classList.toggle('is-moving', k > 0 && k < 1);
    depth.style.transform = k < 1 ? `translate(${((Dx - Fx) * E).toFixed(2)}px, ${((Dy - Fy) * E).toFixed(2)}px) scale(${E.toFixed(4)})` : '';
    const dark = 1 - smooth(1.2, 7, S);
    fog.style.opacity = dark.toFixed(3);
    depth.style.visibility = dark > 0.995 ? 'hidden' : '';
  };
  const schedule = () => { if (live) frame ||= requestAnimationFrame(draw); };

  // Only drawn while the section is near the window.
  new IntersectionObserver(([e]) => { live = e.isIntersecting; last = -1; lightUp(); schedule(); }, { rootMargin: '25% 0px' }).observe(gate);
  addEventListener('scroll', schedule, { passive: true });
  reduce.addEventListener('change', () => { last = -1; schedule(); });
  new ResizeObserver(() => { measure(); lightUp(); last = -1; schedule(); }).observe(stage);

  // A key that reaches the subjects before the viewpoint is through carries the page to the end of the approach.
  win.addEventListener('focusin', () => {
    if (gate.classList.contains('is-open')) return;
    scrollTo({ top: scrollY + gate.getBoundingClientRect().top + run, behavior: 'instant' });
  });

  // In the page the outline sits in the space it stands in, for anyone without the script; here it is drawn over the
  // whole stage instead, under and over the window onto the subjects, so it can grow past the edges.
  win.before(svgs[0]);
  win.after(svgs[1]);
  gate.classList.add('is-live');
  measure();
}
