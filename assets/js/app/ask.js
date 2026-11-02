// Ask Q: CATION's teaching assistant, as a workspace rather than a chat. A question gets a structured answer: a short
// explanation, a diagram drawn from the physics, a control to explore it with, a question to check the idea landed,
// and where to go deeper. Follow-ups stack below in one thread, so the first answer stays in view, and recent
// questions are listed on the left. Opened from a lesson step, a map concept or a chapter, Q says where it was opened
// from, suggests questions about it and links back.
// Q isn't connected to an AI service: `ask` below matches a question to one of the authored answers in
// data/q-topics.js, and says plainly when it has none. A live assistant would replace `ask` and return the same shape.

import { h, icon, Q_MARK } from './ui.js?v=20261102-5';
import * as store from './store.js?v=20261102-5';
import { map } from './model.js?v=20261102-5';
import { topics, SUGGEST } from './data/q-topics.js?v=20261102-5';
import { event, field, wave, line, ME, PAIR, mev, momentum } from './chamber.js?v=20261102-5';

const byId = new Map(topics.map((t) => [t.id, t]));
const LEAD = 193700;                                             // a lead-208 nucleus's rest energy, MeV

// ---------------------------------------------------------------- the answers

// The prototype's stand-in for an assistant: the authored answer whose words best match the question, or null.
export function ask(question) {
  const q = question.toLowerCase();
  const exact = topics.find((t) => t.question.toLowerCase().replace(/\?$/, '') === q.replace(/\?$/, '').trim());
  if (exact) return exact;
  const scored = topics.map((t) => [t, t.match.reduce((n, [w, k]) => n + (q.includes(w) ? k : 0), 0)]).sort((a, b) => b[1] - a[1]);
  return scored[0][1] >= 2 ? scored[0][0] : null;
}

// ---------------------------------------------------------------- the diagrams

const W = 520, H = 340;
const svg = (inner, cls = '') => `<svg class="fig-svg ${cls}" viewBox="0 0 ${W} ${H}" aria-hidden="true">${inner}</svg>`;
const txt = (x, y, s, cls = 'lbl') => `<text class="${cls}" x="${x}" y="${y}">${s}</text>`;
const arrow = (x0, y, x1, cls) => `<path class="${cls}" d="M${x0} ${y}H${x1}M${x1 - 7} ${y - 5}L${x1} ${y}L${x1 - 7} ${y + 5}"/>`;

