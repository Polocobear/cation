// The master optical scene and the five miniatures, all assembled from studio.js and optics.js.
// Each shot returns { scene, camera, rig, labels, frame } and renders once; nothing here animates.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import * as O from './optics.js';
import * as S from './studio.js';

export const SPECTRUM = O.spectrum(24);
const MONO = (() => { const c = O.wavelengthRGB(O.SODIUM); const m = Math.max(...c); return c.map((v) => v / m); })();

// ---------- Geometry helpers ----------

// A plane of incidence in the world: 2D optics coordinates (x, y) map to origin + x·u + y·v.
export class Plane {
  constructor(origin, u, v) {
    this.origin = origin.clone();
    this.u = u.clone().normalize();
    this.v = v.clone().normalize();
    this.n = new THREE.Vector3().crossVectors(this.u, this.v);
  }
  at([x, y]) { return this.origin.clone().addScaledVector(this.u, x).addScaledVector(this.v, y); }
  dir([x, y]) { return new THREE.Vector3().addScaledVector(this.u, x).addScaledVector(this.v, y).normalize(); }
  shifted(d) { return new Plane(this.origin.clone().addScaledVector(this.n, d), this.u, this.v); }
}

const VERTICAL = (z = 0) => new Plane(new THREE.Vector3(0, 0, z), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0));
const FLAT = (y = 0) => new Plane(new THREE.Vector3(0, y, 0), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, -1));

// A glass body: the polygon extruded `depth` along the plane's normal, centred on the plane, with softly
// rounded edges that stay inside the optical outline (so the light meets the faces the physics uses).
export function glassBody(poly, plane, depth, material, bevel = 0.014) {
  const shape = new THREE.Shape(poly.map(([x, y]) => new THREE.Vector2(x, y)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelOffset: -bevel, bevelSegments: 6, curveSegments: 96 });
  geo.translate(0, 0, -depth / 2);
  geo.applyMatrix4(new THREE.Matrix4().makeBasis(plane.u, plane.v, plane.n).setPosition(plane.origin));
  const mesh = new THREE.Mesh(geo, material);
  mesh.renderOrder = 5;
  return mesh;
}

export function aim(camera, target, azimuth, elevation, distance) {
  const az = O.rad(azimuth), el = O.rad(elevation);
  camera.position.set(target.x + distance * Math.sin(az) * Math.cos(el), target.y + distance * Math.sin(el), target.z + distance * Math.cos(az) * Math.cos(el));
  camera.lookAt(target);
  camera.userData.target = target.clone();
}

// ---------- The world: floor, backdrop, fog, lighting ----------
const envCache = new WeakMap();
export function world(renderer, { haze = 1, hazeAzimuth = 0, fog = 0.06, pool = 1, poolAt = [0, -0.4], poolSize = [7, 5] } = {}) {
  if (!envCache.has(renderer)) envCache.set(renderer, S.studioEnvironment(renderer));
  const scene = new THREE.Scene();
  scene.environment = envCache.get(renderer);
  // The floor fades into the colour the sky has at the horizon behind the subject, so there is no line.
  const fogColor = new THREE.Color(S.PALETTE.horizon).add(new THREE.Color(S.PALETTE.haze).multiplyScalar(0.32 * haze * 0.8));
  scene.fog = new THREE.FogExp2(fogColor, fog);
  scene.add(S.backdrop({ hazeAzimuth, hazeStrength: 0.32 * haze }));
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), S.floorMaterial());
  floor.rotation.x = -Math.PI / 2;
  // A few millimetres below everything that rests on it (the glass, the light pool, where the light lands), so
  // no two surfaces share a depth: coplanar faces flicker in stripes as the view turns, and the glass, which
  // sees the floor through its own back faces, would show those stripes too.
  floor.position.y = -0.004;
  scene.add(floor);
  // Glass reads against light: a soft pool on the floor just behind the subject backlights it.
  if (pool) { const p = S.lightPool(poolSize[0], poolSize[1], '#2a2450', pool); p.position.x = poolAt[0]; p.position.z = poolAt[1]; scene.add(p); }
  return scene;
}

function plinth(width, height, depth) {
  const m = new THREE.Mesh(new RoundedBoxGeometry(width, height, depth, 5, 0.018), new THREE.MeshPhysicalMaterial({ color: new THREE.Color('#0d0e16'), roughness: 0.3, clearcoat: 0.85, clearcoatRoughness: 0.12, envMapIntensity: 0.75 }));
  m.position.y = height / 2;
  return m;
}

// ---------- The rig: light through glass, computed and drawn ----------

