// What the prototype remembers on this device: the lesson's progress, the learning it adds to the activity record, the
// practice answers it adds to the Understanding Map, the questions asked of Q and the study room's notes. It all lives
// in localStorage, so it survives a reload and a trip back to the dashboard but never leaves the browser. Every read
// and write is guarded: in a private window, or with storage blocked, the prototype simply starts afresh each time.

const PREFIX = 'cation.';

// The one lesson built so far, and where it sits in its course: lesson 3 of chapter 2, the course's seventh.
export const LESSON = {
  course: 'inside-the-particle-zoo', courseTitle: 'Inside the Particle Zoo', chapter: 2, number: 3, of: 5, inCourse: 7,
  title: 'Can light turn into matter?', href: '#/lesson',
};

export function read(key, fallback) {
  try {
    const v = localStorage.getItem(PREFIX + key);
    return v == null ? fallback : JSON.parse(v);
  } catch { return fallback; }
}
export function write(key, value) {
  try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}
export function forget() {
  try { for (const k of Object.keys(localStorage)) if (k.startsWith(PREFIX)) localStorage.removeItem(k); } catch { /* nothing kept */ }
}

// Learning events recorded here, in the sample learner's shape: { at, kind }, kind being problem, practice or lesson.
export const events = () => read('events', []).map((e) => ({ at: new Date(e.at), kind: e.kind }));
export const record = (kind) => write('events', [...read('events', []), { at: Date.now(), kind }]);

// Practice answers by concept, 1 right and 0 wrong, appended to the sample record on the Understanding Map.
export const practice = () => read('practice', {});
export const answer = (concept, right) => {
  const all = practice();
  write('practice', { ...all, [concept]: (all[concept] || '') + (right ? '1' : '0') });
};

// The lesson's saved progress: the step reached (of 5) and, once finished, when.
export const lesson = () => ({ reached: 1, ...read('lesson', {}) });

// A summary that changes whenever something above does, so the home page knows when to draw itself again.
export const stamp = () => `${read('events', []).length}:${lesson().reached}:${lesson().completedAt || ''}:${JSON.stringify(practice())}`;
