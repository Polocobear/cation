// The optics behind "Why does light change direction?": a glass catalogue, Snell's law, Fresnel reflectance
// and a 2D ray tracer through a polygon in the plane of incidence. Pure functions with no Three.js, so the
// master scene, the miniatures and (after approval) every learning approach read the same numbers.

// Refractive index n(λ). Glasses use the Sellmeier equation with Schott's published coefficients
// (λ in µm, C in µm²); water uses a two-term Cauchy fit (20 °C, visible range).
export const MATERIALS = {
  crown: { name: 'Crown glass', code: 'N-BK7', B: [1.03961212, 0.231792344, 1.01046945], C: [0.00600069867, 0.0200179144, 103.560653] },
  flint: { name: 'Flint glass', code: 'N-F2', B: [1.39757037, 0.159201403, 1.2686543], C: [0.00995906143, 0.0546931752, 119.248346] },
  denseFlint: { name: 'Dense flint', code: 'N-SF11', B: [1.73759695, 0.313747346, 1.89878101], C: [0.013188707, 0.0623068142, 155.23629] },
  water: { name: 'Water', code: 'H₂O', cauchy: [1.3236, 0.00336] },
};

export const D_LINE = 587.6; // nm, the helium d line where n_d is quoted
export const SODIUM = 589.3; // nm, the single colour used for "one wavelength" mode

export function index(material, nm) {
  const l2 = (nm / 1000) ** 2;
  if (material.cauchy) return material.cauchy[0] + material.cauchy[1] / l2;
  let n2 = 1;
  for (let i = 0; i < 3; i++) n2 += (material.B[i] * l2) / (l2 - material.C[i]);
  return Math.sqrt(n2);
}

// Abbe number V_d = (n_d − 1) / (n_F − n_C): how strongly the material spreads colours (lower spreads more).
export function abbe(material) {
  return (index(material, D_LINE) - 1) / (index(material, 486.1) - index(material, 656.3));
}

export const deg = (r) => (r * 180) / Math.PI;
export const rad = (d) => (d * Math.PI) / 180;

const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const add = (a, b, s = 1) => [a[0] + b[0] * s, a[1] + b[1] * s];
const norm = (a) => { const l = Math.hypot(a[0], a[1]); return [a[0] / l, a[1] / l]; };
export const rotate = (v, a) => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)];

// Snell's law in vector form. d: unit direction of travel; nrm: unit normal facing back against d.
// Returns the transmitted direction (null under total internal reflection), the reflected direction,
// the angles of incidence and refraction, and the unpolarised Fresnel reflectance R.
export function refract(d, nrm, n1, n2) {
  const cosi = -dot(nrm, d);
  const eta = n1 / n2;
  const sin2t = eta * eta * (1 - cosi * cosi);
  const reflected = add(d, nrm, 2 * cosi);
  const thetaI = Math.acos(Math.min(1, cosi));
  if (sin2t > 1) return { transmitted: null, reflected, thetaI, thetaT: null, R: 1 };
  const cost = Math.sqrt(1 - sin2t);
  const transmitted = norm(add([d[0] * eta, d[1] * eta], nrm, eta * cosi - cost));
  const rs = (n1 * cosi - n2 * cost) / (n1 * cosi + n2 * cost);
  const rp = (n2 * cosi - n1 * cost) / (n2 * cosi + n1 * cost);
  return { transmitted, reflected, thetaI, thetaT: Math.acos(cost), R: (rs * rs + rp * rp) / 2 };
}

// Shapes in the plane of incidence, counter-clockwise, in scene units. The floor is y = 0.
export function prism(side = 1.15, apexDeg = 60) {
  const h = (side / 2) / Math.tan(rad(apexDeg / 2));
  return [[-side / 2, 0], [side / 2, 0], [0, h]];
}

// Polygons must run counter-clockwise for the outward normals to point out.
export function ccw(poly) {
  let area = 0;
  for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; area += a[0] * b[1] - b[0] * a[1]; }
  return area < 0 ? poly.slice().reverse() : poly;
}

