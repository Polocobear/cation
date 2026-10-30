// "Learning personalized to you": one concept, taught in different ways. The live stage (white light through a
// glass prism, with one slider for the angle of incidence), the method selectors, and the lesson the chosen methods
// make (methods.js). WebGL starts only when the section nears the viewport; the scene renders only when something
// changes (the light arriving, the slider, a drag, a resize, a step in the lesson). Nothing loops on its own.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createRenderer, createPipeline, setLineResolution, placeLabels } from './studio.js';
import { SHOTS } from './scenes.js';
import { createLesson } from './methods.js';
import './target.js';

const root = document.querySelector('.pz');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

// ---------- Methods: one or two at a time ----------
const methods = [...root.querySelectorAll('.method')];
let chosen = methods.filter((m) => m.getAttribute('aria-pressed') === 'true').map((m) => m.dataset.ap);
let teach = () => {}; // set once the stage is running
function syncMethods() {
  for (const m of methods) m.setAttribute('aria-pressed', String(chosen.includes(m.dataset.ap)));
  root.dataset.methods = chosen.join(' ');
  teach(chosen);
}
for (const m of methods) {
  m.addEventListener('click', () => {
    const id = m.dataset.ap;
    if (chosen.includes(id)) { if (chosen.length > 1) chosen = chosen.filter((x) => x !== id); }
    else chosen = [...chosen, id].slice(-2); // a third choice replaces the earlier of the two
    syncMethods();
  });
}
syncMethods();

