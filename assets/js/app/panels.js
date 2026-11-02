// The course list: the learner's courses with their progress, filtered by status or discipline. My Learning shows it;
// each row opens the course's outline.

import { h, icon, menu } from './ui.js?v=20261102-5';
import { enrolled, STATUS, catalogue } from './model.js?v=20261102-5';

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
    : p.status === 'complete' ? `All ${p.total} lessons · ${c.modules.length} chapters`
    : `Chapter ${p.module + 1} of ${c.modules.length} · ${p.done} of ${p.total} lessons`;
  return h('li', { class: `is-${p.status}` },
    h('a', { class: 'course-row', href: c.href, 'aria-label': `${c.title}. ${STATUS[p.status]}, ${p.percent}%. Opens the course outline.` },
      h('span', { class: 'course-thumb' }, h('img', { src: c.thumb, alt: '', loading: 'lazy', decoding: 'async', width: 240, height: 180 })),
      h('span', { class: 'course-text' }, h('span', { class: 'course-name' }, c.title), h('span', { class: 'course-meta' }, meta)),
      h('span', { class: 'course-progress' },
        h('b', {}, `${p.percent}%`, h('small', {}, STATUS[p.status])),
        h('span', { class: 'bar' }, h('span', { style: `width: ${p.percent}%` }))),
      h('span', { html: icon('chevron') }).firstChild));
}
