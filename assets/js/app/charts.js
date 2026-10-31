// Study time and practice accuracy. Both read the learner's own log (model.js), so a figure on screen is always the
// sum or share of the bars and points beside it. Each chart can be explored by pointer or, once focused, by the
// arrow keys, and states its period and units in words.

import { h, icon, menu, dateLabel, hours } from './ui.js';
import { studyPeriod, practice } from './model.js';

// A period picker in a card's head: a button and a menu of choices.
function picker(label, choices, value, onPick) {
  const button = h('button', { type: 'button', class: 'select-btn', 'aria-haspopup': 'menu' });
  const pop = h('div', { class: 'popover', role: 'menu', 'aria-label': label, hidden: true });
  const close = menu(button, pop, { onOpen: () => pop.querySelector('[aria-checked="true"]')?.focus() });
  const draw = () => {
    const current = choices.find(([k]) => k === value)[1];
    button.innerHTML = `${current}${icon('down')}`;
    button.setAttribute('aria-label', `${label}: ${current}`);
    pop.replaceChildren(...choices.map(([k, text]) => h('button', {
      type: 'button', class: 'pop-item', role: 'menuitemradio', 'aria-checked': String(k === value),
      onclick: () => { value = k; close(true); draw(); onPick(k); },
    }, text)));
  };
  pop.addEventListener('keydown', (e) => {
    const items = [...pop.querySelectorAll('.pop-item')], i = items.indexOf(document.activeElement);
    const step = { ArrowDown: 1, ArrowUp: -1 }[e.key];
    if (step) { e.preventDefault(); items[(i + step + items.length) % items.length].focus(); }
  });
  draw();
  return h('div', { class: 'menu', 'data-menu': '' }, button, pop);
}

// Pointer and arrow-key exploration of a row of marks: one tip at a time, read out as it changes. Set up once per
// chart; each redraw hands it the new marks.
function explorer(box, selector) {
  let marks = [], tipFor = () => '', active = -1;
  const tip = h('span', { class: 'chart-tip', role: 'status' });
  const show = (i) => {
    active = i;
    box.classList.toggle('is-exploring', i >= 0);
    if (i < 0) { tip.remove(); return; }
    tip.textContent = tipFor(i);
    marks[i].append(tip);
  };
  box.tabIndex = 0;
  box.addEventListener('pointerover', (e) => { const i = marks.indexOf(e.target.closest(selector)); if (i >= 0) show(i); });
  box.addEventListener('pointerleave', () => show(-1));
  box.addEventListener('blur', () => show(-1));
  box.addEventListener('keydown', (e) => {
    const step = { ArrowRight: 1, ArrowLeft: -1, Home: -Infinity, End: Infinity }[e.key];
    if (step === undefined) return;
    e.preventDefault();
    show(Math.max(0, Math.min(marks.length - 1, active < 0 ? marks.length - 1 : active + step)));
  });
  return (m, t) => { marks = m; tipFor = t; show(-1); };
}

// ---------------------------------------------------------------- study time

const PERIODS = [['week', '7 days'], ['month', '30 days'], ['quarter', '3 months']];

export function renderStudy(el) {
  const chart = h('div', { class: 'study-chart', role: 'img' });
  const foot = h('div', { class: 'study-foot' });
  const explore = explorer(chart, '.b');
  const draw = (kind) => {
    const p = studyPeriod(kind);
    const top = Math.max(...p.bars.map((b) => b.minutes), 1);
    const biggest = p.bars.findIndex((b) => b.minutes === top);
    chart.style.setProperty('--bar-gap', kind === 'month' ? 'calc(2.5 * var(--z))' : 'calc(6 * var(--z))');
    const bars = p.bars.map((b, i) => h('span', { class: `b${b.minutes ? ' is-on' : ''}${i === biggest && b.minutes ? ' is-top' : ''}` },
      h('span', { style: `height: ${Math.max(3, (b.minutes / top) * 100)}%` })));
    chart.replaceChildren(...bars);
    chart.setAttribute('aria-label', `Study time, last ${PERIODS.find(([k]) => k === kind)[1]}: ${hours(p.minutes)} in total. Use the arrow keys to read each ${kind === 'quarter' ? 'week' : 'day'}.`);
    explore(bars, (i) => {
      const b = p.bars[i];
      const when = b.days === 7 ? `Week of ${dateLabel(b.from)}` : dateLabel(b.from, { weekday: 'short', day: 'numeric', month: 'short' });
      return `${when}: ${b.minutes ? hours(b.minutes) : 'no study'}`;
    });
    const change = p.before ? Math.round(((p.minutes - p.before) / p.before) * 100) : null;
    const span = kind === 'quarter' ? '3 months' : `${p.days} days`;
    foot.replaceChildren(
      h('p', { class: 'big' }, (p.minutes / 60).toFixed(1), h('small', {}, 'hours')),
      h('p', { class: 'delta' },
        change === null ? 'No study in the period before'
          : [h('b', { class: change < 0 ? 'is-down' : '' }, `${change >= 0 ? '▲' : '▼'} ${Math.abs(change)}%`), `vs. the ${span} before`]));
  };
  el.replaceChildren(
    h('div', { class: 'card-head' }, h('h2', { id: 'study-title' }, 'Study time'), picker('Study time period', PERIODS, 'month', draw)),
    chart, foot);
  draw('month');
}

