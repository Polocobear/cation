// The home page's learning path: the course in progress as a line of chapter milestones, finished, current and still
// locked, rising from the first chapter to the last. Each milestone shows its chapter's illustration (art.js) and opens
// the course outline, the only page a chapter has so far. The current chapter carries the next lesson and the one
// action that matters, Continue learning, with Q beside it. Below the path: the learner's other courses, kept small.

import { h, icon } from './ui.js?v=20261102-1';
import { ART } from './art.js?v=20261102-1';
import { journey, others, url } from './model.js?v=20261102-1';

const NS = 'http://www.w3.org/2000/svg';
const two = (n) => String(n).padStart(2, '0');
const Q_MARK = '<svg class="q-mark" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11.5" cy="11" r="7"/><path d="m13.6 13.6 5.4 5.6"/></svg>';

// Where each milestone sits, as percentages of the path's box: a gentle rise from lower left to upper right that
// leaves the upper left for the course's name.
const place = (i, count) => {
  const t = count > 1 ? i / (count - 1) : 0;
  return [10 + 79 * t, 66 - 52 * (0.85 * t + 0.15 * t * t)];
};

// A smooth line through the milestones (Catmull-Rom as cubic Béziers), one segment per step so the steps already
// taken can be drawn differently from those ahead. Points are in pixels, so the line keeps its weight and dashes.
const r1 = (v) => Math.round(v * 10) / 10;
function segments(pts) {
  return pts.slice(1).map(([x, y], j) => {
    const i = j + 1, [x0, y0] = pts[i - 2] || pts[i - 1], [x1, y1] = pts[i - 1], [x3, y3] = pts[i + 1] || [x, y];
    return `M${r1(x1)} ${r1(y1)}C${r1(x1 + (x - x0) / 6)} ${r1(y1 + (y - y0) / 6)} ${r1(x - (x3 - x1) / 6)} ${r1(y - (y3 - y1) / 6)} ${r1(x)} ${r1(y)}`;
  });
}

function plate(ch, i) {
  const art = ART[ch.art];
  const badge = ch.state === 'done' ? icon('check') : ch.state === 'locked' ? icon('lock') : '';
  return h('span', { class: 'plate', 'aria-hidden': 'true' },
    art ? h('span', {
      class: 'plate-art',
      html: `<svg viewBox="-60 -60 120 120"><defs><clipPath id="ch-clip-${i}"><circle r="58"/></clipPath></defs><g clip-path="url(#ch-clip-${i})">${art()}</g></svg>`,
    }) : h('span', { class: 'plate-num' }, two(ch.number)),
    badge && h('span', { class: 'badge', html: badge }));
}