// How far along its own branch of the trace each segment end lies. A child ray starts on the very point its
// parent ended on, so ends can be keyed by identity; parents always come before their children.
function pathDistances(tr) {
  const dist = new Map([[tr.o, 0]]);
  for (const g of tr.segments) dist.set(g.b, (dist.get(g.a) ?? 0) + Math.hypot(g.b[0] - g.a[0], g.b[1] - g.a[1]));
  return dist;
}

export class Rig {
  constructor(opts) {
    Object.assign(this, {
      light: 'white', sign: 1, far: 3.4, back: 3.4, floor: true, floorY: 0, boxes: [],
      width: 0.05, intensity: 4, reflections: true, stopAtEntry: false, fadeBack: 0.85, reveal: null,
    }, opts);
    this.beams = new S.Beams(2048);
    this.spots = new S.Spots(512);
    this.group = new THREE.Group();
    this.group.add(this.beams.mesh, this.spots.mesh);
  }
  get entryShape() { return this.shapes[this.entry.shape]; }
  shapesFor(nm) { return this.shapes.map((s) => ({ poly: s.poly, n: O.index(s.material || this.material, nm) })); }
  entryPoint() { return O.onEdge(this.entryShape.poly, this.entry.edge, this.entry.t); }
  incomingDir() { return O.incoming(this.entryShape.poly, this.entry.edge, O.rad(this.theta), this.sign); }
  origin() {
    const e = this.entryPoint(), d = this.incomingDir();
    let back = this.back;
    // In a vertical plane a rising beam comes up from the dark, never through the floor.
    if (this.floor && d[1] > 1e-6) back = Math.min(back, (e[1] - this.floorY - 0.03) / d[1]);
    return [e[0] - d[0] * back, e[1] - d[1] * back];
  }
  traceAt(nm, extra = {}) {
    const o = this.origin(), d = this.incomingDir();
    return { o, ...O.trace(this.shapesFor(nm), o, d, { far: this.far, floor: this.floor, floorY: this.floorY, boxes: this.boxes, ...extra }) };
  }
  // The wavelength the numbers on screen refer to: the d line for white light, sodium for one colour.
  get refNm() { return this.light === 'white' ? O.D_LINE : O.SODIUM; }
  run() {
    this.beams.clear();
    this.spots.clear();
    const samples = this.light === 'white' ? SPECTRUM : [{ nm: O.SODIUM, rgb: MONO }];
    this.ref = this.traceAt(this.refNm);
    const along = pathDistances(this.ref);
    this.pathLength = Math.max(...this.ref.segments.filter((g) => g.path === 'main').map((g) => along.get(g.b) ?? 0));
    // "Follow the light": only the first `reveal` of the path (a fraction of the main path's length) is drawn.
    const reach = this.reveal == null ? Infinity : this.reveal * this.pathLength;
    const P = this.plane;
    for (const s of samples) {
      const tr = this.traceAt(s.nm, this.stopAtEntry ? { maxDepth: 0 } : {});
      const dist = pathDistances(tr);
      for (const seg of tr.segments) {
        if (!this.reflections && seg.path === 'reflection') continue;
        const from = dist.get(seg.a) ?? 0;
        if (from >= reach) continue;
        const a = P.at(seg.a);
        let b = P.at(seg.b);
        // Reflected branches are drawn short: they are a few per cent of the light and should read that way.
        if (seg.path === 'reflection' && seg.end === 'far') b = a.clone().lerp(b, Math.min(1, 0.6 / a.distanceTo(b)));
        const cut = from + a.distanceTo(b) > reach;
        if (cut) b = a.clone().lerp(b, (reach - from) / a.distanceTo(b));
        const len = a.distanceTo(b);
        const incoming = seg.a === tr.o;
        const fadeIn = incoming ? len * this.fadeBack : 0;
        const fadeOut = !cut && seg.end === 'far' ? (seg.path === 'reflection' ? len * 0.92 : Math.min(len * 0.75, 1.8)) : 0;
        const i = this.intensity * seg.w * (seg.inside ? 0.9 : 1);
        this.beams.add(a, b, s.rgb, { width: this.width, intensity: i, fadeIn: cut && incoming ? Math.min(fadeIn, len * 0.6) : fadeIn, fadeOut });
        if (!cut && seg.end === 'floor') this.floorSpot(a, b, s.rgb, i);
      }
    }
    // Scatter inside the glass, along the main path's segments through it.
    if (this.glow) this.glow.set(this.ref.segments.filter((g) => g.inside).map((g) => ({ a: P.at(g.a), b: P.at(g.b), w: g.w * (this.stopAtEntry ? 0 : 1) })));
    // Small glints where the light crosses a glass face (only where the light has got to).
    for (const ev of this.ref.events) {
      if (ev.path !== 'main') continue;
      if (this.stopAtEntry && ev.inside) continue;
      if ((along.get(ev.p) ?? 0) > reach + 1e-6) continue;
      const c = P.at(ev.p);
      const r = 0.07;
      this.spots.add(c, P.u.clone().multiplyScalar(r), P.v.clone().multiplyScalar(r), [1, 1, 1], ev.inside ? 0.8 : 1.6);
    }
    this.beams.commit();
    this.spots.commit();
    return this;
  }
  // The point a distance `d` along the main path at the reference wavelength, and the stretch it is on.
  pointAlong(d) {
    const along = pathDistances(this.ref);
    const main = this.ref.segments.filter((g) => g.path === 'main').sort((g, h) => along.get(g.a) - along.get(h.a));
    for (const g of main) {
      const s0 = along.get(g.a) ?? 0, s1 = along.get(g.b);
      if (d <= s1 + 1e-9 || g === main[main.length - 1]) {
        const t = THREE.MathUtils.clamp((d - s0) / Math.max(s1 - s0, 1e-9), 0, 1);
        return { p: [g.a[0] + (g.b[0] - g.a[0]) * t, g.a[1] + (g.b[1] - g.a[1]) * t], seg: g, index: main.indexOf(g) };
      }
    }
    return null;
  }
  // Light landing on the floor spreads along the beam's direction: the lower the beam, the longer the streak.
  floorSpot(a, b, rgb, intensity) {
    const d = b.clone().sub(a).normalize();
    const h = new THREE.Vector3(d.x, 0, d.z);
    if (h.lengthSq() < 1e-6) h.set(1, 0, 0);
    h.normalize();
    const graze = Math.max(-d.y, 0.12);
    const w = this.width * 0.9;
    const u = h.clone().multiplyScalar(w / graze);
    const v = new THREE.Vector3(-h.z, 0, h.x).multiplyScalar(w);
    this.spots.add(new THREE.Vector3(b.x, 0.002, b.z), u, v, rgb, intensity * 1.6);
  }
  // The main path's interface events at the reference wavelength.
  entryEvent() { return this.ref.events.find((e) => e.path === 'main' && !e.inside); }
  exitEvent() { return this.ref.events.find((e) => e.path === 'main' && e.inside && !e.tir); }
}

