// CATION student dashboard. Home is the learning path for the course in progress (journey.js) beside the Learning
// Rhythm rail (rhythm.js), with the learner's other courses below; My Learning holds the course list and the
// Understanding Map. See dashboard/index.html for the page and model.js for where the numbers come from.

import { h, icon } from './ui.js?v=20261102-2';
import { map, url } from './model.js?v=20261102-2';
import { renderJourney, renderOthers } from './journey.js?v=20261102-2';
import { renderRhythm } from './rhythm.js?v=20261102-2';
import { renderCourses } from './panels.js?v=20261102-2';
import { renderMap } from './map.js?v=20261102-2';
import { router, q, search, account, greeting } from './shell.js?v=20261102-2';

const assistant = q();
search({ ask: (question) => assistant.open({ question }) });
account();

const head = (title, text) => h('div', { class: 'page-head' }, h('h1', {}, title), h('p', {}, text));
let understanding = null;

router({
  home: {
    draw(el) {
      el.querySelector('.greeting').textContent = greeting();
      renderJourney(el.querySelector('#journey'), { onAsk: (concept) => assistant.open({ concept }) });
      renderRhythm(el.querySelector('#rhythm'), { onReview: (id) => { location.hash = `#/learning/${id}`; } });
      renderOthers(el.querySelector('#more'));
      el.classList.add('is-ready');
    },
  },
  learning: {
    draw(el) {
      const courses = h('section', { class: 'card courses', 'aria-labelledby': 'learn-courses-title' });
      renderCourses(courses, { title: 'Your courses', headingId: 'learn-courses-title' });
      const mapCard = h('section', { class: 'card umap', 'aria-labelledby': 'learn-map-title' });
      understanding = renderMap(mapCard, { onAsk: (concept) => assistant.open({ concept }), headingId: 'learn-map-title', more: false });
      el.append(
        head('My Learning', `Your courses, and the Understanding Map for ${map.course.title}. Maps for your other courses come with their lessons. Progress and practice records here are sample data.`),
        h('div', { class: 'learning-grid' }, courses, mapCard),
        h('p', { class: 'page-note' }, h('a', { href: url('/explore/'), html: `Browse the full catalogue${icon('arrow')}` })));
    },
    enter(el, concept) { if (concept) understanding.show(concept); },
  },
  settings: {
    draw(el) {
      el.append(head('Settings', 'There are no accounts in this prototype yet, so there is nothing to set.'),
        h('p', { class: 'page-note' }, h('a', { href: '#/', html: `Back to Home${icon('arrow')}` })));
    },
  },
});
