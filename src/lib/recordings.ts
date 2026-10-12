// REC sequence timing and blending (browser-safe, pure).
import type { PatchedFixture } from "./dmx";
import type { LookState, RecStep, Recording } from "./store";

export const stepLength = (s: RecStep) => Math.max(0, s.fadeIn) + Math.max(0, s.hold) + Math.max(0, s.fadeOut);
export const recLength = (r: Recording) => r.steps.reduce((a, s) => a + stepLength(s), 0);

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const lerpHue = (a: number, b: number, k: number) => {
  let d = ((b - a) % 360 + 540) % 360 - 180;
  return (a + d * k + 360) % 360;
};

/** Blends two states; non-numeric fields switch at the halfway point. */
export function blend(a: LookState, b: LookState, k: number): LookState {
  const base = k < 0.5 ? a : b;
  return {
    ...base,
    intensity: lerp(a.on === false ? 0 : a.intensity, b.on === false ? 0 : b.intensity, k),
    on: true,
    cct: lerp(a.cct, b.cct, k),
    gm: lerp(a.gm, b.gm, k),
    hue: lerpHue(a.hue, b.hue, k),
    saturation: lerp(a.saturation, b.saturation, k),
    crossfade: lerp(a.crossfade ?? 0, b.crossfade ?? 0, k),
  };
}

const find = (s: RecStep, f: PatchedFixture) => s.states.find((x) => x.uid === f.uid) ?? s.states.find((x) => x.name === f.name);

/**
 * Fixture states at time t (seconds). `origin` is the look before the sequence started,
 * so step 1 fades in from what was on stage. Returns null when finished (non-looping).
 */
export function statesAt(rec: Recording, fixtures: PatchedFixture[], origin: Map<string, LookState>, t: number): { states: Map<string, LookState>; step: number } | null {
  const total = recLength(rec);
  if (!rec.steps.length) return null;
  if (total <= 0) return { states: new Map(), step: 0 };
  if (t >= total) { if (!rec.loop) return null; t = t % total; }
  let acc = 0;
  let i = 0;
  for (; i < rec.steps.length - 1; i++) { if (t < acc + stepLength(rec.steps[i]!)) break; acc += stepLength(rec.steps[i]!); }
  const step = rec.steps[i]!;
  const prev = i > 0 ? rec.steps[i - 1]! : null;
  const local = t - acc;
  const out = new Map<string, LookState>();
  for (const f of fixtures) {
    const target = find(step, f)?.state;
    if (!target) continue;
    const from = (prev ? find(prev, f)?.state : undefined) ?? origin.get(f.uid);
    // a previous step that faded out starts from darkness
    const start = prev && prev.fadeOut > 0 && from ? { ...from, intensity: 0 } : from ?? { ...target, intensity: 0 };
    let s: LookState;
    if (local < step.fadeIn && step.fadeIn > 0) s = blend(start, target, local / step.fadeIn);
    else if (local < step.fadeIn + step.hold) s = { ...target };
    else if (step.fadeOut > 0) s = { ...target, intensity: target.intensity * (1 - Math.min(1, (local - step.fadeIn - step.hold) / step.fadeOut)) };
    else s = { ...target };
    out.set(f.uid, s);
  }
  return { states: out, step: i };
}
