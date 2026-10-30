// The ways to learn the lesson, and how two of them combine. Each method is a short sequence of items shown one at a
// time in the stage's caption: something to read, an answer to choose, or something to do with the slider. Every
// number in the text is read from the trace the stage is showing at that moment.
//
//   Visual & spatial   the scene itself: the light can be replayed, and the prism turned by dragging
//   Exploratory        three experiments with the angle of incidence
//   Analytical         Snell's law with the stage's own numbers: a prediction, a measurement, the far face
//   Structured         four steps, one idea each, with a check whose answer decides the next step
//   Conversational     a scripted tutor that talks about what the scene is doing
//
// Pairs: Analytical adds the live equation (and the maths in the feedback) to any other method; Structured then
// Exploratory runs the steps, then the experiments; Conversational with Structured or Exploratory has the tutor
// deliver that method; Visual keeps the camera free (without it the view is fixed, and head-on for Analytical).
import * as O from './optics.js';

const deg = (v) => (v == null ? '—' : `${v.toFixed(1)}°`);
const th = (k) => `<i>θ</i><sub>${k}</sub>`;
const sin = (d) => Math.sin(O.rad(d));
const asin = (x) => O.deg(Math.asin(x));
const n2 = (r) => r.n.toFixed(2);
const law = `<i>n</i><sub>1</sub> sin ${th(1)} = <i>n</i><sub>2</sub> sin ${th(2)}`;
const entryEq = (r, unknown = false) => `1.00 × sin ${deg(r.theta1)} = ${n2(r)} × sin ${unknown ? th(2) : deg(r.theta2)}`;

// ---------- The methods as items ----------
// An item: eyebrow, text(r, m), live(r, m) (redrawn as the slider moves), stage (what the scene shows),
// enter(api, m), choices(r, m) → [{ label, ok, stage, reply(r, m) }], wait(r, m) → done(r, m) once true,
// hint(r, m) while waiting, when(results) to skip it. `m` is the lesson's memory for this run.

function structured(A, K) {
  const check = A
    ? {
      id: 's3', eyebrow: 'Step 3 of 4', stage: { hold: true },
      text: (r) => `With ${th(1)} = ${deg(r.theta1)} and <i>n</i> = ${n2(r)}, what is ${th(2)}?`,
      choices: (r) => {
        const x = sin(r.theta1) / r.n;
        const work = `sin ${deg(r.theta1)} ÷ ${n2(r)} = ${x.toFixed(3)}, so ${th(2)} = ${deg(r.theta2)}.`;
        const wrong = r.n * sin(r.theta1) < 0.99
          ? { v: asin(r.n * sin(r.theta1)), why: 'That bends it away from the normal.' }
          : { v: r.theta1 / r.n, why: 'That divides the angle, not its sine.' };
        return [
          { label: deg(r.theta2), v: r.theta2, ok: true, reply: () => `Right: ${work}` },
          { label: deg(wrong.v), v: wrong.v, ok: false, reply: () => `${wrong.why} ${work}` },
          { label: deg(r.theta1), v: r.theta1, ok: false, reply: () => `That would be no bend at all. ${work}` },
        ].sort((a, b) => a.v - b.v).map((c) => ({ ...c, stage: { ghost: c.v } }));
      },
    }
    : {
      id: 's3', eyebrow: 'Step 3 of 4', stage: { hold: true },
      text: () => 'Glass slows light down. Going in, which way does it bend?',
      choices: () => {
        const wrong = (r) => `It bends towards the normal (your guess is dashed): ${th(2)} = ${deg(r.theta2)} inside, less than ${th(1)} = ${deg(r.theta1)}.`;
        return [
          { label: 'Towards the normal', ok: true, stage: { ghost: 'towards' }, reply: (r) => `Right: ${th(2)} = ${deg(r.theta2)} inside, less than ${th(1)} = ${deg(r.theta1)}. Slowed down, light turns closer to the normal.` },
          { label: 'Straight on', ok: false, stage: { ghost: 'straight' }, reply: wrong },
          { label: 'Away', ok: false, stage: { ghost: 'away' }, reply: wrong },
        ];
      },
    };
  return [
    {
      id: 's1', eyebrow: 'Step 1 of 4', stage: { hold: true, layers: { entry: false, ring: false } },
      enter: (api) => api.setTheta(K.tmin),
      text: () => 'Light travels in straight lines. Here a beam of white light heads for the glass.',
    },
    {
      id: 's2', eyebrow: 'Step 2 of 4', stage: { hold: true },
      text: (r) => `Where it meets the glass, picture a line at right angles to the surface: the normal. Angles are measured from it. This one is ${th(1)} = ${deg(r.theta1)}.`,
    },
    check,
    // Only after a wrong answer: the same idea once more, at another angle.
    {
      id: 's3b', eyebrow: 'Step 3 of 4', when: (res) => res.s3 === false,
      enter: (api) => api.setTheta(30),
      text: (r) => `Here is the same light coming in at ${th(1)} = ${deg(r.theta1)}. Which angle is smaller?`,
      choices: () => [
        { label: `${th(1)}, in air`, ok: false, reply: (r) => `It's ${th(2)}: ${deg(r.theta2)} in the glass against ${deg(r.theta1)} in air. Going into glass, light always turns towards the normal.` },
        { label: `${th(2)}, in glass`, ok: true, reply: (r) => `Yes: ${deg(r.theta2)} in the glass against ${deg(r.theta1)} in air. Going into glass, light always turns towards the normal.` },
      ],
    },
    {
      id: 's4', eyebrow: 'Step 4 of 4', stage: { layers: { exit: true } },
      text: () => 'Leaving the glass, it speeds up and bends away from the normal. Each colour bends a slightly different amount, so white light fans into a spectrum.',
    },
  ];
}

