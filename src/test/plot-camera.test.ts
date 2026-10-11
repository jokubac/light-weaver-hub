import { describe, expect, it } from "vitest";
import { defaultCamera, exposureGain, horizontalFov } from "@/lib/plot-camera";

describe("plot camera", () => {
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
