import { describe, it, expect } from "vitest";
import { recLength, stepStarts, statesAt, applyTweak, tweakPixels } from "@/lib/recordings";
import { snapshot } from "@/components/console/LooksPanel";
import { createFixture } from "./rec-helpers";
import type { Recording } from "@/lib/store";

const f = createFixture();
const st = (intensity: number) => ({ ...snapshot(f), intensity });
const rec = (overlap?: number): Recording => ({ id: "r", name: "r", createdAt: 0, steps: [
  { id: "a", name: "A", fadeIn: 0, hold: 4, fadeOut: 0, states: [{ uid: f.uid, name: f.name, state: st(1) }] },
  { id: "b", name: "B", fadeIn: 2, hold: 2, fadeOut: 0, overlap, states: [{ uid: f.uid, name: f.name, state: st(0) }] },
] });

describe("REC overlap", () => {
  it("overlap of 2s starts the second cue 2s early", () => {
    expect(stepStarts(rec(2))).toEqual([0, 2]);
    expect(recLength(rec(2))).toBe(6);
    expect(recLength(rec())).toBe(8);
  });
  it("overlapping cue dissolves from the still-running cue", () => {
    const r = statesAt(rec(2), [f], new Map(), 3)!;
    expect(r.step).toBe(1);
    expect(r.states.get(f.uid)!.intensity).toBeCloseTo(0.5);
  });
  it("tweaks scale intensity, effect speed and pixel speed", () => {
    const s = applyTweak({ ...st(0.5), fx: { ...snapshot(f).fx, rate: 2 } }, { intensity: 1.5, fxSpeed: 2 });
    expect(s.intensity).toBeCloseTo(0.75);
    expect(s.fx.rate).toBe(4);
    expect(tweakPixels([{ speed: 1 } as never], { pixelSpeed: 3 })[0]!.speed).toBe(3);
  });
});