function exploratory(A, K) {
  return [
    {
      id: 'e1', eyebrow: 'Experiment 1 of 3',
      enter: (api) => { if (api.readout().theta1 < 10) api.setTheta(K.tmin); }, // something to move from
      text: () => 'Set the angle of incidence to 0°. Does the light bend as it goes in?',
      wait: (r) => r.theta1 <= 0.5,
      done: () => 'No. At 0° the light meets the surface square on and goes straight in. It bends only when it arrives at an angle.'
        + (A ? ` sin 0° = 0, so ${th(2)} = 0° too.` : ''),
    },
    {
      id: 'e2', eyebrow: 'Experiment 2 of 3',
      text: () => 'Now raise the angle slowly. At what angle does the light first get out through the far face?',
      wait: (r) => !r.tir && r.theta1 <= K.thr + 2.5,
      hint: (r) => (!r.tir && r.theta1 > K.thr + 2.5 ? 'It gets out now, but you went past the point. Come back down to find where it starts.' : null),
      done: (r) => `At about ${Math.round(K.thr)}°. Below that, the light meets the far face at more than ${deg(r.critical)} and is reflected back inside.`
        + (A ? ` That limit is the critical angle: sin⁻¹(1 ÷ ${n2(r)}) = ${deg(r.critical)}.` : ''),
    },
    {
      id: 'e3', eyebrow: 'Experiment 3 of 3', stage: { layers: { extension: true } },
      text: () => 'Find the angle at which the prism turns the light the least. The dashed line is the way it was heading.',
      live: (r) => (r.deviation != null ? `It is turned by ${deg(r.deviation)}.` : 'It doesn’t get out through the far face.'),
      wait: (r) => r.deviation != null && Math.abs(r.theta1 - K.tmin) <= 1.5,
      done: (r) => `About ${Math.round(K.tmin)}°, turned by ${deg(r.deviation)}. The light crosses the prism level, bending equally in and out; either side, it turns more.`
        + (A ? ` Turn = ${th(1)} + ${th(4)} − 60° = ${deg(r.deviation)}.` : ''),
    },
  ];
}

function analytical(K) {
  return [
    {
      id: 'a1', eyebrow: 'Snell’s law',
      enter: (api, m) => { m.t = Math.abs(api.readout().theta1 - 30) > 6 ? 30 : 70; },
      text: () => `Where the light enters, ${law}:`,
      live: (r, m) => `<span class="ls-eq">${entryEq(r)}</span>Predict: with ${th(1)} = ${m.t}°, what would ${th(2)} be?`,
      choices: (r, m) => {
        const right = asin(sin(m.t) / r.n);
        const away = r.n * sin(m.t) < 0.99 ? asin(r.n * sin(m.t)) : m.t / r.n;
        const work = `sin ${m.t}° ÷ ${n2(r)} = ${(sin(m.t) / r.n).toFixed(3)}, so ${th(2)} = ${deg(right)}`;
        return [
          { v: right, ok: true, reply: () => `Right: ${work}.` },
          { v: m.t, ok: false, reply: () => `That would be no bend. ${work}: smaller than ${th(1)}, because light entering glass bends towards the normal.` },
          { v: away, ok: false, reply: () => `${work}: smaller than ${th(1)}, because light entering glass bends towards the normal.` },
        ].sort((a, b) => a.v - b.v).map((c) => ({ ...c, label: deg(c.v) }));
      },
    },
    {
      id: 'a2', eyebrow: 'Snell’s law',
      text: (r, m) => `Now set the slider to ${m.t}° and read ${th(2)} on the stage.`,
      live: (r) => `<span class="ls-eq">${entryEq(r)}</span>`,
      wait: (r, m) => Math.abs(r.theta1 - m.t) <= 0.3,
      done: (r) => `Measured: ${th(2)} = ${deg(r.theta2)}, as calculated.`,
    },
    {
      id: 'a3', eyebrow: 'The far face', stage: { layers: { exit: true } },
      enter: (api) => { if (api.readout().tir) api.setTheta(K.tmin); }, // start with the light getting out
      text: (r) => `Leaving the glass, sin ${th(4)} = ${n2(r)} × sin ${th(3)}. Lower ${th(1)} until that comes to more than 1.`,
      live: (r) => (r.theta3 != null ? `<span class="ls-eq">${n2(r)} × sin ${deg(r.theta3)} = ${(r.n * sin(r.theta3)).toFixed(3)}</span>` : ''),
      wait: (r) => r.tir,
      done: (r) => `No angle has a sine above 1, so there is no ${th(4)}: the light is reflected back inside. This starts at ${th(3)} = ${deg(r.critical)}, the critical angle.`,
    },
  ];
}

