import { cctFromKelvin, cctRangeOf, kelvin, type PatchedFixture } from "./dmx";
import type { CommandResult } from "./command-line";

/** Relative values apply independently to every selected fixture. */
export function commandPatch(f: PatchedFixture, command: CommandResult): Partial<PatchedFixture> {
  const patch: Partial<PatchedFixture> = {};
  if (command.level != null || command.levelDelta != null) {
    patch.intensity = Math.max(0, Math.min(1, command.levelDelta != null ? f.intensity + command.levelDelta : command.level ?? f.intensity));
    patch.on = true;
  }
  if (command.cct != null || command.cctDelta != null) {
    // every light moves inside its own kelvin span (a Titan reaches 1750 K, a Vortex 2200 K)
    const range = cctRangeOf(f);
    const target = command.cctDelta != null ? kelvin(f.cct, range) + command.cctDelta : command.cct ?? kelvin(f.cct, range);
    patch.cct = cctFromKelvin(target, range);
    patch.crossfade = 0;
    patch.saturation = 0;
  }
  return patch;
}

/** Fade to opposite output in 0.5 s and return in 0.5 s without changing programming. */
export function inverseFlash(f: PatchedFixture, elapsed: number, base: number, target: number): PatchedFixture {
  if (elapsed < 0 || elapsed >= 1) return f;
  const envelope = elapsed < 0.5 ? elapsed / 0.5 : (1 - elapsed) / 0.5;
  return { ...f, on: true, fxPlaying: false, trigger: null, intensity: base + (target - base) * envelope };
}
