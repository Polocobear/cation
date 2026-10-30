// The shared studio: one renderer setup, one lighting environment, one material library, one beam system and
// one annotation style. The master scene and every miniature are built from these pieces and nothing else,
// so they read as one visual universe.
import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// ---------- Palette (linear values are derived from these sRGB tokens) ----------
export const PALETTE = {
  void: '#06070b',      // near-black
  horizon: '#0e0e1a',   // where the floor fades into the dark
  haze: '#2a2550',      // the lavender glow behind the subject
  silver: '#eef0f7',    // silvery white
  ice: '#c9c3f2',       // icy lavender: annotations
  violet: '#7f72e6',    // blue-violet: active marks
  indigo: '#1c1a3c',
};

export function createRenderer(canvas, { preserve = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: preserve });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Khronos PBR Neutral keeps the palette's hues (and the spectrum's) close to what was chosen, and rolls
  // only the brightest light (the beam cores) off to white.
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1;
  return renderer;
}

// Everything renders into one linear, half-float, multisampled buffer, so light adds up as light does
// (24 spectral ribbons sum to white), then one pass tone-maps and encodes for the screen.
export function createPipeline(renderer, scene, camera) {
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  const pass = new RenderPass(scene, camera);
  composer.addPass(pass);
  // A restrained bloom that only the hottest light reaches (beam cores, glints), so light reads as light.
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.32, 0.5, 0.92));
  composer.addPass(new OutputPass());
  composer.use = (s, c) => { pass.scene = s; pass.camera = c; };
  return composer;
}

// ---------- Lighting: a black studio with five softboxes, prefiltered into an environment map ----------
// Glass has no colour of its own; it shows what it reflects and refracts. These panels are placed so the
// prism's faces and bevels pick up long, clean highlights while the room stays dark.
export const SOFTBOXES = [
  // [width, height, position, colour, intensity]. Glass is lit "dark field": the big lights sit behind and
  // beside it, out of the camera's view, so its edges and grazing faces pick them up as clean bright lines
  // while the room behind it stays dark. Positions are where the master camera's faces actually look.
  [7, 2.6, [0, 5.2, -6.5], '#ece8ff', 5],        // back-top: the apex edge and the faces turned up and back
  [3.6, 3, [-1.8, 2.5, -7.6], '#e4defc', 2.4],   // the face the beam enters reflects this: a soft bright plane
  [1.3, 5.5, [-4.6, 2.4, -3.6], '#dfe8ff', 14],  // back-left strip: icy edge light
  [1.3, 5.5, [4.6, 2.4, -3.2], '#d2c6ff', 12],   // back-right strip: lavender edge light
  [4, 4, [0, 8, 0.5], '#ffffff', 0.9],           // overhead: the top edges, kept low so the floor stays dark
  [5, 2.4, [2.4, 0.9, 8], '#d9d4ff', 1.4],       // behind the camera: a faint sheen on the face towards it
];

export function studioEnvironment(renderer) {
  const env = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.SphereGeometry(20, 32, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.void).multiplyScalar(0.6), side: THREE.BackSide }));
  env.add(room);
  // Each panel is brightest in the middle and falls off to its edges, as a diffused softbox does, so faces
  // that reflect one show a smooth sheen rather than a hard-edged card.
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const img = g.createImageData(128, 128);
  for (let y = 0; y < 128; y++) {
    for (let x = 0; x < 128; x++) {
      const u = Math.abs(x / 63.5 - 1), v = Math.abs(y / 63.5 - 1);
      const f = (1 - Math.pow(u, 3)) * (1 - Math.pow(v, 3)) * (0.75 + 0.25 * (1 - y / 127));
      const i = (y * 128 + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.round(255 * Math.max(0, f) ** 1.6);
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const falloff = new THREE.CanvasTexture(c);
  for (const [w, h, p, col, power] of SOFTBOXES) {
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: falloff, color: new THREE.Color(col).multiplyScalar(power * 1.6), side: THREE.DoubleSide }));
    panel.position.set(...p);
    panel.lookAt(0, 0.5, 0);
    env.add(panel);
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(env, 0.02, 0.1, 40).texture;
  pmrem.dispose();
  return tex;
}

