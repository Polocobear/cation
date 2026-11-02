// Learning Rhythm, the home page's right-hand rail: the run of days with learning in them, the last seven days, the
// past year as twelve small month calendars, and one concept worth revisiting. Every figure is counted from learning
// events (model.js), so a day only counts when something was learned in it. The week and the year share one scale of
// gold, from no learning to a full day. A missed day is shown as empty, never as a failure, and the run counts from
// yesterday until today's first action.

import { h, dateLabel } from './ui.js?v=20261102-3';
import { rhythm, revisit } from './model.js?v=20261102-3';

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
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

// One tip for the whole rail, placed over whatever is pointed at or chosen, and kept inside the window.
function tipper() {
  const tip = h('div', { class: 'tip', hidden: true });
  document.body.append(tip);
  return {
    show(target, text) {
      const r = target.getBoundingClientRect();
      tip.textContent = text;
      tip.hidden = false;
      const half = tip.offsetWidth / 2 + 8;
      tip.style.left = `${Math.min(innerWidth - half, Math.max(half, r.left + r.width / 2))}px`;
      tip.style.top = `${r.top}px`;
    },
    hide() { tip.hidden = true; },
  };
}

export function renderRhythm(el, { onReview }) {
  const r = rhythm, tip = tipper();

  // ---- the run of days, said in a sentence
  const lead = r.streak ? `${plural(r.streak, 'day')} in a row` : 'A fresh start';
  const record = r.streak && r.streak >= r.longest ? 'Your longest run this year.'
    : r.longest ? `Your longest this year is ${plural(r.longest, 'day')}.` : '';
  const next = r.todayDone ? 'Today counts already.'
    : r.streak ? `Learn something today to make it ${r.streak + 1}.` : 'One problem today starts a new run.';

  // ---- the last seven days, on the year's scale
  const week = h('ol', { class: 'week', 'aria-label': 'The last seven days' }, r.week.map((d, i) => {
    const isToday = i === r.week.length - 1;
    const text = `${isToday ? 'Today' : dateLabel(d.date, DAY)}: ${d.total ? says(d) : isToday ? 'nothing yet' : 'no learning'}`;
    return h('li', { class: isToday ? 'is-today' : null, 'data-tip': text },
      h('span', { class: 'cell', 'data-l': d.level }),
      h('span', { class: 'wd', 'aria-hidden': 'true' }, isToday ? 'Today' : dateLabel(d.date, { weekday: 'narrow' })),
      h('span', { class: 'visually-hidden' }, text));
  }));
  week.addEventListener('pointerover', (e) => { const li = e.target.closest('li'); if (li) tip.show(li.querySelector('.cell'), li.dataset.tip); });
  week.addEventListener('pointerleave', () => tip.hide());

  // ---- the year: twelve months, each a calendar of its days, weeks starting on Monday
  const days = [], cells = [];
  const months = r.months.map((m, i) => {
    const month = m.first.getMonth();
    const name = i === 0 || month === 0 ? `${MONTHS[month]} ${m.first.getFullYear()}` : MONTHS[month];
    const pad = (m.first.getDay() + 6) % 7;
    return h('div', { class: 'month' },
      h('span', { class: 'month-name' }, name),
      h('span', { class: 'month-days' },
        Array.from({ length: pad }, () => h('i', { class: 'pad' })),
        m.days.map((d) => {
          const c = h('i', { class: d.future ? 'is-future' : null, 'data-l': d.future ? null : d.level });
          if (!d.future) { days.push(d); cells.push(c); }
          return c;
        })));
  });
  const status = h('span', { class: 'visually-hidden', 'aria-live': 'polite' });
  const year = h('div', {
    class: 'year-grid', tabindex: 0, role: 'img',
    'aria-label': `The past year: learning on ${r.activeDays} days. Use the arrow keys to read each day.`,
  }, months);
  let active = -1;
  const point = (i) => {
    cells[active]?.classList.remove('is-active');
    active = i;
    if (i < 0) { tip.hide(); return; }
    cells[i].classList.add('is-active');
    const text = `${dateLabel(days[i].date, DAY)}: ${says(days[i])}`;
    tip.show(cells[i], text);
    status.textContent = text;
  };
  year.addEventListener('pointerover', (e) => { const i = cells.indexOf(e.target); if (i >= 0) point(i); });
  year.addEventListener('pointerleave', () => point(-1));
  year.addEventListener('blur', () => point(-1));
  year.addEventListener('keydown', (e) => {
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 7, ArrowUp: -7, Home: -Infinity, End: Infinity }[e.key];
    if (step === undefined) return;
    e.preventDefault();
    point(Math.max(0, Math.min(cells.length - 1, active < 0 ? cells.length - 1 : active + step)));
  });

  const sections = [
    h('section', { class: 'streak', 'aria-labelledby': 'rhythm-title' },
      h('p', { class: 'streak-lead' }, lead),
      h('p', { class: 'streak-note' }, [record, next].filter(Boolean).map((line) => h('span', {}, line))),
      week),
    h('section', { class: 'year', 'aria-labelledby': 'year-title' },
      h('div', { class: 'rail-head' }, h('h3', { class: 'rail-label', id: 'year-title' }, 'Past year'),
        h('p', {}, plural(r.activeDays, 'learning day'))),
      year, status,
      h('p', { class: 'rail-note' }, 'Days with a problem solved, a concept practised or a lesson finished.')),
  ];

  // ---- one thing worth revisiting, when there is one
  if (revisit) {
    sections.push(h('section', { class: 'revisit', 'aria-labelledby': 'revisit-title' },
      h('h3', { class: 'rail-label', id: 'revisit-title' }, 'Worth revisiting'),
      h('div', { class: 'revisit-row' },
        h('div', {},
          h('p', { class: 'rv-name' }, revisit.name),
          h('p', { class: 'rv-sub' }, `${revisit.recent} of your last ${Math.min(8, revisit.answered)} answers were right`)),
        h('button', {
          type: 'button', class: 'rv-act', onclick: () => onReview(revisit.id),
          'aria-label': `Review ${revisit.name} on your Understanding Map`,
        }, 'Review'))));
  }
  el.replaceChildren(h('h2', { class: 'rail-title', id: 'rhythm-title' }, 'Learning rhythm'),
    ...sections.flatMap((x, i) => (i ? [h('hr'), x] : [x])));
}