const FIGURES = {
  // Annihilation, in the frame where the pair's total momentum is zero: each photon carries half the energy.
  annihilation(K) {
    const cx = W / 2, cy = 162, each = (PAIR + K) / 2, a = -1.1, d = 150;
    const ux = Math.cos(a), uy = Math.sin(a), speed = K > 0.005 ? `  ·  ${mev(K / 2)} moving` : '  ·  at rest';
    return svg(
      `<path class="trk e" d="M40 ${cy}H${cx - 14}"/>${arrow(100, cy, 150, 'trk e')}`
      + `<path class="trk p" d="M${W - 40} ${cy}H${cx + 14}"/><path class="trk p" d="M${W - 100} ${cy}H${W - 150}M${W - 143} ${cy - 5}L${W - 150} ${cy}L${W - 143} ${cy + 5}"/>`
      + `<circle class="nuc-ring" cx="${cx}" cy="${cy}" r="9"/>`
      + `<path class="photon" d="${wave([cx + ux * 14, cy + uy * 14], [cx + ux * d, cy + uy * d], each, 5)}"/>`
      + `<path class="photon" d="${wave([cx - ux * 14, cy - uy * 14], [cx - ux * d, cy - uy * d], each, 5)}"/>`
      + txt(40, cy - 16, `e⁻${speed}`, 'lbl e') + txt(W - 40, cy + 30, `e⁺${speed}`, 'lbl p end')
      + txt(cx + ux * d + 12, cy + uy * d + 18, `γ  ${mev(each, 3)}`) + txt(cx - ux * d - 12, cy - uy * d - 8, `γ  ${mev(each, 3)}`, 'lbl end')
      + txt(cx, H - 18, 'Total momentum: zero before, zero after', 'note mid'));
  },
  // Pair production at a nucleus, as in the lesson's chamber.
  pair(E) {
    return svg(field(W, H, 40) + event({ W, H, energy: E, x: 168, y: 168, scale: H * 0.2, split: 0.44, seed: 0.7 }).markup);
  },
  // Momentum to scale: the photon's, then the most the pair can carry and what's left for the nucleus. The photon's
  // arrow keeps its length; the others are drawn in proportion to it.
  momentum(E) {
    const x0 = 64, s = 392 / E, pair = Math.sqrt(E * E - PAIR * PAIR), nuc = E - pair, xe = x0 + E * s, xp = x0 + pair * s;
    return svg(
      `<path class="guide" d="M${x0} 58V262M${xe} 58V262"/>`
      + txt(x0, 70, 'BEFORE', 'eyebrow-s') + arrow(x0, 98, xe, 'photon-v') + txt(x0, 126, `photon  ${E.toFixed(2)} MeV/c`)
      + txt(x0, 182, 'AFTER', 'eyebrow-s')
      + (pair > 0.02 ? `<path class="trk e" d="M${x0} 210H${x0 + pair * s / 2}"/>` + arrow(x0 + pair * s / 2, 210, xp, 'trk p') : '')
      + arrow(xp, 210, xe, 'nuc-v')
      + txt(x0, 238, `pair, at most  ${pair.toFixed(2)}`, 'lbl')
      + txt(xe, 238, `nucleus, at least  ${nuc.toFixed(2)}`, 'lbl gold end')
      + txt(W / 2, H - 18, 'Arrows to scale, in MeV/c', 'note mid'));
  },
  // An electron and a positron with the same momentum, from the same point, in the same field.
  mirror(p, flip) {
    const R = 74 * p, x = 170, y = H / 2, pts = (sign) => {
      const out = [[x, y]];
      let a = 0, px = x, py = y;
      for (let s = 0; s < Math.PI * R * 1.2 && px < W + 20 && py > -20 && py < H + 20; s += 1.5) { a += (sign * 1.5) / R; px += Math.cos(a) * 1.5; py += Math.sin(a) * 1.5; out.push([px, py]); }
      return out;
    };
    const se = flip ? -1 : 1;
    let marks = '';
    for (let gx = 20; gx < W; gx += 40) for (let gy = 20; gy < H; gy += 40) marks += flip ? `M${gx} ${gy}h0.01` : `M${gx - 2.2} ${gy - 2.2}l4.4 4.4M${gx + 2.2} ${gy - 2.2}l-4.4 4.4`;
    const e = pts(se), q = pts(-se), at = (a) => a[Math.min(a.length - 1, 70)];
    return svg(`<path class="field${flip ? ' dots' : ''}" d="${marks}"/><path class="trk e" d="${line(e)}"/><path class="trk p" d="${line(q)}"/>`
      + `<circle class="nuc" cx="${x}" cy="${y}" r="3"/>`
      + txt(at(e)[0] + 10, at(e)[1] + (se > 0 ? 22 : -14), 'e⁻  charge −1', 'lbl e') + txt(at(q)[0] + 10, at(q)[1] + (se > 0 ? -14 : 22), 'e⁺  charge +1', 'lbl p')
      + txt(W - 20, H - 18, flip ? 'Field out of the screen' : 'Field into the screen', 'note end'));
  },
};