// A semicircular ("D") block: the flat face along x through the centre (y = 0), the curve on the −y side.
export function dBlock(radius = 0.5, segments = 96) {
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const a = (Math.PI * i) / segments;
    pts.push([radius * Math.cos(a), -radius * Math.sin(a)]);
  }
  return ccw(pts);
}

// A point a fraction t along edge i (from vertex i to vertex i + 1), and that edge's outward normal.
export function onEdge(poly, i, t) {
  const a = poly[i], b = poly[(i + 1) % poly.length];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}
export function outwardNormal(poly, i) {
  const a = poly[i], b = poly[(i + 1) % poly.length];
  return norm([b[1] - a[1], -(b[0] - a[0])]); // counter-clockwise polygon: outward is to the right of a→b
}

// Nearest crossing of a ray with the polygon's edges beyond a small epsilon.
function hit(poly, o, d) {
  let best = null;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const e = [b[0] - a[0], b[1] - a[1]];
    const den = d[0] * e[1] - d[1] * e[0];
    if (Math.abs(den) < 1e-12) continue;
    const w = [a[0] - o[0], a[1] - o[1]];
    const t = (w[0] * e[1] - w[1] * e[0]) / den;
    const u = (w[0] * d[1] - w[1] * d[0]) / den;
    if (t > 1e-7 && u >= -1e-9 && u <= 1 + 1e-9 && (!best || t < best.t)) best = { t, edge: i, u };
  }
  return best;
}

// Where a ray in air first meets an opaque box [x0, y0, x1, y1] (a stand), if it does.
function hitBox(box, o, d) {
  const [x0, y0, x1, y1] = box;
  let tmin = -Infinity, tmax = Infinity;
  for (const [oc, dc, lo, hi] of [[o[0], d[0], x0, x1], [o[1], d[1], y0, y1]]) {
    if (Math.abs(dc) < 1e-12) { if (oc < lo || oc > hi) return Infinity; continue; }
    const t1 = (lo - oc) / dc, t2 = (hi - oc) / dc;
    tmin = Math.max(tmin, Math.min(t1, t2));
    tmax = Math.min(tmax, Math.max(t1, t2));
  }
  if (tmax < Math.max(tmin, 0) || tmax <= 1e-7) return Infinity;
  return Math.max(tmin, 0); // a ray that starts on the box (light leaving a glass face it stands on) stops at once
}

// Trace one wavelength from `origin` along `dir` (in air) through glass shapes [{ poly, n }].
// Follows the transmitted path and every reflected branch above `minWeight` (Fresnel). A ray in air stops
// at the floor (y = floorY, when `floor` is set), on an opaque box, or after `far` units. Returns straight
// segments with their energy weight, and the interface events (angles in radians) that the annotations
// and the maths read.
export function trace(shapes, origin, dir, { far = 4, minWeight = 0.012, maxDepth = 8, floor = true, floorY = 0, boxes = [] } = {}) {
  const segments = [];
  const events = [];
  const stack = [{ o: origin, d: norm(dir), inside: -1, w: 1, depth: 0, path: 'main' }];
  while (stack.length) {
    const ray = stack.pop();
    let h = null, shape = -1;
    if (ray.inside >= 0) { h = hit(shapes[ray.inside].poly, ray.o, ray.d); shape = ray.inside; }
    else shapes.forEach((s, i) => { const c = hit(s.poly, ray.o, ray.d); if (c && (!h || c.t < h.t)) { h = c; shape = i; } });
    if (ray.inside < 0) {
      let stop = far, kind = 'far';
      if (floor && ray.d[1] < -1e-9) { const t = (floorY - ray.o[1]) / ray.d[1]; if (t < stop) { stop = t; kind = 'floor'; } }
      for (const b of boxes) { const t = hitBox(b, ray.o, ray.d); if (t < stop) { stop = t; kind = 'box'; } }
      if (!h || stop < h.t) {
        segments.push({ a: ray.o, b: add(ray.o, ray.d, stop), inside: false, w: ray.w, path: ray.path, end: kind });
        continue;
      }
    }
    if (!h) continue; // numerical escape from inside a closed shape; not expected
    const p = add(ray.o, ray.d, h.t);
    segments.push({ a: ray.o, b: p, inside: ray.inside >= 0, w: ray.w, path: ray.path, shape: ray.inside });
    if (ray.depth >= maxDepth) continue;
    const n = shapes[shape].n;
    const out = outwardNormal(shapes[shape].poly, h.edge);
    const inside = ray.inside >= 0;
    const nrm = inside ? [-out[0], -out[1]] : out; // facing back against the ray
    const [n1, n2] = inside ? [n, 1] : [1, n];
    const r = refract(ray.d, nrm, n1, n2);
    events.push({ p, shape, edge: h.edge, normal: out, d: ray.d, t: r.transmitted, inside, thetaI: r.thetaI, thetaT: r.thetaT, R: r.R, tir: !r.transmitted, w: ray.w, path: ray.path });
    if (r.transmitted) stack.push({ o: p, d: r.transmitted, inside: inside ? -1 : shape, w: ray.w * (1 - r.R), depth: ray.depth + 1, path: ray.path });
    if (ray.w * r.R >= minWeight) stack.push({ o: p, d: r.reflected, inside: ray.inside, w: ray.w * r.R, depth: ray.depth + 1, path: r.transmitted ? 'reflection' : ray.path });
  }
  return { segments, events };
}

