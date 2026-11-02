// The dashboard's model: the catalogue joined to the learner's records, with everything the views show worked out
// here rather than stored, so a real record only has to say what happened (lessons finished, answers given, learning
// actions taken) and the rest follows. The records are the sample learner for now (data/sample-learner.js).
// Every module of the app is imported with the same ?v= stamp, so a release never mixes old and new files.
// What this device has recorded (store.js: the lesson's progress, answers, learning events) is added to the sample
// records, and refresh() works everything out again when it changes.

import { catalogue } from './data/catalogue.js?v=20261102-5';
import { paths } from './data/paths.js?v=20261102-5';
import * as learnerData from './data/sample-learner.js?v=20261102-5';
import * as store from './store.js?v=20261102-5';

// Site links are written root-relative, as in the site's own pages, and resolved against the site's root, which the
// page names in <link rel="home"> (a hosted copy may live below the root of its domain).
const root = new URL('.', document.querySelector('link[rel="home"]')?.href || location.origin + '/');
export const url = (path) => (/^([a-z]+:|#)/i.test(path) ? path : new URL(path.replace(/^\//, ''), root).href);

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

export let enrolled, featured, journey, others, map, revisit, rhythm;

// The course with the lesson built so far takes its progress from that lesson: its Continue opens the step reached,
// and once the lesson is finished it counts as done.
function courseList() {
  const saved = store.lesson(), L = store.LESSON;
  return learnerData.enrolments.map((e) => {
    const course = courses.get(e.course);
    const subject = subjects.get(course.subject);
    const ours = e.course === L.course;
    const done = ours && saved.completedAt ? Math.max(e.done, L.inCourse) : e.done;
    const next = ours ? !saved.completedAt && { title: L.title, href: `${L.href}/${saved.reached}` } : e.next && { ...e.next, href: url(e.next.href) };
    return {
      ...course,
      subjectName: subject.name,
      disciplineName: disciplines.get(course.discipline).name,
      href: url(`/courses/${course.slug}/`),
      outline: url(`/courses/${course.slug}/#syllabus-title`),
      thumb: url(`/assets/app/thumb-${e.thumb}.webp?v=20261031-1`),
      picture: url(e.picture),
      lastDay: e.lastDay,
      next: next || null,
      progress: progress(course, done),
    };
  });
}

// The Understanding Map: the sample practice records, with this device's answers added.
function understandingMap(list) {
  const u = learnerData.understanding, mine = store.practice();
  const mapCourse = list.find((c) => c.slug === u.course);
  return {
    course: mapCourse,
    focus: u.focus,
    concepts: u.concepts.map((c) => {
      const practice = c.practice + (mine[c.id] || '');
      return {
        ...c,
        practice,
        lastDay: mine[c.id] ? 0 : c.lastDay,
        state: stateOf(practice),
        answered: practice.length,
        right: [...practice].filter((a) => a === '1').length,
        recent: [...practice.slice(-8)].filter((a) => a === '1').length,
        moduleName: mapCourse.modules[c.module].name,
      };
    }),
    links: u.links.map(([from, to, why]) => ({ from, to, why })),
  };
}

export function refresh() {
  enrolled = courseList();
  // The course to pick up again: the most recently studied one that isn't finished.
  featured = enrolled.find((c) => c.progress.status === 'active');
  // Its learning path: each chapter (module) finished, in progress or still locked, with its art and line (paths.js).
  // Every chapter opens the course outline, the only page each has so far.
  journey = {
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
  others = enrolled.filter((c) => c !== featured && c.progress.status !== 'complete').slice(0, 3);
  map = understandingMap(enrolled);
  // The one concept worth revisiting now, if any: the first the map says needs review.
  revisit = map.concepts.find((c) => c.state === 'review') || null;
  rhythm = rhythmOf([...learnerData.activity, ...store.events()]);
}

// ---------------------------------------------------------------- learning rhythm

// The learning events (data/sample-learner.js) counted by day. A day is active when it has at least one. The streak
// counts back from yesterday when nothing has happened yet today, so the morning never shows a broken run.
const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const LEVELS = [1, 3, 5, 8];                         // actions in a day for each step up the heatmap's scale
const joined = learnerData.learner.joined;
const joinedDay = new Date(joined.getFullYear(), joined.getMonth(), joined.getDate());

const rhythmOf = (activity) => {
  const perDay = new Map();
  for (const e of activity) {
    const k = dayKey(e.at);
    const c = perDay.get(k) || { problem: 0, practice: 0, lesson: 0 };
    c[e.kind]++;
    perDay.set(k, c);
  }
  const dayOf = (date) => {
    const counts = perDay.get(dayKey(date)) || { problem: 0, practice: 0, lesson: 0 };
    const total = counts.problem + counts.practice + counts.lesson;
    return { date, counts, total, level: LEVELS.filter((n) => total >= n).length, future: date > today, before: date < joinedDay };
  };

  // The activity chart follows how long the learner has been here: a learner of a year or more sees the year, as 53
  // Monday-to-Sunday weeks; anyone newer sees a month at a time, from the month they joined to this one.
  const view = (today - joinedDay) / 864e5 >= 365 ? 'year' : 'month';

  const monday = dayOffset(-((today.getDay() + 6) % 7));
  const days = [];
  for (let i = -52 * 7; i < 7; i++) days.push(dayOf(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i)));
  const past = days.filter((d) => !d.future);

  const months = [];
  for (let m = new Date(joinedDay.getFullYear(), joinedDay.getMonth(), 1); m <= today; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) {
    const count = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
    months.push({ first: m, days: Array.from({ length: count }, (_, d) => dayOf(new Date(m.getFullYear(), m.getMonth(), d + 1))) });
  }

  const todayDone = dayOf(dayOffset(0)).total > 0;
  let streak = 0;
  for (let i = todayDone ? 0 : 1; dayOf(dayOffset(-i)).total > 0; i++) streak++;
  let longest = 0, run = 0;
  for (const d of past) { run = d.total ? run + 1 : 0; longest = Math.max(longest, run); }

  return {
    view, joined: joinedDay, days, months,
    week: Array.from({ length: 7 }, (_, i) => dayOf(dayOffset(i - 6))),     // the last seven days, today last
    todayDone, streak, longest,
    activeDays: past.slice(-365).filter((d) => d.total).length,
  };
};

refresh();

export const learner = learnerData.learner;
export const SAMPLE = learnerData.SAMPLE;
export { catalogue, disciplines, subjects };
