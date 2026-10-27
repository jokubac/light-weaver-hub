// Keeps individually programmed pixels when an expanded pixel light is joined back into one light.
import { fixtureState, type PatchedFixture } from "./dmx";
import { lookStateOf } from "./playback";
import type { LookState } from "./store";

type RGB = [number, number, number];
const COLOUR_KEYS = ["cct", "gm", "hue", "saturation", "crossfade", "cctOnly", "fx", "fxPlaying", "gel", "fan"] as const;

/** Joined-light fields for split cells (sorted by pixel index). Identical cells give a plain light. */
export function joinCellState(cells: PatchedFixture[]): Partial<PatchedFixture> {
  const states = cells.map(lookStateOf);
  const same = states.every((s) => JSON.stringify(s) === JSON.stringify(states[0]));
  const first = cells[0]!;
  if (same) return { intensity: first.intensity, ...(first.on != null ? { on: first.on } : {}) };
  const lit = cells.map((c) => fixtureState(c, 0, 1));
  const max = Math.max(...lit.map((s) => s.v));
  const k = max > 0 ? 1 / max : 0;
  return {
    intensity: max > 0 ? Math.min(1, Math.max(...cells.map((c) => (c.on === false ? 0 : c.intensity)))) : first.intensity,
    ...(max > 0 ? { on: true } : first.on != null ? { on: first.on } : {}),
    pixelHold: lit.map((s) => s.rgb.map((x) => Math.round(x * s.v * k)) as RGB),
    pixelCells: states,
  };
}

/** Adds held pixels to the frame for joined lights that no pixel effect is painting. */
export function withPixelHold(frame: Map<string, RGB[]>, fixtures: PatchedFixture[]): Map<string, RGB[]> {
  if (!fixtures.some((f) => f.pixelHold && !frame.has(f.uid))) return frame;
  const out = new Map(frame);
  for (const f of fixtures) if (f.pixelHold && !out.has(f.uid)) out.set(f.uid, f.pixelHold);
  return out;
}

/** Changing the joined light's colour replaces the held pixel look. */
export function clearsPixelHold(patch: Partial<PatchedFixture>): boolean {
  return COLOUR_KEYS.some((k) => k in patch);
}
