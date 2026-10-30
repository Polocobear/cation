// CATION · "Can sound cancel sound?" — the wave surface: scene, camera and render loop.
// Two passes: the displaced wave surface into a half-float target (radiance + view depth), then a
// fullscreen composite for depth of field, tone mapping and grain. The physics is in field.js and the
// shaders, the two camera states in views.js, the scroll-driven lesson in lesson.js, the controls in
// controls.js and the annotations in annotate.js; they drive this scene through window.wave.
//
// URL options (for review and capture): ?t=2.4 freezes time, ?phase=180 sets φ in degrees, ?view=close
// starts on the close-up (?view=0.5 part way), ?gold=1 shows the quiet zones, ?progress=0.6 starts the
// lesson there (the standalone page has no scroll to drive it), ?ss=1.5 surface supersampling, ?dof=0 turns
// depth of field off, ?still renders a few frames and stops (captures hide the controls unless ?ui is given;
// ?ui=0 hides them anywhere), ?manual draws only when wave.advance(dt) is called (frame-by-frame recordings).
// For tuning: ?lambda= ?a0= ?decay= … override the wave, ?yaw= ?el= ?dist= ?fov= ?tx= ?tz= the Observe
// camera, ?uName=a,b,c any uniform (?x_uName= its Close value), ?boxN= a softbox's power and
// ?boxgeoN=az0,az1,el0,el1,edge its placement.

import * as THREE from 'three';
import { surfaceVertex, surfaceFragment, quadVertex, compositeFragment } from './shaders.js';
import { WAVE, k, omega } from './field.js';
import { CLOSE, LOOK, closeFraming } from './views.js';

const q = new URLSearchParams(location.search);
const num = (key, d) => (q.has(key) && q.get(key) !== '' ? parseFloat(q.get(key)) : d);
// Review overrides for the wave parameters (?lambda=0.17&a0=0.03 …); field.js's CPU mirror reads the same object.
for (const [key, prop] of [['lambda', 'wavelength'], ['a0', 'a0'], ['sep', 'separation'], ['core', 'core'], ['decay', 'decay'], ['r0', 'r0']]) {
  WAVE[prop] = num(key, WAVE[prop]);
}
// ?tighten (or ?tighten=1.6): the opt-in bullseye comparison. Off by default; the default is one fixed wavelength.
if (q.has('tighten')) WAVE.tighten = num('tighten', 1.6);

const canvas = document.getElementById('surface');
const still = q.has('still');
const manual = q.has('manual');
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: still || manual });
const DPR = Math.min(window.devicePixelRatio || 1, 2);
// The wave's own clock, so it can pause. Time does not run on while the surface is off screen.
let clock = 0.6, lastNow = null, dirty = true;
let playing = !q.has('paused');
// Render scale: the canvas's pixels per CSS pixel (?pr=), and the surface's supersampling on top of that (?ss=).
// Captures (?still) render at full resolution. Live, the page starts at 1.25 and steps down by itself if frames
// run long (see render()), with the finest detail fading out rather than turning to grit.
let PR = Math.min(DPR, num('pr', still ? DPR : 1.25));
const PR_MIN = Math.min(PR, 0.75);
const SS = num('ss', still ? (DPR >= 2 ? 1 : 1.5) : 1);
renderer.setPixelRatio(PR);
renderer.setClearColor(0x000000, 0); // alpha 0 marks "no surface" for the depth of field

// Observe's camera: low and oblique, as in the reference (≈25° down onto the sources).
// The camera orbits its target: distance, elevation above the plate and yaw (degrees; negative swings
// the camera to the left of the centre line). The 10° turn puts the left source nearer and lower than
// the right, so the two ring systems are not mirror images (level, they read as a pair of eyes).
// The close-up camera is in views.js; applyView() places the camera anywhere between the two.
const CAMERA = {
  fov: num('fov', 30),
  target: new THREE.Vector3(num('tx', -0.1), 0, num('tz', 0.6)),
  dist: num('dist', 3.4727),
  el: num('el', 29),
  yaw: num('yaw', -10),
};
const camera = new THREE.PerspectiveCamera(CAMERA.fov, 16 / 9, 0.05, 60);
{
  const e = THREE.MathUtils.degToRad(CAMERA.el), y = THREE.MathUtils.degToRad(CAMERA.yaw);
  camera.position.set(Math.sin(y) * Math.cos(e), Math.sin(e), Math.cos(y) * Math.cos(e)).multiplyScalar(CAMERA.dist).add(CAMERA.target);
  camera.lookAt(CAMERA.target);
}

