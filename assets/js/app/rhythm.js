// Learning Rhythm, the home page's right-hand rail: the run of days with learning in them, the last seven days, an
// activity chart, and one concept worth revisiting. Every figure is counted from learning events (model.js), so a day
// only counts when something was learned in it. A missed day is shown as empty, never as a failure, and the run counts
// from yesterday until today's first action. The chart follows how long the learner has been here: the year for a
// year or more, otherwise a month at a time back to the month they joined.

import { h, icon, dateLabel } from './ui.js?v=20261102-4';
import { rhythm, revisit } from './model.js?v=20261102-4';

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const DAY = { weekday: 'short', day: 'numeric', month: 'short' };
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const short = (m) => MONTHS[m].slice(0, 3);

// What a day held, in words: "3 problems solved, 1 concept practised".
function says(d) {
  const { problem, practice, lesson } = d.counts;
  const parts = [
    problem && `${plural(problem, 'problem')} solved`,
    practice && `${plural(practice, 'concept')} practised`,
    lesson && `${plural(lesson, 'lesson')} finished`,
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : 'no learning';
}

// One tip for the whole rail, placed over whatever is pointed at or chosen.
function tipper() {
  const tip = h('div', { class: 'tip', hidden: true });
  document.body.append(tip);
  return {
    show(target, text) {
      const r = target.getBoundingClientRect();
      tip.textContent = text;
      tip.hidden = false;
      const half = tip.offsetWidth / 2 + 8;                // kept inside the window
      tip.style.left = `${Math.min(innerWidth - half, Math.max(half, r.left + r.width / 2))}px`;
      tip.style.top = `${r.top}px`;
    },
    hide() { tip.hidden = true; },
  };
}

export function renderRhythm(el, { onReview }) {
  const r = rhythm, tip = tipper();

  // ---- the run of days
  const note = r.todayDone ? 'Today counts already. See you tomorrow.'
    : r.streak ? `Learn one thing today to make it ${r.streak + 1}.`
    : `Your longest run this year was ${plural(r.longest, 'day')}. One problem today starts a new one.`;
  const streak = r.streak
    ? h('p', { class: 'streak' }, h('span', { class: 'streak-n' }, String(r.streak)), h('span', { class: 'streak-unit' }, 'days', h('br'), 'in a row'))
    : h('p', { class: 'streak is-fresh' }, h('span', { class: 'streak-unit' }, 'A fresh start'));

  // ---- the last seven days
  const week = h('ol', { class: 'week', 'aria-label': 'The last seven days' }, r.week.map((d, i) => {
    const isToday = i === r.week.length - 1;
    const label = isToday ? 'Today' : dateLabel(d.date, { weekday: 'short' });
    return h('li', { class: `${d.total ? 'is-on' : ''}${isToday ? ' is-today' : ''}`, 'data-tip': `${isToday ? 'Today' : dateLabel(d.date, DAY)}: ${d.total ? says(d) : isToday ? 'nothing yet' : 'no learning'}` },
      h('span', { class: 'pip', html: d.total ? icon('check') : '' }),
      h('span', { class: 'wd', 'aria-hidden': 'true' }, label),
      h('span', { class: 'visually-hidden' }, `${isToday ? 'Today' : dateLabel(d.date, { weekday: 'long', day: 'numeric', month: 'long' })}: ${d.total ? says(d) : isToday ? 'nothing yet' : 'no learning'}`));
  }));
  week.addEventListener('pointerover', (e) => { const li = e.target.closest('li'); if (li) tip.show(li.querySelector('.pip'), li.dataset.tip); });
  week.addEventListener('pointerleave', () => tip.hide());

  // ---- the activity chart. Pointing at a day, or moving with the arrow keys once the chart is focused, reads it out.
  const status = h('span', { class: 'visually-hidden', 'aria-live': 'polite' });
  let cells = [], days = [], active = -1, steps = {};
  const point = (k) => {
    cells[active]?.classList.remove('is-active');
    active = k;
    if (k < 0) { tip.hide(); return; }
    cells[k].classList.add('is-active');
    const text = `${dateLabel(days[k].date, DAY)}: ${says(days[k])}`;
    tip.show(cells[k], text);
    status.textContent = text;
  };
  const chart = h('div', { class: `heat is-${r.view}`, tabindex: 0, role: 'img' });
  chart.addEventListener('pointerover', (e) => { const k = cells.indexOf(e.target); if (k >= 0) point(k); });
  chart.addEventListener('pointerleave', () => point(-1));
  chart.addEventListener('blur', () => point(-1));
  chart.addEventListener('keydown', (e) => {
    const step = { ...steps, Home: -Infinity, End: Infinity }[e.key];
    if (step === undefined) return;
    e.preventDefault();
    point(Math.max(0, Math.min(cells.length - 1, active < 0 ? cells.length - 1 : active + step)));
  });
  const cell = (d) => {
    const c = h('i', { class: d.future ? 'is-future' : d.before ? 'is-before' : null, 'data-l': d.future || d.before ? null : d.level });
    if (!d.future && !d.before) { cells.push(c); days.push(d); }
    return c;
  };
  const title = h('h2', { class: 'eyebrow', id: 'year-title' });
  const count = h('p');
  const counted = (n) => count.replaceChildren(h('b', {}, String(n)), n === 1 ? ' day with learning' : ' days with learning');
  const head = h('div', { class: 'year-head' }, title, count);

  if (r.view === 'year') {
    // The year: 53 weeks, a column each, Monday at the top.
    steps = { ArrowRight: 7, ArrowLeft: -7, ArrowDown: 1, ArrowUp: -1 };
    title.textContent = 'Your year';
    counted(r.activeDays);
    const grid = h('div', { class: 'heat-grid' }, r.days.map(cell));
    const months = h('div', { class: 'heat-months', 'aria-hidden': 'true' });
    let lastCol = -9;
    r.days.forEach((d, k) => {
      const col = Math.floor(k / 7);
      if (d.date.getDate() === 1 && col - lastCol >= 3 && col <= 50) {
        months.append(h('span', { style: `grid-column: ${col + 1}` }, short(d.date.getMonth())));
        lastCol = col;
      }
    });
    chart.setAttribute('aria-label', `Your year: learning on ${r.activeDays} of the last 365 days. Use the arrow keys to read each day.`);
    chart.append(grid, months);
  } else {
    // A month: a calendar, Monday first, from the month the learner joined to this one.
    steps = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 7, ArrowUp: -7 };
    let at = r.months.length - 1;
    const prev = h('button', { type: 'button', class: 'cal-step', 'aria-label': 'Previous month', html: icon('chevron') });
    const next = h('button', { type: 'button', class: 'cal-step', 'aria-label': 'Next month', html: icon('chevron') });
    const grid = h('div', { class: 'cal-grid' });
    const draw = () => {
      const m = r.months[at], month = m.first.getMonth(), year = m.first.getFullYear();
      title.textContent = at === r.months.length - 1 ? 'This month' : `${MONTHS[month]}${year === new Date().getFullYear() ? '' : ` ${year}`}`;
      const learned = m.days.filter((d) => d.total).length;
      counted(learned);
      point(-1);
      cells = []; days = [];
      grid.replaceChildren(...Array.from({ length: (m.first.getDay() + 6) % 7 }, () => h('i', { class: 'pad' })), ...m.days.map(cell));
      const today = m.days.find((d) => d.date.toDateString() === new Date().toDateString());
      if (today) cells[days.indexOf(today)]?.classList.add('is-today');
      prev.disabled = at === 0;
      next.disabled = at === r.months.length - 1;
      chart.setAttribute('aria-label', `${MONTHS[month]} ${year}: learning on ${plural(learned, 'day')}. Use the arrow keys to read each day.`);
    };
    prev.addEventListener('click', () => { at--; draw(); });
    next.addEventListener('click', () => { at++; draw(); });
    head.append(h('span', { class: 'cal-nav' }, prev, next));
    chart.append(h('div', { class: 'cal-days', 'aria-hidden': 'true' }, ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((l) => h('span', {}, l))), grid);
    draw();
  }

  const sections = [
    h('section', { class: 'rhythm', 'aria-labelledby': 'rhythm-title' },
      h('h2', { class: 'eyebrow', id: 'rhythm-title' }, 'Learning rhythm'),
      streak, h('p', { class: 'streak-note' }, note), week),
    h('section', { class: 'year', 'aria-labelledby': 'year-title' },
      head, chart, status,
      h('div', { class: 'heat-foot' },
        h('span', { class: 'legend', 'aria-hidden': 'true' }, 'Less', [0, 1, 2, 3, 4].map((l) => h('i', { 'data-l': l })), 'More'),
        h('span', {}, `Longest run: ${plural(r.longest, 'day')}`)),
      h('p', { class: 'heat-note' }, 'A day counts when you solve a problem, practise a concept or finish a lesson. Opening CATION doesn’t count.')),
  ];

  // ---- one thing worth revisiting, when there is one
  if (revisit) {
    sections.push(h('section', { class: 'revisit', 'aria-labelledby': 'revisit-title' },
      h('h2', { class: 'eyebrow', id: 'revisit-title' }, 'Worth revisiting'),
      h('div', { class: 'revisit-row' },
        h('div', {},
          h('p', { class: 'rv-name' }, revisit.name),
          h('p', { class: 'rv-sub' }, `Needs review · ${revisit.recent} of the last ${Math.min(8, revisit.answered)} answers right`)),
        h('button', {
          type: 'button', class: 'rv-act', onclick: () => onReview(revisit.id),
          'aria-label': `Review ${revisit.name} on your Understanding Map`, html: `Review${icon('arrow')}`,
        }))));
  }
  el.replaceChildren(...sections.flatMap((x, i) => (i ? [h('hr'), x] : [x])));
}
