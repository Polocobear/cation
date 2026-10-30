// 04 · Closing: the light of Concept 4, "Abstract Convergence", drawn in one WebGL2 fragment shader. Two families of
// strands, Soft Gold from the left and Periwinkle from the right, sweep in to one point near the bottom centre, and a
// dark glossy floor beneath it mirrors them, stretched, softened and streaked. Every strand is a curve y = a·dx^p from
// the convergence point, measured from the approved reference (cation/art/closing/reference-concept-4.webp) in units
// of its height. The words and the button are HTML over the canvas (index.html, finale.css), and the frame they sit in
// gives the shader its convergence point and scale, so type and light stay registered at every size.
// The canvas draws only while the section is on screen, at up to 30 frames a second. The light arrives once, from the
// edges in to the point, as the section first comes into view; after that it drifts very slowly. With reduced motion
// it is drawn once, complete, and holds still.

const VERT = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes;       // canvas, px
uniform vec2 uC;         // the convergence point, px from the bottom left
uniform float uU;        // the design unit: the reference frame's height, px
uniform float uSx;       // horizontal compression on narrow screens (1 on wide ones)
uniform float uT;        // seconds
uniform float uReveal;   // 0 to 1, the light's arrival
uniform float uFade;     // px: the floor fades out over this much at the bottom, under the footer
out vec4 outColor;

float hash(float n) { return fract(sin(n * 91.3458) * 47453.5453); }
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2(i), hash2(i + vec2(1.0, 0.0)), f.x), mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), f.x), f.y);
}

float curve(float dx, vec2 ap) { return ap.x * pow(dx, ap.y); }
float slope(float dx, vec2 ap) { return ap.x * ap.y * pow(max(dx, 1e-4), ap.y - 1.0) / uSx; }

// One strand: a sharp core and a soft halo, from the distance to its curve.
vec2 strand(float dx, float y, vec2 ap, float w, float h) {
  float s = slope(dx, ap);
  float d = abs(y - curve(dx, ap)) * inversesqrt(1.0 + s * s);
  return vec2(exp(-d * d / (w * w)), h * h / (h * h + d * d));
}

// A ribbon of light: a bright edge along its curve and a translucent body that thins upwards from it (with a little
// light just below), threaded with fine striations that follow the edge, like silk. Its thickness grows with the
// distance from the point, as the light opens out.
vec3 ribbon(float dx, float y, vec2 ap, float thick, float edge, float body, float n, float seed, float m, vec3 core, vec3 halo, float shine, float veils) {
  float s = slope(dx, ap);
  float d = (y - curve(dx, ap)) * inversesqrt(1.0 + s * s);
  float w = max(0.0024, 1.6 / uU) * m, h = 0.014 * m;
  // Core, a little bloom round it, and a halo that is mostly close in with a faint long tail.
  float lo = h * h / (h * h + d * d);
  vec3 c = ((exp(-d * d / (w * w)) + 0.22 * exp(-d * d / (9.0 * w * w))) * core * shine / m + (0.8 * lo * lo + 0.2 * lo) * halo * 0.3 * inversesqrt(m)) * edge;
  float th = thick * dx + 0.012;
  float u = d / th;
  float veil = (0.3 + 0.7 * exp(-max(u, 0.0) * 2.5)) * smoothstep(1.05 + 0.3 * m, 0.6, u) * smoothstep(-0.45 - 0.2 * m, 0.0, u);
  float l = u * n, k = floor(l + 0.5), e = abs(l - k);
  float fw = max(fwidth(l), 1e-5) * mix(1.1, 2.6, hash(k * 1.73 + seed)) * m;
  float stria = exp(-e * e / (fw * fw)) * (0.3 + 0.7 * hash(k + seed * 3.1)) * smoothstep(0.5, 0.2, fw);
  return c + mix(halo, core, 0.25 * stria) * veil * body * veils * (0.5 + stria) / m;
}

