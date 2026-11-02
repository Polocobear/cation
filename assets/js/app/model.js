// The dashboard's model: the catalogue joined to the learner's records, with everything the views show worked out
// here rather than stored, so a real record only has to say what happened (lessons finished, answers given, learning
// actions taken) and the rest follows. The records are the sample learner for now (data/sample-learner.js).
// Every module of the app is imported with the same ?v= stamp, so a release never mixes old and new files.

import { catalogue } from './data/catalogue.js?v=20261102-2';
import { paths } from './data/paths.js?v=20261102-2';
import * as learnerData from './data/sample-learner.js?v=20261102-2';

// Site links are written root-relative, as in the site's own pages, and resolved against the site's root, which the
// page names in <link rel="home"> (a hosted copy may live below the root of its domain).
const root = new URL('.', document.querySelector('link[rel="home"]')?.href || location.origin + '/');
export const url = (path) => (/^[a-z]+:/i.test(path) ? path : new URL(path.replace(/^\//, ''), root).href);

const disciplines = new Map(catalogue.disciplines.map((d) => [d.slug, d]));
const subjects = new Map(catalogue.subjects.map((s) => [s.slug, s]));
const courses = new Map(catalogue.courses.map((c) => [c.slug, c]));

export const today = new Date();
export const dayOffset = (n) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + n);

// ---------------------------------------------------------------- mastery

// A concept's state from its practice record, newest answers last. The rule is the prototype's, written down so it
// can be checked and changed: at least eight answers with 85% of the last eight right is mastered; at least four with
// under 60% of the last eight right needs review; no answers is not started; anything else is developing.
export const STATES = {
  mastered: 'Mastered',
  developing: 'Developing',
  review: 'Needs review',
  new: 'Not started',
};
export const MASTERY_RULE = 'Mastered at 85% of the last 8 practice answers; needs review under 60%.';

export function stateOf(record) {
  if (!record.length) return 'new';
  const recent = record.slice(-8);
  const right = [...recent].filter((a) => a === '1').length / recent.length;
  if (record.length >= 8 && right >= 0.85) return 'mastered';
  if (record.length >= 4 && right < 0.6) return 'review';
  return 'developing';
}

// ---------------------------------------------------------------- courses

function progress(course, done) {
  const total = course.modules.reduce((n, m) => n + m.lessons, 0);
  let left = done, module = 0;
  while (module < course.modules.length - 1 && left >= course.modules[module].lessons) left -= course.modules[module++].lessons;
  const status = done === 0 ? 'new' : done >= total ? 'complete' : 'active';
  return {
    total, done, status,
    percent: Math.round((done / total) * 100),
    module,                                          // the module in progress (or the last, once complete)
    lesson: Math.min(left + 1, course.modules[module].lessons),   // the lesson in progress within it
  };
}

export const STATUS = { active: 'In progress', complete: 'Completed', new: 'Not started' };

export const enrolled = learnerData.enrolments.map((e) => {
  const course = courses.get(e.course);
  const subject = subjects.get(course.subject);
  return {
    ...course,
    subjectName: subject.name,
    disciplineName: disciplines.get(course.discipline).name,
    href: url(`/courses/${course.slug}/`),
    outline: url(`/courses/${course.slug}/#syllabus-title`),
    thumb: url(`/assets/app/thumb-${e.thumb}.webp?v=20261031-1`),
    picture: url(e.picture),
    lastDay: e.lastDay,
    next: e.next && { ...e.next, href: url(e.next.href) },
    progress: progress(course, e.done),
  };
});

// The course to pick up again: the most recently studied one that isn't finished.
export const featured = enrolled.find((c) => c.progress.status === 'active');

// Its learning path: each chapter (module) finished, in progress or still locked, with its art and line (paths.js).
// Every chapter opens the course outline, the only page each has so far.
export const journey = {
  course: featured,
  chapters: featured.modules.map((m, i) => ({
    number: i + 1,
    name: m.name,
    lessons: m.lessons,
    state: i < featured.progress.module ? 'done' : i === featured.progress.module ? 'current' : 'locked',
    ...(paths[featured.slug]?.[i] || {}),
    href: featured.outline,
  })),
};

// The other courses worth going back to, most recently studied first.
export const others = enrolled.filter((c) => c !== featured && c.progress.status !== 'complete').slice(0, 3);

// ---------------------------------------------------------------- the Understanding Map

const u = learnerData.understanding;
const mapCourse = enrolled.find((c) => c.slug === u.course);
export const map = {
  course: mapCourse,
  focus: u.focus,
  concepts: u.concepts.map((c) => ({
    ...c,
    state: stateOf(c.practice),
    answered: c.practice.length,
    right: [...c.practice].filter((a) => a === '1').length,
    recent: [...c.practice.slice(-8)].filter((a) => a === '1').length,
    moduleName: mapCourse.modules[c.module].name,
  })),
  links: u.links.map(([from, to, why]) => ({ from, to, why })),
};

// The one concept worth revisiting now, if any: the first the map says needs review.
export const revisit = map.concepts.find((c) => c.state === 'review') || null;

// ---------------------------------------------------------------- learning rhythm

// The learning events (data/sample-learner.js) counted by day. A day is active when it has at least one. The streak
// counts back from yesterday when nothing has happened yet today, so the morning never shows a broken run.
const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const perDay = new Map();
for (const e of learnerData.activity) {
  const k = dayKey(e.at);
  const c = perDay.get(k) || { problem: 0, practice: 0, lesson: 0 };
  c[e.kind]++;
  perDay.set(k, c);
}
const LEVELS = [1, 3, 5, 8];                         // actions in a day for each step up the heatmap's scale

const dayOf = (date) => {
  const counts = perDay.get(dayKey(date)) || { problem: 0, practice: 0, lesson: 0 };
  const total = counts.problem + counts.practice + counts.lesson;
  return { date, counts, total, level: LEVELS.filter((n) => total >= n).length, future: date > today };
};

export const rhythm = (() => {
  // The heatmap: 53 weeks of Monday-to-Sunday columns, the last of them this week.
  const monday = dayOffset(-((today.getDay() + 6) % 7));
  const days = [];
  for (let i = -52 * 7; i < 7; i++) days.push(dayOf(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i)));
  const past = days.filter((d) => !d.future);

  const todayDone = dayOf(dayOffset(0)).total > 0;
  let streak = 0;
  for (let i = todayDone ? 0 : 1; dayOf(dayOffset(-i)).total > 0; i++) streak++;
  let longest = 0, run = 0;
  for (const d of past) { run = d.total ? run + 1 : 0; longest = Math.max(longest, run); }

  return {
    days,
    week: Array.from({ length: 7 }, (_, i) => dayOf(dayOffset(i - 6))),     // the last seven days, today last
    todayDone, streak, longest,
    activeDays: past.slice(-365).filter((d) => d.total).length,
    actions: past.slice(-365).reduce((n, d) => n + d.total, 0),
  };
})();

export const learner = learnerData.learner;
export const SAMPLE = learnerData.SAMPLE;
export { catalogue, disciplines, subjects };
