import { describe, expect, it } from "vitest";
import { cameraBasis, defaultCamera, exposureGain, horizontalFov } from "@/lib/plot-camera";

describe("plot camera", () => {
  it("keeps world-up above the horizon for every yaw, including straight-down views", () => {
    for (const rot of [-180, -90, 0, 90, 180]) {
      for (const tilt of [-45, 0, 5, 45, 90]) {
        const { forward, right, up } = cameraBasis({ rot, tilt });
        const dot = (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * (b[i] ?? 0), 0);
        expect(up[2]).toBeGreaterThanOrEqual(0);
        expect(dot(up, forward)).toBeCloseTo(0);
        expect(dot(right, forward)).toBeCloseTo(0);
        expect(dot(right, right)).toBeCloseTo(1);
        expect(dot(up, up)).toBeCloseTo(1);
      }
    }
  });
  it("longer lenses narrow the view", () => {
    const c = defaultCamera(0, 0);
    expect(horizontalFov({ ...c, lens: 85 })).toBeLessThan(horizontalFov({ ...c, lens: 24 }));
  });
  it("one stop closed halves exposure, doubling ISO restores it", () => {
    const c = defaultCamera(0, 0);
    const base = exposureGain({ ...c, fstop: 2.8, iso: 800 });
    expect(exposureGain({ ...c, fstop: 4, iso: 800 })).toBeCloseTo(base / 2.04, 3);
    expect(exposureGain({ ...c, fstop: 4, iso: 1600 })).toBeCloseTo(base * 2 / 2.04, 3);
  });
});
