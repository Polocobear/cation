// CATION · "Can sound cancel sound?" — wave surface shaders (Stage 1 material prototype).
//
// Everything visible comes from one field: two coherent point sources on a plane,
//   h(x, z, t) = A(r1) sin(k r1 − ωt) + A(r2) sin(k r2 − ωt + φ)
// The vertex shader displaces the mesh with h; the fragment shader re-evaluates h and its exact
// gradient per pixel, so the normals, the shading and the occlusion all follow the same numbers.

// ---------------------------------------------------------------------------------------------
// The field. Shared verbatim by the vertex and fragment stages (and mirrored on the CPU in field.js).
export const FIELD = /* glsl */ `
uniform float uTime;   // seconds
uniform float uPhase;  // relative phase φ of source 2, radians
uniform float uK;      // wave number k = 2π/λ
uniform float uOmega;  // angular frequency ω
uniform float uA0;     // amplitude at a source
uniform float uR0;     // spreading length: A(r) = A0 · e^(−r/L) / √(1 + r/r0)
uniform float uDecay;  // 1/L, absorption on top of cylindrical spreading
uniform float uCore;   // softening radius, so each origin is a smooth bead rather than a cone tip
uniform vec2 uTighten; // review option, off by default (x = 0): the rings tighten near each source, the local
                       // wave number rising to k·(1 + x) at the origin and easing back over radius y.
                       // A comparison for the client, not acoustics: sound in still air keeps one wavelength.
uniform vec2 uSrc1;
uniform vec2 uSrc2;
uniform float uLift;   // display scale on the heights (and so the slopes): 1 in the wide shot, more in the close-up
                       // so the motion reads. It scales the whole field alike, so every ratio stays the same.

// Distance in phase terms: r itself, unless the tightening option is on.
float rho(float r) {
  return r + uTighten.x * uTighten.y * (1.0 - exp(-r / uTighten.y));
}

// One source's amplitude at distance r.
float amp(float r) {
  return uA0 * exp(-r * uDecay) / sqrt(1.0 + r / uR0);
}

// One source. Returns (h, ∂h/∂x, ∂h/∂z, A).
vec4 wave(vec2 p, vec2 s, float phi) {
  vec2 d = p - s;
  float r = sqrt(dot(d, d) + uCore * uCore);
  float A = amp(r);
  float dA = -A * (uDecay + 0.5 / (uR0 + r));
  float th = uK * rho(r) - uOmega * uTime + phi;
  float kr = uK * (1.0 + uTighten.x * exp(-r / uTighten.y));  // ∂θ/∂r
  float sn = sin(th), cs = cos(th);
  return vec4(A * sn, (dA * sn + A * kr * cs) * d / r, A);
}

// Coherent superposition. Returns (h, ∂h/∂x, ∂h/∂z, A1 + A2).
vec4 field(vec2 p) {
  return (wave(p, uSrc1, 0.0) + wave(p, uSrc2, uPhase)) * uLift;
}

// How far the two waves cancel at p, from 0 (they add in step) to 1 (they cancel completely). It reads the
// envelope of the motion, not the height at this instant: the surface at p swings between ±|E|, with
//   E = A1·e^{iθ1} + A2·e^{iθ2},  θ1 = k·r1,  θ2 = k·r2 + φ,
// so |E|² = A1² + A2² + 2·A1·A2·cos(θ1 − θ2) holds for all time. quiet = 1 − |E|/(A1 + A2): it reaches 1
// only where the two arrive equally strong and exactly opposite; where one is weaker (it has spread further)
// the cancellation is only partial and quiet stays below 1.
float quiet(vec2 p) {
  vec2 d1 = p - uSrc1, d2 = p - uSrc2;
  float r1 = sqrt(dot(d1, d1) + uCore * uCore), r2 = sqrt(dot(d2, d2) + uCore * uCore);
  float A1 = amp(r1), A2 = amp(r2);
  float c = cos(uK * (rho(r1) - rho(r2)) - uPhase);
  return 1.0 - sqrt(max(A1 * A1 + A2 * A2 + 2.0 * A1 * A2 * c, 0.0)) / (A1 + A2);
}
`;

