// The application around the home page: routing between views by the address's #/ path, the catalogue search, the
// account menu and Q. Q is not connected to any AI service yet: its panel says so, shows what it would start from, and
// sends nothing anywhere.

import { h, icon, menu } from './ui.js?v=20261102-2';
import { catalogue, enrolled, featured, learner, url } from './model.js?v=20261102-2';

// Older addresses (#/courses, #/knowledge) open My Learning, where their contents now live.
const ROUTES = { '': 'home', learning: 'learning', courses: 'learning', knowledge: 'learning', settings: 'settings' };
const TITLES = { home: 'Home', learning: 'My Learning', settings: 'Settings' };
const Q_MARK = '<svg class="q-mark" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11.5" cy="11" r="7"/><path d="m13.6 13.6 5.4 5.6"/></svg>';

// ---------------------------------------------------------------- views

// Each view draws itself the first time it is shown; `enter` runs every time, with what follows the view's name in
// the address (#/learning/conservation opens that concept on the map).
export function router(views) {
  const drawn = new Set();
  const go = (first) => {
    const [path, param] = location.hash.replace(/^#\/?/, '').split('/');
    const name = ROUTES[path] || 'home';
    const el = document.querySelector(`.view[data-view="${name}"]`);
    for (const v of document.querySelectorAll('.view')) v.hidden = v !== el;
    for (const a of document.querySelectorAll('[data-route]')) {
      if (a.dataset.route === name) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    }
    if (!drawn.has(name)) { views[name].draw(el); drawn.add(name); }
    views[name].enter?.(el, param);
    document.title = `${TITLES[name]} · CATION`;
    if (!first && !param) { scrollTo(0, 0); document.getElementById('main').focus({ preventScroll: true }); }
  };
  addEventListener('hashchange', () => go(false));
  go(true);
}

// ---------------------------------------------------------------- Q

export function q() {
  const panel = document.getElementById('q-panel'), body = document.getElementById('q-body');
  const navButton = document.querySelector('[data-q-open]');
  let opener = null;
  const close = () => {
    if (panel.hidden) return;
    panel.hidden = true;
    navButton.setAttribute('aria-expanded', 'false');
    opener?.focus();
  };
  const open = ({ concept, question } = {}) => {
    opener = document.activeElement;
    const mod = featured.modules[featured.progress.module];
    const [label, value] = question ? ['You asked', `“${question}”`]
      : concept ? ['You were looking at', `${concept.name}, in ${featured.title}`]
      : ['You’re studying', `${featured.title} · chapter ${featured.progress.module + 1}, ${mod.name}`];
    body.replaceChildren(
      h('p', {}, 'Q will be CATION’s teaching assistant. It isn’t connected to an AI service in this prototype, so it can’t answer yet.'),
      h('div', { class: 'q-context' }, h('span', {}, label), h('b', {}, value)),
      h('p', {}, 'When it is connected, Q will start from what you’re studying. Its full teaching experience is still being designed.'),
      h('p', { class: 'q-status' }, 'Not connected. Nothing is sent.'));
    panel.hidden = false;
    navButton.setAttribute('aria-expanded', 'true');
    panel.querySelector('[data-q-close]').focus();
  };
  navButton.setAttribute('aria-expanded', 'false');
  navButton.addEventListener('click', (e) => { e.stopPropagation(); panel.hidden ? open() : close(); });
  panel.querySelector('[data-q-close]').addEventListener('click', close);
  panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  document.addEventListener('click', (e) => { if (!panel.hidden && e.target.isConnected && !panel.contains(e.target) && !e.target.closest('[data-q]')) close(); });
  return { open };
}

// ---------------------------------------------------------------- search

// Everything a learner might look for: lessons that exist, courses, their modules, subjects and their topics.
const INDEX = [
  // Lessons that already exist on the site, from the learner's courses.
  ...enrolled.filter((c) => c.next).map((c) => ({
    kind: 'lesson', label: c.next.title, sub: `${c.title} · ${c.modules[c.progress.module].name}`, href: c.next.href,
    text: `${c.next.title} ${c.modules[c.progress.module].name} ${c.title}`,
  })),
  ...catalogue.courses.map((c) => ({
    kind: 'course', label: c.title, sub: `${catalogue.subjects.find((s) => s.slug === c.subject).name} · ${c.level} · ${c.weeks} weeks`,
    href: url(`/courses/${c.slug}/`), text: `${c.title} ${c.summary}`,
  })),
  ...catalogue.courses.flatMap((c) => c.modules.map((m, i) => ({
    kind: 'module', label: m.name, sub: `${c.title} · Chapter ${i + 1}`, href: url(`/courses/${c.slug}/#syllabus-title`), text: m.name,
  }))),
  ...catalogue.subjects.map((s) => ({
    kind: 'subject', label: s.name, sub: `${catalogue.disciplines.find((d) => d.slug === s.discipline).name} · ${s.topics.join(', ')}`,
    href: url(`/${s.discipline}/#subjects`), text: `${s.name} ${s.topics.join(' ')}`,
  })),
];
const GROUPS = [['lesson', 'Lessons', 3], ['course', 'Courses', 5], ['module', 'Chapters', 4], ['subject', 'Subjects', 3]];
const ICONS = { lesson: 'lesson', course: 'course', module: 'module', subject: 'subject' };

function find(query) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const hits = INDEX.map((item) => {
    const label = item.label.toLowerCase(), text = item.text.toLowerCase();
    if (!terms.every((t) => text.includes(t) || label.includes(t))) return null;
    const score = terms.reduce((s, t) => s + (label.startsWith(t) ? 3 : label.includes(t) ? 2 : 1), 0);
    return { ...item, score };
  }).filter(Boolean).sort((a, b) => b.score - a.score);
  return GROUPS.map(([kind, title, n]) => [title, hits.filter((x) => x.kind === kind).slice(0, n)]).filter(([, xs]) => xs.length);
}

