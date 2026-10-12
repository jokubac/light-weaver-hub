import { describe, expect, it } from "vitest";
import { cameraBasis, cameraViewEdges, defaultCamera, exposureGain, horizontalFov, projectCameraSpace } from "@/lib/plot-camera";

describe("plot camera", () => {
  it("projects camera-up above centre and camera-right to the right", () => {
    expect(projectCameraSpace([0, 1, 5], 400, 225, 200)).toEqual([200, 72.5, 5]);
    expect(projectCameraSpace([1, 0, 5], 400, 225, 200)).toEqual([240, 112.5, 5]);
  });
  it("tilts the plotted field of view down from camera height on elevated floors", () => {
    const cam = { ...defaultCamera(2, 3, 1), h: 2, rot: -90, tilt: 30 };
    const edges = cameraViewEdges(cam, 4);
    expect(edges.left[2]).toBeCloseTo(0);
    expect(edges.right[2]).toBeCloseTo(0);
    expect(edges.left[1]).toBeCloseTo(3 - 4 * Math.cos(Math.PI / 6));
    expect(edges.left[0]).toBeGreaterThan(2);
    expect(edges.right[0]).toBeLessThan(2);
  });
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