// ---------------------------------------------------------------------------------------------
// 2D simplex noise — Ashima Arts / Stefan Gustavson (MIT licence).
const NOISE = /* glsl */ `
vec3 permute3(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute3(permute3(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m; m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}
vec4 hash42(vec2 p) {
  vec4 p4 = fract(vec4(p.xyxy) * vec4(0.1031, 0.1030, 0.0973, 0.1099));
  p4 += dot(p4, p4.wzxy + 33.33);
  return fract((p4.xxyz + p4.yzzw) * p4.zywx);
}
`;

// ---------------------------------------------------------------------------------------------
export const surfaceVertex = /* glsl */ `
precision highp float;
in vec3 position;           // a point of an even grid on screen, in normalised device coordinates
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
uniform mat4 uInvViewProj;  // screen → world for the current camera
uniform vec3 uCamPos;
${FIELD}
out vec2 vP;
// A projected grid: the screen grid laid onto the y = 0 plane through the camera, so every part of the
// visible surface gets the same vertex density from wherever the camera is (it moves between views).
vec2 onPlate(vec2 ndc) {
  vec4 w = uInvViewProj * vec4(ndc, 0.5, 1.0);
  vec3 dir = normalize(w.xyz / w.w - uCamPos);
  float t = dir.y < -0.02 ? -uCamPos.y / dir.y : 40.0;
  vec2 p = uCamPos.xz + dir.xz * t;
  if (p.y < -7.0) p = uCamPos.xz + (p - uCamPos.xz) * (uCamPos.z + 7.0) / (uCamPos.z - p.y);
  return p;
}
void main() {
  vP = onPlate(position.xy);
  vec3 w = vec3(vP.x, field(vP).x, vP.y);
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}
`;


