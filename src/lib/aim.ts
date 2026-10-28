// Moving-head aiming: turns PLOT positions into Pan/Tilt values and generates movement
// between them. Pure and browser-safe — no DOM, no storage — so the maths stays testable.

export interface AimPoint { x: number; y: number; z: number }
/** A light on the plot: position in metres, hanging height in metres, facing in degrees. */
export interface AimFrom { x: number; y: number; h: number; rot: number }
export interface AimOptions { panRange?: number | undefined; tiltRange?: number | undefined }

export const PAN_RANGES = [180, 270, 360, 540];
export const TILT_RANGES = [90, 180, 270];
export const DEFAULT_PAN_RANGE = 540;
export const DEFAULT_TILT_RANGE = 270;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
/** Fold an angle into -180..180 so the head always takes the short way round. */
export const wrap180 = (deg: number) => ((deg + 180) % 360 + 360) % 360 - 180;

/**
 * Pan/tilt (both 0..1) that points a light at a target.
 * Convention: 0.5 is the light's own centre — Pan 0.5 faces the light's `rot`, Tilt 0.5 is level.
 * `panRange`/`tiltRange` are the head's travel in degrees (a 540° head spans ±270°).
 */
export function panTiltFor(from: AimFrom, to: AimPoint, opts: AimOptions = {}): { pan: number; tilt: number } {
  const panRange = opts.panRange ?? DEFAULT_PAN_RANGE;
  const tiltRange = opts.tiltRange ?? DEFAULT_TILT_RANGE;
  const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.h;
  const dist = Math.hypot(dx, dy);
  const heading = (Math.atan2(dy, dx) * 180) / Math.PI;
  const pan = 0.5 + wrap180(heading - from.rot) / panRange;
  // Above the light is positive tilt; a head looking straight down is negative.
  const elevation = dist > 0.0001 ? (Math.atan2(dz, dist) * 180) / Math.PI : dz > 0 ? 90 : -90;
  const tilt = 0.5 + elevation / tiltRange;
  return { pan: clamp01(pan), tilt: clamp01(tilt) };
}

/**
 * A rectangular grid of aim points centred on `center`, laid out in reading order
 * (row by row, left to right) and turned by `rot` degrees.
 */
export function aimGrid(center: AimPoint, rows: number, cols: number, spread = 1, rot = 0): AimPoint[] {
  const r = Math.max(1, Math.round(rows)), c = Math.max(1, Math.round(cols));
  const a = (rot * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
  const out: AimPoint[] = [];
  for (let y = 0; y < r; y++) {
    for (let x = 0; x < c; x++) {
      const u = (x - (c - 1) / 2) * spread, v = (y - (r - 1) / 2) * spread;
      out.push({ x: center.x + u * ca - v * sa, y: center.y + u * sa + v * ca, z: center.z });
    }
  }
  return out;
}

/** Shapes a head can wander through while it holds its aim. */
export type AimShape = "circle" | "figure8" | "sweep" | "random";
export interface AimMove { shape: AimShape; rate: number; size: number }
export const AIM_SHAPES: { id: AimShape; label: string }[] = [
  { id: "circle", label: "Circle" },
  { id: "figure8", label: "Figure 8" },
  { id: "sweep", label: "Sweep" },
  { id: "random", label: "Random" },
];

/**
 * Live Pan/Tilt offsets (±0.5 of the head's whole travel) for a wander shape at time `t`.
 * Deterministic from `seed`, so two lights with the same shape drift apart instead of marching.
 */
export function moveOffset(m: AimMove, t: number, seed = 0): [number, number] {
  const w = 2 * Math.PI * Math.max(0, m.rate) * t, s = Math.max(0, Math.min(1, m.size)) * 0.5;
  switch (m.shape) {
    case "circle":
      return [Math.sin(w) * s, Math.cos(w) * s];
    case "figure8":
      return [Math.sin(w) * s, Math.sin(2 * w) * s * 0.5];
    case "sweep":
      return [Math.sin(w) * s, 0];
    case "random": {
      // Two slow detuned sines read as a hand-picked wander but never jump.
      const a = w * 0.7 + seed, b = w * 1.31 + seed * 1.7;
      return [(Math.sin(a) + Math.sin(b)) / 2 * s, (Math.sin(a + 2.1) + Math.sin(b * 0.83 + 1.3)) / 2 * s];
    }
  }
}

/** A named place on the plot a light can be pointed at. */
export interface AimTarget extends AimPoint { id: string; name: string }

/**
 * Targets read off the plot: every text label ("Actor", "Table", "Background") and every
 * placed light, converted from board units to metres with `metres` per unit.
 */
export function aimTargets(
  items: { id: string; kind: string; x: number; y: number; text?: string | undefined; uid?: string | undefined }[],
  nameOf: (uid: string) => string,
  metres = 1,
  height = 0,
): AimTarget[] {
  const out: AimTarget[] = [];
  for (const it of items) {
    const label = it.kind === "text" ? (it.text ?? "").trim() : it.kind === "fixture" && it.uid ? nameOf(it.uid) : "";
    if (!label) continue;
    out.push({ id: it.id, name: label, x: it.x * metres, y: it.y * metres, z: height });
  }
  return out;
}