// ---------- Backdrop: a dark dome with a low lavender haze at the horizon ----------
export function backdrop({ hazeAzimuth = 0, hazeStrength = 1 } = {}) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uVoid: { value: new THREE.Color(PALETTE.void) },
      uHorizon: { value: new THREE.Color(PALETTE.horizon) },
      uHaze: { value: new THREE.Color(PALETTE.haze).multiplyScalar(hazeStrength) },
      uHazeDir: { value: new THREE.Vector2(Math.sin(hazeAzimuth), -Math.cos(hazeAzimuth)) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uVoid, uHorizon, uHaze;
      uniform vec2 uHazeDir;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float up = max(d.y, 0.0);
        vec3 col = mix(uHorizon, uVoid, smoothstep(0.0, 0.35, up));
        // The haze is a soft glow just above the horizon behind the subject. It rises from nothing at the
        // horizon itself, so the fogged floor meets the sky without a line.
        float facing = dot(normalize(d.xz), uHazeDir) * 0.5 + 0.5;
        float haze = pow(facing, 4.0) * exp(-abs(d.y) * 6.0);
        col += uHaze * haze;

        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(30, 48, 24), mat);
  dome.renderOrder = -10;
  dome.frustumCulled = false;
  return dome;
}

// ---------- Materials ----------
// Honed dark stone: matte enough that it never turns grey under the studio lights, so the only light on it is
// the pool round the subject and the light the beam brings down.
export function floorMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#050609'),
    roughness: 0.72,
    metalness: 0,
    specularIntensity: 0.25,
    envMapIntensity: 0.1,
  });
}

// Optical glass. `n` is the material's index at the d line; Three's own dispersion term handles the colour
// fringing of what is seen through the glass, scaled from the material's Abbe number.
export function glassMaterial({ n = 1.62, abbe = 36, frosted = 0 } = {}) {
  return new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0,
    roughness: 0.012 + frosted * 0.35,
    transmission: 1,
    thickness: 0.9,
    ior: n,
    dispersion: Math.min(2, 22 / abbe),
    // Real glass absorbs a little: thick paths through it take on a faint icy lavender, which gives the
    // body substance without colouring the light that crosses it noticeably.
    attenuationColor: new THREE.Color('#bdb6ee'),
    attenuationDistance: 1.1,
    specularIntensity: 1,
    specularColor: new THREE.Color('#ffffff'),
    envMapIntensity: 2.2,
    // Both sides: the far faces show from inside, as the internal reflections of a real prism do.
    side: THREE.DoubleSide,
  });
}

// A matte, near-black instrument finish (the ray box, mounts).
export function instrumentMaterial() {
  return new THREE.MeshPhysicalMaterial({ color: new THREE.Color('#111219'), roughness: 0.42, metalness: 0.3, clearcoat: 0.3, clearcoatRoughness: 0.3, envMapIntensity: 0.7 });
}

// ---------- Light: camera-facing beam ribbons ----------
// Every ray is a ribbon with a narrow core and a soft halo, added on top of the scene. A white beam is the
// sum of 24 spectral ribbons, so it splits into colours exactly where the optics says the colours separate.
const BEAM_VERT = /* glsl */ `
  attribute vec3 aStart;
  attribute vec3 aEnd;
  attribute vec3 aColor;
  attribute vec4 aShape; // width, intensity, fade-in length, fade-out start (from the far end, in units)
  varying vec2 vAcross;
  varying vec3 vColor;
  varying float vI;
  void main() {
    vec3 dir = aEnd - aStart;
    float len = max(length(dir), 1e-5);
    vec3 t = dir / len;
    float along = (position.x + 0.5) * len;
    vec3 axis = aStart + t * along;
    vec3 toCam = normalize(cameraPosition - axis);
    vec3 side = normalize(cross(t, toCam));
    vec3 p = axis + side * position.y * aShape.x;
    vAcross = vec2(position.y * 2.0, along);
    float fadeIn = aShape.z > 0.0 ? smoothstep(0.0, aShape.z, along) : 1.0;
    float fadeOut = aShape.w > 0.0 ? 1.0 - smoothstep(len - aShape.w, len, along) : 1.0;
    vI = aShape.y * fadeIn * fadeOut;
    vColor = aColor;
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }`;
const BEAM_FRAG = /* glsl */ `
  uniform float uCore;
  uniform float uHalo;
  varying vec2 vAcross;
  varying vec3 vColor;
  varying float vI;
  void main() {
    float x = vAcross.x;
    float core = exp(-x * x * uCore);
    float halo = exp(-x * x * 2.6) * uHalo;
    gl_FragColor = vec4(vColor * vI * (core + halo), 1.0);
  }`;