export const surfaceFragment = /* glsl */ `
precision highp float;
${FIELD}
${NOISE}
#ifndef NL
#define NL 6  // number of softboxes; set from STUDIO in prototype.js
#endif
#ifndef DEBUG
#define DEBUG 0
#endif
uniform mat4 viewMatrix;
uniform vec3 uCamPos;
uniform float uStudioYaw;   // the studio turns with the camera, so the lights keep their places in the shot
uniform mat3 uStudioRot;    // … and tilts with it as it lowers to the close-up (identity in Observe)
uniform vec2 uViewTarget;   // the camera's target (x, z): with the yaw, it sets the view-aligned frame the set's falloffs are laid out in
// Studio: rectangular softboxes in (azimuth, elevation) space, radians. Azimuth 0 looks straight
// past the plate away from the camera; positive azimuth is to the right.
uniform vec4 uBox[NL];      // az0, az1, el0, el1
uniform float uBoxEdge[NL]; // edge softness of the panel itself
uniform vec3 uBoxCol[NL];   // radiance at the panel's centre, left end
uniform vec3 uBoxColR[NL];  // radiance at the panel's centre, right end (a panel can be graded across)
uniform float uBoxHot[NL];  // how far the radiance drops from the centre of a panel to its rim
uniform float uBoxMask[NL]; // where a flagged (snooted) panel reaches the plate: 0 everywhere, 1 the light columns, 2 around the sources, 3 the near band
uniform vec2 uNearMask;     // the near band: z where a panel flagged 3 starts to reach the plate, z where it is full
// Material
uniform float uRoughBase;   // pearlescent layer
uniform float uRoughCoat;   // clear coat
uniform float uSpecAA;      // widens the coat lobe where the normal changes faster than a pixel (anti-aliases far highlights)
uniform float uCoat;
uniform float uCoatF0;      // clear coat reflectance at normal incidence
uniform vec3 uAlbedo;
uniform vec3 uPearlA, uPearlB, uPearlC;  // facing → mid → grazing reflectance tints
uniform float uOcc;         // trough occlusion strength
uniform vec3 uOccShape;     // normalised height where occlusion is full, where it ends, curve exponent
uniform vec3 uOccNear;      // z where trough contrast starts to ease toward the camera, z where it bottoms out, remaining share
uniform vec2 uSpecOcc;      // specular occlusion of the coat: normalised height where it is full, where it ends
uniform float uMicro;       // micro-relief strength
uniform float uMicroScale;  // micro-relief frequency, 1/units
uniform float uDetail;      // render pixels per display pixel (≤ 1): below 1, the finest detail fades out sooner rather than turn to grit
uniform float uGlitter;
uniform float uGlitterCell;
// Where the light falls. The studio is art-directed like a lit set: the light gathers on the middle
// band, the near foreground sits in shadow and the far field sinks into the dark.
uniform vec3 uPoolNear;     // z where the foreground falloff starts, z where it bottoms out, floor
uniform vec3 uPoolFar;      // z where the far dimming starts, z where it bottoms out, floor
uniform vec3 uPoolFarEdge;  // the far band gathers light toward the sides of the frame: view azimuth (radians) where this starts, where it is full, the floor there
uniform vec2 uPoolColBack;  // the light columns start behind each source: z (relative to the source) where they are gone, where they are full
uniform vec4 uPoolCols;     // light columns: inward offset of each column from its source, its width, floor between columns, X strength
uniform float uPoolColLean; // how far the columns lean in toward the centre line per unit of z (negative leans in)
uniform vec3 uPoolColNear;  // the columns end toward the camera: z where they start to fade, z where gone, even light level in front
uniform vec2 uPoolColGain;  // strength of the left and right light columns
uniform vec4 uPoolSide;     // the near band is lit from the left: gain at the left and right of the frame, z where this starts, z where it is full
uniform vec3 uPoolX;        // the X between the sources: z where its arms cross, arm slope dx/dz, arm width
uniform vec4 uPoolOval;     // in the close-up, the light gathers round the midpoint: the oval's
                            // half-width and half-depth round the view's centre, where the falloff starts (1 = its rim), floor
uniform vec3 uWarm;         // tint the light takes on toward the camera (peach-white)
uniform vec2 uWarmZ;        // z where the warm tint starts, z where it is full
uniform vec2 uFade;         // the plate dissolves into the backdrop between these z (far edge)
uniform float uFadeLift;    // how much further back the plate reaches along antinodal lines (in z): the horizon follows the interference
uniform vec3 uEnvTint;      // dim navy dome
uniform vec3 uSrcLight;     // around each source: radius of the snooted light, trough-darkening kept at the origin, radius where it is back to full
uniform vec4 uDofSurf;      // the composite's focus, focus band, blur scale (px) and far-side scale, so glints can soften where the plate is out of focus
uniform float uDofMax;
uniform vec3 uSrcBounce;    // near a source, walls that mirror below the horizon see the lit pit opposite (inter-reflection)
// The quiet zones, where the two waves cancel, turn a muted gold with quieter reflections.
uniform float uGold;        // 0: none; 1: full (lesson.js brings it up as the phase of B turns)
uniform vec3 uQuiet;        // quiet() where the gold starts, where it is full, and a curve (below 1 spreads it wider)
uniform vec3 uGoldF0;       // the satin layer's reflectance there: soft gold in place of the periwinkle pearl
uniform float uGoldRough;   // … and its roughness: broader than the pearl, an even sheen
uniform vec3 uGoldGlow;     // a little diffuse gold under the studio's ambient, so the zones read where they mirror dark sky
uniform vec3 uGoldCoat;     // the clear coat's reflections there: dimmed and warmed, so even the highlights turn gold
uniform vec4 uGoldSpot;     // round the listening point (x, z, radius), the gold widens to where quiet() reaches w …
uniform float uGoldLift;    // … and its diffuse glow is this much brighter, so the line the lesson is about reads first
in vec2 vP;
out vec4 outColor;

float band(float x, float lo, float hi, float w) {
  return smoothstep(lo - w, lo + w, x) * (1.0 - smoothstep(hi - w, hi + w, x));
}
// Studio radiance seen along R through a lobe of roughness a: each panel edge is blurred by the
// lobe's angular width, so the satin layer sees soft gradients and the coat sees crisp panels.
float gCols = 1.0;  // light-column factor at the current fragment, set in main()
float gSrc = 0.0;   // nearness to a source at the current fragment, set in main()
float gNear = 0.0;  // how far into the near band the current fragment is, set in main()
vec3 studio(vec3 R, float a) {
  R = uStudioRot * R;
  float el = asin(clamp(R.y, -1.0, 1.0));
  float az = atan(R.x, -R.z) + uStudioYaw;
  vec3 c = uEnvTint * smoothstep(-0.05, 0.7, R.y);
  c += uSrcBounce * gSrc * smoothstep(0.0, -0.35, R.y);
  float blur = 1.6 * a;
  for (int i = 0; i < NL; i++) {
    float reach = uBoxMask[i] < 0.5 ? 1.0 : (uBoxMask[i] < 1.5 ? gCols : (uBoxMask[i] < 2.5 ? gSrc : gNear));
    vec4 b = uBox[i];
    float w = uBoxEdge[i] + blur;
    // Azimuth spans shrink toward the zenith; widen the edge there so the panel stays smooth.
    float wa = w / max(cos(el), 0.25);
    // Skip panels that cannot reach this ray (band() is exactly zero outside its edges): same result, less work.
    if (reach <= 0.0 || el < b.z - w || el > b.w + w || az < b.x - wa || az > b.y + wa) continue;
    float m = band(az, b.x, b.y, wa) * band(el, b.z, b.w, w);
    // The lobe spreads a panel's light over a wider patch of sky rather than adding light: a thin
    // strip stays a crisp bright line in the glossy coat but only a faint glow in the satin base.
    float ea = b.y - b.x + 2.0 * uBoxEdge[i], ee = b.w - b.z + 2.0 * uBoxEdge[i];
    m *= (ea / (ea + 2.0 * blur)) * (ee / (ee + 2.0 * blur));
    vec2 ctr = vec2(0.5 * (b.x + b.y), 0.5 * (b.z + b.w));
    vec2 hs = vec2(0.5 * (b.y - b.x), 0.5 * (b.w - b.z)) + 1e-3;
    float r = length((vec2(az, el) - ctr) / hs);
    vec3 tint = mix(uBoxCol[i], uBoxColR[i], smoothstep(b.x, b.y, az));
    c += tint * m * (1.0 - uBoxHot[i] * smoothstep(0.0, 1.0, r)) * reach;
  }
  return c;
}

// Micro-relief: domain-warped ridged noise, a fine etched texture that only reads where a
// highlight passes over it.
float frost(vec2 q) {
  vec2 w = vec2(snoise(q * 0.31 + vec2(3.1, 1.7)), snoise(q * 0.31 - vec2(7.7, 2.3)));
  float n = 1.0 - abs(snoise(q + 1.8 * w));
  float n2 = 1.0 - abs(snoise(q * 2.13 + 2.7 * w + 11.0));
  return n * n * n + 0.35 * n2 * n2;
}
vec2 frostGrad(vec2 p, float fp) {
  float sc = uMicroScale;
  float e = 0.18;
  // Fade the relief out where a cell shrinks below a few pixels, so it never shimmers (and skip it there).
  float fade = smoothstep(2.0, 5.0, uDetail / (sc * max(fp, 1e-6)));
  if (fade <= 0.0) return vec2(0.0);
  vec2 q = p * sc;
  float c = frost(q);
  vec2 g = vec2(frost(q + vec2(e, 0.0)) - c, frost(q + vec2(0.0, e)) - c) / e;
  return g * fade;
}

// The plate's coordinates turned with the camera: x across the view, z toward the camera.
vec2 toView(vec2 p) {
  vec2 rel = p - uViewTarget;
  vec2 cs = vec2(cos(uStudioYaw), sin(uStudioYaw));
  return uViewTarget + vec2(rel.x * cs.x - rel.y * cs.y, rel.x * cs.y + rel.y * cs.x);
}

vec3 pearl(float x) {
  return x < 0.5 ? mix(uPearlA, uPearlB, smoothstep(0.0, 0.5, x)) : mix(uPearlB, uPearlC, smoothstep(0.5, 1.0, x));
}

void main() {
  vec4 f = field(vP);
  float h = f.x;
  vec2 g = f.yz;
  vec3 wpos = vec3(vP.x, h, vP.y);
  vec3 V = normalize(uCamPos - wpos);
  vec2 fw = fwidth(vP);
  float fp = max(fw.x, fw.y);  // world size of a pixel here

  // Macro normal straight from the analytic gradient of the field.
  vec3 N = normalize(vec3(-g.x, 1.0, -g.y));
  // Micro-relief: full strength on the pearlescent layer, a little less on the coat.
  vec2 mg = uMicro > 0.0 ? frostGrad(vP, fp) * uMicro : vec2(0.0);
  vec3 Nm = normalize(vec3(-g.x - mg.x, 1.0, -g.y - mg.y));
  vec3 Nc = normalize(vec3(-g.x - 0.2 * mg.x, 1.0, -g.y - 0.2 * mg.y));

  float NoV = clamp(dot(N, V), 1e-3, 1.0);
  float NoVm = clamp(dot(Nm, V), 1e-3, 1.0);

  // Where the light falls on the plate. Things tied to the sources (the light columns, the X between
  // them) use the plate's own x and z; the set's falloffs (near shadow, far dimming, horizon, warm tint)
  // are laid out square to the view, in (xc, zc): the plate's coordinates turned with the camera.
  float z = vP.y;
  vec2 pc = toView(vP);
  float xc = pc.x, zc = pc.y;
  float pool = mix(1.0, uPoolNear.z, smoothstep(uPoolNear.x, uPoolNear.y, zc));
  vec3 dirV = wpos - uCamPos;
  float azV = atan(dirV.x, -dirV.z) + uStudioYaw;  // horizontal angle off the centre of the view
  float farFloor = mix(uPoolFar.z, uPoolFarEdge.z, smoothstep(uPoolFarEdge.x, uPoolFarEdge.y, abs(azV)));
  pool *= mix(1.0, farFloor, smoothstep(-uPoolFar.x, -uPoolFar.y, -zc));
  // Light falls unevenly, as on a lit set: a column through each source and an X of light crossing
  // on the centre line between them, with quieter diagonal zones in between. A column is the glint path
  // of a tall light behind the source, so it runs straight toward the camera, leaning in a little.
  vec2 s1 = toView(uSrc1), s2 = toView(uSrc2);
  float colFade = 1.0 - smoothstep(uPoolColNear.x, uPoolColNear.y, zc);
  vec2 dc = vec2(xc - s1.x - uPoolCols.x + uPoolColLean * (zc - s1.y), xc - s2.x + uPoolCols.x - uPoolColLean * (zc - s2.y)) / uPoolCols.y;
  vec2 colBack = smoothstep(uPoolColBack.x, uPoolColBack.y, vec2(zc - s1.y, zc - s2.y));
  float cols = max(exp(-0.5 * dc.x * dc.x) * colBack.x * uPoolColGain.x, exp(-0.5 * dc.y * dc.y) * colBack.y * uPoolColGain.y) * colFade;
  float arm = uPoolX.y * (z - uPoolX.x);
  vec2 dxa = vec2(vP.x - arm, vP.x + arm) / uPoolX.z;
  float xArms = exp(-0.5 * min(dxa.x * dxa.x, dxa.y * dxa.y)) * smoothstep(-1.2, -0.5, z) * (1.0 - smoothstep(1.2, 1.8, z));
  pool *= mix(mix(uPoolColNear.z, uPoolCols.z, colFade), 1.0, max(cols, uPoolCols.w * xArms));
  pool *= mix(1.0, mix(uPoolSide.x, uPoolSide.y, smoothstep(-1.6, 1.6, xc)), smoothstep(uPoolSide.z, uPoolSide.w, zc));
  pool *= mix(1.0, uPoolOval.w, smoothstep(uPoolOval.z, 1.0, length((vP - uViewTarget) / uPoolOval.xy)));

  gCols = cols;
  float rS = min(length(vP - uSrc1), length(vP - uSrc2));
  gSrc = exp(-0.5 * rS * rS / (uSrcLight.x * uSrcLight.x));
  gNear = smoothstep(uNearMask.x, uNearMask.y, zc);

  // Pearlescent base: the reflectance tint drifts with viewing angle and a slow "film" variation.
  float film = snoise(vP * 1.3 + 4.0) * 0.5 + snoise(vP * 3.1 - 2.0) * 0.25;
  vec3 F0 = pearl(clamp(1.0 - NoVm + 0.10 * film, 0.0, 1.0));
  vec3 Fb = F0 + (1.0 - F0) * pow(1.0 - NoVm, 5.0);
  // The diffuse part is tiny on this dark pearl, so a flat ambient stands in for a full studio lookup.
  vec3 base = Fb * studio(reflect(-V, Nm), uRoughBase) + uAlbedo * (0.6 + 0.6 * Nm.y);
  // The quiet zones: where the waves cancel, the pearl turns satin gold, a broad soft reflection of the same studio
  // with a little diffuse gold, so the zone reads even where it mirrors dark sky. The weight comes from
  // quiet() (the envelope, steady in time), so the gold holds still on the nodal bands while the surface
  // moves through it.
  vec2 dSpot = vP - uGoldSpot.xy;
  float spot = exp(-dot(dSpot, dSpot) / (uGoldSpot.z * uGoldSpot.z));
  float qz = uGold > 0.0 ? uGold * pow(smoothstep(mix(uQuiet.x, uGoldSpot.w, spot), uQuiet.y, quiet(vP)), uQuiet.z) : 0.0;
  if (qz > 0.0) {
    vec3 satin = uGoldF0 * studio(reflect(-V, Nm), uGoldRough) + uGoldGlow * (1.0 + uGoldLift * spot) * (0.6 + 0.6 * Nm.y);
    base = mix(base, satin, qz);
  }

  float Fc = uCoat * (uCoatF0 + (1.0 - uCoatF0) * pow(1.0 - NoV, 5.0));
  // Specular anti-aliasing: where the normal turns within a pixel (far away, or on tight crests) the
  // coat lobe widens to match, so thin highlight lines never break up into shimmer.
  vec3 dN = fwidth(N);
  float rCoat = sqrt(uRoughCoat * uRoughCoat + uSpecAA * dot(dN, dN));
  vec3 coat = Fc * studio(reflect(-V, Nc), rCoat);

  // Troughs see little of the studio: occlusion from the local height relative to local amplitude.
  float hn = h / (f.w + 1e-4);
  // Toward the camera the troughs soften, so the foreground reads as calm swells rather than holes.
  float occAmt = uOcc * mix(1.0, uOccNear.z, smoothstep(uOccNear.x, uOccNear.y, zc));
  // Near each origin the troughs stay open, so a source reads as a bright point, not a dark pit.
  float rSrc = min(length(vP - uSrc1), length(vP - uSrc2));
  occAmt *= mix(uSrcLight.y, 1.0, smoothstep(0.0, uSrcLight.z, rSrc));
  float occ = mix(1.0 - occAmt, 1.0, pow(smoothstep(uOccShape.x, uOccShape.y, hn), uOccShape.z));

  // Specular occlusion: inside a trough, the rays the coat reflects toward the low studio lights are
  // blocked by the neighbouring crests, so the walls of a pit do not draw a bright outline round it,
  // while crest tops and the ridges between pits keep their lines.
  coat *= mix(1.0, smoothstep(uSpecOcc.x, uSpecOcc.y, hn), 1.0 - gSrc);
  // Quiet zones reflect less, and in gold: their highlights dim rather than flare, as befits the least motion.
  coat *= mix(vec3(1.0), uGoldCoat, qz);
  vec3 col = (base * (1.0 - Fc) + coat) * occ;
  // Glints gather inside the highlight lines and soften away where the plate is out of focus.
  float lit = smoothstep(0.22, 0.9, dot(col, vec3(0.2126, 0.7152, 0.0722)));
  float vz = -(viewMatrix * vec4(wpos, 1.0)).z;
  float cocPx = min(max(abs(1.0 / uDofSurf.x - 1.0 / vz) - uDofSurf.y, 0.0) * uDofSurf.z * (vz > uDofSurf.x ? uDofSurf.w : 1.0), uDofMax);
  lit *= (1.0 - smoothstep(2.5, 8.0, cocPx)) * (1.0 - qz);

  // Sparse metallic glints: tiny flakes with their own tilt, lit only by the same studio.
  if (uGlitter > 0.0 && lit > 0.0) {
    vec2 gq = vP / uGlitterCell;
    vec2 id = floor(gq);
    vec4 r1 = hash42(id);
    vec4 r2 = hash42(id + 71.3);
    float on = step(r1.x, mix(0.4, 0.7, smoothstep(0.8, 1.6, vP.y)));  // denser toward the camera
    float d = length(fract(gq) - (0.25 + 0.5 * r1.yz));
    float dotm = 1.0 - smoothstep(0.1, 0.3, d);
    // Flake size on screen (geometric mean of the two pixel footprints): fade out below ~1.5 px.
    float cellPx = uGlitterCell / max(sqrt(fw.x * fw.y), 1e-6);
    float w = on * dotm * smoothstep(1.2, 2.6, cellPx * uDetail) * lit;
    // Only flakes that can show pay for a studio lookup.
    if (w > 0.0) {
      vec3 fn = normalize(N + 0.5 * vec3(r2.x * 2.0 - 1.0, 0.0, r2.y * 2.0 - 1.0));
      col += w * studio(reflect(-V, fn), 0.02) * uGlitter * (0.3 + 0.7 * r2.z * r2.z);
    }
  }

  // Toward the camera the highlights (not the shadows) warm to peach-white.
  float hi = smoothstep(0.12, 1.0, dot(col, vec3(0.2126, 0.7152, 0.0722)));
  col *= pool * mix(vec3(1.0), uWarm, smoothstep(uWarmZ.x, uWarmZ.y, zc) * hi);
  // The plate dissolves into the dark at its far edge.
  // The far edge follows the interference: along antinodal lines, where the two waves add, the swell
  // stands taller and reaches further back; along nodal lines it sinks sooner. So the horizon undulates
  // with the field instead of being a ruled line.
  vec2 d1 = vP - uSrc1, d2 = vP - uSrc2;
  float dr = rho(sqrt(dot(d1, d1) + uCore * uCore)) - rho(sqrt(dot(d2, d2) + uCore * uCore));
  float env = 0.5 + 0.5 * cos(uK * dr - uPhase);  // 1 on antinodal lines, 0 on nodal lines
  col *= smoothstep(uFade.y, uFade.x, zc + uFadeLift * (env - 0.5));

  float viewZ = -(viewMatrix * vec4(wpos, 1.0)).z;
#if DEBUG == 1
  col = N * 0.5 + 0.5;
#elif DEBUG == 2
  col = studio(reflect(-V, N), uRoughCoat);
#elif DEBUG == 3
  col = vec3(occ);
#elif DEBUG == 4
  col = Fb;
#elif DEBUG == 5
  col = vec3(pool * smoothstep(uFade.y, uFade.x, zc));
#elif DEBUG == 6
  col = vec3(quiet(vP));  // for checking the shader's quiet() against field.js (with ?uRaw=1)
#elif DEBUG == 7
  col = vec3(0.5 + 25.0 * h);  // the displayed height, for checking it against field.js (with ?uRaw=1)
#endif
  outColor = vec4(col, viewZ);
}
`;