// ---------- Annotations ----------

// A set of construction lines for one interface: the dashed normal, and solid arcs for the angle of
// incidence and the angle of refraction. Returns the group and anchors for labels.
function interfaceMarks(rig, ev, { normal = 0.42, arc = 0.2, labelR = 0.34, incidence = true, refraction = true, materials } = {}) {
  const P = rig.plane;
  const g = new THREE.Group();
  const p = P.at(ev.p);
  const out = P.dir(ev.normal);
  const outside = ev.inside ? out.clone() : out.clone(); // the normal on the air side always points out
  g.add(S.polyline([p.clone().addScaledVector(out, normal), p.clone().addScaledVector(out, -normal)], materials.dashed));
  const anchors = {};
  const arcBetween = (from, to, r) => {
    const cos = THREE.MathUtils.clamp(from.dot(to), -1, 1);
    const ang = Math.acos(cos);
    const w = to.clone().addScaledVector(from, -cos);
    if (w.lengthSq() < 1e-8) return { ang, mid: from.clone() };
    w.normalize();
    g.add(S.polyline(S.arcPoints(p, from, w, r, ang), materials.solid));
    const mid = from.clone().multiplyScalar(Math.cos(ang / 2)).addScaledVector(w, Math.sin(ang / 2));
    return { ang, mid };
  };
  // Air side: between the outward normal and the ray in air. Glass side: between the inward normal and
  // the ray in glass.
  const inAir = ev.inside ? P.dir(ev.t || ev.d) : P.dir(ev.d).negate();
  const inGlass = ev.inside ? P.dir(ev.d).negate() : (ev.t ? P.dir(ev.t) : null);
  if (incidence) { const a = arcBetween(outside, inAir, arc); anchors.air = p.clone().addScaledVector(a.mid, labelR); }
  if (refraction && inGlass) { const a = arcBetween(outside.clone().negate(), inGlass, arc * 1.15); anchors.glass = p.clone().addScaledVector(a.mid, labelR * 1.05); }
  return { group: g, anchors, point: p };
}

