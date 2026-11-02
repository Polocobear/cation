// Learning Rhythm, the home page's right-hand rail: the run of days with learning in them, the last seven days, the
// year as a heatmap, and one concept worth revisiting. Every figure is counted from learning events (model.js), so a
// day only counts when something was learned in it. A missed day is shown as empty, never as a failure, and the run
// counts from yesterday until today's first action.

import { h, icon, dateLabel } from './ui.js?v=20261102-2';
import { rhythm, revisit, STATES } from './model.js?v=20261102-2';

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const DAY = { weekday: 'short', day: 'numeric', month: 'short' };

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

  // ---- the year
  const cells = r.days.map((d) => h('i', { class: d.future ? 'is-future' : null, 'data-l': d.future ? null : d.level }));
  const grid = h('div', { class: 'heat-grid' }, cells);
  const months = h('div', { class: 'heat-months', 'aria-hidden': 'true' });
  let lastCol = -9;
  r.days.forEach((d, i) => {
    const col = Math.floor(i / 7);
    if (d.date.getDate() === 1 && col - lastCol >= 3 && col <= 50) {
      months.append(h('span', { style: `grid-column: ${col + 1}` }, dateLabel(d.date, { month: 'short' })));
      lastCol = col;
    }
  });
  const status = h('span', { class: 'visually-hidden', 'aria-live': 'polite' });
  const heat = h('div', {
    class: 'heat', tabindex: 0, role: 'img',
    'aria-label': `Your year: learning on ${r.activeDays} of the last 365 days. Use the arrow keys to read each day.`,
  }, grid, months);
  const past = r.days.filter((d) => !d.future).length;
  let active = -1;
  const point = (i) => {
    cells[active]?.classList.remove('is-active');
    active = i;
    if (i < 0) { tip.hide(); return; }
    cells[i].classList.add('is-active');
    const text = `${dateLabel(r.days[i].date, DAY)}: ${says(r.days[i])}`;
    tip.show(cells[i], text);
    status.textContent = text;
  };
  grid.addEventListener('pointerover', (e) => { const i = cells.indexOf(e.target); if (i >= 0 && i < past) point(i); });
  heat.addEventListener('pointerleave', () => point(-1));
  heat.addEventListener('blur', () => point(-1));
  heat.addEventListener('keydown', (e) => {
    const step = { ArrowRight: 7, ArrowLeft: -7, ArrowDown: 1, ArrowUp: -1, Home: -Infinity, End: Infinity }[e.key];
    if (step === undefined) return;
    e.preventDefault();
    point(Math.max(0, Math.min(past - 1, active < 0 ? past - 1 : active + step)));
  });

  const sections = [
    h('section', { class: 'rhythm', 'aria-labelledby': 'rhythm-title' },
      h('h2', { class: 'eyebrow', id: 'rhythm-title' }, 'Learning rhythm'),
      streak, h('p', { class: 'streak-note' }, note), week),
    h('section', { class: 'year', 'aria-labelledby': 'year-title' },
      h('div', { class: 'year-head' }, h('h2', { class: 'eyebrow', id: 'year-title' }, 'Your year'),
        h('p', {}, h('b', {}, String(r.activeDays)), ' days with learning')),
      heat, status,
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
        h('span', { class: 'rv-mark', title: STATES[revisit.state] }),
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
