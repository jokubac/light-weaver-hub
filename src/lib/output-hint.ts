// Which fixture fields count as "controlling a light", so the console can notice a
// programming move no matter which screen made it and remind the operator when the
// output is blocked (master at 0% or blackout held).

import type { PatchedFixture } from "./dmx";

/** Fixture fields that decide what a light actually does; a change here is a control move. */
export const OUTPUT_KEYS = [
  "intensity",
  "cct",
  "gm",
  "hue",
  "saturation",
  "crossfade",
  "cctOnly",
  "fx",
  "on",
  "fxPlaying",
  "fan",
  "gel",
  "beam",
  "trigger",
] as const;

export type OutputKey = (typeof OUTPUT_KEYS)[number];

/** True when at least one light already in the scene had an output field changed. */
export function outputChanged(before: PatchedFixture[], after: PatchedFixture[]): boolean {
  const prev = new Map(before.map((f) => [f.uid, f]));
  for (const f of after) {
    const p = prev.get(f.uid);
    if (!p) continue; // freshly patched: not an attempt to control a light
    for (const k of OUTPUT_KEYS) {
      if (JSON.stringify(p[k] ?? null) !== JSON.stringify(f[k] ?? null)) return true;
    }
  }
  return false;
}
