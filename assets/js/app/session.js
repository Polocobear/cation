// The study room: a live session for working through a chapter with a tutor or classmates. This prototype has no
// calling service, so nobody else can join and the room says so; what works is everything on your side. Your camera
// and microphone are used only after you turn them on, only in this browser, and they're switched off when you leave
// the room or the page. The room can put the lesson's bubble chamber on its stage, and keeps notes and questions to
// bring on this device.

import { h, icon } from './ui.js?v=20261102-5';
import * as store from './store.js?v=20261102-5';
import { learner } from './model.js?v=20261102-5';
import { topics } from './data/q-topics.js?v=20261102-5';
import { createChamber, mev } from './chamber.js?v=20261102-5';

const TITLE = 'Antimatter and pair production';

export function renderSession(el) {
  let stream = null, cam = false, mic = false, inRoom = false, started = 0, timer = 0, meter = 0, audio = null, showing = false;
  const status = h('p', { class: 'sr-status', 'aria-live': 'polite' });

  // ---- your camera and microphone, only on request
  async function want(kind) {
    try {
      const got = await navigator.mediaDevices.getUserMedia(kind === 'video' ? { video: { width: 1280, height: 720 } } : { audio: true });
      if (!stream) stream = new MediaStream();
      for (const t of got.getTracks()) stream.addTrack(t);
      return true;
    } catch (err) {
      status.textContent = err?.name === 'NotAllowedError' ? `The browser didn’t allow the ${kind === 'video' ? 'camera' : 'microphone'}. You can change that in its site settings.`
        : `No ${kind === 'video' ? 'camera' : 'microphone'} is available here.`;
      return false;
    }
  }
  const tracks = (kind) => stream ? stream.getTracks().filter((t) => t.kind === kind) : [];
  async function setCam(on) {
    if (on && !tracks('video').length && !(await want('video'))) on = false;
    for (const t of tracks('video')) { t.enabled = on; if (!on) { t.stop(); stream.removeTrack(t); } }
    cam = on; paint();
  }
  async function setMic(on) {
    if (on && !tracks('audio').length && !(await want('audio'))) on = false;
    for (const t of tracks('audio')) t.enabled = on;
    mic = on; listen(); paint();
  }
  // A ring on your tile that moves with your voice, so you can see the microphone is working.
  function listen() {
    cancelAnimationFrame(meter);
    if (!mic || !tracks('audio').length) { el.style.setProperty('--level', 0); return; }
    audio ||= new AudioContext();
    const an = audio.createAnalyser(); an.fftSize = 512;
    audio.createMediaStreamSource(new MediaStream(tracks('audio'))).connect(an);
    const buf = new Uint8Array(an.fftSize);
    const tick = () => {
      an.getByteTimeDomainData(buf);
      let peak = 0; for (const v of buf) peak = Math.max(peak, Math.abs(v - 128));
      el.style.setProperty('--level', Math.min(1, peak / 40).toFixed(2));
      meter = requestAnimationFrame(tick);
    };
    tick();
  }
  function stopAll() {
    cancelAnimationFrame(meter);
    for (const t of stream?.getTracks() || []) t.stop();
    stream = null; cam = false; mic = false;
    audio?.close(); audio = null;
    el.style.setProperty('--level', 0);
  }

  // ---- the parts both screens share: your tile and the two buttons
  const video = h('video', { autoplay: true, muted: true, playsinline: true });
  const tile = h('div', { class: 'tile me' }, video,
    h('span', { class: 'tile-off' }, h('span', { class: 'avatar', 'aria-hidden': 'true' }, learner.initials), h('span', { class: 'tile-note' }, 'Camera off')),
    h('span', { class: 'tile-name' }, h('span', { class: 'mic-dot', 'aria-hidden': 'true' }), `${learner.name} (you)`));
  const camBtn = h('button', { type: 'button', class: 'av-btn', onclick: () => setCam(!cam) });
  const micBtn = h('button', { type: 'button', class: 'av-btn', onclick: () => setMic(!mic) });
  function paint() {
    video.srcObject = cam ? stream : null;
    tile.classList.toggle('is-cam', cam);
    tile.classList.toggle('is-mic', mic);
    camBtn.innerHTML = `${icon(cam ? 'cam' : 'camOff')}<span>${cam ? 'Camera on' : 'Camera off'}</span>`;
    micBtn.innerHTML = `${icon(mic ? 'mic' : 'micOff')}<span>${mic ? 'Mic on' : 'Mic off'}</span>`;
    camBtn.setAttribute('aria-pressed', String(cam)); camBtn.setAttribute('aria-label', cam ? 'Turn camera off' : 'Turn camera on');
    micBtn.setAttribute('aria-pressed', String(mic)); micBtn.setAttribute('aria-label', mic ? 'Turn microphone off' : 'Turn microphone on');
    camBtn.classList.toggle('is-off', !cam); micBtn.classList.toggle('is-off', !mic);
  }

  // ---- before joining
  function lobby(left = false) {
    inRoom = false; clearInterval(timer);
    el.dataset.mode = 'lobby';
    el.replaceChildren(h('div', { class: 'lobby' },
      h('div', { class: 'lobby-preview' }, tile, h('div', { class: 'av-row' }, micBtn, camBtn), status),
      h('div', { class: 'lobby-info' },
        h('p', { class: 'eyebrow' }, 'Study room · Inside the Particle Zoo'),
        h('h1', {}, TITLE),
        h('p', { class: 'lead' }, 'A room for working through chapter 2 together, with a tutor or with classmates: talk it over, put the bubble chamber on screen and keep notes as you go.'),
        h('dl', { class: 'lobby-facts' },
          h('div', {}, h('dt', {}, 'In the room'), h('dd', {}, 'Nobody yet')),
          h('div', {}, h('dt', {}, 'Bring'), h('dd', {}, 'Lesson 3, Can light turn into matter?'))),
        h('p', { class: 'lobby-note' }, 'Prototype: live calls aren’t connected, so nobody else can join. Your camera and microphone stay in this browser and only turn on when you ask.'),
        left && h('p', { class: 'say' }, 'You left the room. Your notes are kept on this device.'),
        h('div', { class: 'lobby-acts' },
          h('button', { type: 'button', class: 'continue', onclick: room, html: `Join the room${icon('arrow')}` }),
          h('a', { class: 'back-btn', href: '#/' }, 'Not now')))));
    paint();
  }

  // ---- in the room
  function room() {
    inRoom = true; started = Date.now();
    el.dataset.mode = 'room';
    const clock = h('span', { class: 'clock' });
    const tickClock = () => { const s = Math.floor((Date.now() - started) / 1000); clock.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
    tickClock(); clearInterval(timer); timer = setInterval(tickClock, 1000);

    const stage = h('div', { class: 'room-stage' });
    const shareBtn = h('button', { type: 'button', class: 'av-btn', 'aria-pressed': 'false', onclick: () => { showing = !showing; drawStage(); } });
    const sideBtn = h('button', { type: 'button', class: 'av-btn', 'aria-pressed': 'true', 'aria-controls': 'room-side', html: `${icon('panel')}<span>Notes</span>`,
      onclick: () => { const open = side.hidden; side.hidden = !open; sideBtn.setAttribute('aria-pressed', String(open)); } });
    const side = h('aside', { class: 'room-side', id: 'room-side', 'aria-label': 'Notes, questions and materials' });

    function drawStage() {
      shareBtn.innerHTML = `${icon('screen')}<span>${showing ? 'Hide the chamber' : 'Show the chamber'}</span>`;
      shareBtn.setAttribute('aria-pressed', String(showing));
      if (showing) {
        let energy = 1.4;
        const box = h('div', { class: 'stage-fill' });
        const out = h('output', {}, mev(energy));
        const ch = createChamber(box, { at: (W, H) => ({ x: W * 0.3, y: H * 0.47 }), trace: true });
        const slider = h('input', { type: 'range', min: 0.5, max: 3, step: 0.01, value: energy, 'aria-label': 'Photon energy',
          oninput: (e) => { energy = Number(e.target.value); out.textContent = mev(energy); e.target.setAttribute('aria-valuetext', mev(energy)); } });
        stage.replaceChildren(h('div', { class: 'shared' }, box,
          h('p', { class: 'stage-cap' }, 'The chamber from lesson 3, on the room’s screen'),
          h('div', { class: 'controls' }, h('label', { class: 'en' }, h('span', {}, 'Energy'), slider, out),
            h('button', { type: 'button', class: 'fire', html: `Fire photon${icon('arrow')}`, onclick: () => ch.fire({ energy, split: 0.25 + Math.random() * 0.5, seed: Math.random() }) }))), tile);
        ch.show({ energy, pending: true });
      } else {
        stage.replaceChildren(h('div', { class: 'alone' },
          h('p', { class: 'alone-title' }, 'You’re the only one here'),
          h('p', {}, 'When live sessions are connected, your tutor or classmates will appear here. In this prototype nobody else can join.'),
          h('p', {}, 'You can still use the room on your own: put the chamber on screen, or note what to ask next time.')), tile);
      }
    }

    // Notes are kept as you type; questions to bring start from what you've asked Q.
    const notes = h('textarea', { id: 'room-notes', rows: 8, placeholder: 'What you worked out, what still puzzles you…' });
    notes.value = store.read('room.notes', '');
    const saved = h('span', { class: 'saved', 'aria-live': 'polite' });
    notes.addEventListener('input', () => { store.write('room.notes', notes.value); saved.textContent = 'Saved on this device'; });
    const asked = store.read('q.recent', []).map((id) => topics.find((t) => t.id === id)).filter(Boolean).slice(0, 3);
    side.append(
      h('section', {}, h('h2', { class: 'eyebrow' }, h('label', { for: 'room-notes' }, 'Notes')), notes, saved),
      h('section', {}, h('h2', { class: 'eyebrow' }, 'Questions to bring'),
        asked.length ? h('ul', { class: 'side-list', role: 'list' }, asked.map((t) => h('li', {}, h('a', { href: `#/q/${t.id}` }, t.question))))
          : h('p', { class: 'side-empty' }, 'Questions you ask Q will be listed here.')),
      h('section', {}, h('h2', { class: 'eyebrow' }, 'Materials'),
        h('ul', { class: 'side-list', role: 'list' },
          h('li', {}, h('a', { href: '#/lesson' }, 'Lesson 3 · Can light turn into matter?')),
          h('li', {}, h('a', { href: '#/learning/pair-production' }, 'Pair production on your Understanding Map')))));

    el.replaceChildren(
      h('div', { class: 'room-top' },
        h('h1', {}, TITLE), h('span', { class: 'room-meta' }, h('span', { class: 'live-dot', 'aria-hidden': 'true' }), 'Only you · ', clock)),
      h('div', { class: 'room-body' }, stage, side),
      h('div', { class: 'room-bar', role: 'toolbar', 'aria-label': 'Room controls' },
        micBtn, camBtn, shareBtn, sideBtn,
        h('button', { type: 'button', class: 'av-btn leave', onclick: () => { stopAll(); lobby(true); }, html: `${icon('leave')}<span>Leave</span>` })),
      status);
    drawStage(); paint();
  }

  // Leaving the page switches everything off.
  addEventListener('pagehide', stopAll);
  return {
    enter() { if (!inRoom) lobby(); },
    leave() { stopAll(); paint(); if (inRoom) lobby(); },
  };
}
