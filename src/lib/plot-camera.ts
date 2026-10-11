// Virtual camera for the live plot: lens, iris, ISO and sensor drive field of view and exposure.
export interface PlotCamera {
  id: string; name: string;
  x: number; y: number; h: number; rot: number; tilt: number; floor: number;
  lens: number; // focal length, mm
  fstop: number;
  iso: number;
  sensor: SensorId;
}
export type SensorId = "s35" | "ff" | "m43" | "lf";
export const SENSORS: { id: SensorId; label: string; w: number; h: number }[] = [
  { id: "s35", label: "Super 35", w: 24.9, h: 14.0 },
  { id: "ff", label: "Full Frame", w: 36, h: 24 },
  { id: "lf", label: "ARRI LF", w: 36.7, h: 25.5 },
  { id: "m43", label: "Micro 4/3", w: 17.3, h: 13 },
];
export const LENSES = [14, 18, 24, 35, 50, 85, 135];
export const FSTOPS = [1.4, 2, 2.8, 4, 5.6, 8, 11, 16];
export const ISOS = [100, 200, 400, 800, 1280, 1600, 3200, 6400];

export const defaultCamera = (x: number, y: number, floor = 0): PlotCamera => ({
  id: Math.random().toString(36).slice(2, 10), name: "Camera A", x, y, h: 1.5, rot: 0, tilt: 5, floor, lens: 35, fstop: 2.8, iso: 800, sensor: "s35",
});

/** Horizontal field of view in degrees. */
export function horizontalFov(c: PlotCamera) {
  const s = SENSORS.find((x) => x.id === c.sensor);
  return (2 * Math.atan((s?.w ?? 24.9) / (2 * Math.max(1, c.lens))) * 180) / Math.PI;
}

/** Plot coordinates are X/Y on the floor and +Z up; screen right must form an upright basis. */
export function cameraBasis(c: Pick<PlotCamera, "rot" | "tilt">) {
  const yaw = c.rot * Math.PI / 180, pitch = -c.tilt * Math.PI / 180;
  const forward: [number, number, number] = [Math.cos(yaw) * Math.cos(pitch), Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch)];
  const right: [number, number, number] = [Math.sin(yaw), -Math.cos(yaw), 0];
  const up: [number, number, number] = [-Math.cos(yaw) * Math.sin(pitch), -Math.sin(yaw) * Math.sin(pitch), Math.cos(pitch)];
  return { forward, right, up };
}

/** Scene-referred exposure multiplier: 18% grey at ~400 lux, ISO 800, f/2.8. */
export function exposureGain(c: PlotCamera) {
  return (c.iso / 800) * (2.8 * 2.8) / (c.fstop * c.fstop) / 400;
}
