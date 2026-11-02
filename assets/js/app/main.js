// CATION student dashboard. Home is the learning path for the course in progress (journey.js) beside the Learning
// Rhythm rail (rhythm.js), with the learner's other courses below; My Learning holds the course list and the
// Understanding Map. The lesson (lesson.js), Ask Q (ask.js) and the study room (session.js) are views of the same
// application. See dashboard/index.html for the page and model.js for where the numbers come from.

import { h, icon } from './ui.js?v=20261102-5';
import { map, url, refresh } from './model.js?v=20261102-5';
import * as store from './store.js?v=20261102-5';
import { renderJourney, renderOthers } from './journey.js?v=20261102-5';
import { renderRhythm } from './rhythm.js?v=20261102-5';
import { renderCourses } from './panels.js?v=20261102-5';
import { renderMap } from './map.js?v=20261102-5';
import { renderLesson } from './lesson.js?v=20261102-5';
import { renderAsk } from './ask.js?v=20261102-5';
import { renderSession } from './session.js?v=20261102-5';
import { router, search, account, greeting } from './shell.js?v=20261102-5';

// Q opens as a view of its own, told where it was opened from (a lesson step, a concept, a chapter) or what was asked.
let assistant = null, pendingQ = null;
const openQ = (opts) => {
  if (assistant && location.hash.startsWith('#/q')) assistant.open(opts);
  else { pendingQ = opts; location.hash = '#/q'; }
};
search({ ask: (question) => openQ({ question }) });
account();

// What this device has recorded changes the figures; each view that shows them draws again when it has.
let seen = store.stamp();
const changed = (since) => {
  const now = store.stamp();
  if (now !== seen) { refresh(); seen = now; }
  return now !== since;
};

const head = (title, text) => h('div', { class: 'page-head' }, h('h1', {}, title), h('p', {}, text));
let understanding = null, lesson = null, room = null, homeAt = null, learningAt = null;

router({
  home: {
    draw(el) { el.querySelector('.greeting').textContent = greeting(); },
    enter(el) {
      if (!changed(homeAt)) return;
      homeAt = store.stamp();
      renderJourney(el.querySelector('#journey'), { onAsk: ({ name }) => openQ({ from: { kind: 'chapter', name } }) });
      renderRhythm(el.querySelector('#rhythm'), { onReview: (id) => { location.hash = `#/learning/${id}`; } });
      renderOthers(el.querySelector('#more'));
      el.classList.add('is-ready');
    },
  },
  learning: {
    draw() {},
    enter(el, concept) {
      if (changed(learningAt)) {
        learningAt = store.stamp();
        const courses = h('section', { class: 'card courses', 'aria-labelledby': 'learn-courses-title' });
        renderCourses(courses, { title: 'Your courses', headingId: 'learn-courses-title' });
        const mapCard = h('section', { class: 'card umap', 'aria-labelledby': 'learn-map-title' });
        understanding = renderMap(mapCard, { onAsk: (c) => openQ({ from: { kind: 'concept', id: c.id, name: c.name } }), headingId: 'learn-map-title', more: false });
        el.replaceChildren(
          head('My Learning', `Your courses, and the Understanding Map for ${map.course.title}. Maps for your other courses come with their lessons. Progress and practice records here are sample data, with anything you’ve answered in this browser added.`),
          h('div', { class: 'learning-grid' }, courses, mapCard),
          h('p', { class: 'page-note' }, h('a', { href: url('/explore/'), html: `Browse the full catalogue${icon('arrow')}` })));
      }
      if (concept) understanding.show(concept);
    },
  },
  lesson: {
    draw(el) { lesson = renderLesson(el, { onAsk: (from) => openQ({ from }) }); },
    enter(el, step) { lesson.show(step); },
  },
  q: {
    draw(el) { assistant = renderAsk(el); },
    enter(el, topic) { assistant.open({ ...pendingQ, topic }); pendingQ = null; },
  },
  session: {
    draw(el) { room = renderSession(el); },
    enter() { room.enter(); },
    leave() { room.leave(); },
  },
  settings: {
    draw(el) {
      el.append(head('Settings', 'There are no accounts in this prototype yet. What you do here, in the lesson, with Q and in the study room, is kept in this browser only.'),
        h('div', { class: 'page-note' },
          h('button', { type: 'button', onclick: () => { store.forget(); location.hash = '#/'; location.reload(); }, html: `${icon('restart')}Start the prototype afresh` }),
          h('a', { href: '#/', html: `Back to Home${icon('arrow')}` })),
        h('p', { class: 'settings-note' }, 'Starting afresh forgets the lesson’s progress, your answers, your questions to Q and your study-room notes. The sample learner’s records stay.'));
    },
  },
});