// Studio: rectangular softboxes placed in azimuth/elevation (degrees). Azimuth 0 is straight past
// the plate, away from the camera; positive is to the right.
//
// A flat patch mirrors the sky at the same azimuth as the view ray reaching it (≈ −15° under the
// left source, 0° on the centre line, +15° under the right source) and at an elevation that runs
// from ≈ 12° at the far edge of the frame to ≈ 40° at the bottom. Slopes facing the camera mirror
// higher (steep ones past the zenith), slopes facing away mirror lower; sideways slopes swing the azimuth a long way.
// Few panels, small and bright, so the highlights are crisp shapes riding the crests with
// near-black studio between them.
const STUDIO = [
  // A key behind the plate, narrow in azimuth and shallow: the crest tops where the rings cross between
  // the sources mirror it, so the constructive crossings catch the light as bright beads while the rest of
  // the plate falls off into indigo. The far band mirrors below it and stays dark. Graded rose to icy.
  { az: [-14, 14], el: [22, 29], edge: 3, col: [1.04, 0.9, 0.98], colR: [0.84, 0.92, 1.14], power: 3.0, hot: 0.75 },
  // One thin, very bright strip: the glossy coat draws it as a crisp silver line along each crest across
  // the middle band, while the satin base sees it only as a faint glow. Graded rose-white (left) to icy
  // white (right), split either side of the centre line so the crossing is left to the key.
  { az: [-32, -4], el: [24, 28], edge: 0.6, col: [1.06, 0.9, 0.92], colR: [1.0, 0.92, 0.98], power: 12, hot: 0.3 },
  { az: [4, 32], el: [24, 28], edge: 0.6, col: [0.94, 0.94, 1.06], colR: [0.84, 0.94, 1.14], power: 12, hot: 0.3 },
  // A second thin strip, warm, at the elevation the foreground crests mirror: crisp peach rim lines on
  // the near swells. Flagged to the near band: further back, the walls of the pits mirror it too and
  // would draw a lit rim round every pit.
  { az: [-24, 24], el: [33, 35.5], edge: 0.6, col: [1.2, 0.95, 0.74], power: 6, hot: 0.3, mask: 3 },
  // Low wings behind the plate: the outward flanks of each ring mirror these, and the far band gathers
  // their light toward the left and right.
  { az: [-64, -16], el: [1.5, 12], edge: 2.5, col: [1.05, 0.76, 0.76], power: 0.9, hot: 0.45 },  // warm rose, left
  { az: [16, 64], el: [1.5, 12], edge: 2.5, col: [0.6, 0.82, 1.2], power: 0.9, hot: 0.45 },    // icy, right
  { az: [-48, 48], el: [1, 18], edge: 5, col: [0.52, 0.54, 1.0], power: 0.5, hot: 0.0 },       // dim periwinkle band: camera-facing slopes
  // Tall, narrow strips aimed at the azimuth the plate under each source mirrors (set below from the
  // camera), flagged so they only reach the light columns: each source gets a glint path of lit crests.
  { aim: 0, width: 11, el: [20, 38], edge: 2, col: [1.02, 0.9, 0.96], power: 34, hot: 0.35, mask: 1 },
  { aim: 1, width: 11, el: [20, 38], edge: 2, col: [0.86, 0.94, 1.1], power: 23, hot: 0.35, mask: 1 },
  // A soft overhead cap snooted onto the sources: the steep camera-facing walls of the inner rings
  // mirror the sky near and past the zenith, so they catch it and each origin reads as a bright point.
  { az: [-200, 200], el: [50, 92], edge: 4, col: [0.96, 0.92, 1.06], power: 1.4, hot: 0.65, mask: 2 },
  // A broad, dim fill low across the back of the studio: the satin base turns it into the periwinkle
  // body of the slopes between the highlights. It stops below what the near swells mirror, so the
  // foreground stays dark.
  { az: [-70, 70], el: [6, 36], edge: 8, col: [0.66, 0.66, 0.94], power: 0.34, hot: 0.3 },
];
// Aim the glint strips: a flat patch under a source mirrors the sky at the azimuth of the view ray to it.
for (const b of STUDIO) {
  if (b.aim === undefined) continue;
  const sx = (b.aim ? 1 : -1) * WAVE.separation / 2;
  const az = THREE.MathUtils.radToDeg(Math.atan2(sx - camera.position.x, camera.position.z)) + CAMERA.yaw;
  const w = num('glintw', b.width);
  b.az = [az - w / 2, az + w / 2];
  if (q.has('glintel')) b.el = q.get('glintel').split(',').map(Number);
}
const rad = THREE.MathUtils.degToRad;
const c3 = (a, p = 1) => new THREE.Vector3(a[0] * p, a[1] * p, a[2] * p);

