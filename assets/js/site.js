// CATION: behaviour shared by every page (the phone menu, content easing in as it comes into view, and hiding
// any artwork that fails to load so its slot shows the plain fallback colour instead of a broken-image icon).

for (const img of document.images) {
  const hide = () => { img.style.visibility = 'hidden'; };
  if (img.complete && !img.naturalWidth && img.currentSrc) hide();
  else img.addEventListener('error', hide, { once: true });
}

const toggle = document.querySelector('.menu-toggle');
const sheet = document.getElementById('menu-sheet');

if (toggle && sheet) {
  const set = (open) => {
    document.body.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.querySelector('.visually-hidden').textContent = open ? 'Close menu' : 'Menu';
  };
  toggle.addEventListener('click', () => set(toggle.getAttribute('aria-expanded') !== 'true'));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('menu-open')) { set(false); toggle.focus(); }
  });
  sheet.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
  matchMedia('(min-width: 1080px)').addEventListener('change', () => set(false));
}

// Reveals (the motion is in base.css). Each [data-reveal] element eases in once, the first time it comes into view.
// Elements that arrive together follow one another in page order, 80ms apart. Anything first met from above, or while
// scrolling up (already scrolled past, or skipped by a link further down the page), is simply there, so scrolling back
// up never plays an entrance.
const reveals = [...document.querySelectorAll('[data-reveal]')];
document.documentElement.classList.add('has-reveals');

if (reveals.length) {
  const STEP = 80;
  const MOST = 8;
  const order = new Map(reveals.map((el, i) => [el, i]));
  // The first entrance waits for the typeface, so nothing re-wraps mid-motion, but never more than half a second.
  const fonts = Promise.race([document.fonts?.ready, new Promise((done) => setTimeout(done, 500))]);
  let lastY = scrollY;
  let rising = false;
  addEventListener('scroll', () => { rising = scrollY < lastY; lastY = scrollY; }, { passive: true });

  const io = new IntersectionObserver(async (entries) => {
    const arriving = [];
    for (const { target, isIntersecting, boundingClientRect: r } of entries) {
      if ((r.top < 0 && (isIntersecting || r.bottom < 0)) || (isIntersecting && rising)) {
        io.unobserve(target);
        target.classList.add('is-in', 'is-done');
      } else if (isIntersecting) {
        io.unobserve(target);
        arriving.push(target);
      }
    }
    if (!arriving.length) return;
    arriving.sort((a, b) => order.get(a) - order.get(b));
    await fonts;
    // The page may have moved while the typeface loaded (a link to a section lands a moment later): look again.
    const entering = arriving.filter((el) => {
      const r = el.getBoundingClientRect();
      if (r.bottom <= 0) el.classList.add('is-in', 'is-done');
      else if (r.top >= innerHeight) io.observe(el);
      else return true;
      return false;
    });
    entering.forEach((el, i) => {
      el.style.setProperty('--reveal-delay', `${Math.min(i, MOST) * STEP}ms`);
      el.classList.add('is-in');
      const running = el.getAnimations({ subtree: true }).filter((a) => a.animationName?.startsWith('reveal-'));
      Promise.allSettled(running.map((a) => a.finished)).then(() => el.classList.add('is-done'));
    });
  }, { rootMargin: '0px 0px -8% 0px' });

  for (const el of reveals) io.observe(el);
}
