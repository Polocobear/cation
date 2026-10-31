// The dashboard's panels other than the map and the charts: the featured lesson, the course list, the tasks and the
// completion count. Each renders into the element it is given, so the other views can reuse them.

import { h, icon, dueLabel, daysFrom, dateLabel, menu } from './ui.js';
import { enrolled, STATUS, tasks, catalogue, url } from './model.js';

// ---------------------------------------------------------------- the featured lesson

export function renderFeature(el, course) {
  const p = course.progress, mod = course.modules[p.module];
  const resume = course.next ? course.next.href : course.outline;
  const v = '?v=20261031-1';
  el.replaceChildren(
    h('div', { class: 'feature-art' },
      h('img', {
        src: url(`/assets/app/banner-1440.webp${v}`),
        srcset: `${url(`/assets/app/banner-1440.webp${v}`)} 1440w, ${url(`/assets/app/banner-2880.webp${v}`)} 2880w`,
        sizes: '(max-width: 719px) 220vw, 88vw', fetchpriority: 'high', decoding: 'async',
        alt: 'A bubble-chamber photograph: a photon turns into an electron and a positron, which wind into opposite spirals in the magnetic field.',
      })),
    h('div', { class: 'feature-copy' },
      h('div', { class: 'feature-meta' },
        h('span', { class: 'chip' }, course.subjectName),
        h('span', {}, `Module ${p.module + 1} · Lesson ${p.lesson} of ${mod.lessons} · ${p.percent}% complete`),
        h('span', { class: 'meter', role: 'progressbar', 'aria-label': 'Course progress', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': p.percent },
          h('span', { style: `width: ${p.percent}%` }))),
      h('h2', { id: 'feature-title' }, course.title),
      h('p', {}, course.summary),
      h('div', { class: 'resume-row' },
        h('a', { class: 'resume', href: resume, html: `<span class="play">${icon('play')}</span>Resume learning${icon('arrow')}` }),
        !course.next && h('p', { class: 'resume-note' }, 'Lessons are in development, so this opens the course outline.'))),
    h('ol', { class: 'feature-modules', 'aria-label': `${course.title}: modules` },
      course.modules.map((m, i) => {
        const when = i < p.module ? 'done' : i === p.module ? 'now' : 'later';
        return h('li', { class: `is-${when}`, 'aria-current': when === 'now' ? 'step' : null },
          h('span', { class: 'n', html: when === 'done' ? icon('check') : String(i + 1) }),
          m.name,
          h('span', { class: 'visually-hidden' }, when === 'done' ? ', finished' : when === 'now' ? ', in progress' : ''));
      })));
}

// ---------------------------------------------------------------- your courses

const FILTERS = [
  ['all', 'All courses'], ['active', 'In progress'], ['complete', 'Completed'], ['new', 'Not started'],
  ...catalogue.disciplines.map((d) => [d.slug, d.name]),
];

export function renderCourses(el, { title = 'Your courses', headingId = 'courses-title' } = {}) {
  let filter = 'all';
  const list = h('ul', { class: 'course-list', role: 'list' });
  const button = h('button', { type: 'button', class: 'select-btn', 'aria-haspopup': 'menu' });
  const pop = h('div', { class: 'popover', role: 'menu', 'aria-label': 'Filter courses', hidden: true });
  const close = menu(button, pop, { onOpen: () => pop.querySelector('[aria-checked="true"]')?.focus() });

  const draw = () => {
    const name = FILTERS.find(([k]) => k === filter)[1];
    button.innerHTML = `${filter === 'all' ? 'Filter' : name}${icon('down')}`;
    button.setAttribute('aria-label', `Filter courses: ${name}`);
    pop.replaceChildren(...FILTERS.flatMap(([key, label], i) => [
      i === 4 ? h('div', { class: 'pop-rule', role: 'separator' }) : null,
      h('button', { type: 'button', class: 'pop-item', role: 'menuitemradio', 'aria-checked': String(key === filter),
        onclick: () => { filter = key; close(true); draw(); } }, label),
    ]).filter(Boolean));
    const shown = enrolled.filter((c) => filter === 'all' || c.progress.status === filter || c.discipline === filter);
    list.replaceChildren(...shown.map(courseRow));
    if (!shown.length) list.append(h('li', { class: 'list-empty' }, 'No courses match this filter.'));
  };
  // Arrow keys move through the filter menu.
  pop.addEventListener('keydown', (e) => {
    const items = [...pop.querySelectorAll('.pop-item')], i = items.indexOf(document.activeElement);
    const step = { ArrowDown: 1, ArrowUp: -1 }[e.key];
    if (step) { e.preventDefault(); items[(i + step + items.length) % items.length].focus(); }
  });

  draw();
  el.replaceChildren(
    h('div', { class: 'card-head' }, h('h2', { id: headingId }, title), h('div', { class: 'menu', 'data-menu': '' }, button, pop)),
    list);
}

function courseRow(c) {
  const p = c.progress;
  const meta = p.status === 'new' ? `${p.total} lessons · ${c.weeks} weeks`
    : p.status === 'complete' ? `All ${p.total} lessons · ${c.modules.length} modules`
    : `Module ${p.module + 1} of ${c.modules.length} · ${p.done} of ${p.total} lessons`;
  return h('li', { class: `is-${p.status}` },
    h('a', { class: 'course-row', href: c.href, 'aria-label': `${c.title}. ${STATUS[p.status]}, ${p.percent}%. Opens the course outline.` },
      h('span', { class: 'course-thumb' }, h('img', { src: c.thumb, alt: '', loading: 'lazy', decoding: 'async', width: 240, height: 180 })),
      h('span', { class: 'course-text' }, h('span', { class: 'course-name' }, c.title), h('span', { class: 'course-meta' }, meta)),
      h('span', { class: 'course-progress' },
        h('b', {}, `${p.percent}%`, h('small', {}, STATUS[p.status])),
        h('span', { class: 'bar' }, h('span', { style: `width: ${p.percent}%` }))),
      h('span', { html: icon('chevron') }).firstChild));
}

// ---------------------------------------------------------------- tasks

const KIND_ICON = { review: 'review', lesson: 'lesson', practice: 'practice', quiz: 'quiz', start: 'start' };

export function taskRow(t, { onConcept }) {
  const soon = daysFrom(t.date) <= 2;
  const inner = [
    h('span', { html: icon(KIND_ICON[t.kind]) }).firstChild,
    h('span', { class: 'task-text' }, h('span', { class: 'task-title' }, t.title),
      h('span', { class: 'task-sub' }, `${t.course.title} · ${t.detail}`)),
    h('span', { class: `task-due${soon ? ' is-soon' : ''}` }, dueLabel(t.date)),
    h('span', { html: icon('chevron') }).firstChild,
  ];
  return t.concept
    ? h('button', { type: 'button', class: 'task', onclick: () => onConcept(t.concept), 'aria-label': `${t.title}, ${dueLabel(t.date)}. Shows it on your Understanding Map.` }, ...inner)
    : h('a', { class: 'task', href: t.href, 'aria-label': `${t.title}, ${dueLabel(t.date)}. ${t.kind === 'lesson' ? 'Opens the lesson.' : 'Opens the course outline.'}` }, ...inner);
}

export function renderTasks(el, { onConcept, limit = 3 }) {
  el.replaceChildren(
    h('div', { class: 'card-head' },
      h('h2', { id: 'tasks-title' }, 'Upcoming tasks'),
      h('a', { class: 'link-btn', href: '#/calendar', html: `View all${icon('arrow')}` })),
    h('div', { class: 'task-list' }, tasks.slice(0, limit).map((t) => taskRow(t, { onConcept }))));
}

// Every task, grouped by the day it is due (the Calendar view).
export function renderAgenda(el, { onConcept }) {
  const days = new Map();
  for (const t of tasks) {
    const key = t.date.toDateString();
    if (!days.has(key)) days.set(key, []);
    days.get(key).push(t);
  }
  el.replaceChildren(...[...days.values()].map((group) =>
    h('section', { class: 'day-group' },
      h('h3', {}, dateLabel(group[0].date, { weekday: 'long', day: 'numeric', month: 'long' })),
      h('div', { class: 'task-list' }, group.map((t) => taskRow(t, { onConcept }))))));
}

// ---------------------------------------------------------------- courses completed

export function renderDone(el) {
  const total = enrolled.length, done = enrolled.filter((c) => c.progress.status === 'complete').length;
  const share = Math.round((done / total) * 100);
  el.replaceChildren(
    h('h2', { class: 'done-head', id: 'done-title', html: `${icon('check')}Courses completed` }),
    h('p', { class: 'done-figure' }, h('span', { class: 'big' }, String(done)), h('span', {}, `of ${total} enrolled`)),
    h('div', { class: 'done-bar' },
      h('span', { class: 'bar', role: 'progressbar', 'aria-label': 'Enrolled courses completed', 'aria-valuemin': 0, 'aria-valuemax': total, 'aria-valuenow': done },
        h('span', { style: `width: ${share}%` })),
      `${share}%`));
}
