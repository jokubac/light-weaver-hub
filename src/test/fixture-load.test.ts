import { describe, expect, it } from "vitest";
import { normalizeFixture } from "@/lib/dmx";

/** A saved project is read back through normalizeFixture; anything it forgets is lost for good. */
describe("Lights loaded from a saved project", () => {
  it("keeps the pixel map position", () => {
    const f = normalizeFixture({ uid: "a", name: "Titan", universe: 1, address: 1, pixelPos: { x: 3, y: 7, r: 90 } });
    expect(f.pixelPos).toEqual({ x: 3, y: 7, r: 90 });
  });

  it("keeps the battery and moving-head values", () => {
    const power = { kind: "vmount" as const, kwh: 0.9, charge: 0.5, watts: 100, usedWh: 10 };
    const f = normalizeFixture({ uid: "b", name: "Spot", universe: 1, address: 1, power, beam: { pan: 0.25, tilt: 0.5 } });
    expect(f.power).toEqual(power);
    expect(f.beam).toEqual({ pan: 0.25, tilt: 0.5 });
  });

  it("still drops the trigger so lights do not fire on load", () => {
    const f = normalizeFixture({ uid: "c", name: "Plain", universe: 1, address: 1, trigger: { kind: "flash", at: 5 } });
    expect(f.trigger).toBeNull();
  });
});