export class Beams {
  constructor(max = 512) {
    const quad = new THREE.PlaneGeometry(1, 1, 1, 1);
    this.geometry = new THREE.InstancedBufferGeometry();
    this.geometry.index = quad.index;
    this.geometry.attributes.position = quad.attributes.position;
    this.geometry.instanceCount = 0;
    this.attrs = {
      aStart: new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3),
      aEnd: new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3),
      aColor: new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3),
      aShape: new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4),
    };
    for (const [k, a] of Object.entries(this.attrs)) { a.setUsage(THREE.DynamicDrawUsage); this.geometry.setAttribute(k, a); }
    this.material = new THREE.ShaderMaterial({
      vertexShader: BEAM_VERT,
      fragmentShader: BEAM_FRAG,
      uniforms: { uCore: { value: 34 }, uHalo: { value: 0.07 } },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide, // the ribbon turns to face the camera, so its winding depends on the view
      blending: THREE.AdditiveBlending,
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 20;
    this.max = max;
    this.count = 0;
  }
  clear() { this.count = 0; }
  add(a, b, rgb, { width = 0.03, intensity = 1, fadeIn = 0, fadeOut = 0 } = {}) {
    if (this.count >= this.max) return;
    const i = this.count++;
    this.attrs.aStart.setXYZ(i, a.x, a.y, a.z);
    this.attrs.aEnd.setXYZ(i, b.x, b.y, b.z);
    this.attrs.aColor.setXYZ(i, rgb[0], rgb[1], rgb[2]);
    this.attrs.aShape.setXYZW(i, width, intensity, fadeIn, fadeOut);
  }
  commit() {
    this.geometry.instanceCount = this.count;
    for (const a of Object.values(this.attrs)) a.needsUpdate = true;
  }
}

// Soft light where a beam meets a surface: on the floor it stretches along the beam's direction (a low beam
// spreads into a long streak), at a glass face it is a small round glint.
const SPOT_VERT = /* glsl */ `
  attribute vec3 aCenter;
  attribute vec3 aAxisU;
  attribute vec3 aAxisV;
  attribute vec4 aSpot; // r, g, b, intensity
  varying vec2 vUv;
  varying vec4 vSpot;
  void main() {
    vUv = position.xy * 2.0;
    vSpot = aSpot;
    vec3 p = aCenter + aAxisU * position.x + aAxisV * position.y;
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }`;
const SPOT_FRAG = /* glsl */ `
  varying vec2 vUv;
  varying vec4 vSpot;
  void main() {
    float r2 = dot(vUv, vUv);
    float a = exp(-r2 * 5.0) + exp(-r2 * 1.4) * 0.12;
    gl_FragColor = vec4(vSpot.rgb * vSpot.a * a, 1.0);
  }`;

export class Spots {
  constructor(max = 128) {
    const quad = new THREE.PlaneGeometry(1, 1);
    this.geometry = new THREE.InstancedBufferGeometry();
    this.geometry.index = quad.index;
    this.geometry.attributes.position = quad.attributes.position;
    this.attrs = {
      aCenter: new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3),
      aAxisU: new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3),
      aAxisV: new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3),
      aSpot: new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4),
    };
    for (const [k, a] of Object.entries(this.attrs)) { a.setUsage(THREE.DynamicDrawUsage); this.geometry.setAttribute(k, a); }
    this.material = new THREE.ShaderMaterial({ vertexShader: SPOT_VERT, fragmentShader: SPOT_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 19;
    this.max = max;
    this.count = 0;
  }
  clear() { this.count = 0; }
  add(center, u, v, rgb, intensity) {
    if (this.count >= this.max) return;
    const i = this.count++;
    this.attrs.aCenter.setXYZ(i, center.x, center.y, center.z);
    this.attrs.aAxisU.setXYZ(i, u.x, u.y, u.z);
    this.attrs.aAxisV.setXYZ(i, v.x, v.y, v.z);
    this.attrs.aSpot.setXYZW(i, rgb[0], rgb[1], rgb[2], intensity);
  }
  commit() {
    this.geometry.instanceCount = this.count;
    for (const a of Object.values(this.attrs)) a.needsUpdate = true;
  }
}

