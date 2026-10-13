import { describe, it, expect } from "vitest";
import { recLength, stepStarts, statesAt, applyTweak, tweakPixels } from "@/lib/recordings";
import { defaultFx, type PatchedFixture } from "@/lib/dmx";
import type { LookState, Recording } from "@/lib/store";

const f = { uid: "u1", name: "F1" } as unknown as PatchedFixture;
const st = (intensity: number): LookState => ({ intensity, cct: 0.5, gm: 0.5, hue: 0, saturation: 0, crossfade: 0, on: true, fx: defaultFx() } as LookState);
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
  it("tweaks scale intensity, effect speed and pixel speed", () => {
    const s = applyTweak({ ...st(0.5), fx: { ...defaultFx(), rate: 2 } }, { intensity: 1.5, fxSpeed: 2 });
    expect(s.intensity).toBeCloseTo(0.75);
    expect(s.fx.rate).toBe(4);
    expect(tweakPixels([{ speed: 1 } as never], { pixelSpeed: 3 })[0]!.speed).toBe(3);
  });
});

import { mergeStates, fxTime } from "@/lib/dmx";
describe("overlap colour merge and speed ramp", () => {
  it("red 50% + blue 50% on the colour wheel is green at full level", () => {
    const m = mergeStates({ v: 0.5, rgb: [255, 0, 0] }, { v: 0.5, rgb: [0, 0, 255] });
    expect(m.v).toBe(1);
    expect(m.rgb[1]).toBeGreaterThan(200);
    expect(m.rgb[0]).toBeLessThan(30);
  });
  it("light mix of red and blue is magenta", () => {
    const m = mergeStates({ v: 0.5, rgb: [255, 0, 0] }, { v: 0.5, rgb: [0, 0, 255] }, "add");
    expect(m.rgb[0]).toBeCloseTo(127.5); expect(m.rgb[2]).toBeCloseTo(127.5);
  });
  it("overlapping cue carries the outgoing cue as a mix", () => {
    const r = statesAt(rec(2), [f], new Map(), 3)!;
    const s = r.states.get(f.uid)!;
    expect(s.intensity).toBeCloseTo(0); // incoming target is 0 here
    expect(s.mix?.from.intensity).toBeCloseTo(0.5);
  });
  it("ramp 1→3 Hz over 2s advances 4 cycles per 2s leg (no jumps)", () => {
    const fx = { ...defaultFx(), rate: 1, rampTo: 3, rampTime: 2 };
    expect(fxTime(fx, 2) * fx.rate).toBeCloseTo(4);
    expect(fxTime(fx, 4) * fx.rate).toBeCloseTo(8);
  });
});

import { mixFrames } from "@/lib/recordings";
describe("pixel overlap", () => {
  it("red and blue pixels at 50/50 merge to green at full level", () => {
    const m = mixFrames(new Map([["u", [[255, 0, 0]]]]), new Map([["u", [[0, 0, 255]]]]), 0.5);
    const [r, g, b] = m.get("u")![0]!;
    expect(g).toBeGreaterThan(200); expect(r).toBeLessThan(30); expect(b).toBeLessThan(30);
  });
});