function conversational(A, K) {
  return [
    {
      id: 'c1', enter: (api) => api.setTheta(K.tmin),
      text: () => 'Look at where the light enters the glass. Does it turn towards the dashed normal, or away from it?',
      choices: () => [
        { label: 'Towards it', ok: true, reply: (r) => `Yes: ${deg(r.theta1)} in the air, ${deg(r.theta2)} in the glass. Glass slows light, which turns it closer to the normal.` + (A ? ` (${entryEq(r)})` : '') },
        { label: 'Away from it', ok: false, reply: (r) => `Compare the two angles: ${deg(r.theta1)} in the air, ${deg(r.theta2)} in the glass. It got smaller, so the light turned towards the normal. Glass slows light, and slowing turns it closer.` },
      ],
    },
    {
      id: 'c2',
      text: () => 'Now use the slider to bring the light in closer to the normal. What happens to the bend?',
      wait: (r) => r.theta1 <= K.tmin - 14,
      done: (r) => `At ${deg(r.theta1)} it’s ${deg(r.theta2)} inside: closer to the normal, less bend. At 0° there would be none.`,
    },
    {
      id: 'c3',
      text: () => `Keep going, below ${Math.round(K.thr)}°, and watch the far face.`,
      wait: (r) => r.tir,
      done: (r) => `It can’t get out there now. It meets the far face at ${deg(r.theta3)}, more than the critical angle of ${deg(r.critical)}, so it’s reflected back inside.`
        + (A ? ` (sin ${th(4)} would be ${(r.n * sin(r.theta3)).toFixed(2)}: no sine is above 1.)` : ''),
    },
    {
      id: 'c4', text: () => 'Want to ask me something about it?',
      choices: () => [
        { label: 'Why does glass slow light?', reply: (r) => `Light is an electromagnetic wave. In glass it sets the electrons in the atoms vibrating, and the waves they give off combine with it into a slower wave: here 1 ÷ ${n2(r)}, about ${Math.round(100 / r.n)}% of its speed in air.` },
        { label: 'Why do the colours spread?', reply: () => 'Glass slows violet light a little more than red, so violet bends a little more at each face. The white beam leaves as a fan of colours.' },
      ],
    },
  ];
}

