// CATION · "Can sound cancel sound?" — the annotations over the scene: a label for each source, the listening
// point at the midpoint, and the captions along the bottom. They follow the camera (wave.project, every
// frame) and the lesson's beats (lesson.js); the surface itself is drawn by the shaders.
//
// The listening point is a dot that rides the surface: its height is the field's own height there
// (field.js, the same formula and clock as the shader), drawn between two short marks at the surface's
// rest level. In step it rises and falls past the marks; opposite, it stays on them.

import { WAVE, MIDPOINT, sample, gain } from './field.js';

const CAPTIONS = {
  add: 'Here, the waves move together. Their effects add.',
  cancel: 'Now they move in opposite directions. At this point, they cancel.',
  try: 'Try changing the phase yourself.',
  still: 'In step, the waves add here. Half a cycle apart, they cancel. Try changing the phase yourself.',
};
const PAD = 14;  // px between a label and the frame's edge

// The listening point's word: how its swing compares with one wave alone.
export function response(phaseDeg) {
  const g = gain(MIDPOINT.x, MIDPOINT.z, (phaseDeg * Math.PI) / 180);
  return g <= 0.15 ? 'Quiet' : g > 1 ? 'Stronger' : 'Weaker';
}

export function mountAnnotations(root, wave, lesson) {
  const el = (tag, cls, html = '') => Object.assign(document.createElement(tag), { className: cls, innerHTML: html });
  const labelA = el('p', 'xp-src', '<i aria-hidden="true">←</i>Source A');
  const labelB = el('p', 'xp-src', 'Source B<i aria-hidden="true">→</i>');
  const point = el('div', 'xp-point', '<span class="xp-level"></span><span class="xp-dot"></span><span class="xp-word"></span>');
  const word = point.querySelector('.xp-word');
  const dot = point.querySelector('.xp-dot');
  const captions = el('div', 'xp-captions');
  const lines = {};
  for (const [id, text] of Object.entries(CAPTIONS)) {
    lines[id] = el('p', 'xp-cap', text);
    captions.append(lines[id]);
  }
  const meta = el('p', 'xp-meta', 'Source B <b>0°</b> out of step');
  const metaDeg = meta.querySelector('b');
  // Screen readers hear each caption once, as it changes; the visible lines cross-fade.
  const live = el('p', 'xp-vh');
  live.setAttribute('aria-live', 'polite');
  for (const n of [labelA, labelB, point, captions, meta]) n.setAttribute('aria-hidden', 'true');
  root.querySelector('.xp-bottom').prepend(captions, meta);
  root.prepend(labelA, labelB, point);
  root.append(live);

  // ---------- the source labels: beside each source, or pinned to the frame's edge once it is out of view ----------

  const s = WAVE.separation / 2;
  function place(label, x, side) {
    const p = wave.project(x, 0);
    const W = window.innerWidth, w = label.offsetWidth, h = label.offsetHeight;
    const gap = Math.max(24, Math.abs(wave.project(x + 0.17, 0).x - p.x));
    const off = side < 0 ? p.x < 0 : p.x > W;
    let left = side < 0 ? p.x - gap - w : p.x + gap;
    left = Math.min(Math.max(left, PAD), W - PAD - w);
    const top = Math.min(Math.max(p.y - h / 2, PAD), window.innerHeight - PAD - h);
    label.classList.toggle('is-off', off);
    label.style.transform = `translate(${left.toFixed(1)}px, ${top.toFixed(1)}px)`;
  }

  // ---------- the listening point ----------

  function placePoint() {
    const h = sample(MIDPOINT.x, MIDPOINT.z, wave.time, wave.phase).h * wave.lift;
    const rest = wave.project(MIDPOINT.x, MIDPOINT.z, 0);
    const now = wave.project(MIDPOINT.x, MIDPOINT.z, h);
    point.style.transform = `translate(${rest.x.toFixed(1)}px, ${rest.y.toFixed(1)}px)`;
    dot.style.transform = `translateY(${(now.y - rest.y).toFixed(2)}px)`;
  }

  // ---------- the beats ----------

  let shown = '', said = '';
  function caption(beat, phase, guided) {
    if (!guided) return 'still';
    if (beat === 'add') return 'add';
    // While B turns, the captions step aside (neither is true half way) and the line below says how far it has gone.
    if (beat === 'shift') return phase < 15 ? 'add' : phase < 165 ? '' : 'cancel';
    if (beat === 'cancel') return 'cancel';
    if (beat === 'try') return 'try';
    return '';
  }

  lesson.onChange(({ beat, phase, guided }) => {
    const c = wave.view.toFixed(3);
    if (c !== root.style.getPropertyValue('--close')) root.style.setProperty('--close', c);
    if (root.dataset.beat !== beat) root.dataset.beat = beat;
    const cap = caption(beat, phase, guided);
    if (cap !== shown) {
      for (const [id, line] of Object.entries(lines)) line.classList.toggle('is-on', id === cap);
      shown = cap;
      if (cap && CAPTIONS[cap] !== said) live.textContent = said = CAPTIONS[cap];
    }
    const deg = `${Math.round(phase)}°`;
    if (metaDeg.textContent !== deg) metaDeg.textContent = deg;
    const w = beat === 'observe' || beat === 'approach' ? 'Midpoint' : response(phase);
    if (word.textContent !== w) word.textContent = w;
  });

  function update() {
    place(labelA, -s, -1);
    place(labelB, s, 1);
    placePoint();
  }
  wave.onFrame(update);
  window.addEventListener('resize', () => requestAnimationFrame(update));
  update();
}