function annotationMaterials(scale = 1) {
  return {
    solid: S.lineMaterial({ width: 1.3 * scale, opacity: 0.85 }),
    dashed: S.lineMaterial({ width: 1.1 * scale, opacity: 0.55, dashed: true, dash: 0.03, gap: 0.026 }),
    faint: S.lineMaterial({ width: 1 * scale, opacity: 0.3, dashed: true, dash: 0.02, gap: 0.03 }),
    accent: S.lineMaterial({ color: S.PALETTE.silver, width: 1.4 * scale, opacity: 0.9 }),
  };
}

function ring(center, axisA, axisB, radius, steps = 160) {
  return S.arcPoints(center, axisA, axisB, radius, Math.PI * 2, steps);
}

// ---------- The prism set (master, visual, analytical, conversational share it) ----------
const PRISM = { side: 1.15, length: 1.5, plinth: 0, beamZ: 0.3, entryT: 0.42 };

function prismSet(renderer, { material = 'flint', theta = null, light = 'white', haze = 1, hazeAzimuth = 0.3, reflections = true, stopAtEntry = false, width, pool = 2.2 } = {}) {
  const scene = world(renderer, { haze, hazeAzimuth, pool, poolAt: [0.1, -1.3], poolSize: [4.2, 3.2] });
  const mat = O.MATERIALS[material];
  const nd = O.index(mat, O.D_LINE);
  const P0 = PRISM.plinth;
  const poly = O.translate(O.prism(PRISM.side, 60), 0, P0);
  const body = glassBody(poly, VERTICAL(0), PRISM.length, S.glassMaterial({ n: nd, abbe: O.abbe(mat) }), 0.03);
  scene.add(body);

  if (P0 > 0) scene.add(plinth(PRISM.side + 0.26, P0, PRISM.length + 0.3));
  const shadow = S.contactShadow(PRISM.side * 1.3, PRISM.length * 1.15, 0.35);
  shadow.position.y = P0 + 0.0015;
  scene.add(shadow);
  const half = (PRISM.side + 0.26) / 2;
  const rig = new Rig({
    shapes: [{ poly }], material: mat, plane: VERTICAL(PRISM.beamZ),
    entry: { shape: 0, edge: 2, t: PRISM.entryT },
    theta: theta ?? O.deg(O.minDeviationIncidence(Math.PI / 3, nd)),
    light, reflections, stopAtEntry, boxes: P0 > 0 ? [[-half, 0, half, P0]] : [], ...(width ? { width } : {}),
  });
  scene.add(rig.group);
  return { scene, rig, body, nd, mat };
}

// ---------- Shots ----------
export const SHOTS = {};

// What the lesson's prism does to the light, without drawing anything: the same geometry and trace as the
// master scene, so checks, challenges and predictions read exactly the numbers the stage shows.
// θ1/θ2 at the entry face, θ3/θ4 at the face the light leaves by (θ3 inside), the deviation, and the angle
// violet (400 nm) and red (700 nm) leave at when both leave by the same face.
export function measure(material, theta, light = 'white') {
  const mat = O.MATERIALS[material];
  const poly = O.translate(O.prism(PRISM.side, 60), 0, PRISM.plinth);
  const nm = light === 'white' ? O.D_LINE : O.SODIUM;
  const run = (wl) => {
    const d = O.incoming(poly, 2, O.rad(theta), 1);
    const e = O.onEdge(poly, 2, PRISM.entryT);
    const back = d[1] > 1e-6 ? Math.min(3.4, (e[1] - 0.03) / d[1]) : 3.4;
    const tr = O.trace([{ poly, n: O.index(mat, wl) }], [e[0] - d[0] * back, e[1] - d[1] * back], d, { far: 3.4 });
    const main = tr.events.filter((v) => v.path === 'main');
    return { d, entry: main.find((v) => !v.inside), first: main.find((v) => v.inside), exit: main.find((v) => v.inside && !v.tir) };
  };
  const r = run(nm);
  const n = O.index(mat, nm);
  const out = r.exit && r.exit.t;
  let spread = null;
  if (light === 'white') {
    const v = run(400), red = run(700);
    if (v.exit && red.exit && v.exit.edge === red.exit.edge && !v.first.tir && !red.first.tir) spread = O.deg(Math.acos(THREE.MathUtils.clamp(v.exit.t[0] * red.exit.t[0] + v.exit.t[1] * red.exit.t[1], -1, 1)));
  }
  return {
    material, mat, n, nm, theta,
    theta1: O.deg(r.entry.thetaI), theta2: r.entry.thetaT != null ? O.deg(r.entry.thetaT) : null,
    theta3: r.first ? O.deg(r.first.thetaI) : null, theta4: r.first && r.first.thetaT != null ? O.deg(r.first.thetaT) : null,
    tir: !!(r.first && r.first.tir), critical: O.deg(Math.asin(1 / n)),
    deviation: out ? O.deg(Math.acos(THREE.MathUtils.clamp(r.d[0] * out[0] + r.d[1] * out[1], -1, 1))) : null,
    spread,
  };
}

