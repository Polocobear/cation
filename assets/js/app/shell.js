// The application around the dashboard: routing between views by the address's #/ path, the catalogue search, the
// notifications and account menus, and Q. Q is not connected to any AI service yet: its panel says so, shows what it
// would start from, and sends nothing anywhere.

import { h, icon, menu, dueLabel, daysFrom } from './ui.js';
import { catalogue, enrolled, featured, tasks, learner, url } from './model.js';

const ROUTES = { '': 'home', courses: 'courses', knowledge: 'knowledge', calendar: 'calendar', settings: 'settings' };
const TITLES = { home: 'Home', courses: 'My Courses', knowledge: 'Knowledge', calendar: 'Calendar', settings: 'Settings' };
const Q_MARK = '<svg class="q-mark" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11.5" cy="11" r="7"/><path d="m13.6 13.6 5.4 5.6"/></svg>';

// ---------------------------------------------------------------- views

export function router(views) {
  const drawn = new Set(['home']);
  const go = (first) => {
    const name = ROUTES[location.hash.replace(/^#\/?/, '').split('/')[0]] || 'home';
    for (const v of document.querySelectorAll('.view')) v.hidden = v.dataset.view !== name;
    for (const a of document.querySelectorAll('[data-route]')) {
      if (a.dataset.route === name) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    }
    if (!drawn.has(name)) { views[name](document.querySelector(`.view[data-view="${name}"]`)); drawn.add(name); }
    document.title = `${TITLES[name]} · CATION`;
    if (!first) { scrollTo(0, 0); document.getElementById('main').focus({ preventScroll: true }); }
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
      : ['You’re studying', `${featured.title} · ${mod.name}`];
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
    kind: 'module', label: m.name, sub: `${c.title} · Module ${i + 1}`, href: url(`/courses/${c.slug}/#syllabus-title`), text: m.name,
  }))),
  ...catalogue.subjects.map((s) => ({
    kind: 'subject', label: s.name, sub: `${catalogue.disciplines.find((d) => d.slug === s.discipline).name} · ${s.topics.join(', ')}`,
    href: url(`/${s.discipline}/#subjects`), text: `${s.name} ${s.topics.join(' ')}`,
  })),
];
const GROUPS = [['lesson', 'Lessons', 3], ['course', 'Courses', 5], ['module', 'Modules', 4], ['subject', 'Subjects', 3]];
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

export function search({ ask }) {
  const input = document.getElementById('search'), list = document.getElementById('search-results');
  const box = input.closest('.search');
  let options = [], active = -1;

  const option = (id, content, attrs) => h(attrs.href ? 'a' : 'button', { id, role: 'option', class: 'pop-item', 'aria-selected': 'false', tabindex: -1, ...attrs }, ...content);
  const draw = () => {
    const query = input.value.trim();
    const parts = [];
    let n = 0;
    if (!query) {
      parts.push(h('p', { class: 'pop-title' }, 'Your courses'));
      for (const c of enrolled.slice(0, 4)) parts.push(option(`sr-${n++}`, [h('span', { html: icon('course') }).firstChild, h('span', {}, c.title, h('small', {}, `${c.subjectName} · ${c.progress.percent}%`))], { href: c.href }));
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
        { type: 'button', class: 'pop-item ask', 'data-q': '', onclick: () => { close(); ask(query); } }));
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
  const openList = () => { if (list.hidden) { list.hidden = false; input.setAttribute('aria-expanded', 'true'); } draw(); };
  const close = () => { list.hidden = true; input.setAttribute('aria-expanded', 'false'); select(-1); };

  input.addEventListener('focus', openList);
  input.addEventListener('input', openList);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (list.hidden) openList();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      select(options.length ? (active + step + options.length) % options.length : -1);
    } else if (e.key === 'Enter') {
      const target = options[active] || (input.value.trim() && options.find((o) => o.matches('a[href*="/courses/"]')));
      if (target) { e.preventDefault(); target.click(); }
    } else if (e.key === 'Escape') {
      if (!list.hidden) { e.stopPropagation(); close(); } else input.blur();
    }
  });
  document.addEventListener('click', (e) => { if (!box.contains(e.target)) close(); });
  box.addEventListener('focusout', (e) => { if (!box.contains(e.relatedTarget)) close(); });

  // ⌘K or Ctrl+K from anywhere, and / when not typing.
  const mac = /Mac|iPhone|iPad/.test(navigator.platform);
  if (!mac) document.querySelector('[data-mod]').textContent = 'Ctrl';
  document.addEventListener('keydown', (e) => {
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName);
    if ((e.key === 'k' && (mac ? e.metaKey : e.ctrlKey)) || (e.key === '/' && !typing)) { e.preventDefault(); input.focus(); input.select(); }
  });
}

// ---------------------------------------------------------------- notifications and account

export function topBar({ onTask }) {
  document.getElementById('greeting').textContent = `Welcome back, ${learner.name}.`;
  const mod = featured.modules[featured.progress.module];
  document.getElementById('greeting-line').textContent = `You’re on module ${featured.progress.module + 1} of ${featured.title}: ${mod.name.toLowerCase()}.`;

  // Notifications: what's due in the next three days. Opening the menu marks them read on this device.
  const bell = document.getElementById('bell'), notes = document.getElementById('notes'), dot = bell.querySelector('.dot');
  const soon = tasks.filter((t) => daysFrom(t.date) <= 3);
  const KEY = 'cation-app-read';
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
  const unread = () => soon.filter((t) => !read().includes(t.id));
  const refresh = () => {
    dot.hidden = !unread().length;
    bell.setAttribute('aria-label', unread().length ? `Notifications, ${unread().length} new` : 'Notifications');
  };
  notes.replaceChildren(
    h('p', { class: 'pop-title' }, 'Due in the next three days'),
    ...(soon.length ? soon.map((t) => h('button', { type: 'button', class: 'pop-item', 'data-q': '', onclick: () => { closeNotes(); onTask(t); } },
      h('span', { html: icon(t.concept ? 'review' : 'lesson') }).firstChild,
      h('span', {}, t.title, h('small', {}, `${dueLabel(t.date)} · ${t.course.title}`))))
      : [h('p', { class: 'pop-empty' }, 'Nothing is due in the next three days.')]));
  const closeNotes = menu(bell, notes, {
    onOpen: () => {
      try { localStorage.setItem(KEY, JSON.stringify([...new Set([...read(), ...soon.map((t) => t.id)])])); } catch { /* private mode */ }
      refresh();
      notes.querySelector('.pop-item')?.focus();
    },
  });
  refresh();

  const me = document.getElementById('me'), account = document.getElementById('account');
  me.textContent = learner.initials;
  account.replaceChildren(
    h('div', { class: 'account-who' }, h('span', { class: 'avatar', 'aria-hidden': 'true' }, learner.initials),
      h('span', {}, h('b', {}, learner.name), h('span', {}, 'Sample learner · no sign-in yet'))),
    h('div', { class: 'pop-rule', role: 'separator' }),
    h('a', { class: 'pop-item', href: '#/settings', html: `${icon('module')}Settings` }),
    h('a', { class: 'pop-item', href: url('/'), html: `${icon('arrow')}CATION website` }));
  const closeAccount = menu(me, account, { onOpen: () => account.querySelector('.pop-item')?.focus() });
  account.addEventListener('click', (e) => { if (e.target.closest('a')) closeAccount(); });
}