const fieldUniforms = {
  uTime: { value: 0 },
  uPhase: { value: THREE.MathUtils.degToRad(num('phase', 0)) },
  uK: { value: k() },
  uOmega: { value: omega() },
  uA0: { value: WAVE.a0 },
  uR0: { value: WAVE.r0 },
  uDecay: { value: WAVE.decay },
  uCore: { value: WAVE.core },
  uTighten: { value: new THREE.Vector2(WAVE.tighten, WAVE.tightenR) },
  uSrc1: { value: new THREE.Vector2(-WAVE.separation / 2, 0) },
  uSrc2: { value: new THREE.Vector2(WAVE.separation / 2, 0) },
  uLift: { value: 1 },
};

const surfaceUniforms = {
  ...fieldUniforms,
  uCamPos: { value: camera.position.clone() },
  uInvViewProj: { value: new THREE.Matrix4() },
  uStudioYaw: { value: rad(CAMERA.yaw) },
  uStudioRot: { value: new THREE.Matrix3() },
  uViewTarget: { value: new THREE.Vector2(CAMERA.target.x, CAMERA.target.z) },
  uBox: { value: STUDIO.map((b) => new THREE.Vector4(rad(b.az[0]), rad(b.az[1]), rad(b.el[0]), rad(b.el[1]))) },
  uBoxEdge: { value: STUDIO.map((b) => rad(b.edge)) },
  uBoxCol: { value: STUDIO.map((b) => c3(b.col, b.power)) },
  uBoxColR: { value: STUDIO.map((b) => c3(b.colR || b.col, b.power)) },
  uBoxHot: { value: STUDIO.map((b) => b.hot) },
  uBoxMask: { value: STUDIO.map((b) => b.mask || 0) },
  uNearMask: { value: new THREE.Vector2(0.9, 1.5) },
  uRoughBase: { value: num('rough', 0.045) },
  uRoughCoat: { value: 0.018 },
  uSpecAA: { value: 0.35 },
  uCoat: { value: 1.0 },
  uCoatF0: { value: 0.22 },
  uAlbedo: { value: new THREE.Vector3(0.004, 0.006, 0.02) },
  uPearlA: { value: new THREE.Vector3(0.15, 0.155, 0.3) },   // facing: periwinkle indigo
  uPearlB: { value: new THREE.Vector3(0.24, 0.22, 0.56) },   // silver lavender
  uPearlC: { value: new THREE.Vector3(0.22, 0.34, 0.72) },    // grazing: icy blue
  uOcc: { value: 0.88 },
  uOccShape: { value: new THREE.Vector3(-0.8, 0.5, 1.5) },
  uOccNear: { value: new THREE.Vector3(0.6, 1.6, 0.35) },
  uSpecOcc: { value: new THREE.Vector2(-0.55, 0.35) },
  uMicro: { value: num('micro', 0.009) },
  uMicroScale: { value: 62 },
  uDetail: { value: 1 },
  uGlitter: { value: num('glitter', 10.0) },
  uGlitterCell: { value: 0.0036 },
  uPoolNear: { value: new THREE.Vector3(0.9, 1.9, 0.65) },
  uPoolCols: { value: new THREE.Vector4(0.15, 0.24, 0.12, 0.25) },
  uPoolColLean: { value: -0.3 },
  uPoolColGain: { value: new THREE.Vector2(1.3, 0.8) },
  uPoolColBack: { value: new THREE.Vector2(-0.9, 0.0) },
  uPoolFarEdge: { value: new THREE.Vector3(0.25, 0.45, 1.0) },
  uPoolSide: { value: new THREE.Vector4(1.25, 0.25, 0.0, 1.0) },
  uPoolColNear: { value: new THREE.Vector3(1.0, 1.6, 0.7) },
  uPoolX: { value: new THREE.Vector3(0.41, 0.39, 0.2) },
  uPoolOval: { value: new THREE.Vector4(2.2, 1.4, 0.6, 1.0) },  // floor 1: off in Observe (views.js sets Close's)
  uWarm: { value: new THREE.Vector3(1.4, 1.0, 0.6) },   // peach-white tint of the light toward the camera
  uWarmZ: { value: new THREE.Vector2(0.0, 1.0) },
  uPoolFar: { value: new THREE.Vector3(-0.6, -1.6, 0.08) },
  uFade: { value: new THREE.Vector2(-1.2, -2.05) },
  uFadeLift: { value: 0.6 },
  uEnvTint: { value: new THREE.Vector3(0.046, 0.048, 0.078) },
  uSrcLight: { value: new THREE.Vector3(0.1, 0.15, 0.42) },
  uSrcBounce: { value: new THREE.Vector3(0.9, 0.86, 1.1) },
  // The quiet zones, where the two waves cancel (lesson.js sets uGold as the phase of B starts to turn)
  uGold: { value: num('gold', 0) },
  uQuiet: { value: new THREE.Vector3(0.62, 1.0, 1.0) },  // only near-complete cancellation: thin lines, fading where it is partial
  uGoldF0: { value: new THREE.Vector3(0.8, 0.52, 0.18) },
  uGoldRough: { value: 0.1 },
  uGoldGlow: { value: new THREE.Vector3(0.22, 0.14, 0.04) },
  uGoldCoat: { value: new THREE.Vector3(0.5, 0.33, 0.12) },
  uGoldSpot: { value: new THREE.Vector4(0, 0, 0.35, 0.3) },  // the listening point (field.js MIDPOINT): wider there, from quiet 0.3
  uGoldLift: { value: 3.5 },
};