// The master scene: the lesson's live stage. Every learning approach draws on this one scene, switching
// layers of construction on and off rather than building scenes of its own:
//   layers.entry / ring   the normal and angles where the light enters, and the protractor ring round it
//   layers.exit           the same construction where it leaves (or is reflected inside)
//   layers.extension      the incoming ray continued straight on, dashed: how far the prism turned it
//   layers.glass          the prism itself (off isolates the light)
//   hold                  the light stops at the glass: the moment before an answer
//   ghost                 a dashed predicted path into the glass: 'towards' | 'straight' | 'away' | θ2 in degrees
//   reveal                draw only this fraction of the light's path (the light arriving)
//   marker                with `reveal`, a bright point at the front of the light (following it)
SHOTS.master = (renderer, { aspect = 16 / 10, labels = null, material = 'flint', theta = null, light = 'white' } = {}) => {
  const set = prismSet(renderer, { material, theta, light, haze: 1.5 });
  // Nothing comes nearer the camera than a few units, so the near plane sits well out: depth precision for the
  // floor and the glass where they meet.
  const camera = new THREE.PerspectiveCamera(26, aspect, 0.3, 100);
  const target = new THREE.Vector3(-0.08, 0.62, 0);
  aim(camera, target, -16, 7, 6.6);
  const marks = new THREE.Group();
  set.scene.add(marks);
  const mats = annotationMaterials();
  mats.ghost = S.lineMaterial({ color: S.PALETTE.silver, width: 1.5, opacity: 0.9, dashed: true, dash: 0.032, gap: 0.024 });
  const marker = new S.Spots(4);
  set.scene.add(marker.mesh);
  const opts = { layers: { glass: true, entry: true, ring: true, exit: false, extension: false }, hold: false, ghost: null, reveal: null, marker: false };
  const shot = { ...set, camera, marks, labels: [], key: material };
  shot.update = (state = {}) => {
    if (state.material) {
      shot.key = state.material;
      set.mat = O.MATERIALS[state.material];
      set.nd = O.index(set.mat, O.D_LINE);
      set.rig.material = set.mat;
      set.body.material.ior = set.nd;
      set.body.material.dispersion = Math.min(2, 22 / O.abbe(set.mat));
    }
    if (state.theta != null) set.rig.theta = state.theta;
    if (state.light) set.rig.light = state.light;
    if (state.layers) Object.assign(opts.layers, state.layers);
    for (const k of ['hold', 'ghost', 'reveal', 'marker']) if (k in state) opts[k] = state[k];
    const L = opts.layers;
    set.body.visible = L.glass;
    set.rig.stopAtEntry = !!opts.hold;
    set.rig.reveal = opts.hold ? null : opts.reveal;
    set.rig.run();
    marks.clear();
    const P = set.rig.plane;
    const ev = set.rig.entryEvent();
    const m = interfaceMarks(set.rig, ev, { materials: mats, normal: 0.46, arc: 0.21, labelR: 0.36, incidence: L.entry, refraction: L.entry && !opts.hold });
    if (L.entry) marks.add(m.group);
    // A faint protractor circle round the point of entry, as on an optics bench.
    if (L.ring) marks.add(S.polyline(ring(m.point, P.u, P.v, 0.46), mats.faint));
    const anchors = { air: P.at([-1.12, PRISM.plinth + 1.02]), glass: P.at([0.74, PRISM.plinth + 0.98]) };
    if (L.entry) { anchors.theta1 = m.anchors.air; if (!opts.hold) anchors.theta2 = m.anchors.glass; }
    // Where the light leaves, or is turned back inside.
    const first = set.rig.ref.events.find((e) => e.path === 'main' && e.inside);
    if (L.exit && first && !opts.hold) {
      // Inside, θ3 sits between the inward normal and the ray; outside, θ4 (none when it is turned back).
      const x = interfaceMarks(set.rig, first, { materials: mats, normal: 0.4, arc: 0.19, labelR: 0.33, incidence: !first.tir });
      marks.add(x.group);
      anchors.theta3 = x.anchors.glass;
      anchors.theta4 = x.anchors.air || null;
    }
    if (L.extension && !opts.hold) {
      marks.add(S.polyline([m.point, m.point.clone().addScaledVector(P.dir(ev.d), 1.7)], mats.faint));
      delete anchors.glass; // the dashed line runs through where the glass's name sits
    }
    // A prediction: a dashed path into the glass, with a small ring where it ends.
    if (opts.ghost != null && ev.t) {
      const dIn = P.dir(ev.d), inward = P.dir(ev.normal).negate(), real = P.dir(ev.t);
      const turn = Math.sign(new THREE.Vector3().crossVectors(inward, real).dot(P.n)) || 1;
      let dir;
      if (opts.ghost === 'towards') dir = real;
      else if (opts.ghost === 'straight') dir = dIn;
      else if (opts.ghost === 'away') dir = dIn.clone().applyAxisAngle(P.n, -turn * Math.max(Math.acos(THREE.MathUtils.clamp(dIn.dot(real), -1, 1)), O.rad(12)));
      else dir = inward.clone().applyAxisAngle(P.n, turn * O.rad(THREE.MathUtils.clamp(Number(opts.ghost) || 0, 0, 89)));
      const end = m.point.clone().addScaledVector(dir, 0.62);
      marks.add(S.polyline([m.point, end], mats.ghost));
      marks.add(S.polyline(ring(end, P.u, P.v, 0.035, 40), mats.accent));
      anchors.ghost = end.clone().addScaledVector(dir, 0.16);
    }
    // The front of the light, when following it.
    marker.clear();
    if (set.rig.reveal != null && opts.marker) {
      const at = set.rig.pointAlong(set.rig.reveal * set.rig.pathLength);
      if (at) {
        const c = P.at(at.p);
        marker.add(c, P.u.clone().multiplyScalar(0.16), P.v.clone().multiplyScalar(0.16), [1, 1, 1], 2.4);
        anchors.marker = c;
        shot.front = { inside: at.seg.inside, index: at.index, end: at.seg.end, after: set.rig.ref.events.filter((e) => e.path === 'main' && (pathDistances(set.rig.ref).get(e.p) ?? 0) <= set.rig.reveal * set.rig.pathLength + 1e-6) };
      }
    } else shot.front = null;
    marker.commit();
    shot.readout = { ...measure(shot.key, set.rig.theta, set.rig.light), exit: set.rig.exitEvent() };
    shot.anchors = anchors;
    return shot;
  };
  return shot.update();
};

