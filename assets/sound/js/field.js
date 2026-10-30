// The wave field's parameters, plus a CPU mirror of the GLSL `field()` and `envelope()` in shaders.js.
// The controls and the checks use the mirror, so labels and tests come from the same numbers as the surface.

export const WAVE = {
  separation: 2.0,  // source spacing, scene units (sources at x = ±separation/2, z = 0)
  wavelength: 0.188, // (spacing/2 − core)/λ = 5, so both origins and the midpoint between them crest together
  frequency: 0.42,  // Hz
  a0: 0.0316,       // amplitude at a source
  r0: 1.0,          // cylindrical spreading length
  decay: 1.8,       // absorption, 1/units: each source owns a disc of clean rings, they cross only in a narrow hourglass between the sources, and the field has settled by the foreground
  core: 0.06,       // softening radius at each origin: a smooth bead, not a cone tip
  tighten: 0,       // review option, off by default: rings tighten near each source (local k up to k·(1 + tighten))
  tightenR: 0.35,   // radius over which the tightening eases off
};

export const k = (w = WAVE) => (2 * Math.PI) / w.wavelength;
export const omega = (w = WAVE) => 2 * Math.PI * w.frequency;
// Distance in phase terms (the shader's rho()): r itself, unless the review-only tightening is on.
export const rho = (r, w = WAVE) => r + w.tighten * w.tightenR * (1 - Math.exp(-r / w.tightenR));
// One source's amplitude at distance r (the shader's amp()).
export const amp = (r, w = WAVE) => (w.a0 * Math.exp(-r * w.decay)) / Math.sqrt(1 + r / w.r0);

// h and its gradient at (x, z) for time t (s) and relative phase phi (radians).
export function sample(x, z, t, phi, w = WAVE) {
  const out = { h: 0, dx: 0, dz: 0, amp: 0 };
  const s = w.separation / 2;
  for (const [sx, ph] of [[-s, 0], [s, phi]]) {
    const dx = x - sx, dz = z;
    const r = Math.sqrt(dx * dx + dz * dz + w.core * w.core);
    const A = amp(r, w);
    const dA = -A * (w.decay + 0.5 / (w.r0 + r));
    const th = k(w) * rho(r, w) - omega(w) * t + ph;
    const dhdr = dA * Math.sin(th) + A * k(w) * (1 + w.tighten * Math.exp(-r / w.tightenR)) * Math.cos(th);
    out.h += A * Math.sin(th);
    out.dx += (dhdr * dx) / r;
    out.dz += (dhdr * dz) / r;
    out.amp += A;
  }
  return out;
}

// The two sources' combined oscillation at (x, z) for phase phi, which does not change with time:
// E = A1·e^{iθ1} + A2·e^{iθ2}, θ = k·r (+ φ for source B). The surface there swings between ±|E|.
export function envelope(x, z, phi, w = WAVE) {
  const s = w.separation / 2;
  let re = 0, im = 0, sum = 0;
  for (const [sx, ph] of [[-s, 0], [s, phi]]) {
    const r = Math.sqrt((x - sx) ** 2 + z * z + w.core * w.core);
    const A = amp(r, w);
    const th = k(w) * rho(r, w) + ph;
    re += A * Math.cos(th); im += A * Math.sin(th); sum += A;
  }
  return { E: Math.hypot(re, im), sum };
}

// How strongly the surface swings at (x, z), against what the two sources would give in step:
// 1 = they add fully, 0 = they cancel. It only reaches 0 where both arrive equally strong.
export function swing(x, z, phi, w = WAVE) {
  const { E, sum } = envelope(x, z, phi, w);
  return E / sum;
}

// How far the two waves cancel at (x, z), 1 − swing: the gold lines in the close-up. The shader's quiet() is the same.
export const quiet = (x, z, phi, w = WAVE) => 1 - swing(x, z, phi, w);

// The lesson's listening point: halfway between the sources, where both waves arrive equally strong.
export const MIDPOINT = { x: 0, z: 0 };

// How strongly the surface swings at (x, z) against the stronger of the two waves alone: 2 where two equal
// waves add in step, 0 where they cancel. At the midpoint it is 2·|cos(φ/2)|.
export function gain(x, z, phi, w = WAVE) {
  const s = w.separation / 2;
  const { E } = envelope(x, z, phi, w);
  const r = (sx) => Math.sqrt((x - sx) ** 2 + z * z + w.core * w.core);
  return E / Math.max(amp(r(-s), w), amp(r(s), w));
}

// A time (s) when source A's wave is at a crest at (x, z): with B in step, the surface there is at its highest.
export function crestTime(x, z, w = WAVE) {
  const r = Math.sqrt((x + w.separation / 2) ** 2 + z * z + w.core * w.core);
  const T = 1 / w.frequency;
  const t = (k(w) * rho(r, w) - Math.PI / 2) / omega(w);
  return ((t % T) + T) % T;
}
