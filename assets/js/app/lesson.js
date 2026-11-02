// The lesson: Inside the Particle Zoo, chapter 2, lesson 3, "Can light turn into matter?". Five steps, each a short
// text on the left and one thing to do on the right: a prediction, an energy ledger to balance, an experiment in a
// bubble chamber, two questions, and a look back. Every step is its own address (#/lesson/3), so the browser's Back
// works; progress is kept on this device (store.js), so the dashboard's Continue picks up at the step reached and a
// reload loses nothing. Answering adds to the Understanding Map's practice record; finishing adds the lesson to the
// learning rhythm. The physics is in chamber.js.

import { h, icon, Q_MARK } from './ui.js?v=20261102-5';
import * as store from './store.js?v=20261102-5';
import { createChamber, PAIR, ME, mev } from './chamber.js?v=20261102-5';

const { LESSON } = store;

const STEPS = [
  { short: 'Question', name: 'The question' },
  { short: 'Intuition', name: 'The intuition' },
  { short: 'Experiment', name: 'The experiment' },
  { short: 'Check', name: 'Check your understanding' },
  { short: 'Reflect', name: 'Reflection' },
];
const OBJECTIVES = [
  ['short', 'Find an energy too low to make a pair'],
  ['pair', 'Make an electron–positron pair'],
  ['alone', 'Fire a photon with energy to spare, and no nucleus'],
];
const fresh = () => ({ reached: 1, prediction: null, built: null, fired: [], q1: null, q2: null });