// 01 Visual & spatial: the same prism seen from above and to one side, with an orbit ring that says
// "turn it, look inside".
SHOTS.visual = (renderer, { aspect = 2 } = {}) => {
  const set = prismSet(renderer, { hazeAzimuth: 0.6, haze: 0.6, reflections: false, width: 0.06 });
  set.rig.run();
  const camera = new THREE.PerspectiveCamera(30, aspect, 0.05, 100);
  aim(camera, new THREE.Vector3(0.75, 0.42, 0.1), 36, 26, 4.5);
  const mats = annotationMaterials(1.4);
  const c = new THREE.Vector3(0, 0.003, 0);
  const X = new THREE.Vector3(1, 0, 0), Z = new THREE.Vector3(0, 0, 1);
  set.scene.add(S.polyline(ring(c, X, Z, 1.05), mats.dashed));
  // A brighter quarter of the ring with an arrowhead: the direction you can drag.
  const arc = S.arcPoints(c, X, Z, 1.05, O.rad(70), 40).map((p) => p.applyAxisAngle(new THREE.Vector3(0, 1, 0), O.rad(-10)));
  set.scene.add(S.polyline(arc, mats.accent));
  const tip = arc[arc.length - 1], prev = arc[arc.length - 4];
  const t = tip.clone().sub(prev).normalize();
  const side = new THREE.Vector3(-t.z, 0, t.x);
  set.scene.add(S.polyline([tip.clone().addScaledVector(t, -0.09).addScaledVector(side, 0.06), tip, tip.clone().addScaledVector(t, -0.09).addScaledVector(side, -0.06)], mats.accent));
  return { ...set, camera };
};

