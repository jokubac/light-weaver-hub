// Fan / spread: distribute a value range across an ordered selection — pure.
import { kelvinToRgb } from "./dmx";

export type FanMode = "linear" | "center";
export type SpreadAttr = "intensity" | "cct" | "hue";

/** Returns n values from `from` to `to`. "center" puts `from` in the middle and `to` at both ends. */
export function fanValues(n: number, from: number, to: number, mode: FanMode = "linear"): number[] {
  if (n <= 0) return [];
  if (n === 1) return [from];
  return Array.from({ length: n }, (_, i) => {
    let k = i / (n - 1);
    if (mode === "center") k = Math.abs(k - 0.5) * 2;
    return from + (to - from) * k;
  });
}

/**
 * CSS colour for one preview swatch of a spread value.
 * CCT uses the same black-body conversion the lamps themselves are drawn with,
 * so a warm→cool spread never shows a green step on the way.
 */
export function spreadSwatch(attr: SpreadAttr, v: number): string {
  if (attr === "hue") return `hsl(${Math.round(v) % 360} 100% 50%)`;
  if (attr === "cct") {
    const [r, g, b] = kelvinToRgb(v);
    return `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)})`;
  }
  return "var(--primary)";
}