// What each diagram's control reads out.
const READOUT = {
  annihilation: (K) => `Each photon carries (1.022 + ${K.toFixed(2)}) ÷ 2 = ${mev((PAIR + K) / 2, 3)}. More energy makes a shorter wavelength.`,
  pair: (E) => (E < PAIR ? `No pair: ${mev(E)} is ${mev(PAIR - E, 3)} short of the 1.022 MeV the two masses need.`
    : `A pair, with ${mev(E - PAIR, 3)} left over as motion. The faster a particle, the wider it curves.`),
  momentum: (E) => {
    const p = E - Math.sqrt(E * E - PAIR * PAIR);
    const ev = (p * p) / (2 * LEAD) * 1e6;
    return `A lead nucleus takes at least ${p.toFixed(2)} MeV/c of momentum, and with it only ${ev < 0.1 ? ev.toFixed(3) : ev.toFixed(2)} eV of energy.`;
  },
  mirror: (p) => `Radius r = p / qB: the same ${p.toFixed(2)} MeV/c and the same size of charge give the same radius. Only the direction differs.`,
};

// ---------------------------------------------------------------- the workspace

export function renderAsk(el) {
  const thread = store.read('q.thread', []);              // [{ id, asked }] in order; id null when Q had no answer
  let context = null;

  const recent = h('ul', { class: 'q-recent', role: 'list' });
  const scroll = h('div', { class: 'q-scroll' });
  const bar = h('div', { class: 'q-from' });
  const input = h('input', { type: 'text', id: 'q-input', autocomplete: 'off', spellcheck: 'true', 'aria-label': 'Ask Q a question' });
  const form = h('form', { class: 'q-compose', onsubmit: (e) => { e.preventDefault(); submit(input.value); } },
    h('span', { class: 'q-compose-mark', html: Q_MARK }), input,
    h('button', { type: 'submit', class: 'q-send', 'aria-label': 'Ask', html: icon('send') }));

  el.replaceChildren(
    h('aside', { class: 'q-side', 'aria-label': 'Your questions' },
      h('button', { type: 'button', class: 'q-new', onclick: () => { thread.length = 0; save(); draw(); input.focus(); }, html: `${icon('plus')}New question` }),
      h('h2', { class: 'eyebrow' }, 'Recent'), recent,
      h('p', { class: 'q-proto' }, 'Prototype. Q isn’t connected to an AI service yet: it answers the four questions written for it, and says so when it can’t answer.')),
    h('section', { class: 'q-main', 'aria-label': 'Ask Q' }, bar, scroll, form));

  const save = () => store.write('q.thread', thread);
  const remember = (id) => store.write('q.recent', [id, ...store.read('q.recent', []).filter((x) => x !== id)].slice(0, 8));

  function submit(text) {
    const asked = text.trim();
    if (!asked) return;
    const t = ask(asked);
    input.value = '';
    add(t ? t.id : null, t && t.question.toLowerCase() === asked.toLowerCase() ? null : asked);
  }
  function add(id, asked = null) {
    if (id && thread.length && thread[thread.length - 1].id === id) { scrollTo(scroll.lastElementChild); return; }
    thread.push({ id, asked });
    if (id) remember(id);
    save(); draw();
    scrollTo(scroll.querySelector('.answer:last-of-type'));
  }
  const scrollTo = (node) => {
    if (!node) return;
    node.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    node.querySelector('h2')?.focus({ preventScroll: true });
  };

  // ---- where Q was opened from, and the way back
  function drawContext() {
    if (!context) { bar.hidden = true; return; }
    const [where, back, href] = context.kind === 'lesson' ? [`From your lesson · Step ${context.step} of 5, ${context.name}`, 'Back to the lesson', `#/lesson/${context.step}`]
      : context.kind === 'concept' ? [`From your Understanding Map · ${context.name}`, 'Back to the map', `#/learning/${context.id}`]
      : [`From your path · Chapter 2, ${context.name}`, 'Back to your path', '#/'];
    bar.hidden = false;
    bar.replaceChildren(h('span', { class: 'q-from-dot', 'aria-hidden': 'true' }), h('span', {}, where),
      h('a', { href, html: `${back}${icon('arrow')}` }),
      h('button', { type: 'button', class: 'q-from-x', 'aria-label': 'Stop using this context', html: icon('close'), onclick: () => { context = null; drawContext(); draw(); } }));
  }
  const suggested = () => !context ? [] : context.kind === 'lesson' ? SUGGEST.lesson[context.step] || []
    : context.kind === 'concept' ? SUGGEST.concept[context.id] || [] : SUGGEST.chapter;

  // ---- the first screen: a question, and what to ask
  function welcome() {
    const first = suggested(), rest = topics.filter((t) => !first.includes(t.id));
    const row = (t) => h('li', {}, h('button', { type: 'button', class: 'q-prompt', onclick: () => add(t.id), html: `<span>${t.question}</span>${icon('arrow')}` }));
    return h('div', { class: 'q-welcome' },
      h('span', { class: 'q-big', html: Q_MARK }),
      h('h1', {}, 'What would you like to understand?'),
      h('p', {}, 'Ask about what you’re studying. Q answers with a short explanation, a diagram you can explore and a question to check the idea has landed.'),
      first.length > 0 && h('div', { class: 'q-group' },
        h('h2', { class: 'eyebrow' }, context.kind === 'lesson' ? 'About this step' : context.kind === 'concept' ? `About ${context.name}` : 'About this chapter'),
        h('ul', { role: 'list' }, first.map((id) => row(byId.get(id))))),
      h('div', { class: 'q-group' },
        h('h2', { class: 'eyebrow' }, first.length ? 'Q can also answer' : 'Q can answer these so far'),
        h('ul', { role: 'list' }, rest.map(row))));
  }

  // ---- one answer
  function answer({ id, asked }, k) {
    if (!id) {
      return h('article', { class: 'answer is-none', 'aria-labelledby': `a-${k}` },
        h('p', { class: 'a-asked' }, `You asked: “${asked}”`),
        h('h2', { id: `a-${k}`, tabindex: -1 }, 'Q can’t answer that yet'),
        h('p', { class: 'a-none' }, 'This prototype isn’t connected to an AI service, so Q only has the answers written for it. These are the questions it can answer so far:'),
        h('ul', { class: 'a-next', role: 'list' }, topics.map((t) => h('li', {}, h('button', { type: 'button', onclick: () => add(t.id), html: `${t.question}${icon('arrow')}` })))));
    }
    const t = byId.get(id), f = t.figure, x = f.explore;
    let value = x.value, flip = false;
    const fig = h('div', { class: 'fig' }), read = h('p', { class: 'a-readout', 'aria-live': 'polite' }), out = h('output');
    const draw = () => { fig.innerHTML = FIGURES[f.kind](value, flip); read.textContent = READOUT[f.kind](value); out.textContent = `${value.toFixed(2)} ${x.unit}`; };
    const slider = h('input', { type: 'range', min: x.min, max: x.max, step: x.step, value, 'aria-label': x.label,
      oninput: (e) => { value = Number(e.target.value); e.target.setAttribute('aria-valuetext', `${value.toFixed(2)} ${x.unit}`); draw(); } });
    const flipBtn = x.flip && h('button', { type: 'button', class: 'switch', 'aria-pressed': 'false',
      onclick: (e) => { flip = !flip; e.currentTarget.setAttribute('aria-pressed', String(flip)); draw(); } }, h('i'), 'Reverse the field');
    draw();

    const live = h('p', { class: 'say', 'aria-live': 'polite' });
    const opts = h('div', { class: 'choices', role: 'group', 'aria-label': t.check.prompt });
    let picked = null, solved = false;
    const drawOpts = () => opts.replaceChildren(...t.check.options.map(([label, right, says], i) => h('button', {
      type: 'button', class: `choice${picked === i ? (right ? ' is-right' : ' is-wrong') : ''}`, 'aria-pressed': String(picked === i),
      onclick: () => {
        picked = i;
        store.answer(t.concept, right);
        if (right && !solved) { solved = true; store.record('practice'); }
        drawOpts();
        live.className = `say ${right ? 'yes' : 'no'}`; live.textContent = says;
      },
    }, h('span', { class: 'choice-mark', 'aria-hidden': 'true' }), label)));
    drawOpts();

    const d = t.deeper, conceptName = (cid) => map.concepts.find((c) => c.id === cid)?.name || cid;
    return h('article', { class: 'answer', 'aria-labelledby': `a-${k}` },
      asked && h('p', { class: 'a-asked' }, `You asked: “${asked}”`),
      h('h2', { id: `a-${k}`, tabindex: -1 }, t.question),
      h('div', { class: 'a-body' },
        h('div', { class: 'a-text' },
          h('div', { class: 'a-explain' }, t.explain.map((p) => h('p', { html: p }))),
          h('section', { class: 'a-check', 'aria-label': 'Check your understanding' },
            h('h3', { class: 'eyebrow' }, 'Check your understanding'), h('p', { class: 'q-text' }, t.check.prompt), opts, live),
          h('section', { class: 'a-deeper', 'aria-label': 'Go deeper' },
            h('h3', { class: 'eyebrow' }, 'Go deeper'),
            h('ul', { class: 'deeper', role: 'list' },
              d.lessons.map(([label, href, sub]) => h('li', {}, h('a', { href, html: `${icon('lesson')}<span>${label}<small>${sub}</small></span>` }))),
              d.soon && h('li', { class: 'is-soon' }, h('span', { class: 'soon', html: `${icon('lock')}<span>${d.soon[0]}<small>${d.soon[1]}</small></span>` })),
              d.concepts.map((cid) => h('li', {}, h('a', { href: `#/learning/${cid}`, html: `${icon('subject')}<span>${conceptName(cid)}<small>On your Understanding Map</small></span>` })))),
            d.aside && h('p', { class: 'a-aside' }, d.aside),
            h('p', { class: 'eyebrow ask-next' }, 'Ask next'),
            h('ul', { class: 'a-next', role: 'list' }, d.next.map((nid) => h('li', {}, h('button', { type: 'button', onclick: () => add(nid), html: `${byId.get(nid).question}${icon('arrow')}` })))))),
        h('div', { class: 'a-visual' },
          h('figure', {}, fig, h('figcaption', {}, f.caption)),
          h('div', { class: 'a-explore' },
            h('h3', { class: 'eyebrow' }, 'Explore it'),
            h('label', { class: 'en' }, h('span', {}, x.label), slider, out),
            flipBtn, read))));
  }

  function draw() {
    recent.replaceChildren(...store.read('q.recent', []).filter((id) => byId.has(id)).map((id) => h('li', {},
      h('button', { type: 'button', class: thread.some((x) => x.id === id) ? 'is-in' : '', onclick: () => add(id), html: `<span>${byId.get(id).question}</span>` }))));
    if (!recent.children.length) recent.append(h('li', { class: 'q-none' }, 'Questions you ask appear here.'));
    scroll.replaceChildren(thread.length ? h('div', { class: 'thread' }, thread.map(answer)) : welcome());
    input.placeholder = thread.length ? 'Ask a follow-up…' : 'Ask about pair production, antimatter, momentum…';
  }

  draw();
  return {
    // `from` says where Q was opened: { kind: 'lesson', step, name }, { kind: 'concept', id, name } or
    // { kind: 'chapter', name }; `question` is asked straight away; `topic` opens an answer by its id.
    open({ from, question, topic } = {}) {
      if (from) { context = from; thread.length = 0; save(); }
      drawContext(); draw();
      if (topic && byId.has(topic)) add(topic);
      else if (question) submit(question);
      else (scroll.querySelector('.answer:last-of-type h2') || input).focus({ preventScroll: true });
    },
  };
}