// ---------------------------------------------------------------------------------------------
// Fullscreen composite: depth of field (single-pass scatter-as-gather bokeh), filmic tone map,
// grade, vignette and grain. Works in linear HDR so bright glints open into real bokeh discs.
export const quadVertex = /* glsl */ `
precision highp float;
in vec3 position;
out vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const compositeFragment = /* glsl */ `
precision highp float;
uniform sampler2D uScene;   // rgb: linear HDR radiance, a: view depth (0 where there is no surface)
uniform vec2 uRes;          // output size in pixels
uniform float uFocus;       // focus distance
uniform float uFocusBand;   // half-width of the sharp band, in 1/distance (a deep, art-directed focus zone)
uniform float uFarScale;    // blur beyond the sharp band, relative to the blur in front of it
uniform float uCocScale;    // pixels of blur per unit of |1/focus − 1/z|
uniform float uMaxCoc;      // pixels
uniform float uExposure;
uniform float uSeed;
uniform vec3 uBackdrop;     // display-referred navy the blacks sit on
uniform float uDof;
uniform float uDofSamples;  // sample budget for the widest blur: live pages use a small one, captures the full spiral
uniform float uRaw;         // 1: pass the surface's values through untouched (checks)
in vec2 vUv;
out vec4 outColor;

const float GOLDEN = 2.39996323;