export function renderLesson(el, { onAsk }) {
  let s = { ...fresh(), ...store.read('lesson', {}) };
  const save = () => store.write('lesson', s);
  const done = [
    () => !!s.prediction,
    () => s.built === 'pair',
    () => OBJECTIVES.every(([k]) => s.fired.includes(k)),
    () => !!(s.q1?.right && s.q2?.right),
    () => !!s.completedAt,
  ];
  let at = 0;

  // ---- the frame: where you are, the five steps, the text column and the stage
  const steps = h('ol', { class: 'steps', 'aria-label': 'Lesson steps' });
  const text = h('section', { class: 'lesson-text', 'aria-live': 'off' });
  const stage = h('div', { class: 'stage' });
  el.replaceChildren(
    h('div', { class: 'lesson-top' },
      h('a', { class: 'lesson-back', href: '#/', html: `${icon('back')}Your path` }),
      h('p', { class: 'lesson-where' }, `${LESSON.courseTitle} · Chapter ${LESSON.chapter}, lesson ${LESSON.number} of ${LESSON.of}`)),
    steps, text, stage);

  const drawSteps = () => steps.replaceChildren(...STEPS.map((st, i) => {
    const n = i + 1, open = n <= s.reached, isDone = done[i]() && (n < s.reached || n === 5);
    return h('li', { class: `${isDone ? 'is-done' : ''}${n === at ? ' is-now' : ''}` },
      h('button', {
        type: 'button', disabled: !open, 'aria-current': n === at ? 'step' : null,
        'aria-label': `Step ${n}, ${st.name}${isDone ? ', done' : n === at ? ', current' : open ? '' : ', not reached yet'}`,
        onclick: () => { location.hash = `#/lesson/${n}`; },
      }, h('span', { class: 'step-mark', html: isDone ? icon('check') : String(n) }), h('span', { class: 'step-name' }, st.short)));
  }));

  // ---- the foot of the text column: Ask Q, Back and Continue
  const foot = (hint, last = false) => {
    const next = h('button', { type: 'button', class: 'continue', html: `Continue${icon('arrow')}`, onclick: () => go(at + 1) });
    const why = h('p', { class: 'foot-hint' });
    const sync = () => { const ok = done[at - 1](); next.disabled = !ok; why.textContent = ok ? '' : hint; drawSteps(); };
    return {
      sync,
      node: h('div', { class: 'lesson-foot' }, !last && why,
        h('div', { class: 'foot-row' },
          h('button', { type: 'button', class: 'ask-q', onclick: () => onAsk({ kind: 'lesson', step: at, name: STEPS[at - 1].name }), html: `${Q_MARK}Ask Q about this` }),
          h('span', { class: 'foot-go' },
            at > 1 && !last && h('button', { type: 'button', class: 'back-btn', onclick: () => { location.hash = `#/lesson/${at - 1}`; } }, 'Back'),
            last ? h('a', { class: 'continue', href: '#/', html: `Back to your path${icon('arrow')}` }) : next))),
    };
  };
  const go = (n) => { s.reached = Math.max(s.reached, n); save(); location.hash = `#/lesson/${n}`; };
  const head = (title) => [
    h('p', { class: 'eyebrow' }, `Step ${at} of 5 · ${STEPS[at - 1].name}`),
    h('h2', { tabindex: -1 }, title)];
  const say = (live, msg, tone = '') => { live.className = `say ${tone}`; live.textContent = msg; };

  // ---------------------------------------------------------------- 1 · the question
  function question() {
    const f = foot('Make a prediction to continue.');
    const live = h('p', { class: 'say', 'aria-live': 'polite' });
    const picks = [['yes', 'Yes, it can'], ['no', 'No: light has no mass'], ['unsure', 'I’m not sure']];
    const group = h('div', { class: 'picks', role: 'group', 'aria-label': 'Your prediction' });
    const draw = () => group.replaceChildren(...picks.map(([k, label]) => h('button', {
      type: 'button', class: 'pick', 'aria-pressed': String(s.prediction === k),
      onclick: () => { s.prediction = k; save(); draw(); say(live, 'Noted. You’ll put it to the test in step 3.'); f.sync(); },
    }, label)));
    draw();
    if (s.prediction) say(live, 'Noted. You’ll put it to the test in step 3.');
    text.replaceChildren(...head('Can light turn into matter?'),
      h('p', { class: 'lead' }, 'Light has no mass. An electron does. Yet in photographs of particle detectors, electrons appear where gamma rays cross matter, with no electron going in.'),
      h('p', {}, 'Where do they come from? Before you find out, make a prediction: can a photon, a particle of light, become matter?'),
      group, live, f.node);
    const box = h('div', { class: 'stage-fill' });
    stage.replaceChildren(box, h('p', { class: 'stage-cap' }, 'A gamma-ray photon on its way to a lead nucleus'));
    createChamber(box).fire({ energy: 1.6, pending: true });
    f.sync();
  }

  // ---------------------------------------------------------------- 2 · the intuition
  function intuition() {
    const f = foot('Balance the ledger to continue.');
    const E = 1.6, SCALE = 1.8;
    const choices = [['e', 'e⁻', 'An electron'], ['p', 'e⁺', 'A positron'], ['pair', 'e⁻ + e⁺', 'An electron and a positron'], ['ee', 'e⁻ + e⁻', 'Two electrons']];
    const PARTS = { e: ['e'], p: ['p'], pair: ['e', 'p'], ee: ['e', 'e'] };
    const live = h('p', { class: 'say', 'aria-live': 'polite' });
    const after = h('div', { class: 'lg-bar' }), charge = h('b', { class: 'lg-charge' }), verdict = h('span', { class: 'lg-verdict' });
    const group = h('div', { class: 'lg-picks', role: 'group', 'aria-label': 'What the photon becomes' });
    const pct = (v) => `${(v / SCALE) * 100}%`;
    const FEEDBACK = {
      e: ['Energy is fine: 0.511 MeV of mass, and the rest as motion. But charge goes from 0 to −1, and charge is never made or lost.', 'no'],
      p: ['Energy is fine again. But charge goes from 0 to +1, and charge is never made or lost.', 'no'],
      ee: ['Two masses’ worth of energy, but charge goes from 0 to −2.', 'no'],
      pair: ['That balances. Charge: −1 + 1 = 0, as before. Energy: 1.022 MeV becomes the two masses and 0.578 MeV is left to move them. The positron is the electron’s antiparticle: the same mass, the opposite charge.', 'yes'],
    };
    const draw = () => {
      group.replaceChildren(...choices.map(([k, sym, label]) => h('button', {
        type: 'button', class: 'pick', 'aria-pressed': String(s.built === k), 'aria-label': label,
        onclick: () => { s.built = k; save(); draw(); f.sync(); },
      }, sym)));
      const parts = PARTS[s.built] || [];
      const rest = E - parts.length * ME;
      after.replaceChildren(...parts.map((p) => h('i', { class: `seg ${p}`, style: `width: ${pct(ME)}` }, h('span', {}, p === 'e' ? 'e⁻ mass' : 'e⁺ mass'))),
        parts.length ? h('i', { class: 'seg motion', style: `width: ${pct(rest)}` }, h('span', {}, `motion ${rest.toFixed(3)}`)) : h('i', { class: 'seg empty' }, h('span', {}, 'Choose above')));
      const q = parts.reduce((n, p) => n + (p === 'e' ? -1 : 1), 0);
      charge.textContent = parts.length ? `${parts.map((p, i) => (i ? (p === 'e' ? ' − 1' : ' + 1') : p === 'e' ? '−1' : '+1')).join('')}${parts.length > 1 ? ` = ${q < 0 ? '−' : ''}${Math.abs(q)}` : ''}` : '?';
      verdict.textContent = !parts.length ? '' : q === 0 ? 'balances' : 'doesn’t balance';
      verdict.className = `lg-verdict ${q === 0 ? 'ok' : 'off'}`;
      if (s.built) say(live, ...FEEDBACK[s.built]);
    };
    const ticks = h('div', { class: 'lg-scale', 'aria-hidden': 'true' }, [0, 0.5, 1, 1.5].map((v) => h('span', { style: `left: ${pct(v)}` }, v.toFixed(1))), h('span', { class: 'unit' }, 'MeV'));
    stage.replaceChildren(h('div', { class: 'ledger' },
      h('div', { class: 'lg-row lg-head' }, h('span'), ticks, h('span', { class: 'lg-col' }, 'Charge')),
      h('div', { class: 'lg-row' },
        h('span', { class: 'lg-label' }, h('span', { class: 'eyebrow' }, 'Before'), h('b', {}, 'γ, one photon')),
        h('div', { class: 'lg-bar' }, h('i', { class: 'seg photon', style: `width: ${pct(E)}` }, h('span', {}, `photon ${mev(E)}`))),
        h('b', { class: 'lg-charge' }, '0')),
      h('div', { class: 'lg-row lg-after' },
        h('span', { class: 'lg-label' }, h('span', { class: 'eyebrow' }, 'After'), h('b', {}, 'Your choice')),
        h('div', { class: 'lg-stack' }, group, after), h('span', { class: 'lg-q' }, charge, verdict)),
      h('p', { class: 'lg-note' }, 'Whatever energy doesn’t become mass becomes motion, so energy can always be made to balance. Charge can’t.')));
    text.replaceChildren(...head('Mass is stored energy'),
      h('p', { class: 'lead' }, 'E = mc² says mass is a form of energy. An electron at rest holds 0.511 MeV of it.'),
      h('p', {}, 'So a photon with enough energy could, in principle, pay for an electron. But a photon has no electric charge, and charge is never made or lost.'),
      h('p', { class: 'task' }, 'On the right, choose what a 1.60 MeV photon could become, and watch the ledger.'),
      live, f.node);
    draw();
    f.sync();
  }

  // ---------------------------------------------------------------- 3 · the experiment
  function experiment() {
    const f = foot('Complete all three to continue.');
    let energy = s.energy || 0.8, nucleus = true;
    const live = h('p', { class: 'say', 'aria-live': 'polite' });
    const list = h('ul', { class: 'objectives', 'aria-label': 'To do' });
    const drawList = () => list.replaceChildren(...OBJECTIVES.map(([k, label]) => h('li', { class: s.fired.includes(k) ? 'is-done' : '' },
      h('span', { class: 'obj-mark', html: s.fired.includes(k) ? icon('check') : '' }), label,
      h('span', { class: 'visually-hidden' }, s.fired.includes(k) ? ' (done)' : ''))));

    const box = h('div', { class: 'stage-fill' });
    const ch = createChamber(box, { at: (W, H) => ({ x: W * 0.33, y: H * 0.47 }), trace: true });
    const value = h('b', {}), fill = h('i'), out = h('output', { class: 'en-val' });
    const slider = h('input', { type: 'range', min: 0.5, max: 3, step: 0.01, value: energy, 'aria-label': 'Photon energy' });
    const sync = () => {
      value.replaceChildren(energy.toFixed(2), h('small', {}, ' MeV'));
      out.textContent = mev(energy);
      fill.style.width = `${((energy - 0.5) / 2.5) * 100}%`;
      slider.setAttribute('aria-valuetext', mev(energy));
      fill.classList.toggle('is-over', energy >= PAIR);
    };
    slider.addEventListener('input', () => { energy = Number(slider.value); sync(); });
    slider.addEventListener('keydown', (e) => { if (e.key === 'Enter') fire(); });
    const toggle = h('button', { type: 'button', class: 'switch', 'aria-pressed': 'true', onclick: () => {
      nucleus = !nucleus; toggle.setAttribute('aria-pressed', String(nucleus));
      ch.show({ energy, nucleus, pending: true });
    } }, h('i'), 'Lead nucleus in the path');
    const fire = () => {
      const r = ch.fire({ energy, nucleus, split: 0.25 + Math.random() * 0.5, seed: Math.random() });
      s.energy = energy;
      const before = done[2]();
      if (!s.fired.includes(r.outcome)) s.fired.push(r.outcome);
      if (!before && done[2]()) store.record('practice');
      save(); drawList(); f.sync();
      if (r.outcome === 'short') say(live, `No pair. ${mev(energy)} is ${mev(PAIR - energy, 3)} short of the 1.022 MeV that an electron’s and a positron’s masses add up to.${nucleus ? '' : ' (There’s no nucleus either.)'}`);
      else if (r.outcome === 'alone') say(live, 'No pair, though there’s energy to spare. With no nucleus to take up some of its momentum, a lone photon can’t become a pair: energy and momentum can’t both balance.');
      else say(live, `A pair. 1.022 MeV became the two particles’ mass; the other ${mev(r.T, 3)} is their motion, ${mev(r.Te)} for the electron and ${mev(r.Tp)} for the positron. They curve opposite ways because their charges are opposite.`, 'yes');
    };

    stage.replaceChildren(box,
      h('div', { class: 'readout' },
        h('span', { class: 'eyebrow' }, 'Photon energy'), value,
        h('span', { class: 'meter', 'aria-hidden': 'true' }, fill, h('span', { class: 'thr', style: `left: ${((PAIR - 0.5) / 2.5) * 100}%` }, h('span', {}, '1.022')))),
      h('ul', { class: 'legend-keys', 'aria-label': 'Key' },
        h('li', { class: 'k-e' }, 'Electron, e⁻'), h('li', { class: 'k-p' }, 'Positron, e⁺'),
        h('li', { class: 'k-g' }, 'Photon, γ (leaves no track)'), h('li', { class: 'k-b' }, 'Magnetic field into the screen')),
      h('div', { class: 'controls' },
        h('label', { class: 'en' }, h('span', {}, 'Energy'), slider, out),
        toggle,
        h('button', { type: 'button', class: 'fire', onclick: fire, html: `Fire photon${icon('arrow')}` })));
    ch.show({ energy, nucleus, pending: true });
    sync(); drawList();
    text.replaceChildren(...head('Find the threshold'),
      h('p', { class: 'lead' }, 'This is a bubble chamber, seen from above, in a magnetic field pointing into the screen. Charged particles leave trails of bubbles and curve: positive one way, negative the other.'),
      h('p', {}, 'Set the photon’s energy and fire it at a lead nucleus. Faster particles curve less; as they slow down, they spiral.'),
      list, live, f.node);
    f.sync();
  }

  // ---------------------------------------------------------------- 4 · check your understanding
  function check() {
    const f = foot('Answer both to continue.');
    const live1 = h('p', { class: 'say', 'aria-live': 'polite' }), live2 = h('p', { class: 'say', 'aria-live': 'polite' });
    const input = h('input', { type: 'number', step: 'any', min: 0, max: 3, inputmode: 'decimal', id: 'q1-in', placeholder: '0.00', value: s.q1?.value ?? '' });
    const capTop = h('p', { class: 'stage-cap' });
    const judge = (v) => {
      if (Math.abs(v - 0.478) <= 0.025) return [true, 'Right: 1.50 − 1.022 = 0.478 MeV. The nucleus takes a little too, but only a few electronvolts.'];
      if (Math.abs(v - 1.5) <= 0.03) return [false, 'That’s the photon’s whole energy. 1.022 MeV of it became the particles’ mass before any was left to move them.'];
      if (Math.abs(v - 0.239) <= 0.03) return [false, 'That’s each particle’s share if they split it evenly. The question asks for both together.'];
      if (Math.abs(v - 1.022) <= 0.03) return [false, 'That’s the energy that became their mass. How much is left over?'];
      if (Math.abs(v - 0.989) <= 0.03) return [false, 'You’ve taken off one electron’s mass. A positron is made too, with the same 0.511 MeV.'];
      return [false, 'Not quite. Start from the photon’s 1.50 MeV and take away what became mass.'];
    };
    const caption = () => { capTop.textContent = s.q1?.right ? 'Near a nucleus: 1.50 MeV → e⁻ + e⁺ + 0.478 MeV of motion' : 'Near a nucleus: 1.50 MeV → e⁻ + e⁺ + ? MeV of motion'; };
    const form = h('form', { class: 'num-ask', onsubmit: (e) => {
      e.preventDefault();
      const v = Number(String(input.value).replace(',', '.'));
      if (input.value === '' || Number.isNaN(v)) { say(live1, 'Type a number of MeV first.'); return; }
      const [right, msg] = judge(v);
      const first = !s.q1?.right;
      store.answer('pair-production', right);
      if (right && first) store.record('problem');
      s.q1 = { value: input.value, right: right || !!s.q1?.right }; save();
      say(live1, msg, right ? 'yes' : 'no'); caption(); f.sync();
    } }, h('label', { for: 'q1-in', class: 'visually-hidden' }, 'Kinetic energy in MeV'), input, h('span', { class: 'unit' }, 'MeV'), h('button', { type: 'submit', class: 'check-btn' }, 'Check'));

    const OPTIONS = [
      ['energy', 'There isn’t enough energy', false, 'There is: 1.50 MeV is more than the 1.022 MeV the two masses need. Something else is missing.'],
      ['momentum', 'Momentum can’t balance without something to take some of it', true, 'Right. The pair can never carry all of a photon’s momentum, so something else, a nucleus, has to take the rest.'],
      ['charge', 'Charge wouldn’t balance', false, 'It would: −1 + 1 = 0, the same as the photon’s. Something else is missing.'],
    ];
    const choices = h('div', { class: 'choices', role: 'group', 'aria-label': 'Why no pair appears' });
    const drawChoices = () => choices.replaceChildren(...OPTIONS.map(([k, label, right, msg]) => h('button', {
      type: 'button', class: `choice${s.q2?.choice === k ? (right ? ' is-right' : ' is-wrong') : ''}`, 'aria-pressed': String(s.q2?.choice === k),
      onclick: () => {
        const first = !s.q2?.right;
        store.answer('pair-production', right);
        if (right && first) store.record('problem');
        s.q2 = { choice: k, right: right || !!s.q2?.right }; save();
        drawChoices(); say(live2, msg, right ? 'yes' : 'no'); f.sync();
      },
    }, h('span', { class: 'choice-mark', 'aria-hidden': 'true' }), label)));
    drawChoices();
    if (s.q1) say(live1, judge(Number(s.q1.value))[1], judge(Number(s.q1.value))[0] ? 'yes' : 'no');
    if (s.q2) say(live2, OPTIONS.find(([k]) => k === s.q2.choice)[3], s.q2.choice === 'momentum' ? 'yes' : 'no');

    text.replaceChildren(...head('Two questions'),
      h('div', { class: 'quiz' },
        h('p', { class: 'q-num' }, '1'),
        h('div', {}, h('p', { class: 'q-text' }, 'A 1.50 MeV photon makes a pair near a nucleus. How much kinetic energy do the electron and positron carry between them?'), form, live1)),
      h('div', { class: 'quiz' },
        h('p', { class: 'q-num' }, '2'),
        h('div', {}, h('p', { class: 'q-text' }, 'The same photon crosses empty space, far from any nucleus. Why does no pair appear?'), choices, live2)),
      f.node);
    const top = h('div', { class: 'stage-fill' }), bottom = h('div', { class: 'stage-fill' });
    stage.replaceChildren(h('div', { class: 'stage-split' },
      h('div', { class: 'half' }, top, capTop),
      h('div', { class: 'half' }, bottom, h('p', { class: 'stage-cap' }, 'Far from any nucleus: 1.50 MeV → ?'))));
    createChamber(top, { at: (W, H) => ({ x: W * 0.3, y: H * 0.5 }) }).show({ energy: 1.5, split: 0.42, labels: false, seed: 0.62, zoom: 1.6 });
    createChamber(bottom).show({ energy: 1.5, nucleus: false, labels: false });
    caption();
    f.sync();
  }

  // ---------------------------------------------------------------- 5 · reflection
  function reflect() {
    if (!s.completedAt) { s.completedAt = Date.now(); save(); store.record('lesson'); }
    const f = foot('', true);
    const SAID = {
      yes: 'You predicted it could, and it can, on two conditions you found for yourself.',
      no: 'You predicted it couldn’t, because light has no mass. It can: mass is a form of energy, and a photon can carry plenty.',
      unsure: 'You weren’t sure at the start. Now you’ve made it happen yourself.',
    };
    text.replaceChildren(...head('Light can become matter'),
      h('p', { class: 'lead' }, SAID[s.prediction] || SAID.unsure),
      h('ol', { class: 'takeaways' },
        h('li', {}, h('b', {}, 'Enough energy. '), 'A photon can become an electron and a positron if it carries at least 1.022 MeV, their combined rest energy. The rest becomes their motion.'),
        h('li', {}, h('b', {}, 'Always a pair. '), 'Charge must balance, so matter comes with its antimatter: −1 + 1 = 0.'),
        h('li', {}, h('b', {}, 'A nucleus nearby. '), 'It takes up momentum the pair can’t carry. A lone photon in empty space can’t do it.')),
      h('div', { class: 'next-up' },
        h('p', { class: 'eyebrow' }, `Next · lesson ${LESSON.number + 1} of ${LESSON.of}`),
        h('p', { class: 'next-name' }, 'Annihilation'),
        h('p', {}, 'The same exchange, run backwards: an electron meets a positron, and their 1.022 MeV leaves as two photons. You saw it at the end of each positron’s spiral. The lesson is still being written; Q can already explain it.'),
        h('p', { class: 'next-acts' },
          h('a', { href: '#/q/annihilation', class: 'link-btn', html: `${Q_MARK}Ask Q why they annihilate` }),
          h('button', { type: 'button', class: 'link-btn restart', onclick: restart, html: `${icon('restart')}Restart this lesson` }))),
      f.node);
    const box = h('div', { class: 'stage-fill' });
    stage.replaceChildren(box, h('p', { class: 'stage-cap' }, 'Pair production near a nucleus, at 1.60 MeV'));
    createChamber(box, { at: (W, H) => ({ x: W * 0.4, y: H * 0.5 }) }).fire({ energy: 1.6, split: 0.4, notes: true, seed: 0.1 });
    f.sync();
  }

  function restart() {
    s = { ...fresh(), completedAt: s.completedAt };
    save();
    location.hash = '#/lesson/1';
  }

  const BUILD = [question, intuition, experiment, check, reflect];
  return {
    show(param) {
      const n = Math.min(Math.max(1, parseInt(param, 10) || s.reached), s.reached);
      if (String(n) !== param) { location.replace(`#/lesson/${n}`); return; }
      at = n;
      el.dataset.step = n;
      BUILD[n - 1]();
      drawSteps();
      text.querySelector('h2').focus({ preventScroll: true });
    },
  };
}
