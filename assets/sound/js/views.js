// CATION · "Can sound cancel sound?" — the two camera states the lesson moves between.
//
// Observe is the low, oblique camera of Stage 1 (set in prototype.js). Close is a low camera on the line
// halfway between the sources, looking along it at the midpoint: the waves come in from the left and right
// and meet in front of the viewer. One value (0 = Observe, 1 = Close) moves every camera parameter
// together, so the camera travels along a single path; lesson.js sets it from the page's scroll.

// Close's framing: the camera's elevation above the plate (degrees), the point it looks at (the midpoint,
// nudged toward the camera so the midpoint sits a little above the middle of the frame, clear of the
// captions), and the width of plate in view at the midpoint's distance, for wide (desktop) and tall (phone)
// frames.
export const CLOSE = {
  el: { wide: 17, tall: 28 },  // tall frames see more sky above the plate, so they look down more steeply
  yaw: 0,
  x: 0,
  z: 0.035,
  width: { wide: 1.15, tall: 0.62 },
  lift: 2,          // display scale on the heights: the surface moves twice as far, so its motion reads up close
  focus: 0.9,       // depth of field: focus distance as a share of the camera's distance d to the midpoint …
  focusBand: 0.345, // … the sharp band either side of it, in 1/d (so 0.69·d to 1.3·d, on any frame) …
  blur: 0.6,        // … and the blur beyond, against Observe's
  tilt: 0,          // how far the studio tilts down with the camera (see prototype.js)
  exposure: 1,      // relative to Observe's
};

// Close's values for the set's falloffs (uniform name → value). Observe's are whatever prototype.js set.
// The oblique shot keeps the light on the sources and lets the band between them fall dark; up close the
// light gathers on the midpoint instead, with the far plate sinking into the dark behind it.
export const LOOK = {
  uPoolCols: [0.15, 0.24, 1.0, 0.0],
  uPoolSide: [1.0, 1.0, 0.0, 1.0],
  uPoolOval: [0.5, 0.7, 0.2, 0.3],
  uPoolFar: [-0.45, -1.3, 0.1],
  uFade: [-1.2, -2.2],
  uFadeLift: 0.3,
  uMicro: 0.004,  // the etched micro-relief, magnified up close, is turned down so it stays a texture rather than grit
};

// Close's camera on a frame of this aspect, given Observe's vertical field of view. Frames
// narrower than 16:9 keep the horizontal field (prototype.js widens the vertical one), so phones see less
// plate across but the same rings at the same size.
export function closeFraming(aspect, fovDeg) {
  const t = Math.min(1, Math.max(0, (aspect - 0.8) / (1.5 - 0.8)));
  const width = CLOSE.width.tall + (CLOSE.width.wide - CLOSE.width.tall) * t;
  const tanH = Math.tan((fovDeg * Math.PI) / 360) * Math.max(aspect, 16 / 9);
  return { dist: width / (2 * tanH), x: CLOSE.x, z: CLOSE.z, el: CLOSE.el.tall + (CLOSE.el.wide - CLOSE.el.tall) * t };
}