// 02 Exploratory: a semicircular block on the bench with a ray box and a protractor, the classic Snell's
// law experiment. A dimmer second ray is the previous trial.
SHOTS.exploratory = (renderer, { aspect = 2 } = {}) => {
  const scene = world(renderer, { hazeAzimuth: 0.2, haze: 0.6 });
  const mat = O.MATERIALS.crown;
  const nd = O.index(mat, O.D_LINE);
  const R = 0.62, H = 0.16, beamY = 0.075;
  const poly = O.dBlock(R, 128);
  // The flat face is the longest edge.
  let flat = 0, best = 0;
  poly.forEach((p, i) => { const q = poly[(i + 1) % poly.length]; const l = Math.hypot(q[0] - p[0], q[1] - p[1]); if (l > best) { best = l; flat = i; } });
  const body = glassBody(poly, FLAT(H / 2), H, S.glassMaterial({ n: nd, abbe: O.abbe(mat) }), 0.012);
  scene.add(body);
  const shadow = S.contactShadow(R * 2.3, R * 1.4, 0.3);
  shadow.position.z = 0.25;
  scene.add(shadow);
  const plane = FLAT(beamY);
  const mats = annotationMaterials(1.4);
  const rays = [];
  for (const [theta, intensity, sign] of [[44, 1.2, 1], [24, 0.38, 1]]) {
    const rig = new Rig({ shapes: [{ poly }], material: mat, plane, entry: { shape: 0, edge: flat, t: 0.5 }, theta, sign, floor: false, back: 1.15, far: 1.5, intensity, width: 0.07, fadeBack: intensity < 1 ? 0.9 : 0.2 });
    rig.run();
    scene.add(rig.group);
    rays.push(rig);
  }
  // Ray box at the start of the bright ray.
  const lead = rays[0];
  const o = plane.at(lead.origin());
  const d = plane.dir(lead.incomingDir());
  const box = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.15, 0.2, 4, 0.03), S.instrumentMaterial());
  box.position.copy(o).addScaledVector(d, -0.2);
  box.position.y = 0.075;
  box.lookAt(box.position.clone().add(new THREE.Vector3(d.z, 0, -d.x)));
  scene.add(box);
  // Protractor: a ring of ticks round the centre of the flat face, and the normal through it.
  const c = new THREE.Vector3(0, 0.002, 0);
  const X = new THREE.Vector3(1, 0, 0), Z = new THREE.Vector3(0, 0, 1);
  scene.add(S.polyline(ring(c, X, Z, R + 0.2, 200), mats.faint));
  for (let a = 0; a < 360; a += 10) {
    const r = O.rad(a), len = a % 30 === 0 ? 0.08 : 0.04;
    const dir = new THREE.Vector3(Math.cos(r), 0, Math.sin(r));
    scene.add(S.polyline([c.clone().addScaledVector(dir, R + 0.2), c.clone().addScaledVector(dir, R + 0.2 + len)], a % 30 === 0 ? mats.solid : mats.dashed));
  }
  scene.add(S.polyline([new THREE.Vector3(0, 0.003, -R - 0.32), new THREE.Vector3(0, 0.003, R + 0.32)], mats.dashed));
  const camera = new THREE.PerspectiveCamera(30, aspect, 0.05, 100);
  aim(camera, new THREE.Vector3(0.6, 0.0, 0.25), 12, 42, 4.3);
  return { scene, camera, rig: lead };
};

// 03 Analytical: the master prism head-on, as a measured construction: both normals, all four angles,
// the apex angle and the deviation.
SHOTS.analytical = (renderer, { aspect = 2 } = {}) => {
  const set = prismSet(renderer, { hazeAzimuth: 0, haze: 0.5, reflections: false, width: 0.055 });
  set.rig.run();
  const mats = annotationMaterials(1.6);
  const g = new THREE.Group();
  const entry = interfaceMarks(set.rig, set.rig.entryEvent(), { materials: mats, normal: 0.36, arc: 0.18 });
  const exit = interfaceMarks(set.rig, set.rig.exitEvent(), { materials: mats, normal: 0.36, arc: 0.18 });
  g.add(entry.group, exit.group);
  // The incoming ray continued straight on (dashed), and the deviation between it and the outgoing ray.
  const P = set.rig.plane;
  const ev = set.rig.entryEvent();
  const dIn = P.dir(ev.d);
  g.add(S.polyline([entry.point, entry.point.clone().addScaledVector(dIn, 1.9)], mats.faint));
  // Apex angle.
  const apex = P.at([0, PRISM.plinth + O.prism(PRISM.side)[2][1]]);
  const down = new THREE.Vector3(0, -1, 0);
  const l = down.clone().applyAxisAngle(P.n, -Math.PI / 6), r = down.clone().applyAxisAngle(P.n, Math.PI / 6);
  g.add(S.polyline(S.arcPoints(apex, l, r.clone().addScaledVector(l, -l.dot(r)).normalize(), 0.16, Math.PI / 3), mats.solid));
  set.scene.add(g);
  const camera = new THREE.PerspectiveCamera(17, aspect, 0.05, 100);
  aim(camera, new THREE.Vector3(0.62, 0.6, 0), -5, 3, 6.4);
  return { ...set, camera };
};

