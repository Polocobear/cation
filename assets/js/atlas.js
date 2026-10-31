// CATION homepage, 04 · Subjects. The strip of sixteen facets is set out three times side by side, the page's own copy
// in the middle and a hidden copy to either side, so it runs on without end. The track moves as one piece: dragged or
// swiped, scrolled sideways, carried to whichever facet has focus, and drifting a little as the page scrolls past.
// Positions are in pixels: `user` is how far the reader has moved it, `drift` the scroll's share.

const strip = document.querySelector('.atlas-strip');

if (strip) {
  const track = strip.querySelector('.atlas-track');
  const set = track.querySelector('.atlas-set');
  const title = document.getElementById('atlas-title');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');

  for (const copy of [-1, 1]) {
    const twin = set.cloneNode(true);
    twin.style.setProperty('--copy', copy);
    twin.setAttribute('aria-hidden', 'true');
    twin.querySelector('.atlas-list').removeAttribute('aria-label');
    for (const a of twin.querySelectorAll('a')) a.tabIndex = -1;
    if (copy < 0) set.before(twin); else set.after(twin);
  }
  const links = [...set.querySelectorAll('.facet-link')];
  strip.classList.add('is-live');

  let b = 0;      // a facet's base
  let P = 0;      // the strip repeats every 4 bases
  let W = 0;      // the window onto it
  let home = 0;   // where Physics' left corner meets the heading's left edge
  let user = 0;
  let drift = 0;
  let frame = 0;
  let glide = 0;

  const measure = () => {
    const was = P;
    b = set.querySelector('.facet.is-apex').offsetWidth / 2;   // its box is two bases wide
    P = 4 * b;
    W = strip.clientWidth;
    // From the layout, not the painted box: the question in front of this section (gate.js) scales it while it nears.
    home = W / 2 - title.offsetLeft;
    if (was) user *= P / was;
  };

  // Each facet's centre along the track, so a label that would be cut by the edge of the window can step aside.
  const facets = [...track.querySelectorAll('.facet')].map((el) => {
    const copy = Number(el.closest('.atlas-set').style.getPropertyValue('--copy')) || 0;
    const j = Number(el.style.getPropertyValue('--j'));
    return { el, at: () => copy * P + (j + 1) * b / 2, off: false };
  });

  // How far into the page's own copy the middle of the window is: always between a quarter base and a period and a
  // quarter, so any of its facets, the last column included, can be brought to the middle; the twins cover the rest.
  const at = () => ((((home + user + drift - b / 4) % P) + P) % P) + b / 4;
  const render = () => {
    frame = 0;
    const x = W / 2 - at();
    track.style.transform = `translate3d(${x.toFixed(2)}px, 0, 0)`;
    const edge = Math.max(60, 0.16 * b);
    for (const f of facets) {
      const c = x + f.at();
      const off = c < edge || c > W - edge;
      if (off !== f.off) f.el.classList.toggle('is-off', (f.off = off));
    }
  };
  const schedule = () => { frame ||= requestAnimationFrame(render); };
  const stop = () => { cancelAnimationFrame(glide); glide = 0; };

  // A flick carries on and slows to a stop.
  const fling = (v) => {
    let last = performance.now();
    const step = (now) => {
      const dt = Math.min(48, now - last);
      last = now;
      user += v * dt;
      v *= Math.exp(-dt / 320);
      render();
      glide = Math.abs(v) > 0.02 ? requestAnimationFrame(step) : 0;
    };
    glide = requestAnimationFrame(step);
  };
  const glideTo = (target) => {
    stop();
    if (reduce.matches) { user = target; schedule(); return; }
    const from = user, start = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - start) / 750);
      user = from + (target - from) * (1 - (1 - k) ** 3);
      render();
      glide = k < 1 ? requestAnimationFrame(step) : 0;
    };
    glide = requestAnimationFrame(step);
  };

  // Dragging. Mostly-vertical movement is left to the page, so a swipe up or down still scrolls it.
  let drag = null;
  let dragged = false;
  strip.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    stop();
    dragged = false;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, from: user, on: false, trail: [[e.timeStamp, e.clientX]] };
  });
  strip.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    if (!drag.on) {
      if (Math.abs(dx) < 6 || Math.abs(dx) < Math.abs(e.clientY - drag.y)) return;
      drag.on = dragged = true;
      strip.setPointerCapture(e.pointerId);
      strip.classList.add('is-dragging');
    }
    user = drag.from - dx;
    drag.trail.push([e.timeStamp, e.clientX]);
    if (drag.trail.length > 6) drag.trail.shift();
    schedule();
  });
  const release = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const { on, trail } = drag;
    drag = null;
    if (!on) return;
    strip.classList.remove('is-dragging');
    const [t0, x0] = trail[0], [t1, x1] = trail[trail.length - 1];
    if (e.type !== 'pointerup' || reduce.matches || e.timeStamp - t1 > 80 || t1 <= t0) return;
    fling(Math.max(-4, Math.min(4, -(x1 - x0) / (t1 - t0))));
  };
  strip.addEventListener('pointerup', release);
  strip.addEventListener('pointercancel', release);
  // A drag that ends over a facet isn't a click on it.
  strip.addEventListener('click', (e) => { if (dragged) { e.preventDefault(); e.stopPropagation(); dragged = false; } }, true);
  strip.addEventListener('dragstart', (e) => e.preventDefault());

  // Sideways scrolling (a trackpad, or Shift with a wheel) moves the strip; vertical scrolling stays with the page.
  strip.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    e.preventDefault();
    stop();
    user += e.deltaX * (e.deltaMode === 1 ? 16 : 1);
    schedule();
  }, { passive: false });

  // Focus carries the strip to the facet, centring it, the short way round.
  strip.addEventListener('focusin', (e) => {
    const i = links.indexOf(e.target);
    if (i < 0) return;
    // The link fills the facet's whole box, which is wider than the facet; the facet is the middle base of it.
    const r = e.target.getBoundingClientRect(), c = r.left + r.width / 2;
    if (c - b / 2 >= W * 0.06 && c + b / 2 <= W * 0.94) return;
    const want = Math.floor(i / 2) * b / 2 + b / 2;
    const d = ((((want - at()) % P) + P * 1.5) % P) - P / 2;
    glideTo(user + d);
  });
  // A facet that grows from a corner (atlas.css) grows towards the middle of the window. The way is chosen as the
  // pointer comes in, not while it moves inside, so an open facet never turns round.
  const ready = (facet) => {
    if (!facet.classList.contains('is-corner')) return;
    const r = facet.getBoundingClientRect();
    facet.classList.toggle('grows-left', r.left + r.width / 2 > W / 2);
  };
  strip.addEventListener('pointerover', (e) => {
    const facet = e.target.closest('.facet');
    if (facet && e.pointerType === 'mouse' && !facet.contains(e.relatedTarget)) ready(facet);
  });
  strip.addEventListener('focusin', (e) => { const facet = e.target.closest('.facet'); if (facet) ready(facet); });

  // Left and right step along the strip; up and down cross between the rows.
  strip.addEventListener('keydown', (e) => {
    const i = links.indexOf(document.activeElement);
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: i % 2 ? 0 : 1, ArrowUp: i % 2 ? -1 : 0 }[e.key];
    if (i < 0 || step === undefined) return;
    e.preventDefault();
    links[(i + step + links.length) % links.length].focus({ preventScroll: true });
  });
  // overflow: clip can't be scrolled, but where it falls back to hidden, focus could scroll the strip itself.
  strip.addEventListener('scroll', () => { strip.scrollLeft = 0; });

  // The drift: a fifth of a period across the whole pass, none when the strip is centred in the window.
  let near = false;
  const onScroll = () => {
    if (!near || reduce.matches) { if (drift) { drift = 0; schedule(); } return; }
    const r = strip.getBoundingClientRect();
    drift = 0.2 * P * (innerHeight / 2 - (r.top + r.height / 2)) / (innerHeight + r.height);
    schedule();
  };
  new IntersectionObserver(([e]) => { near = e.isIntersecting; onScroll(); }, { rootMargin: '20% 0px' }).observe(strip);
  addEventListener('scroll', onScroll, { passive: true });

  // The facets arrive once, when a quarter of the strip is in view.
  const arrive = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    strip.classList.add('is-in');
    arrive.disconnect();
  }, { threshold: 0.25 });
  arrive.observe(strip);

  new ResizeObserver(() => { measure(); onScroll(); render(); }).observe(strip);
  measure();
  render();
}