// ---------- The stage ----------
async function start() {
  const stage = root.querySelector('.stage');
  const view = stage.querySelector('.stage-view');
  const canvas = view.querySelector('.stage-canvas');
  const copy = stage.querySelector('.stage-copy');
  const angle = stage.querySelector('[data-ctl="theta"]');
  const hint = stage.querySelector('.stage-hint');
  const room = stage.querySelector('.stage-room');
  const renderer = createRenderer(canvas);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);

  const shot = SHOTS.master(renderer, { aspect: 1.4 });
  const { camera, rig } = shot;
  const pipeline = createPipeline(renderer, shot.scene, camera);
  pipeline.setPixelRatio(dpr);

  // The composed framing, kept so narrower stages step back along the same line to fit the same action.
  const BASE = { pos: camera.position.clone(), target: camera.userData.target.clone(), aspect: 1.4 };
  const START = rig.theta; // the composed angle: least deviation
  // Two views the lesson can ask for: the composed three-quarter view, and head-on, where the angles read true.
  const VIEWS = {
    composed: BASE.pos.clone().sub(BASE.target).normalize(),
    'head-on': new THREE.Vector3(0, Math.sin(THREE.MathUtils.degToRad(4)), Math.cos(THREE.MathUtils.degToRad(4))),
  };
  let fitDist = BASE.pos.distanceTo(BASE.target);

  // Three of the scene's own points place it on a wide stage: the prism's apex, the front edge of its base, and
  // where the light lands.
  const poly = rig.entryShape.poly;
  const apex = poly.reduce((a, p) => (p[1] > a[1] ? p : a));
  const path = rig.ref.segments.filter((g) => g.path === 'main');
  const body = new THREE.Box3().setFromObject(shot.body);
  const KEY = {
    apex: rig.plane.at(apex),
    base: new THREE.Vector3(apex[0], body.min.y, body.max.z),
    land: rig.plane.at(path[path.length - 1].b),
  };
  const probe = camera.clone();
  const onFrame = (p) => { const v = p.clone().project(probe); return [(v.x + 1) / 2, (1 - v.y) / 2]; };
  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(BASE.target);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.enableZoom = false;
  controls.rotateSpeed = 0.55;
  const az0 = Math.atan2(BASE.pos.x - BASE.target.x, BASE.pos.z - BASE.target.z);
  controls.minAzimuthAngle = az0 - THREE.MathUtils.degToRad(42);
  controls.maxAzimuthAngle = az0 + THREE.MathUtils.degToRad(42);
  controls.minPolarAngle = THREE.MathUtils.degToRad(58);
  controls.maxPolarAngle = THREE.MathUtils.degToRad(88);

  // Labels: the angles and indices are the trace's own numbers.
  const tags = {};
  for (const el of view.querySelectorAll('[data-label]')) tags[el.dataset.label] = el;
  const values = {};
  for (const el of stage.querySelectorAll('[data-v]')) values[el.dataset.v] = el;
  const fmt = (d) => (d == null ? '—' : `${d.toFixed(1)}°`);
  function showNumbers() {
    const r = shot.readout;
    values.theta1.textContent = fmt(r.theta1);
    values.theta2.textContent = r.theta2 == null ? 'reflected' : fmt(r.theta2);
    values.glassName.textContent = r.mat.name;
    values.glassN.textContent = `n = ${r.n.toFixed(2)}`;
    values.thetaOut.textContent = fmt(rig.theta);
    angle.value = rig.theta.toFixed(1);
    angle.style.setProperty('--fill', `${((rig.theta - angle.min) / (angle.max - angle.min)) * 100}%`);
  }
  showNumbers();
  let arrived = true;
  function labels() {
    const a = shot.anchors, keys = Object.keys(tags);
    const was = keys.map((k) => tags[k].hidden);
    placeLabels(keys.filter((k) => a[k]).map((k) => ({ el: tags[k], at: a[k] })), camera, view.clientWidth, view.clientHeight);
    const behind = keys.map((k) => !!a[k] && tags[k].hidden); // placeLabels hides what is behind the camera
    keys.forEach((k, j) => { tags[k].hidden = was[j]; });
    const c = copy.getBoundingClientRect();
    keys.forEach((k, j) => {
      // The angles are measured once the light is there to measure.
      let hide = !a[k] || behind[j] || (!arrived && k.startsWith('theta'));
      // A medium's name gives way to the lesson's text where the two would overlap.
      if (!hide && (k === 'air' || k === 'glass')) {
        const b = tags[k].getBoundingClientRect();
        hide = b.left < c.right && b.right > c.left && b.top < c.bottom + 6 && b.bottom > c.top;
      }
      tags[k].hidden = hide;
    });
  }

  // Rendering on demand
  let raf = 0, anim = null, camTween = null;
  function frame(now) {
    raf = 0;
    let moving = controls.update();
    if (camTween) moving = camTween(now) || moving;
    if (anim) moving = anim(now) || moving;
    pipeline.render();
    labels();
    if (moving) request();
  }
  function request() { if (!raf) raf = requestAnimationFrame(frame); }
  controls.addEventListener('change', request);

  function resize() {
    const w = view.clientWidth, h = view.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    pipeline.setSize(w, h);
    setLineResolution(w, h);
    // The scene's frame: where on the stage the camera's picture goes. It is fixed by the stage's size alone, never
    // by the lesson, so nothing moves as a lesson grows or changes.
    let frame;
    if (room.offsetHeight) {
      // Phones: the stage keeps a room of its own for the scene, between the title and the slider.
      const v = view.getBoundingClientRect(), r = room.getBoundingClientRect();
      frame = { x: 0, y: r.top - v.top, w, h: r.height };
    } else {
      // Wide stages: the lesson's text keeps the top-left column, at its widest and tallest, from the start. The
      // apex sits clear of that column, the light lands inside the stage, and the base stands above the slider.
      const fit = Math.max(1, BASE.aspect / (w / h)) ** 0.92;
      probe.aspect = w / h;
      probe.clearViewOffset();
      probe.position.copy(BASE.target).addScaledVector(VIEWS.composed, BASE.pos.distanceTo(BASE.target) * fit);
      probe.lookAt(BASE.target);
      probe.updateProjectionMatrix();
      probe.updateMatrixWorld();
      const A = onFrame(KEY.apex), B = onFrame(KEY.base), L = onFrame(KEY.land);
      const text = copy.offsetLeft + parseFloat(getComputedStyle(copy).maxWidth);
      const ax = Math.max(text + 0.15 * w, 0.58 * w);
      const s = Math.min(1.15, (0.96 * w - ax) / ((L[0] - A[0]) * w));
      frame = { w: s * w, h: s * h };
      frame.x = ax - A[0] * frame.w;
      frame.y = 0.83 * h - Math.max(B[1], L[1]) * frame.h;
    }
    camera.aspect = frame.w / frame.h;
    camera.setViewOffset(frame.w, frame.h, -frame.x, -frame.y, w, h);
    const fit = Math.max(1, BASE.aspect / camera.aspect) ** 0.92;
    fitDist = BASE.pos.distanceTo(BASE.target) * fit;
    const dir = camera.position.clone().sub(controls.target).normalize();
    camera.position.copy(controls.target).addScaledVector(dir, fitDist);
    camera.updateProjectionMatrix();
    request();
  }
  new ResizeObserver(resize).observe(view);

  // Anything that changes the lesson skips the light's arrival.
  function settle() {
    if (!anim) return;
    anim = null; arrived = true; shot.marks.visible = true;
  }

  // The slider: the light is re-traced at the new angle, and the labels and the lesson read the new trace.
  angle.addEventListener('input', () => {
    settle();
    shot.update({ theta: Number(angle.value), reveal: null });
    showNumbers();
    lesson.angle();
    request();
  });

  // The camera, for the lesson: free to turn with Visual & spatial, otherwise held on the view the method needs.
  let viewName = 'composed';
  function setView(name, orbit) {
    controls.enabled = orbit;
    stage.dataset.orbit = orbit ? 'on' : 'off';
    hint.hidden = !orbit;
    if (orbit && name === viewName) return;
    viewName = name;
    const from = camera.position.clone().sub(controls.target).normalize(), to = VIEWS[name];
    if (from.distanceTo(to) < 1e-3) return;
    const t0 = performance.now(), dur = reduced.matches ? 0 : 900;
    camTween = (now) => {
      const k = dur ? Math.min(1, (now - t0) / dur) : 1;
      const e = k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2;
      camera.position.copy(controls.target).addScaledVector(from.clone().lerp(to, e).normalize(), fitDist);
      camera.lookAt(controls.target);
      if (k < 1) return true;
      camTween = null;
      return false;
    };
    request();
  }

  const lesson = createLesson(copy.querySelector('.stage-lesson'), {
    startTheta: START,
    readout: () => shot.readout,
    stage(state) { settle(); shot.update({ ...state, reveal: null }); showNumbers(); request(); },
    setTheta(v) { settle(); shot.update({ theta: v, reveal: null }); showNumbers(); request(); },
    view: setView,
    canReplay: () => !reduced.matches,
    replay: () => arrive(),
  });

  // The light arrives: it travels in from the left, crosses the prism and fans out; then the construction and the
  // angles appear. Once, when the stage is first in view.
  function arrive() {
    if (reduced.matches) return;
    const from = Math.max(0, (rig.back - 2.6) / rig.pathLength);
    const t0 = performance.now(), travel = 1900;
    arrived = false;
    shot.marks.visible = false;
    anim = (now) => {
      const k = Math.min(1, (now - t0) / travel);
      const e = 1 - (1 - k) ** 3;
      shot.update({ reveal: k < 1 ? from + (1 - from) * e : null });
      if (k < 1) return true;
      arrived = true;
      shot.marks.visible = true;
      anim = null;
      return false;
    };
    request();
  }

  resize();
  await document.fonts.ready;
  pipeline.render();
  labels();
  stage.classList.add('is-live');
  teach = (ids) => lesson.set(ids);
  teach(chosen);
  root.dataset.ready = 'true';

  const seen = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) { seen.disconnect(); arrive(); }
  }, { threshold: 0.45 });
  seen.observe(stage);
}

// Start WebGL a little before the section scrolls into view.
const io = new IntersectionObserver((entries) => {
  if (entries.some((e) => e.isIntersecting)) {
    io.disconnect();
    start().catch((err) => console.error('Optics stage failed to start', err));
  }
}, { rootMargin: '600px 0px' });
io.observe(root.querySelector('.stage'));