const surfaceMaterial = new THREE.RawShaderMaterial({
  glslVersion: THREE.GLSL3,
  vertexShader: surfaceVertex,
  fragmentShader: surfaceFragment,
  uniforms: surfaceUniforms,
  defines: { DEBUG: num('debug', 0) | 0, NL: STUDIO.length },
});

// A projected grid: rows and columns spaced evenly on screen (in normalised device coordinates, a little
// past the edges); the vertex shader lays each point onto the plate through the current camera, so every
// part of the visible surface gets the same vertex density from any viewpoint.
function buildGrid(cols, rows) {
  const pos = new Float32Array(cols * rows * 3);
  let n = 0;
  for (let j = 0; j < rows; j++) {
    const ny = -1.1 + (2.18 * j) / (rows - 1);
    for (let i = 0; i < cols; i++) {
      pos[n++] = -1.08 + (2.16 * i) / (cols - 1); pos[n++] = ny; pos[n++] = 0;
    }
  }
  const idx = new Uint32Array((cols - 1) * (rows - 1) * 6);
  n = 0;
  for (let j = 0; j < rows - 1; j++) {
    for (let i = 0; i < cols - 1; i++) {
      const a = j * cols + i, b = a + 1, c = a + cols, d = c + 1;
      idx[n++] = a; idx[n++] = b; idx[n++] = c;
      idx[n++] = b; idx[n++] = d; idx[n++] = c;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}

const scene = new THREE.Scene();
const surface = new THREE.Mesh(new THREE.BufferGeometry(), surfaceMaterial);
surface.frustumCulled = false;
scene.add(surface);

// Composite pass
const tri = new THREE.BufferGeometry();
tri.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
const compositeUniforms = {
  uScene: { value: null },
  uRes: { value: new THREE.Vector2() },
  uFocus: { value: 3.6 },
  uFocusBand: { value: 0.035 },
  uFarScale: { value: 1.7 },
  uCocScale: { value: 90 },
  uMaxCoc: { value: 9 },
  uExposure: { value: num('exposure', 1.6) },
  uSeed: { value: 0 },
  uBackdrop: { value: new THREE.Vector3(0.03, 0.044, 0.078) },
  uDof: { value: num('dof', 1) },
  uDofSamples: { value: num('dofs', still ? 400 : 40) },
  uRaw: { value: 0 },  // 1 shows the surface pass untouched (for checking DEBUG output against field.js)
};
// The surface shader reads the same focus numbers, so glints can soften where the plate is out of focus.
const dofSurf = { value: new THREE.Vector4() };
surfaceUniforms.uDofSurf = dofSurf;
surfaceUniforms.uDofMax = compositeUniforms.uMaxCoc;
const syncDof = () => dofSurf.value.set(compositeUniforms.uFocus.value, compositeUniforms.uFocusBand.value, compositeUniforms.uCocScale.value * compositeUniforms.uDof.value, compositeUniforms.uFarScale.value);
const composite = new THREE.Mesh(tri, new THREE.RawShaderMaterial({
  glslVersion: THREE.GLSL3, vertexShader: quadVertex, fragmentShader: compositeFragment,
  uniforms: compositeUniforms, depthTest: false, depthWrite: false,
}));
composite.frustumCulled = false;
const post = new THREE.Scene();
post.add(composite);
const postCam = new THREE.Camera();

// Review overrides for any uniform (?uOcc=0.3&uPoolX=0.4,0.4,0.2) and per-softbox power (?box3=0.5).
for (const [key, val] of q) {
  const u = surfaceUniforms[key] || compositeUniforms[key];
  const v = val.split(',').map(parseFloat);
  if (u && typeof u.value === 'number') u.value = v[0];
  else if (u && u.value && u.value.set) u.value.set(...v);
  const box = /^box(\d+)$/.exec(key);
  if (box) { surfaceUniforms.uBoxCol.value[+box[1]].multiplyScalar(v[0]); surfaceUniforms.uBoxColR.value[+box[1]].multiplyScalar(v[0]); }
  const geo = /^boxgeo(\d+)$/.exec(key);  // ?boxgeo0=az0,az1,el0,el1,edge (degrees)
  if (geo) { surfaceUniforms.uBox.value[+geo[1]].set(...v.slice(0, 4).map(rad)); if (v.length > 4) surfaceUniforms.uBoxEdge.value[+geo[1]] = rad(v[4]); }
  const hot = /^boxhot(\d+)$/.exec(key);
  if (hot) surfaceUniforms.uBoxHot.value[+hot[1]] = v[0];
  const look = /^x_(u\w+)$/.exec(key);  // ?x_uPoolNear=…: a Close value
  if (look && look[1] in LOOK) LOOK[look[1]] = v.length > 1 ? v : v[0];
}

// ---------- the view: Observe ↔ Close ----------

// Observe's values for the falloffs Close changes (as set above, overrides included).
const asList = (v) => (typeof v === 'number' ? v : v.toArray());
const OBSERVE_LOOK = Object.fromEntries(Object.keys(LOOK).map((key) => [key, asList(surfaceUniforms[key].value)]));
const DOF = compositeUniforms.uDof.value, FOCUS = compositeUniforms.uFocus.value, BAND = compositeUniforms.uFocusBand.value;
const EXPOSURE = compositeUniforms.uExposure.value;
// How far the studio tilts with the camera as it lowers (1: the lights keep their places in the shot; 0: the
// studio stays put, so up close flat plate mirrors the dim sky below the key and only the slopes catch it).
const TILT = num('tilt', CLOSE.tilt);
const LIFT = num('lift', CLOSE.lift);
let cam = q.has('view') ? (q.get('view') === 'close' ? 1 : num('view', 0)) : 0;  // 0 = Observe, 1 = Close
const lerp = (a, b, t) => a + (b - a) * t;
const aim = new THREE.Vector3(), axis = new THREE.Vector3(), turn = new THREE.Matrix4();

function applyView() {
  const p = cam;
  const cl = closeFraming(camera.aspect, CAMERA.fov);
  const tx = lerp(CAMERA.target.x, cl.x, p), tz = lerp(CAMERA.target.z, cl.z, p);
  const el = rad(lerp(CAMERA.el, cl.el, p)), yaw = rad(lerp(CAMERA.yaw, CLOSE.yaw, p));
  // The distance changes by a factor of four: interpolated in log space, the approach keeps an even pace.
  const dist = Math.exp(lerp(Math.log(CAMERA.dist), Math.log(cl.dist), p));
  aim.set(tx, 0, tz);
  camera.position.set(Math.sin(yaw) * Math.cos(el), Math.sin(el), Math.cos(yaw) * Math.cos(el)).multiplyScalar(dist).add(aim);
  camera.lookAt(aim);
  camera.updateMatrixWorld();
  const U = surfaceUniforms;
  U.uCamPos.value.copy(camera.position);
  U.uInvViewProj.value.multiplyMatrices(camera.matrixWorld, camera.projectionMatrixInverse);
  U.uStudioYaw.value = yaw;
  U.uViewTarget.value.set(tx, tz);
  turn.makeRotationAxis(axis.set(Math.cos(yaw), 0, -Math.sin(yaw)), -(el - rad(CAMERA.el)) * TILT);
  U.uStudioRot.value.setFromMatrix4(turn);
  for (const key in LOOK) {
    const a = OBSERVE_LOOK[key], b = LOOK[key], u = U[key];
    if (typeof a === 'number') u.value = lerp(a, b, p);
    else u.value.fromArray(a.map((x, i) => lerp(x, b[i], p)));
  }
  fieldUniforms.uLift.value = lerp(1, LIFT, p);
  // Up close the focus sits just in front of the midpoint and the sharp band widens to hold the whole meeting
  // area, from the near swells to just behind the midpoint, with a softer blur beyond it.
  compositeUniforms.uFocus.value = lerp(FOCUS, dist * CLOSE.focus, p);
  compositeUniforms.uFocusBand.value = lerp(BAND, CLOSE.focusBand / dist, p);
  compositeUniforms.uDof.value = DOF * lerp(1, CLOSE.blur, p);
  compositeUniforms.uExposure.value = EXPOSURE * lerp(1, num('cexp', CLOSE.exposure), p);
  syncDof();
  dirty = true;
}

let target = null;
let gridSize = '';
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  surfaceUniforms.uDetail.value = Math.min(1, PR / DPR);
  renderer.setPixelRatio(PR);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // Narrower than 16:9 (phones), the vertical field widens so the same width of the plate stays in view.
  const wide = 16 / 9, half = THREE.MathUtils.degToRad(CAMERA.fov / 2);
  camera.fov = camera.aspect >= wide - 0.01 ? CAMERA.fov : THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(half) * wide / camera.aspect));
  camera.updateProjectionMatrix();
  applyView();
  const bw = Math.round(w * PR), bh = Math.round(h * PR);
  const tw = Math.round(bw * SS), th = Math.round(bh * SS);
  if (target) target.dispose();
  target = new THREE.WebGLRenderTarget(tw, th, {
    type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: true,
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false,
  });
  compositeUniforms.uScene.value = target.texture;
  compositeUniforms.uRes.value.set(bw, bh);
  // Blur sizes are set in reference pixels (941 tall) and scale with the output.
  const s = bh / 941;
  compositeUniforms.uCocScale.value = num('coc', 90) * s;
  compositeUniforms.uMaxCoc.value = num('maxcoc', 13) * s;
  syncDof();
  const density = num('mesh', still ? 1.4 : 3);  // CSS px between vertices: denser triangles only add overshading, not detail
  if (gridSize === `${w}x${h}`) return;  // a change of render scale keeps the mesh
  gridSize = `${w}x${h}`;
  surface.geometry.dispose();
  surface.geometry = buildGrid(Math.round(w / density), Math.round(h / density));
}
resize();
let resizeTimer = 0;
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(resize, 120); });