// ---------- The lesson ----------
export function createLesson(panel, api) {
  const intro = panel.innerHTML;
  const r0 = api.readout();
  // The prism's landmarks: the angle the light first escapes the far face at, and the least-deviation angle.
  const K = { tmin: api.startTheta, thr: asin(r0.n * sin(60 - r0.critical)) };
  let modes = new Set(['visual']);
  let items = [], chat = false, footer = false;
  let i = 0, st = {}, m = {}, results = {}, log = [];
  let held = false; // the light is waiting at the glass, so θ2 isn't shown anywhere yet

  function compose(ids) {
    modes = new Set(ids);
    const A = modes.has('analytical'), S = modes.has('structured'), E = modes.has('exploratory'), C = modes.has('conversational');
    if (S) items = [...structured(A, K), ...(E ? exploratory(A, K) : [])];
    else if (E) items = exploratory(A, K);
    else if (C) items = conversational(A, K);
    else if (A) items = analytical(K);
    else items = [];
    chat = C;
    footer = A && (S || E);
    const V = modes.has('visual');
    api.view(A && !V ? 'head-on' : 'composed', V);
    root().dataset.lesson = items.length ? (chat ? 'chat' : 'steps') : '';
    restart();
  }
  const root = () => panel.closest('.stage');

  function base(extra = {}) {
    const A = modes.has('analytical');
    return {
      hold: false, ghost: null, ...extra,
      layers: { glass: true, entry: true, ring: true, exit: A, extension: false, ...(extra.layers || {}) },
    };
  }

  function restart() {
    results = {}; m = {}; log = [];
    if (!items.length) { api.stage(base()); render(); return; }
    go(0);
  }

  function go(k) {
    while (k < items.length && items[k].when && !items[k].when(results)) k++;
    if (k >= items.length) { finish(); return; }
    i = k; st = {};
    const it = items[i];
    held = !!it.stage?.hold;
    api.stage(base(it.stage));
    it.enter?.(api, m);
    if (chat && it.text) log.push({ who: 'tutor', html: it.text(api.readout(), m) });
    if (it.wait) check();
    render();
  }

  // After the last item: plain methods show a way to start again; the tutor says so.
  function finish() {
    i = items.length; st = {};
    if (chat) log.push({ who: 'tutor', html: 'That’s the idea: light changes speed at the surface, and that turns it. Move the slider any time and watch the angles.' });
    render();
  }

  function check() {
    const it = items[i], r = api.readout();
    if (!it?.wait || st.done || !it.wait(r, m)) return false;
    st.done = true; st.reply = it.done(r, m); st.ok = true;
    if (chat) { log.push({ who: 'tutor', html: st.reply }); go(i + 1); }
    return true;
  }

  function answer(k) {
    const it = items[i], r = api.readout();
    const c = it.choices(r, m)[k];
    if (!c) return;
    if (c.stage) api.stage(base({ ...it.stage, hold: false, ...c.stage }));
    held = false;
    const reply = c.reply(api.readout(), m);
    if (it.id) results[it.id] = c.ok !== false;
    if (chat) {
      log.push({ who: 'you', html: c.label }, { who: 'tutor', html: reply });
      if (it.id === 'c4') { st.asked = [...(st.asked || []), k]; render(); return; }
      go(i + 1);
      return;
    }
    st.answered = true; st.reply = reply; st.ok = c.ok !== false;
    render();
  }

  function actions(it, r) {
    const btn = (act, label, cls = 'ls-next') => `<button type="button" class="${cls}" data-act="${act}">${label}</button>`;
    if (!it) return `<div class="ls-actions">${btn('restart', 'Start again')}</div>`;
    if (it.choices && !st.answered) {
      const list = it.choices(r, m).map((c, k) => (st.asked?.includes(k) ? '' : `<button type="button" class="ls-chip" data-act="answer" data-i="${k}">${c.label}</button>`)).join('');
      const more = it.id === 'c4' && st.asked?.length ? btn('restart', 'Start again', 'ls-chip ls-chip-quiet') : '';
      return `<div class="ls-actions">${list}${more}</div>`;
    }
    if (it.wait && !st.done) return '';
    return `<div class="ls-actions">${btn('next', chat ? 'Go on' : i === items.length - 1 ? 'Finish' : 'Next', chat ? 'ls-chip' : 'ls-next')}</div>`;
  }

  function render() {
    const r = api.readout();
    if (!items.length) {
      panel.innerHTML = intro + (api.canReplay() ? '<div class="ls-actions"><button type="button" class="ls-next" data-act="replay">Replay the light</button></div>' : '');
      return;
    }
    const it = items[i];
    let html = '';
    if (chat) {
      html += '<p class="ls-eyebrow">Tutor <span>· scripted</span></p><div class="ls-chat">';
      html += log.slice(-2).map((l) => `<p class="${l.who === 'you' ? 'ls-you' : 'ls-t'}">${l.html}</p>`).join('');
      html += '</div>';
      if (it?.live) html += `<p class="ls-live">${it.live(r, m)}</p>`;
    } else if (it) {
      if (it.eyebrow) html += `<p class="ls-eyebrow">${it.eyebrow}</p>`;
      if (it.text) html += `<p class="ls-text">${it.text(r, m)}</p>`;
      if (it.live && !st.done) html += `<p class="ls-live">${it.live(r, m)}</p>`;
      if (st.reply) html += `<p class="ls-fb${st.ok ? '' : ' is-wrong'}" role="status">${st.reply}</p>`;
      else if (it.hint) { const h = it.hint(r, m); if (h) html += `<p class="ls-hint">${h}</p>`; }
    } else {
      html += '<p class="ls-text">Move the slider to any angle: every number on the stage is measured from the light as it goes through.</p>';
    }
    if (footer) html += `<p class="ls-eq ls-foot">${law}<br>${entryEq(r, held)}</p>`;
    html += actions(it, r);
    panel.innerHTML = html;
  }

  panel.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'answer') answer(Number(b.dataset.i));
    else if (act === 'next') go(i + 1);
    else if (act === 'restart') restart();
    else if (act === 'replay') api.replay();
  });

  return {
    set: compose,
    // The slider moved (or the stage was set): read the new trace.
    angle() { if (!check()) render(); else if (!chat) render(); },
  };
}