// Light scattered inside the glass. A copy of a glass body drawn additively, brightest on the surfaces
// nearest the beam's path through it: the path reads as a lit filament and the faces around it glow faintly,
// as real glass does where a strong beam crosses it.
const GLOW_VERT = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const GLOW_FRAG = /* glsl */ `
  #define MAX_SEG 8
  uniform vec3 uA[MAX_SEG];
  uniform vec3 uB[MAX_SEG];
  uniform float uW[MAX_SEG];
  uniform int uCount;
  uniform vec3 uColor;
  uniform float uRadius;
  varying vec3 vWorld;
  void main() {
    float g = 0.0;
    for (int i = 0; i < MAX_SEG; i++) {
      if (i >= uCount) break;
      vec3 ab = uB[i] - uA[i];
      float t = clamp(dot(vWorld - uA[i], ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
      float d = length(vWorld - (uA[i] + ab * t));
      g += uW[i] * exp(-d * d / (uRadius * uRadius));
    }
    gl_FragColor = vec4(uColor * g, 1.0);
  }`;

export class GlassGlow {
  constructor(geometry, { color = '#cfc8ff', radius = 0.16, strength = 0.18 } = {}) {
    this.material = new THREE.ShaderMaterial({
      vertexShader: GLOW_VERT,
      fragmentShader: GLOW_FRAG,
      uniforms: {
        uA: { value: Array.from({ length: 8 }, () => new THREE.Vector3()) },
        uB: { value: Array.from({ length: 8 }, () => new THREE.Vector3()) },
        uW: { value: new Array(8).fill(0) },
        uCount: { value: 0 },
        uColor: { value: new THREE.Color(color).multiplyScalar(strength) },
        uRadius: { value: radius },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.renderOrder = 18;
  }
  set(segments) {
    const u = this.material.uniforms;
    const n = Math.min(8, segments.length);
    for (let i = 0; i < n; i++) { u.uA.value[i].copy(segments[i].a); u.uB.value[i].copy(segments[i].b); u.uW.value[i] = segments[i].w; }
    u.uCount.value = n;
  }
}

// ---------- Annotations: one hairline family ----------
// Solid hairlines for measured angles, dashed for constructions (normals, extensions, predictions). All in
// icy lavender, drawn over the glass so they stay legible inside it. Widths are in CSS pixels.
const lineMaterials = new Set();
export function lineMaterial({ color = PALETTE.ice, width = 1.25, opacity = 0.7, dashed = false, dash = 0.035, gap = 0.03 } = {}) {
  const m = new LineMaterial({ color: new THREE.Color(color), linewidth: width, transparent: true, opacity, dashed, dashSize: dash, gapSize: gap, depthTest: false, depthWrite: false, worldUnits: false });
  lineMaterials.add(m);
  return m;
}
export function setLineResolution(w, h) { for (const m of lineMaterials) m.resolution.set(w, h); }

export function polyline(points, material) {
  const g = new LineGeometry();
  g.setPositions(points.flatMap((p) => [p.x, p.y, p.z]));
  const line = new Line2(g, material);
  line.computeLineDistances();
  line.renderOrder = 30;
  return line;
}

// An arc in the plane spanned by unit vectors u (start) and w (90° from u), from 0 to `angle` radians.
export function arcPoints(center, u, w, radius, angle, steps = 48) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const a = (angle * i) / steps;
    pts.push(center.clone().addScaledVector(u, Math.cos(a) * radius).addScaledVector(w, Math.sin(a) * radius));
  }
  return pts;
}

// ---------- Labels: HTML over the canvas, placed from world positions ----------
export function placeLabels(labels, camera, width, height) {
  const v = new THREE.Vector3();
  for (const l of labels) {
    v.copy(l.at).project(camera);
    const x = (v.x * 0.5 + 0.5) * width;
    const y = (-v.y * 0.5 + 0.5) * height;
    l.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    l.el.hidden = v.z > 1;
  }
}

// A wide, faint pool of light on the floor round the subject, as if from a high soft key: the stage the
// object stands on, without a visible stand.
export function lightPool(width, depth, color = '#2c2752', strength = 1) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(color).multiplyScalar(strength), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.001;
  m.renderOrder = 1;
  return m;
}

// Contact shading under an object on the floor: a soft dark ellipse from a canvas gradient.
let contactTex = null;
export function contactShadow(width, depth, strength = 0.55) {
  if (!contactTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(0,0,0,1)');
    grd.addColorStop(0.45, 'rgba(0,0,0,0.55)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    contactTex = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), new THREE.MeshBasicMaterial({ map: contactTex, transparent: true, opacity: strength, depthWrite: false, color: 0x000000 }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.0015;
  m.renderOrder = 1;
  return m;
}