float coc(float z) {
  z = z <= 0.0 ? 1000.0 : z;
  float s = z > uFocus ? uFarScale : 1.0;
  return min(max(abs(1.0 / uFocus - 1.0 / z) - uFocusBand, 0.0) * uCocScale * s, uMaxCoc);
}

vec3 aces(vec3 x) {
  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec3 toSRGB(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

void main() {
  vec4 c0 = texture(uScene, vUv);
  if (uRaw > 0.5) { outColor = vec4(c0.rgb, 1.0); return; }
  float z0 = c0.a;
  float s0 = coc(z0) * uDof;
  vec3 acc = c0.rgb;
  float tot = 1.0;
  float rad = 0.6;
  vec2 px = 1.0 / uRes;
  // Golden-angle spiral; each sample is kept if its own circle of confusion reaches this pixel. The step
  // grows with the blur so the widest blur costs uDofSamples samples (never denser than 0.9/r).
  float R = uMaxCoc * uDof;
  float dr = max(0.9, R * R / (2.0 * uDofSamples));
  for (int i = 0; i < 400; i++) {
    if (rad >= R) break;
    float ang = float(i) * GOLDEN;
    vec2 uv = vUv + vec2(cos(ang), sin(ang)) * px * rad;
    vec4 s = texture(uScene, uv);
    float ss = coc(s.a) * uDof;
    float zs = s.a <= 0.0 ? 1000.0 : s.a;
    float zc = z0 <= 0.0 ? 1000.0 : z0;
    if (zs > zc) ss = clamp(ss, 0.0, s0 * 2.0);  // sharp foreground is not smeared by what is behind it
    float m = smoothstep(rad - 0.5, rad + 0.5, ss);
    acc += mix(acc / tot, s.rgb, m);
    tot += 1.0;
    rad += dr / rad;
  }
  vec3 col = acc / tot;

  col = aces(col * uExposure);

  // Vignette
  vec2 q = (vUv - 0.5) * vec2(1.0, 1.15);
  col *= mix(1.0, 0.78, smoothstep(0.4, 0.95, length(q)));

  col = toSRGB(col);
  // The blacks sit on a deep navy backdrop (a screen blend), a touch deeper toward the top.
  col += uBackdrop * mix(1.0, 0.75, smoothstep(0.4, 1.0, vUv.y)) * (1.0 - col);
  // Fine film grain doubles as dither for the deep gradients.
  float n = hash12(gl_FragCoord.xy + uSeed * 37.0) + hash12(gl_FragCoord.xy * 1.37 - uSeed * 11.0) - 1.0;
  col += n * 0.008;
  outColor = vec4(col, 1.0);
}
`;