const frozen = q.has('t') ? num('t', 0) : null;
let frames = 0;

// Adaptive render scale: over each run of 40 frames, if the median frame takes longer than about 20 ms
// (under 50 fps), drop the render scale a step. Gaps from pauses or hidden tabs are ignored.
const pace = { last: 0, gaps: [], settle: performance.now() + 1500 };  // the first moments include compiling and loading
function adapt(now) {
  const gap = now - pace.last;
  pace.last = now;
  if (still || manual || q.has('fixed') || gap > 250 || now < pace.settle) return;
  pace.gaps.push(gap);
  if (pace.gaps.length < 40) return;
  const median = pace.gaps.sort((a, b) => a - b)[20];
  pace.gaps.length = 0;
  window.__quality = { pr: PR, ms: +median.toFixed(1) };
  if (median > 20 && PR > PR_MIN) {
    PR = Math.max(PR_MIN, +(PR - 0.25).toFixed(2));
    resize();
    pace.settle = now + 600;
  }
}

function draw() {
  fieldUniforms.uTime.value = frozen ?? clock;
  compositeUniforms.uSeed.value = still ? 0 : (frames * 0.618) % 1;
  renderer.setRenderTarget(target);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  renderer.render(post, postCam);
}

// One frame of dt seconds: the lesson (which may move the camera or the phase), the wave's clock, then a
// draw if anything changed. Paused and at rest, the frame is redrawn only when something changes (the phase,
// the view, a resize). The waves keep running however the camera moves.
const tickListeners = [], frameListeners = [];
function step(dt) {
  for (const f of tickListeners) f(dt);
  if (playing) clock += dt;
  if (playing || dirty || still) {
    draw();
    for (const f of frameListeners) f();
  }
  dirty = false;
  frames++;
}

