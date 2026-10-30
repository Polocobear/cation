// The two figures beneath the lesson. Both are data attributes on .pz-proof: data-cut, the per cent less time to
// mastery, and data-retain, how many times more is remembered a month later. The numbers, the bars and their
// descriptions all follow from them. The bars grow once, as the figures come into view.
const el = document.querySelector('.pz-proof');
if (el) {
  const cut = Math.max(0, Math.min(90, Number(el.dataset.cut) || 0));
  const retain = Math.max(1, Number(el.dataset.retain) || 1);
  const fig = (k) => el.querySelector(`[data-fig="${k}"]`);
  const bars = (k) => [...el.querySelectorAll(`[data-group="${k}"] .pz-bar`)];
  const set = (bar, v, label) => { bar.querySelector('.pz-bar-fill').style.setProperty('--v', v); bar.querySelector('.pz-bar-value').textContent = label; };
  fig('cut').textContent = String(cut);
  fig('retain').textContent = String(retain);
  const [slow, fast] = bars('cut');
  set(slow, 1, '100');
  set(fast, (100 - cut) / 100, String(100 - cut));
  const [once, kept] = bars('retain');
  set(once, 1 / retain, '1×');
  set(kept, 1, `${retain}×`);
  el.querySelector('[data-group="cut"]').setAttribute('aria-label', `Time to mastery: conventional learning 100, with CATION ${100 - cut}.`);
  el.querySelector('[data-group="retain"]').setAttribute('aria-label', `Remembered a month later: conventional learning 1 times, with CATION ${retain} times.`);
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el.classList.add('is-pending');
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      el.classList.remove('is-pending');
    }, { threshold: 0.4 });
    io.observe(el);
  }
}
