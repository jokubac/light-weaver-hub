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
