import { describe, expect, it } from "vitest";
import { endFromHandle, endsFromRotation, rotationFromEnds } from "@/components/console/FramingPad";

describe("framing pad corner cuts", () => {
  it("straight blade at rotation 0.5 has equal ends", () => {
    const e = endsFromRotation(0.3, 0.5);
    expect(e.a).toBeCloseTo(0.3);
    expect(e.b).toBeCloseTo(0.3);
  });
  it("one end deeper than the other tilts the blade (cuts a corner)", () => {
    const { ins, rot } = rotationFromEnds(0, 0.6);
    expect(ins).toBeCloseTo(0.3);
    expect(rot).toBeGreaterThan(0.5);
    const back = endsFromRotation(ins, rot);
    expect(back.a).toBeCloseTo(0);
    expect(back.b).toBeCloseTo(0.6);
  });
  it("handle drag keeps the other end fixed and hits the pointer depth", () => {
    const a = endFromHandle(0.5, 0);
    expect(a * 0.85 + 0 * 0.15).toBeCloseTo(0.5);
  });
});

import { blend } from "@/lib/recordings";
describe("REC framing glide", () => {
  const base = { intensity: 1, cct: 0.5, gm: 0, hue: 0, saturation: 0, on: true } as never;
  it("blades glide halfway instead of jumping", () => {
    const s = blend({ ...(base as object), beam: { Blade1A: 0 } } as never, { ...(base as object), beam: { Blade1A: 0.8 } } as never, 0.5);
    expect(s.beam!.Blade1A).toBeCloseTo(0.4);
  });
  it("a blade only one cue sets glides back to open", () => {
    const s = blend({ ...(base as object), beam: { Blade2B: 0.6 } } as never, { ...(base as object) } as never, 0.25);
    expect(s.beam!.Blade2B).toBeCloseTo(0.45);
  });
});