// 04 Structured: three glass slabs of rising height, one step after another; the beam passes through each
// and is shifted sideways by each, exactly as a parallel-sided block shifts it.
SHOTS.structured = (renderer, { aspect = 2 } = {}) => {
  const scene = world(renderer, { hazeAzimuth: -0.4, haze: 0.8, pool: 2.6, poolAt: [0.2, -1.1], poolSize: [4.4, 2.8] });
  const mat = O.MATERIALS.flint;
  const nd = O.index(mat, O.D_LINE);
  const T = 0.15, depth = 0.8;
  const xs = [-0.62, 0, 0.62], hs = [0.62, 0.95, 1.3];
  // Each pane leans at the prism's own face angle (60° to the floor), so from the master camera's side its face
  // catches the same softbox the prism's entry face does: the same sheen, the same family. The optics uses
  // the leaned outline, so the beam's path stays exact.
  const lean = O.rad(-30);
  const shapes = xs.map((x, i) => {
    const poly = O.slab(0, hs[i] / 2, T, hs[i]).map((p) => O.rotate(p, lean));
    const lift = Math.min(...poly.map((p) => p[1]));
    return { poly: poly.map(([px, py]) => [px + x, py - lift]) };
  });
  for (const s of shapes) scene.add(glassBody(s.poly, VERTICAL(0), depth, S.glassMaterial({ n: nd, abbe: O.abbe(mat) }), 0.02));
  for (const [i, x] of xs.entries()) {
    const sh = S.contactShadow(T * 3, depth * 1.2, 0.35);
    sh.position.x = x;
    scene.add(sh);
    scene.add(numeral(i + 1, new THREE.Vector3(x + 0.04, 0.003, depth / 2 + 0.22)));
  }
  // Enter the first slab's left face low down, rising at 30°; edge 3 runs down the left face.
  const rig = new Rig({ shapes, material: mat, plane: VERTICAL(0.12), entry: { shape: 0, edge: 3, t: 0.355 }, theta: 40, sign: 1, back: 1.4, far: 1.6, width: 0.06, reflections: false });
  rig.run();
  scene.add(rig.group);
  const camera = new THREE.PerspectiveCamera(30, aspect, 0.05, 100);
  aim(camera, new THREE.Vector3(0.62, 0.45, 0), -16, 9, 4.7);
  return { scene, camera, rig };
};

// 05 Conversational: the moment before the answer. The light has reached the glass; two dashed paths are
// the two predictions on the table.
SHOTS.conversational = (renderer, { aspect = 2 } = {}) => {
  const set = prismSet(renderer, { stopAtEntry: true, reflections: false, hazeAzimuth: -0.5, haze: 0.6, width: 0.06 });
  set.rig.run();
  const mats = annotationMaterials(1.5);
  const P = set.rig.plane;
  const ev = set.rig.entryEvent();
  const p = P.at(ev.p);
  const out = P.dir(ev.normal);
  set.scene.add(S.polyline([p.clone().addScaledVector(out, 0.4), p.clone().addScaledVector(out, -0.4)], mats.dashed));
  // Prediction A bends towards the normal (what happens); B bends away from it (a common guess).
  const dIn = P.dir(ev.d);
  const tA = P.dir(ev.t);
  const inward = out.clone().negate();
  const devA = Math.acos(THREE.MathUtils.clamp(dIn.dot(tA), -1, 1));
  const tB = dIn.clone().applyAxisAngle(P.n, Math.sign(new THREE.Vector3().crossVectors(dIn, inward).dot(P.n)) * -devA * 1.6);
  for (const t of [tA, tB]) {
    const end = p.clone().addScaledVector(t, 0.52);
    set.scene.add(S.polyline([p, end], mats.dashed));
    set.scene.add(S.polyline(ring(end, P.u, P.v, 0.035, 40), mats.solid));
  }
  const camera = new THREE.PerspectiveCamera(24, aspect, 0.05, 100);
  aim(camera, p.clone().add(new THREE.Vector3(0.62, -0.1, 0)), -22, 6, 3.4);
  return { ...set, camera };
};

// A small engraved step number on the floor (canvas text in icy lavender).
function numeral(n, at) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = S.PALETTE.ice;
  g.font = '500 92px Satoshi, Inter, system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(String(n), 64, 68);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.26), new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.6, 1.6, 1.6), transparent: true, opacity: 0.95, depthWrite: false, fog: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.copy(at);
  m.renderOrder = 25;
  return m;
}
