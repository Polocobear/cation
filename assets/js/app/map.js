// The Understanding Map: the concepts of the course in progress, joined where one is needed to understand the next.
// Each concept shows its state (worked out from its practice record in model.js). Pointing at one lights its links
// and neighbours; choosing one (click, Enter or Space) opens what it is, the record behind its state, what it builds
// on and leads to, and the way into the course. The arrow keys move between concepts by direction.

import { h, icon } from './ui.js?v=20261102-4';
import { map, STATES, MASTERY_RULE, SAMPLE } from './model.js?v=20261102-4';

const NS = 'http://www.w3.org/2000/svg';
const ago = (n) => (n === 0 ? 'today' : n === 1 ? 'yesterday' : `${n} days ago`);

export function renderMap(el, { onAsk, headingId = 'map-title', more = true } = {}) {
  const byId = new Map(map.concepts.map((c) => [c.id, c]));
  const needs = (id) => map.links.filter((l) => l.to === id);
  const leads = (id) => map.links.filter((l) => l.from === id);

  const field = h('div', { class: 'map-field', role: 'group', 'aria-label': `Concepts in ${map.course.title}` });
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'map-links');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');
  const lines = map.links.map((l) => {
    const a = byId.get(l.from), b = byId.get(l.to), line = document.createElementNS(NS, 'line');
    for (const [k, v] of [['x1', a.x], ['y1', a.y], ['x2', b.x], ['y2', b.y]]) line.setAttribute(k, v);
    svg.append(line);
    return { ...l, line };
  });
  field.append(svg);

  const nodes = new Map();
  for (const c of map.concepts) {
    const focus = c.id === map.focus;
    const node = h('button', {
      type: 'button', class: `node${focus ? ' is-focus' : ''}`, 'data-state': c.state, 'data-id': c.id,
      'data-label': c.label || null, style: `--x: ${c.x}%; --y: ${c.y}%`,
      'aria-expanded': 'false', 'aria-label': `${c.name}: ${STATES[c.state]}${focus ? ', the lesson in progress' : ''}`,
    }, h('span', { class: 'orb' }), h('span', { class: 'node-label', 'aria-hidden': 'true' }, c.name));
    nodes.set(c.id, node);
    field.append(node);
  }

  const scroll = h('div', { class: 'map-scroll' }, field);
  const legend = h('p', { class: 'map-legend' },
    Object.entries(STATES).map(([k, label]) => h('span', { 'data-state': k }, h('i'), label)));

  // Lighting a concept: its links, the concepts at their other ends, and the rest faded back.
  let selected = null, pointed = null;
  const light = (id) => {
    field.classList.toggle('is-focused', !!id);
    const near = new Set(id ? [id] : []);
    for (const l of lines) {
      const on = !!id && (l.from === id || l.to === id);
      l.line.classList.toggle('is-lit', on);
      if (on) { near.add(l.from); near.add(l.to); }
    }
    for (const [k, n] of nodes) n.classList.toggle('is-near', near.has(k));
  };
  const relight = () => light(pointed || selected);

  let detail = null;
  const close = (refocus) => {
    if (!selected) return;
    nodes.get(selected).setAttribute('aria-expanded', 'false');
    if (refocus) nodes.get(selected).focus();
    selected = null;
    detail?.remove();
    detail = null;
    relight();
  };

  const open = (id) => {
    if (selected === id) return close(true);
    close();
    const c = byId.get(id);
    selected = id;
    nodes.get(id).setAttribute('aria-expanded', 'true');
    const chips = (links, end) => links.map((l) =>
      h('button', { type: 'button', title: l.why, onclick: () => { open(l[end]); nodes.get(l[end]).focus(); } }, byId.get(l[end]).name));
    const before = needs(id), after = leads(id);
    const verb = { new: 'See it in the outline', review: 'Review in the outline', developing: 'Continue in the outline', mastered: 'Open in the outline' }[c.state];
    detail = h('div', { class: 'map-detail', role: 'dialog', 'aria-label': c.name, 'data-side': c.x > 50 ? 'left' : 'right' },
      h('button', { type: 'button', class: 'x', 'aria-label': 'Close', onclick: () => close(true), html: icon('close') }),
      h('span', { class: 'state', 'data-state': c.state }, h('i'), `${STATES[c.state]} · Chapter ${c.module + 1}: ${c.moduleName}`),
      h('h3', {}, c.name),
      h('p', {}, c.about),
      h('p', { class: 'evidence', title: MASTERY_RULE },
        c.answered
          ? `${SAMPLE ? 'Sample record: ' : ''}${c.right} of ${c.answered} practice answers right, last practised ${ago(c.lastDay)}.`
          : `${SAMPLE ? 'Sample record: ' : ''}not practised yet.`),
      before.length ? h('p', { class: 'rel' }, 'Builds on', chips(before, 'from')) : null,
      after.length ? h('p', { class: 'rel' }, 'Leads to', chips(after, 'to')) : null,
      h('div', { class: 'acts' },
        h('a', { href: map.course.outline, html: `${verb}${icon('arrow')}` }),
        h('button', { type: 'button', 'data-q': '', onclick: () => onAsk?.(c), html: `<svg class="q-mark" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11.5" cy="11" r="7"/><path d="m13.6 13.6 5.4 5.6"/></svg>Ask Q` })));
    el.append(detail);
    relight();
  };

  // Moving between concepts by direction: the nearest one within 60° of the arrow's way.
  const step = (from, key) => {
    const [dx, dy] = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] }[key];
    const a = byId.get(from);
    let best = null, score = Infinity;
    for (const c of map.concepts) {
      if (c.id === from) continue;
      const vx = c.x - a.x, vy = (c.y - a.y) * 0.6, d = Math.hypot(vx, vy);
      const cos = (vx * dx + vy * dy) / d;
      if (cos < 0.5) continue;
      const s = d * (2 - cos);
      if (s < score) { score = s; best = c.id; }
    }
    return best;
  };

  field.addEventListener('click', (e) => {
    const node = e.target.closest('.node');
    if (node) open(node.dataset.id);
  });
  field.addEventListener('pointerover', (e) => { const n = e.target.closest('.node'); if (n) { pointed = n.dataset.id; relight(); } });
  field.addEventListener('pointerleave', () => { pointed = null; relight(); });
  field.addEventListener('focusin', (e) => { const n = e.target.closest('.node'); if (n) { pointed = n.dataset.id; relight(); } });
  field.addEventListener('focusout', () => { pointed = null; relight(); });
  field.addEventListener('keydown', (e) => {
    const n = e.target.closest('.node');
    if (!n || !e.key.startsWith('Arrow')) return;
    const next = step(n.dataset.id, e.key);
    e.preventDefault();
    if (next) nodes.get(next).focus();
  });
  el.addEventListener('keydown', (e) => { if (e.key === 'Escape' && selected) { e.stopPropagation(); close(true); } });
  document.addEventListener('click', (e) => { if (selected && e.target.isConnected && !el.contains(e.target)) close(); });

  el.replaceChildren(
    h('div', { class: 'card-head' },
      h('h2', { id: headingId }, 'Your understanding', h('small', {}, map.course.title)),
      more ? h('a', { class: 'link-btn', href: '#/learning', html: `Explore all${icon('arrow')}` }) : null),
    scroll, legend);
  // Where the map is wider than its card (phones), it starts centred on the lesson in progress.
  requestAnimationFrame(() => { scroll.scrollLeft = (scroll.scrollWidth - scroll.clientWidth) / 2; });

  return {
    // Opens a concept from elsewhere (a task, a search), bringing the map into view first.
    // Called from a click elsewhere, so it waits for that click to finish, which would otherwise close it again.
    show(id) {
      el.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      setTimeout(() => {
        if (selected !== id) open(id);
        nodes.get(id).focus({ preventScroll: true });
      });
    },
  };
}