const mark = (text, query) => {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const span = document.createElement('span');
  let html = text.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
  for (const t of terms) html = html.replace(new RegExp(`(${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig'), '<mark>$1</mark>');
  span.innerHTML = html;
  return span;
};

// Search opens over the page (from the sidebar, ⌘K or Ctrl+K, or /) and closes with Escape or a click outside it.
export function search({ ask }) {
  const layer = document.getElementById('search-layer'), input = document.getElementById('search');
  const list = document.getElementById('search-results');
  let options = [], active = -1, opener = null;

  const option = (id, content, attrs) => h(attrs.href ? 'a' : 'button', { id, role: 'option', class: 'pop-item', 'aria-selected': 'false', tabindex: -1, ...attrs }, ...content);
  const draw = () => {
    const query = input.value.trim();
    const parts = [];
    let n = 0;
    if (!query) {
      parts.push(h('p', { class: 'pop-title' }, 'Your courses'));
      for (const c of enrolled.slice(0, 4)) parts.push(option(`sr-${n++}`, [h('span', { html: icon('course') }).firstChild, h('span', {}, c.title, h('small', {}, `${c.subjectName} · ${c.progress.done} of ${c.progress.total} lessons`))], { href: c.href }));
    } else {
      const groups = find(query);
      for (const [title, items] of groups) {
        parts.push(h('p', { class: 'pop-title' }, title));
        for (const it of items) parts.push(option(`sr-${n++}`, [h('span', { html: icon(ICONS[it.kind]) }).firstChild, h('span', {}, mark(it.label, query), h('small', {}, it.sub))], { href: it.href }));
      }
      if (!groups.length) parts.push(h('p', { class: 'pop-empty' }, `Nothing in the catalogue matches “${query}”.`));
      parts.push(h('div', { class: 'pop-rule', role: 'separator' }));
      parts.push(option(`sr-${n++}`, [h('span', { html: icon('search') }).firstChild, h('span', {}, 'See every match in Explore')], { href: url(`/explore/?q=${encodeURIComponent(query)}`) }));
      parts.push(option(`sr-${n++}`, [h('span', { class: 'ask-mark', html: Q_MARK }).firstChild, h('span', {}, `Ask Q “${query}”`, h('small', {}, 'Prototype: Q isn’t connected yet'))],
        { type: 'button', class: 'pop-item ask', 'data-q': '', onclick: () => { close(false); ask(query); } }));
    }
    list.replaceChildren(...parts);
    options = [...list.querySelectorAll('[role="option"]')];
    select(-1);
  };
  const select = (i) => {
    options[active]?.setAttribute('aria-selected', 'false');
    active = i;
    if (i >= 0) {
      options[i].setAttribute('aria-selected', 'true');
      options[i].scrollIntoView({ block: 'nearest' });
      input.setAttribute('aria-activedescendant', options[i].id);
    } else input.removeAttribute('aria-activedescendant');
  };
  const open = () => {
    if (!layer.hidden) { input.select(); return; }
    opener = document.activeElement;
    layer.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    input.value = '';
    draw();
    input.focus();
  };
  const close = (refocus = true) => {
    if (layer.hidden) return;
    layer.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    select(-1);
    if (refocus) opener?.focus?.();
  };

  input.addEventListener('input', draw);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      select(options.length ? (active + step + options.length) % options.length : -1);
    } else if (e.key === 'Enter') {
      const target = options[active] || (input.value.trim() && options.find((o) => o.matches('a[href*="/courses/"]')));
      if (target) { e.preventDefault(); target.click(); }
    } else if (e.key === 'Escape') {
      e.preventDefault(); close();
    } else if (e.key === 'Tab') {
      e.preventDefault();                       // focus stays in the search; the arrow keys move through the results
    }
  });
  list.addEventListener('click', (e) => { if (e.target.closest('a')) close(false); });
  layer.addEventListener('click', (e) => { if (e.target === layer) close(); });
  for (const b of document.querySelectorAll('[data-search-open]')) b.addEventListener('click', (e) => { e.stopPropagation(); open(); });

  const mac = /Mac|iPhone|iPad/.test(navigator.platform);
  if (!mac) for (const k of document.querySelectorAll('[data-mod]')) k.textContent = 'Ctrl';
  document.addEventListener('keydown', (e) => {
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName);
    if ((e.key === 'k' && (mac ? e.metaKey : e.ctrlKey)) || (e.key === '/' && !typing)) { e.preventDefault(); open(); }
  });
}

// ---------------------------------------------------------------- account

export function account() {
  const me = document.getElementById('me'), panel = document.getElementById('account');
  me.textContent = learner.initials;
  panel.replaceChildren(
    h('div', { class: 'account-who' }, h('span', { class: 'avatar', 'aria-hidden': 'true' }, learner.initials),
      h('span', {}, h('b', {}, learner.name), h('span', {}, 'Sample learner · no sign-in yet'))),
    h('div', { class: 'pop-rule', role: 'separator' }),
    h('a', { class: 'pop-item', href: '#/settings', html: `${icon('module')}Settings` }),
    h('a', { class: 'pop-item', href: url('/'), html: `${icon('arrow')}CATION website` }));
  const close = menu(me, panel, { onOpen: () => panel.querySelector('.pop-item')?.focus() });
  panel.addEventListener('click', (e) => { if (e.target.closest('a')) close(); });
}

// A greeting for the time of day.
export const greeting = () => {
  const hour = new Date().getHours();
  return `Good ${hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'}, ${learner.name}.`;
};