// ---------------------------------------------------------------- practice accuracy

const WEEKS = [['4', '4 weeks'], ['8', '8 weeks'], ['12', '12 weeks']];
const LOW = 40;   // the chart's floor, in percent: the axis is labelled, so it never reads as zero

// A smooth line through the points (Catmull-Rom as cubic Béziers), in the 0–100 box of the SVG.
const curve = (pts) => pts.map(([x, y], i) => {
  if (!i) return `M${x} ${y}`;
  const [x0, y0] = pts[i - 2] || pts[i - 1], [x1, y1] = pts[i - 1], [x3, y3] = pts[i + 1] || [x, y];
  return `C${x1 + (x - x0) / 6} ${y1 + (y - y0) / 6} ${x - (x3 - x1) / 6} ${y - (y3 - y1) / 6} ${x} ${y}`;
}).join('');

export function renderPerf(el) {
  const box = h('div', { class: 'perf-chart', role: 'img' });
  const foot = h('div', { class: 'perf-foot' });
  const explore = explorer(box, '.perf-pt');
  const draw = (n) => {
    const weeks = practice.slice(-Number(n));
    const pts = weeks.map((w, i) => [(i / (weeks.length - 1)) * 100, 100 - ((w.share * 100 - LOW) / (100 - LOW)) * 100]);
    const svg = `<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <g class="grid">${[0, 50, 100].map((y) => `<line x1="0" x2="100" y1="${y}" y2="${y}"/>`).join('')}</g>
      <path class="area" d="${curve(pts)}L100 100L0 100Z"/><path class="line" d="${curve(pts)}"/></svg>`;
    const plot = h('div', { class: 'perf-plot', html: svg });
    for (const [v, y] of [[100, 0], [70, 50], [40, 100]]) plot.append(h('span', { class: 'perf-axis', style: `top: ${y}%` }, `${v}%`));
    const marks = weeks.map((w, i) => h('span', { class: `perf-pt${i === weeks.length - 1 ? ' is-last' : ''}`, style: `left: ${pts[i][0]}%; top: ${pts[i][1]}%` }));
    plot.append(...marks);
    box.replaceChildren(plot);
    const last = weeks[weeks.length - 1], first = weeks[0];
    marks[marks.length - 1].append(h('span', { class: 'chart-tip pt-label', 'aria-hidden': 'true' }, `${Math.round(last.share * 100)}%`));
    explore(marks, (i) => `Week of ${dateLabel(weeks[i].from)}: ${weeks[i].correct} of ${weeks[i].answered} right (${Math.round(weeks[i].share * 100)}%)`);
    box.setAttribute('aria-label', `Practice accuracy over the last ${n} weeks, from ${Math.round(first.share * 100)}% to ${Math.round(last.share * 100)}% of answers right. Use the arrow keys to read each week.`);
    const gain = Math.round((last.share - first.share) * 100);
    foot.replaceChildren(
      h('p', {}, 'Share of practice answers right, each week'),
      h('p', { class: 'delta' }, h('b', {}, `${gain >= 0 ? '+' : '−'}${Math.abs(gain)} pts`), `vs. ${n} weeks ago`));
  };
  el.replaceChildren(
    h('div', { class: 'card-head' }, h('h2', { id: 'perf-title' }, 'Practice accuracy'), picker('Practice period', WEEKS, '8', draw)),
    box, foot);
  draw('8');
}