// A rectangle (a parallel-sided slab) centred on (cx, cy), counter-clockwise.
export function slab(cx, cy, w, h) {
  return [[cx - w / 2, cy - h / 2], [cx + w / 2, cy - h / 2], [cx + w / 2, cy + h / 2], [cx - w / 2, cy + h / 2]];
}

export function translate(poly, dx, dy) { return poly.map(([x, y]) => [x + dx, y + dy]); }

// The incoming direction that meets edge i at incidence angle θ (radians), arriving from below the normal
// (sign +1) or above it (−1).
export function incoming(poly, i, theta, sign = 1) {
  const out = outwardNormal(poly, i);
  return rotate([-out[0], -out[1]], sign * theta);
}

// Angle of minimum deviation for a prism of apex A (radians) and index n: the incidence where the ray
// crosses the prism symmetrically.
export function minDeviationIncidence(apex, n) {
  return Math.asin(Math.min(1, n * Math.sin(apex / 2)));
}

// CIE 1931 colour matching functions (Wyman, Sloan & Shirley 2013 multi-lobe fit) → linear sRGB.
function lobe(x, mu, s1, s2) { const t = (x - mu) / (x < mu ? s1 : s2); return Math.exp(-0.5 * t * t); }
export function wavelengthRGB(nm) {
  const X = 1.056 * lobe(nm, 599.8, 37.9, 31.0) + 0.362 * lobe(nm, 442.0, 16.0, 26.7) - 0.065 * lobe(nm, 501.1, 20.4, 26.2);
  const Y = 0.821 * lobe(nm, 568.8, 46.9, 40.5) + 0.286 * lobe(nm, 530.9, 16.3, 31.1);
  const Z = 1.217 * lobe(nm, 437.0, 11.8, 36.0) + 0.681 * lobe(nm, 459.0, 26.0, 13.8);
  let r = 3.2406 * X - 1.5372 * Y - 0.4986 * Z;
  let g = -0.9689 * X + 1.8758 * Y + 0.0415 * Z;
  let b = 0.0557 * X - 0.2040 * Y + 1.0570 * Z;
  // Spectral colours lie outside sRGB: add just enough white to bring the most negative channel to zero.
  const m = Math.min(0, r, g, b);
  return [r - m, g - m, b - m];
}

// N wavelengths across the visible range with colours white-balanced so that, added together, they make
// neutral white: where the colours overlap (before the light splits) the beam is white, as it should be.
export function spectrum(count = 24, from = 400, to = 700) {
  const out = [];
  for (let i = 0; i < count; i++) out.push({ nm: from + ((to - from) * (i + 0.5)) / count });
  const sum = [0, 0, 0];
  for (const s of out) { s.rgb = wavelengthRGB(s.nm); for (let c = 0; c < 3; c++) sum[c] += s.rgb[c]; }
  for (const s of out) s.rgb = s.rgb.map((v, c) => v / sum[c]);
  return out;
}
