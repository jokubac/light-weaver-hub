// Light-meter maths for the live plot: approximate centre-beam lux at 3 m for common
// fixture models, inverse-square + beam falloff illuminance at a point, and the
// resulting T-stop for a given camera exposure (ISO / shutter).
import type { WallSegment, Opening } from "@/lib/plot-geometry";
import { rayBlocked } from "@/lib/plot-geometry";

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Approximate centre-beam lux at 3 m, full output, matched by model-name fragment. */
const LUX3M_MODELS: { test: RegExp; lux: number }[] = [
  // ARRI SkyPanel
  { test: /s360/, lux: 9300 },
  { test: /s120/, lux: 3850 },
  { test: /s60/, lux: 2050 },
  { test: /s30/, lux: 1150 },
  // Aputure
  { test: /1200d/, lux: 12000 },
  { test: /600d/, lux: 7000 },
  { test: /300d/, lux: 3800 },
  { test: /ls ?60x|amaran 60/, lux: 2500 },
  { test: /\bmc\b/, lux: 120 },
  { test: /amaran 200/, lux: 1800 },
  { test: /amaran/, lux: 1500 },
  // Nanlux
  { test: /evoke ?2400/, lux: 26000 },
  { test: /evoke ?1200/, lux: 15000 },
  // Nanlite Forza
  { test: /forza ?300/, lux: 9000 },
  { test: /forza ?60/, lux: 2000 },
  { test: /forza/, lux: 3000 },
  // Astera
  { test: /hyperion/, lux: 450 },
  { test: /titan/, lux: 280 },
  { test: /helios/, lux: 60 },
  { test: /ax3|nyx/, lux: 90 },
  { test: /ax1/, lux: 25 },
  // Litepanels / Creamsource / Kino Flo / Quasar
  { test: /gemini/, lux: 1500 },
  { test: /vortex/, lux: 4500 },
  { test: /kino|diva/, lux: 600 },
  { test: /quasar/, lux: 200 },
];

/** Looks up a known fixture's datasheet-ish lux @ 3m, else estimates from watts & beam angle. */
export function lux3m(model: string, watts: number, beamDeg: number, override?: number): number {
  if (override !== undefined && Number.isFinite(override) && override > 0) return override;
  const m = model.toLowerCase();
  const hit = LUX3M_MODELS.find((x) => x.test.test(m));
  if (hit) return hit.lux;
  return wattFallbackLux3m(watts, beamDeg);
}

/** Rough estimate for unlisted fixtures: LED efficacy spread over the beam's solid angle. */
export function wattFallbackLux3m(watts: number, beamDeg: number): number {
  const efficacy = 140; // lm/W, typical modern LED fixture
  const lumens = Math.max(0, watts) * efficacy;
  const halfRad = (clamp(beamDeg, 1, 179) / 2) * Math.PI / 180;
  const omega = Math.max(0.001, 2 * Math.PI * (1 - Math.cos(halfRad)));
  const intensity = lumens / omega; // candela
  return intensity / 9; // E = I / d², d = 3m
}

export interface MeterLight { x: number; y: number; z: number; rot: number; tilt: number; beam: number; lux3m: number; level: number }

/** Beam-centre falloff shared with the plot's light-pool rendering. */
function beamEdge(angle: number, halfRad: number) {
  return Math.pow(Math.max(0, 1 - Math.pow(angle / Math.max(0.001, halfRad), 2)), 2);
}

/** Illuminance (lux) at a point from every light, summed, with beam falloff and wall occlusion. */
export function illuminanceAt(point: [number, number, number], lights: MeterLight[], walls: WallSegment[], openings: Opening[]): number {
  let total = 0;
  for (const l of lights) {
    if (l.level <= 0.002 || l.lux3m <= 0) continue;
    const dx = point[0] - l.x, dy = point[1] - l.y, dz = point[2] - l.z;
    const dist = Math.hypot(dx, dy, dz);
    if (dist < 0.05) continue;
    const a = (l.rot * Math.PI) / 180, tiltRad = clamp(l.tilt, 0, 90) * Math.PI / 180;
    const axis: [number, number, number] = [Math.cos(a) * Math.cos(tiltRad), Math.sin(a) * Math.cos(tiltRad), -Math.sin(tiltRad)];
    const cosIncidence = clamp((dx * axis[0] + dy * axis[1] + dz * axis[2]) / dist, -1, 1);
    const angle = Math.acos(cosIncidence);
    const halfRad = Math.min(90, l.beam / 2) * Math.PI / 180;
    if (angle > halfRad) continue;
    if (rayBlocked([l.x, l.y, l.z], point, walls, openings)) continue;
    const intensity = l.lux3m * 9 * l.level; // candela such that I/9 = lux3m at full level
    total += Math.max(0, (intensity / (dist * dist)) * beamEdge(angle, halfRad));
  }
  return total;
}

export const footcandles = (lux: number) => lux / 10.764;

/** Shutter time in seconds from fps & shutter angle (default 24fps / 180° → 1/48s). */
export function shutterSeconds(fps = 24, shutterAngle = 180): number {
  return (shutterAngle / 360) / Math.max(1, fps);
}

const INCIDENT_METER_C = 250;

/** T-stop (incident-meter style) for a measured illuminance, ISO and shutter time. */
export function tStopFor(lux: number, iso: number, shutterSec: number, C = INCIDENT_METER_C): number {
  return Math.sqrt(Math.max(0, lux) * Math.max(0, shutterSec) * Math.max(1, iso) / C);
}

/** Nearest third-stop T value, e.g. { value: 2.8, thirds: 1, label: "T2.8 +1/3" }. */
export function roundToThirdStop(t: number): { value: number; thirds: 0 | 1 | 2; label: string } {
  if (!(t > 0)) return { value: 0, thirds: 0, label: "—" };
  // N = 2^(k/6): every 6 steps of k is one full stop, every 2 steps is a third-stop.
  const k = Math.round(Math.log2(t) * 6);
  const baseK = Math.floor(k / 3) * 3;
  const thirds = (k - baseK) as 0 | 1 | 2;
  const value = Math.pow(2, baseK / 6);
  const rounded = value >= 10 ? Math.round(value * 10) / 10 : Math.round(value * 100) / 100;
  const suffix = thirds === 1 ? " +1/3" : thirds === 2 ? " +2/3" : "";
  return { value: rounded, thirds, label: `T${rounded}${suffix}` };
}

/** Stops a camera's current iris is over (+) or under (-) the metered T-stop. */
export function stopsDifference(meteredT: number, cameraFstop: number): number {
  if (!(meteredT > 0) || !(cameraFstop > 0)) return 0;
  return 2 * Math.log2(cameraFstop / meteredT);
}