// The light above the floor, for one side (0 gold, from the left; 1 periwinkle, from the right), at a distance dx
// from the point and a height y above it. m widens everything, for the floor's blur; in the floor the colour also
// deepens (sat), as a dark glossy surface gives back more of the hue than the white of the cores, and the veils
// (veils) give back less than the strands.
vec3 light(float dx, float y, float side, float hue, float m, float shine, float sat, float veils) {
  vec2 M = mix(vec2(0.659, 1.63), vec2(0.663, 1.68), side);   // the bright primary strand
  vec2 S = mix(vec2(0.935, 1.95), vec2(0.877, 1.85), side);   // a second, joining it two-thirds of the way in
  vec2 U = mix(vec2(1.119, 1.69), vec2(1.183, 1.76), side);   // the outermost, faint, up towards the top corner
  vec2 L = mix(vec2(0.548, 2.00), vec2(0.493, 1.71), side);   // the lower edge of the fan
  // Very slow, organic drift in the curvature; the silhouette holds.
  M.x *= 1.0 + 0.010 * sin(uT * 0.13 + side * 2.1);
  S.x *= 1.0 + 0.016 * sin(uT * 0.09 + 1.3 + side);
  U.x *= 1.0 + 0.020 * sin(uT * 0.07 + 2.4 - side);
  L.x *= 1.0 + 0.014 * sin(uT * 0.11 + 0.7 + side * 1.7);
  vec3 halo = mix(vec3(0.93, 0.70, 0.34), vec3(0.46, 0.50, 1.0), hue);
  vec3 core = mix(mix(vec3(1.0, 0.91, 0.72), vec3(0.88, 0.88, 1.0), hue), halo * 1.15, sat);
  vec3 c = vec3(0.0);
  // Each strand is brightest nearer the point and quieter towards the edges of the frame.
  float fade = smoothstep(0.35, 0.78, dx), close = 1.0 + 1.6 * exp(-dx / 0.18);
  c += ribbon(dx, y, M, 0.13, 2.8 * mix(1.0, 0.5, fade), mix(0.75, 0.9, side) * mix(1.0, 0.2, fade) * close, 14.0, 1.0 + side * 7.0, m, core, halo, shine, veils);
  float join = smoothstep(0.30, 0.5, dx) * smoothstep(0.82, 0.55, dx);
  c += ribbon(dx, y, S, 0.2, 1.0 * join, mix(0.6, 0.75, side) * join * mix(1.0, 0.15, fade), 16.0, 4.0 + side * 9.0, m, core, halo, shine, veils);
  float far = smoothstep(0.02, 0.18, dx) * smoothstep(0.75, 0.35, dx);
  c += ribbon(dx, y, U, 0.2, 0.15 * far, 0.12 * far, 10.0, 8.0 + side * 3.0, m, core, halo, 1.0, veils);
  c += ribbon(dx, y, L, 0.12, mix(0.12, 0.07, side), 0.05, 8.0, 2.0 + side * 5.0, m, core, halo, 1.0, veils);
  // The horizon: a fine line just above the point, level across the width and dipping in to meet it, with a few
  // fainter lines stacked over it. Near the point they burn bright, so the light flattens into a lens along the
  // horizon before it converges.
  float w = max(0.0014, 1.0 / uU) * m, h = 0.008 * m;
  float dip = 1.0 - exp(-dx * dx / 0.01);
  float H = 0.2 + 6.0 * exp(-dx / 0.12);
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float dh = abs(y - (0.025 + 0.0062 * fi) * dip);
    float g = i == 0 ? H : 2.2 * exp(-dx / 0.1) / (1.0 + fi * 2.5);
    c += exp(-dh * dh / (w * w)) * core * g / m + h * h / (h * h + dh * dh) * halo * g * 0.18 * inversesqrt(m);
  }
  // A low haze over the horizon at the sides, where the lowest sheets of light lie almost flat.
  c += halo * 0.07 * exp(-max(y - 0.025, 0.0) / 0.07) * smoothstep(0.02, 0.03, y) * smoothstep(0.05, 0.3, dx) * veils;
  // The floor's far edge: the band between the horizon line and the point's level stays dark at the sides.
  c *= 1.0 - 0.65 * smoothstep(0.02, 0.004, y) * smoothstep(0.12, 0.3, dx) * step(m, 1.0);
  return c * smoothstep(1.45, 0.62, dx);
}

