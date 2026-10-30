// CATION · "Can sound cancel sound?" — the controls: the phase slider for source B, revealed in the lesson's
// last beat, and a small pause button in the corner. Mounting them starts the lesson (lesson.js) and the
// annotations (annotate.js); all of them drive the scene through window.wave (prototype.js).

import { runLesson } from './lesson.js';
import { mountAnnotations, response } from './annotate.js';

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ICON = {
  play: '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.6v8.8L10.2 6z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.6 1.8h2.2v8.4H2.6zM7.2 1.8h2.2v8.4H7.2z" fill="currentColor"/></svg>',
};
const SNAP = [0, 90, 180, 270, 360];  // a dragged slider settles onto these when it lands within 3° (keys step freely)

export function mount(wave) {
  const root = document.createElement('div');
  root.className = 'xp';
  root.innerHTML = `
    <div class="xp-bottom">
      <label class="xp-phase">
        <span class="xp-label">Phase of B</span>
        <span class="xp-slider">
          <input type="range" min="0" max="360" step="1" value="0">
          <span class="xp-ticks" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>
        </span>
        <output aria-hidden="true">0°</output>
      </label>
    </div>
    <button type="button" class="xp-play"></button>`;
  document.body.append(root);

  const $ = (sel) => root.querySelector(sel);
  const slider = $('input');
  const readout = $('output');
  const phaseCtl = $('.xp-phase');
  const playBtn = $('.xp-play');

  const lesson = runLesson(wave, { reduced: REDUCED });
  mountAnnotations(root, wave, lesson);

  // ---------- the slider: it shows the lesson's phase, and in the last beat it is the visitor's ----------

  let shownPhase = -1, open = null;
  function show(deg) {
    if (deg === shownPhase) return;
    shownPhase = deg;
    if (+slider.value !== deg) slider.value = deg;
    readout.textContent = `${deg}°`;
    slider.style.setProperty('--fill', `${(deg / 360) * 100}%`);
    slider.setAttribute('aria-valuetext', `${deg} degrees: ${response(deg).toLowerCase()} at the midpoint`);
  }
  lesson.onChange(({ beat, phase }) => {
    show(Math.round(phase));
    const isOpen = beat === 'try';
    if (isOpen !== open) {
      open = isOpen;
      phaseCtl.inert = !isOpen;  // out of the tab order until it is shown
      root.classList.toggle('is-trying', isOpen);
    }
  });

  let keyed = false;
  slider.addEventListener('keydown', () => { keyed = true; });
  slider.addEventListener('pointerdown', () => { keyed = false; });
  slider.addEventListener('input', () => {
    let v = +slider.value;
    const near = keyed ? undefined : SNAP.find((p) => Math.abs(v - p) <= 3);
    if (near !== undefined && near !== v) { v = near; slider.value = v; }
    lesson.setUserPhase(v);
  });

  // ---------- pause ----------

  function setPlaying(p) {
    wave.setPlaying(p);
    playBtn.innerHTML = p ? ICON.pause : ICON.play;
    playBtn.setAttribute('aria-label', p ? 'Pause the waves' : 'Play the waves');
  }
  playBtn.addEventListener('click', () => setPlaying(!wave.playing));
  setPlaying(wave.playing);

  wave.lesson = lesson;
}
