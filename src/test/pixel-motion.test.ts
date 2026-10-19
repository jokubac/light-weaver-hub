import { describe, expect, it } from "vitest";
import { defaultLayer, layerAt } from "@/lib/pixels";

describe("pixel effect motion", () => {
  it("recorded move loops and interpolates the box position", () => {
    const l = { ...defaultLayer(), area: { x: 0, y: 0, w: 10, h: 5 }, motion: [{ t: 0, x: 0, y: 0, a: 0 }, { t: 2, x: 20, y: 10, a: 90 }], motionLen: 2 };
    expect(layerAt(l, 1).area).toEqual({ x: 10, y: 5, w: 10, h: 5 });
    expect(layerAt(l, 3).angle).toBe(45);
  });
  it("spin adds degrees per second", () => {
    expect(layerAt({ ...defaultLayer(), angle: 10, spin: 30 }, 2).angle).toBe(70);
  });
});