void main() {
  vec2 q = (gl_FragCoord.xy - uC) / uU;
  float side = step(0.0, q.x);
  float hue = smoothstep(-0.035, 0.035, q.x);
  float dx = abs(q.x) / uSx;
  float below = step(q.y, 0.0);
  float depth = max(-q.y, 0.0);
  // The floor mirrors the light above it: a point at this depth sees the strands at height k·depth, so their
  // reflections stretch downwards away from the centre, and they widen as the floor comes towards the viewer.
  float k = side > 0.5 ? 0.359 * pow(max(dx, 0.03), -0.533) : 0.393 * pow(max(dx, 0.03), -0.6);
  float y = mix(q.y, k * depth, below);
  float m = mix(1.0, 1.0 + depth * 55.0, below);
  // A restrained shimmer that travels along the strands in towards the point.
  float ph = fract(dx * 0.85 + uT * 0.032 + side * 0.41);
  float shine = 1.0 + 0.4 * exp(-pow((ph - 0.5) / 0.06, 2.0)) * smoothstep(0.03, 0.2, dx);
  // The arrival: the light comes in from the edges and reaches the point last.
  float front = mix(1.5, -0.25, uReveal);
  float arrive = smoothstep(front, front + 0.16, dx);
  float at = smoothstep(0.78, 1.0, uReveal);

  vec3 c = light(dx, y, side, hue, m, shine, 0.55 * below, 1.0 - 0.75 * below) * arrive;
  float streak = 0.3 + 1.5 * pow(noise(vec2(dx * 5.0 + uT * 0.004, y * 85.0)), 1.5);
  c *= mix(1.0, mix(1.5, 1.75, hue) * exp(-depth * 3.6) * streak, below);

  // The point itself: a small, very bright core, a short flare along the horizon, and a glow around it that tints
  // towards each side's colour. Below the horizon the glow is its own reflection, taller and softer.
  float rr = length(vec2(q.x * 0.5, q.y));
  c += vec3(1.0, 0.95, 0.92) * (2.4 * exp(-rr * rr / 0.00002) + 0.3 / (1.0 + rr * rr / 0.0001)) * at;
  c += vec3(1.0, 0.93, 0.9) * exp(-abs(q.y) / 0.003) * exp(-abs(q.x) / 0.07) * 0.45 * at;
  float ra = length(vec2(q.x / 1.8, q.y * mix(1.0, 0.85, below)));
  vec3 tint = mix(mix(vec3(1.0, 0.72, 0.45), vec3(0.62, 0.62, 1.0), hue), vec3(0.82, 0.69, 1.0), exp(-abs(q.x) / 0.05));
  c += tint * (0.75 / (1.0 + ra * ra / 0.0009) + 0.06 * exp(-ra / 0.2)) * at;
  // Its reflection: a fine vertical line down the floor.
  c += vec3(0.55, 0.52, 0.85) * below * (exp(-q.x * q.x / 0.0000064) * 0.22 + exp(-q.x * q.x / 0.0006) * 0.07) * exp(-depth / 0.6) * at;
  // The floor's own faint sheen near the point.
  c += vec3(0.05, 0.05, 0.085) * below * exp(-depth / 0.25) * exp(-dx * dx / 0.3) * at;
  // The floor runs on under the footer and fades out before the section ends.
  c *= smoothstep(0.0, uFade, gl_FragCoord.y);

  vec3 bg = vec3(0.035, 0.043, 0.051);
  vec3 col = 1.0 - (1.0 - bg) * exp(-c);
  col += (hash2(gl_FragCoord.xy + fract(uT)) - 0.5) / 255.0;
  outColor = vec4(col, 1.0);
}`;

const section = document.querySelector('.finale');
if (section) start(section);

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(s)); return null; }
  return s;
}

function start(section) {
  const canvas = section.querySelector('.finale-canvas');
  const frame = section.querySelector('.finale-frame');
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'high-performance' });
  if (!gl) return; // finale.css keeps a soft glow at the point instead
  const vs = compile(gl, gl.VERTEX_SHADER, VERT), fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.error(gl.getProgramInfoLog(prog)); return; }
  gl.useProgram(prog);
  gl.bindVertexArray(gl.createVertexArray());
  const u = {};
  for (const n of ['uRes', 'uC', 'uU', 'uSx', 'uT', 'uReveal', 'uFade']) u[n] = gl.getUniformLocation(prog, n);

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const t0 = performance.now();
  let raf = 0, last = -1e9, onScreen = false, arrivedAt = null;
  const ease = (x) => 1 - (1 - x) ** 3;
  const reveal = (now) => (reduced.matches ? 1 : arrivedAt === null ? 0 : ease(Math.min(1, (now - arrivedAt) / 2800)));

  function draw(now) {
    gl.uniform1f(u.uT, reduced.matches ? 0 : (now - t0) / 1000);
    gl.uniform1f(u.uReveal, reveal(now));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function loop(now) {
    raf = 0;
    if (!onScreen || reduced.matches) return;
    if (now - last >= 32) { last = now; draw(now); }
    raf = requestAnimationFrame(loop);
  }
  const run = () => { if (!raf && onScreen && !reduced.matches) raf = requestAnimationFrame(loop); };

  // The frame (finale.css) places the point and sets the scale; the canvas is drawn at up to 1.5× the CSS pixel and
  // no more than about 2.4 million pixels.
  function resize() {
    const w = section.clientWidth, h = section.clientHeight;
    if (!w || !h) return;
    const scale = Math.min(devicePixelRatio || 1, 1.5, Math.sqrt(2.4e6 / (w * h)));
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    gl.viewport(0, 0, canvas.width, canvas.height);
    const cs = getComputedStyle(frame), f = frame.getBoundingClientRect(), s = section.getBoundingClientRect();
    const at = parseFloat(cs.getPropertyValue('--cv-y')) || 0.7285;
    const unit = parseFloat(cs.getPropertyValue('--cv-unit')) || 1;
    const sx = parseFloat(cs.getPropertyValue('--cv-sx')) || 1;
    gl.uniform2f(u.uRes, canvas.width, canvas.height);
    gl.uniform2f(u.uC, (f.left - s.left + f.width / 2) * canvas.width / w, (h - (f.top - s.top + f.height * at)) * canvas.height / h);
    gl.uniform1f(u.uU, f.height * unit * canvas.height / h);
    gl.uniform1f(u.uSx, sx);
    // The fade covers the tail below the frame, where the footer stands, and a little of the frame.
    gl.uniform1f(u.uFade, (h - f.height + 0.06 * f.height) * canvas.height / h);
    draw(performance.now());
  }
  new ResizeObserver(resize).observe(section);

  new IntersectionObserver((entries) => {
    for (const e of entries) {
      onScreen = e.isIntersecting;
      if (onScreen && arrivedAt === null && e.intersectionRatio >= 0.25) arrivedAt = performance.now();
    }
    if (onScreen) run();
  }, { threshold: [0, 0.25] }).observe(section);
  reduced.addEventListener('change', () => { draw(performance.now()); run(); });
  section.classList.add('is-drawn');
}
