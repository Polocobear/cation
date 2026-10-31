// The dashboard's model: the catalogue joined to the learner's records, with everything the panels show worked out
// here rather than stored, so a real record only has to say what happened (lessons finished, answers given, minutes
// studied) and the rest follows. The records are the sample learner for now (data/sample-learner.js).

import { catalogue } from './data/catalogue.js';
import * as learnerData from './data/sample-learner.js';

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
    lastDay: e.lastDay,
    next: e.next && { ...e.next, href: url(e.next.href) },
    progress: progress(course, e.done),
  };
});

// The course to pick up again: the most recently studied one that isn't finished.
export const featured = enrolled.find((c) => c.progress.status === 'active');

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
    moduleName: mapCourse.modules[c.module].name,
  })),
  links: u.links.map(([from, to, why]) => ({ from, to, why })),
};

// ---------------------------------------------------------------- study time and practice

export const studyLog = learnerData.studyLog;          // minutes per day, index 0 is today

// Each period, its bars (oldest first) and the period of the same length before it, for the comparison.
export function studyPeriod(kind) {
  const bars = [];
  if (kind === 'week' || kind === 'month') {
    const n = kind === 'week' ? 7 : 30;
    for (let i = n - 1; i >= 0; i--) bars.push({ minutes: studyLog[i], from: dayOffset(-i), days: 1 });
    const before = studyLog.slice(n, 2 * n).reduce((a, b) => a + b, 0);
    return { bars, minutes: bars.reduce((a, b) => a + b.minutes, 0), before, days: n };
  }
  for (let w = 12; w >= 0; w--) {                        // 13 weeks, a bar each
    const minutes = studyLog.slice(w * 7, w * 7 + 7).reduce((a, b) => a + b, 0);
    bars.push({ minutes, from: dayOffset(-(w * 7 + 6)), days: 7 });
  }
  const before = studyLog.slice(91, 182).reduce((a, b) => a + b, 0);
  return { bars, minutes: bars.reduce((a, b) => a + b.minutes, 0), before, days: 91 };
}

export const practice = learnerData.practice.map((w, i, all) => ({
  ...w,
  share: w.correct / w.answered,
  from: dayOffset(-7 * (all.length - 1 - i) - 6),
}));

// ---------------------------------------------------------------- tasks

export const tasks = learnerData.tasks.map((t) => ({
  ...t,
  course: enrolled.find((c) => c.slug === t.course),
  href: t.href && url(t.href),
  date: dayOffset(t.due),
}));

export const learner = learnerData.learner;
export const SAMPLE = learnerData.SAMPLE;
export { catalogue, disciplines, subjects };
