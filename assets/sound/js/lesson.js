// CATION · "Can sound cancel sound?" — the lesson: what the scene shows at each point of the page's scroll.
//
// The section pins the experiment while the visitor scrolls through it (assets/css/home-sections.css), and
// the scroll progress through that pinned stretch, 0 to 1, drives the lesson in beats:
//
//   observe   the wide, low shot of both sources
//   approach  the camera moves in to the midpoint between them
//   add       the two waves arrive in step: the midpoint swings twice as far as either wave alone
//   shift     source B's phase turns from 0° to 180°, and the midpoint's swing shrinks to nothing
//   cancel    the waves arrive in opposite directions and cancel at the midpoint
//   try       the phase slider is the visitor's
//
// Scrolling sets where the lesson is going; the scene follows it smoothly (fast scrolling or a jump just
// moves it there sooner). The waves keep running throughout, independently of the scroll. Once the visitor
// moves the slider, the phase is theirs until they scroll back above the last beat, when the guided phase
// takes over again from wherever they left it.

import { MIDPOINT, crestTime } from './field.js';

export const BEATS = [
  ['observe', 0],
  ['approach', 0.08],
  ['add', 0.38],
  ['shift', 0.54],
  ['cancel', 0.74],
  ['try', 0.86],
];
const RELEASE = 0.8;  // scrolling back above this hands the phase back to the lesson

export const beatAt = (p) => BEATS.reduce((id, [name, at]) => (p >= at ? name : id), 'observe');
// Camera: 0 = Observe, 1 = Close.
export const cameraAt = (p) => smoother(0.08, 0.36, p);
// The phase the lesson sets for source B (degrees).
export const guidedPhase = (p) => 180 * smoother(0.54, 0.72, p);
// The quiet zones' gold (shaders.js) comes up as B's phase starts to turn, so the visitor sees the quiet line
// slide onto the midpoint, and stays for the visitor's own turn.
export const goldAt = (p) => smoother(0.5, 0.68, p);

export function smoother(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * t * (t * (t * 6 - 15) + 10);
}

// Where the page has scrolled to, through the pinned stretch: the experiment's frame sits in a pinned box
// ([data-lesson-pin]) inside a taller track ([data-lesson-track]); progress is how far the pin has travelled
// down the track. Null when the scene is not embedded that way (the standalone page).
function scrollSource() {
  let pin, track;
  try {
    pin = window.frameElement?.closest('[data-lesson-pin]');
    track = pin?.closest('[data-lesson-track]');
  } catch {
    return null;
  }
  if (!pin || !track) return null;
  // Not pinned (reduced motion, or a screen too short to pin): the lesson opens on its last beat.
  return () => {
    const t = track.getBoundingClientRect(), p = pin.getBoundingClientRect();
    const run = t.height - p.height;
    return run > 1 ? { progress: Math.min(1, Math.max(0, (p.top - t.top) / run)), pinned: true } : { progress: 1, pinned: false };
  };
}

export function runLesson(wave, { reduced = false } = {}) {
  const q = new URLSearchParams(location.search);
  const fromScroll = reduced ? null : scrollSource();
  // guided: the scroll walks the visitor through the beats. Otherwise the scene opens on the last beat, and
  // the captions explain it in one line (annotate.js).
  let { progress: goal, pinned: guided } = fromScroll ? fromScroll() : { progress: +(q.get('progress') ?? 0), pinned: true };
  if (reduced) { goal = 1; guided = false; }
  let p = goal;            // where the scene is (eases toward goal)
  let user = null;         // the visitor's phase (degrees), while it is theirs
  let phase = guidedPhase(p);
  let handBack = 0;        // after the visitor's phase is released, it eases back to the guided one
  let handFrom = 0;
  const listeners = [];

  // Unguided, the scene opens in step, with the slider already the visitor's: the one-line caption reads in
  // that order (in step they add, opposite they cancel). With reduced motion the waves also start paused, at
  // the moment the midpoint is at a crest: in step it stands raised, and opposite it lies flat, so the
  // difference shows in a still frame too.
  if (!guided) user = 0;
  if (reduced) {
    wave.setPlaying(false);
    wave.setTime(crestTime(MIDPOINT.x, MIDPOINT.z));
  }

  function tick(dt) {
    if (fromScroll) ({ progress: goal, pinned: guided } = fromScroll());
    // A critically damped follow: smooth on wheel steps and jumps, and settled within half a second.
    const k = 1 - Math.exp(-dt * 7);
    p = Math.abs(goal - p) < 1e-4 ? goal : p + (goal - p) * k;
    if (user !== null && goal < RELEASE) {
      handFrom = user;
      handBack = 1;
      user = null;
    }
    const lead = guidedPhase(p);
    if (user !== null) phase = user;
    else {
      handBack = Math.max(0, handBack - dt / 0.6);
      phase = lead + (handFrom - lead) * handBack * handBack * (3 - 2 * handBack);
    }
    wave.setView(cameraAt(p));
    wave.setGold(goldAt(p));
    wave.setPhaseDegrees(phase);
    const state = { p, beat: beatAt(p), phase, user: user !== null, guided };
    for (const f of listeners) f(state);
  }
  wave.onTick(tick);
  tick(0);

  return {
    get progress() { return p; },
    get beat() { return beatAt(p); },
    get phase() { return phase; },
    // The visitor's own phase (degrees), from the slider. Only in the last beat.
    setUserPhase(d) {
      if (beatAt(p) !== 'try') return;
      user = d;
      handBack = 0;
      tick(0);
    },
    // For review and the standalone page: go to a point of the lesson (it eases there).
    setProgress(v) { goal = Math.min(1, Math.max(0, v)); },
    onChange(f) { listeners.push(f); f({ p, beat: beatAt(p), phase, user: user !== null, guided }); },
  };
}
