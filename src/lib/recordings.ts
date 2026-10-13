// REC sequence timing and blending (browser-safe, pure).
import type { PatchedFixture } from "./dmx";
import type { PixelLayer } from "./pixels";
import type { LookState, RecStep, Recording, StepTweak } from "./store";

export const stepLength = (s: RecStep) => Math.max(0, s.fadeIn) + Math.max(0, s.hold) + Math.max(0, s.fadeOut);

/** Start time of every step; a step's overlap pulls it earlier over the previous one, like stacked clips. */
export function stepStarts(rec: Recording): number[] {
  const out: number[] = [];
  let end = 0;
  rec.steps.forEach((s, i) => {
    const prev = i > 0 ? rec.steps[i - 1]! : null;
    const ov = prev ? Math.min(Math.max(0, s.overlap ?? 0), stepLength(prev)) : 0;
    const start = Math.max(0, end - ov);
    out.push(start);
    end = start + stepLength(s);
  });
  return out;
}

export const recLength = (r: Recording) => {
  const st = stepStarts(r);
  return r.steps.reduce((a, s, i) => Math.max(a, st[i]! + stepLength(s)), 0);
};

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const lerpHue = (a: number, b: number, k: number) => {
  let d = ((b - a) % 360 + 540) % 360 - 180;
  return (a + d * k + 360) % 360;
};
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

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

/** Applies a cue's playback corrections to one recorded state. */
export function applyTweak(s: LookState, t?: StepTweak): LookState {
  if (!t) return s;
  const out: LookState = { ...s, intensity: clamp01(s.intensity * (t.intensity ?? 1)), cct: clamp01(s.cct + (t.cct ?? 0)) };
  if (s.fx && (t.fxSpeed != null || t.fxSize != null)) {
    const size = t.fxSize ?? 1;
    const mid = s.fx.max;
    out.fx = { ...s.fx, rate: s.fx.rate * (t.fxSpeed ?? 1), min: clamp01(mid - (s.fx.max - s.fx.min) * size), max: s.fx.max };
  }
  return out;
}

/** Pixel layers of a cue with its pixel-speed correction applied. */
export function tweakPixels(layers: PixelLayer[], t?: StepTweak): PixelLayer[] {
  const k = t?.pixelSpeed ?? 1;
  return k === 1 ? layers : layers.map((l) => ({ ...l, speed: l.speed * k }));
}

const find = (s: RecStep, f: PatchedFixture) => s.states.find((x) => x.uid === f.uid) ?? s.states.find((x) => x.name === f.name);

/** One step's own envelope at local time; `from` is what it fades in from. */
function stepState(step: RecStep, target: LookState, from: LookState, local: number): LookState {
  if (local < step.fadeIn && step.fadeIn > 0) return blend(from, target, local / step.fadeIn);
  if (local < step.fadeIn + step.hold || step.fadeOut <= 0) return { ...target };
  return { ...target, intensity: target.intensity * (1 - Math.min(1, (local - step.fadeIn - step.hold) / step.fadeOut)) };
}

/**
 * Fixture states at time t (seconds). `origin` is the look before the sequence started,
 * so step 1 fades in from what was on stage. Overlapping cues dissolve into each other.
 * Returns null when finished (non-looping).
 */
export function statesAt(rec: Recording, fixtures: PatchedFixture[], origin: Map<string, LookState>, t: number): { states: Map<string, LookState>; step: number } | null {
  const total = recLength(rec);
  if (!rec.steps.length) return null;
  if (total <= 0) return { states: new Map(), step: 0 };
  if (t >= total) { if (!rec.loop) return null; t = t % total; }
  const starts = stepStarts(rec);
  let i = 0;
  for (let j = 0; j < rec.steps.length; j++) if (starts[j]! <= t) i = j;
  const out = new Map<string, LookState>();
  // state of a fixture produced by step k at time t (recursive through earlier steps)
  const at = (k: number, f: PatchedFixture): LookState | undefined => {
    const step = rec.steps[k]!;
    const rec0 = find(step, f)?.state;
    if (!rec0) return k > 0 ? at(k - 1, f) : origin.get(f.uid);
    const target = applyTweak(rec0, step.tweak);
    const local = Math.min(t - starts[k]!, stepLength(step));
    const before = k > 0 ? at(k - 1, f) : origin.get(f.uid);
    return stepState(step, target, before ?? { ...target, intensity: 0 }, local);
  };
  for (const f of fixtures) {
    if (!find(rec.steps[i]!, f)) continue;
    const s = at(i, f);
    if (s) out.set(f.uid, s);
  }
  return { states: out, step: i };
}
