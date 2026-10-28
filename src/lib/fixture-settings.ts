import type { PatchedFixture } from "./dmx";

/** Deliberate whitelist: never copy identity, DMX patch, grouping or battery state. */
export function copyFixtureSettings(f: PatchedFixture) {
  return structuredClone({
    intensity: f.intensity, on: f.on !== false, cct: f.cct, gm: f.gm,
    hue: f.hue, saturation: f.saturation, crossfade: f.crossfade,
    cctOnly: f.cctOnly, gel: f.gel ?? "", fan: f.fan ?? "auto",
    fx: f.fx, fxPlaying: f.fxPlaying !== false, beam: f.beam ?? {}, move: f.move ?? undefined,
  });
}
export type FixtureSettings = ReturnType<typeof copyFixtureSettings>;