export function renderJourney(el, { onAsk }) {
  const { course, chapters } = journey;
  const p = course.progress, current = chapters.find((c) => c.state === 'current');
  const pts = chapters.map((_, i) => place(i, chapters.length));
  const at = chapters.indexOf(current);

  const line = document.createElementNS(NS, 'svg');
  line.setAttribute('class', 'path-line');
  line.setAttribute('aria-hidden', 'true');
  const box = h('div', { class: 'path' }, line);
  // Drawn to the path's size whenever it changes.
  new ResizeObserver(([entry]) => {
    const { width: w, height: hgt } = entry.contentRect;
    line.setAttribute('viewBox', `0 0 ${w} ${hgt}`);
    line.innerHTML = segments(pts.map(([x, y]) => [(x / 100) * w, (y / 100) * hgt]))
      .map((d, j) => `<path class="${j < at ? 'is-done' : 'is-ahead'}" d="${d}"${j < at ? ' pathLength="1"' : ''}/>`).join('');
  }).observe(box);

  const resume = course.next ? course.next.href : course.outline;
  const items = chapters.map((ch, i) => {
    const [x, y] = pts[i];
    const status = ch.state === 'done' ? 'finished' : ch.state === 'current' ? `in progress, lesson ${p.lesson} of ${ch.lessons} next`
      : `opens when you finish chapter ${ch.number - 1}`;
    const link = h('a', {
      class: 'ch-link', href: ch.href,
      'aria-label': `Chapter ${ch.number}, ${ch.name}: ${status}. Opens the course outline.`,
    }, plate(ch, i), ch.state !== 'current' && h('span', { class: 'ch-label', 'aria-hidden': 'true' },
      h('span', { class: 'ch-name' }, h('span', { class: 'ch-num' }, two(ch.number)), ch.name),
      ch.line && h('span', { class: 'ch-line' }, ch.line)));

    const now = ch.state === 'current' && h('div', { class: 'now' },
      h('p', { class: 'eyebrow' }, `Chapter ${ch.number} · in progress`),
      h('h3', {}, ch.name),
      h('p', { class: 'now-meta' },
        h('span', { class: 'pips', 'aria-hidden': 'true' },
          Array.from({ length: ch.lessons }, (_, k) => h('i', { class: k + 1 < p.lesson ? 'is-done' : k + 1 === p.lesson ? 'is-now' : '' }))),
        `Lesson ${p.lesson} of ${ch.lessons}`),
      h('div', { class: 'now-acts' },
        h('a', { class: 'continue', href: resume, html: `Continue learning${icon('arrow')}` }),
        h('button', { type: 'button', class: 'ask-q', 'data-q': '', onclick: () => onAsk({ name: ch.name }), html: `${Q_MARK}Ask Q` })),
      !course.next && h('p', { class: 'continue-note' }, 'Lessons are in development, so this opens the course outline.'));

    return h('li', {
      class: `chapter is-${ch.state}`, style: `--x: ${x}%; --y: ${y}%; --i: ${i}`,
      'aria-current': ch.state === 'current' ? 'step' : null,
    }, link, now);
  });

  el.replaceChildren(
    h('div', { class: 'journey-head' },
      h('p', { class: 'eyebrow' }, `${course.subjectName} · your path`),
      h('h2', { id: 'journey-title' }, course.title),
      h('p', { class: 'journey-sum' }, course.summary),
      h('p', { class: 'journey-meta' }, `${p.done} of ${p.total} lessons · chapter ${current.number} of ${chapters.length} · `,
        h('a', { href: course.outline }, 'Course outline'))),
    (box.append(h('ol', { class: 'chapters', 'aria-label': `${course.title}: chapters` }, items)), box));
}

// ---------------------------------------------------------------- the other courses

export function renderOthers(el) {
  el.replaceChildren(
    h('div', { class: 'more-head' },
      h('h2', { class: 'eyebrow', id: 'more-title' }, 'Your other courses'),
      h('p', { class: 'more-links' },
        h('a', { href: '#/learning', html: `All your courses${icon('arrow')}` }),
        h('a', { href: url('/explore/'), html: `Explore subjects${icon('arrow')}` }))),
    h('ul', { class: 'more-list', role: 'list' }, others.map((c) => {
      const p = c.progress, mod = c.modules[p.module];
      const meta = c.next ? `Next lesson: ${c.next.title}` : p.status === 'new' ? `${c.modules.length} chapters · ${c.weeks} weeks`
        : `Chapter ${p.module + 1} of ${c.modules.length} · ${mod.name}`;
      return h('li', {},
        h('a', {
          class: 'course-card', href: c.next ? c.next.href : c.href,
          'aria-label': `${c.title}. ${meta}. ${c.next ? 'Opens the lesson.' : 'Opens the course page.'}`,
        },
          h('img', { src: c.picture, alt: '', loading: 'lazy', decoding: 'async' }),
          h('span', { class: 'cc-text', 'aria-hidden': 'true' },
            h('span', { class: 'cc-subject' }, c.subjectName),
            h('span', { class: 'cc-title' }, c.title),
            h('span', { class: 'cc-meta' }, meta)),
          h('span', { html: icon('arrow') }).firstChild));
    })));
}
