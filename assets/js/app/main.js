// CATION student dashboard. Builds the home view from the model (catalogue and learner records) and hands the other
// views and the shell their parts. See dashboard/index.html for the page and model.js for where the numbers come from.

import { h, icon } from './ui.js';
import { featured, map, url } from './model.js';
import { renderFeature, renderCourses, renderTasks, renderAgenda, renderDone } from './panels.js';
import { renderMap } from './map.js';
import { renderStudy, renderPerf } from './charts.js';
import { router, q, search, topBar } from './shell.js';

const assistant = q();
const ask = (concept) => assistant.open({ concept });

renderFeature(document.getElementById('feature'), featured);
renderCourses(document.getElementById('courses'));
const home = renderMap(document.getElementById('umap'), { onAsk: ask });
// A task tied to a concept opens it on the map; any other goes where it points.
const onTask = (t) => {
  if (!t.concept) { location.href = t.href; return; }
  if (!location.hash || location.hash === '#/') return home.show(t.concept);
  addEventListener('hashchange', () => home.show(t.concept), { once: true });
  location.hash = '#/';
};
renderTasks(document.getElementById('tasks'), { onConcept: (id) => onTask({ concept: id }) });
renderStudy(document.getElementById('study'));
renderDone(document.getElementById('done'));
renderPerf(document.getElementById('perf'));
document.querySelector('.dash').classList.add('is-ready');

topBar({ onTask });
search({ ask: (question) => assistant.open({ question }) });

const head = (title, text) => h('div', { class: 'page-head' }, h('h2', {}, title), h('p', {}, text));
router({
  courses(el) {
    const card = h('section', { class: 'card courses', 'aria-labelledby': 'all-courses-title' });
    renderCourses(card, { title: 'Enrolled', headingId: 'all-courses-title' });
    el.append(head('My Courses', 'The courses you’re enrolled in. Each opens its outline; lessons are in development.'), card,
      h('p', { class: 'page-note' }, h('a', { href: url('/explore/'), html: `Browse the full catalogue${icon('arrow')}` })));
  },
  knowledge(el) {
    const card = h('section', { class: 'card umap', 'aria-labelledby': 'all-map-title' });
    renderMap(card, { onAsk: ask, headingId: 'all-map-title', more: false });
    el.append(head('Knowledge', `The Understanding Map for ${map.course.title}. Maps for your other courses come with their lessons. States here come from sample practice records.`), card);
  },
  calendar(el) {
    const card = h('section', { class: 'card' });
    renderAgenda(card, { onConcept: (id) => onTask({ concept: id }) });
    el.append(head('Calendar', 'Everything due, by day. A full calendar with your own events is planned.'), card);
  },
  settings(el) {
    el.append(head('Settings', 'There are no accounts in this prototype yet, so there is nothing to set. Notifications you have read are remembered on this device only.'),
      h('p', { class: 'page-note' }, h('a', { href: '#/', html: `Back to Home${icon('arrow')}` })));
  },
});
