import { describe, expect, it } from "vitest";
import { aimGrid, aimTargets, moveOffset, panTiltFor, wrap180 } from "./aim";

const near = (v: number, e: number) => expect(v).toBeCloseTo(e, 4);

describe("panTiltFor", () => {
  it("points straight ahead at the light's own centre", () => {
    const r = panTiltFor({ x: 0, y: 0, h: 3, rot: 0 }, { x: 10, y: 0, z: 3 });
    near(r.pan, 0.5);
    near(r.tilt, 0.5);
  });

  it("turns a quarter of a 360° head for a target 90° off facing", () => {
    const r = panTiltFor({ x: 0, y: 0, h: 3, rot: 0 }, { x: 0, y: 10, z: 3 }, { panRange: 360, tiltRange: 180 });
    near(r.pan, 0.75);
  });

  it("keeps a light already facing its target centred", () => {
    const r = panTiltFor({ x: 0, y: 0, h: 3, rot: 90 }, { x: 0, y: 10, z: 3 }, { panRange: 360 });
    near(r.pan, 0.5);
  });

  it("tips the beam down toward a floor target", () => {
    // 3 m up, 10 m out: atan2(-3, 10) = -16.699° on a 270° tilt span.
    const r = panTiltFor({ x: 0, y: 0, h: 3, rot: 0 }, { x: 10, y: 0, z: 0 });
    near(r.tilt, 0.5 - 16.6989 / 270);
  });

  it("lifts the beam above the light's own height", () => {
    const r = panTiltFor({ x: 0, y: 0, h: 2, rot: 0 }, { x: 2, y: 0, z: 4 }, { tiltRange: 180 });
    near(r.tilt, 0.5 + 45 / 180);
  });

  it("clamps a target outside the head's travel instead of wrapping", () => {
    const r = panTiltFor({ x: 0, y: 0, h: 3, rot: 0 }, { x: -10, y: -3, z: 3 }, { panRange: 180 });
    expect(r.pan).toBe(0);
  });

  it("always takes the short way round", () => {
    near(wrap180(270), -90);
    near(wrap180(-270), 90);
    near(wrap180(180), -180);
  });
});

describe("aimGrid", () => {
  it("lays a 2×2 grid around the target in reading order", () => {
    const g = aimGrid({ x: 5, y: 4, z: 0 }, 2, 2, 2);
    expect(g.map((p) => [p.x, p.y])).toEqual([[4, 3], [6, 3], [4, 5], [6, 5]]);
  });

  it("stays centred when the row count is odd", () => {
    const g = aimGrid({ x: 0, y: 0, z: 1.7 }, 3, 1, 1.5);
    expect(g.map((p) => p.y)).toEqual([-1.5, 0, 1.5]);
    expect(g.every((p) => p.x === 0 && p.z === 1.7)).toBe(true);
  });

  it("turns the whole grid with the plot", () => {
    const g = aimGrid({ x: 0, y: 0, z: 0 }, 2, 2, 2, 90);
    near(g[0]!.x, 1);
    near(g[0]!.y, -1);
    near(g[0]!.z, 0);
  });
});

describe("moveOffset", () => {
  it("starts a circle at the top of its travel", () => {
    const [p, t] = moveOffset({ shape: "circle", rate: 1, size: 1 }, 0);
    near(p, 0);
    near(t, 0.5);
  });

  it("sweeps side to side without tipping", () => {
    expect(moveOffset({ shape: "sweep", rate: 1, size: 1 }, 0.25)[1]).toBe(0);
    near(moveOffset({ shape: "sweep", rate: 1, size: 1 }, 0.25)[0], 0.5);
  });

  it("never leaves half the head's travel", () => {
    for (const shape of ["circle", "figure8", "sweep", "random"] as const) {
      for (let k = 0; k < 40; k++) {
        const [p, t] = moveOffset({ shape, rate: 0.3, size: 1 }, k * 0.37);
        expect(Math.abs(p)).toBeLessThanOrEqual(0.5 + 1e-9);
        expect(Math.abs(t)).toBeLessThanOrEqual(0.5 + 1e-9);
      }
    }
  });

  it("is repeatable and drifts apart per light", () => {
    const a = moveOffset({ shape: "random", rate: 0.5, size: 0.8 }, 3.1, 12);
    const b = moveOffset({ shape: "random", rate: 0.5, size: 0.8 }, 3.1, 12);
    const c = moveOffset({ shape: "random", rate: 0.5, size: 0.8 }, 3.1, 77);
    expect(a).toEqual(b);
    expect(a[0]).not.toBeCloseTo(c[0], 3);
  });
});

describe("aimTargets", () => {
  const items = [
    { id: "t1", kind: "text", x: 2, y: 3, text: "Actor" },
    { id: "t2", kind: "text", x: 1, y: 1, text: "   " },
    { id: "f1", kind: "fixture", x: 4, y: 5, uid: "u1" },
    { id: "m1", kind: "macro", x: 0, y: 0 },
  ];
  it("names labels and placed lights, in metres", () => {
    const ts = aimTargets(items, (u) => (u === "u1" ? "Spot 1" : "?"), 0.5, 1.7);
    expect(ts).toEqual([
      { id: "t1", name: "Actor", x: 1, y: 1.5, z: 1.7 },
      { id: "f1", name: "Spot 1", x: 2, y: 2.5, z: 1.7 },
    ]);
  });
});