function render(now) {
  adapt(now);
  step(lastNow === null ? 0 : Math.min(now - lastNow, 100) / 1000);
  lastNow = now;
  if (still && frames >= 3) {
    window.__ready = true;
    return;
  }
  if (onScreen) requestAnimationFrame(render);
}
// Embedded in a page, the surface renders only while it is on screen (an observer inside a frame
// measures against the top-level viewport).
let onScreen = !manual;
if (!manual) {
  new IntersectionObserver(([e]) => {
    const was = onScreen;
    onScreen = still || e.isIntersecting;
    if (onScreen && !was) requestAnimationFrame(render);
  }).observe(canvas);
  requestAnimationFrame(render);
}

// The scene's interface, for the controls and for review.
const gl = renderer.getContext();
const info = gl.getExtension('WEBGL_debug_renderer_info');
window.__gl = info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
window.wave = {
  uniforms: surfaceUniforms,
  composite: compositeUniforms,
  setPhaseDegrees(d) {
    const v = THREE.MathUtils.degToRad(d);
    if (v !== fieldUniforms.uPhase.value) { fieldUniforms.uPhase.value = v; dirty = true; }
  },
  get phaseDegrees() { return THREE.MathUtils.radToDeg(fieldUniforms.uPhase.value); },
  get playing() { return playing; },
  setPlaying(p) { playing = p; },
  get time() { return fieldUniforms.uTime.value; },
  setTime(t) { clock = t; dirty = true; },
  // The camera: 0 = Observe, 1 = Close (views.js), or anywhere between.
  setView(c) { if (c !== cam) { cam = c; applyView(); } },
  get view() { return cam; },
  // The quiet zones' gold, 0 to 1.
  setGold(w) { if (w !== surfaceUniforms.uGold.value) { surfaceUniforms.uGold.value = w; dirty = true; } },
  get lift() { return fieldUniforms.uLift.value; },
  get phase() { return fieldUniforms.uPhase.value; },
  // Called every frame with dt (s), before the frame is drawn.
  onTick(f) { tickListeners.push(f); },
  onFrame(f) { frameListeners.push(f); },
  // ?manual: draw the next frame dt seconds on (frame-by-frame recordings; time and the lesson both advance).
  advance(dt) { step(dt); },
  // A point on the plate (x, z), at height y, in CSS pixels from the frame's top left.
  project(x, z, y = 0) {
    const v = new THREE.Vector3(x, y, z).project(camera);
    return { x: (v.x * 0.5 + 0.5) * window.innerWidth, y: (0.5 - v.y * 0.5) * window.innerHeight, ahead: v.z < 1 };
  },
  // Milliseconds per frame, drawing n frames back to back and waiting for the GPU (for performance checks).
  bench(n = 30) {
    const px = new Uint8Array(4);
    const sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);  // blocks until the GPU is done
    sync();
    const start = performance.now();
    for (let i = 0; i < n; i++) { draw(start + i * 16.7); sync(); }
    return (performance.now() - start) / n;
  },
  get renderScale() { return PR; },
};

if (q.get('ui') !== '0' && (!still || q.has('ui'))) import('./controls.js').then((m) => m.mount(window.wave));
