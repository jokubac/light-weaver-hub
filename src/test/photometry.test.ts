import { describe, expect, it } from "vitest";
import { lux3m, wattFallbackLux3m, illuminanceAt, footcandles, shutterSeconds, tStopFor, roundToThirdStop, stopsDifference } from "@/lib/photometry";
import { wallSegments } from "@/lib/plot-geometry";

describe("lux3m lookup", () => {
  it("matches known fixture models by name", () => {
    expect(lux3m("ARRI SkyPanel S60", 450, 110)).toBe(2050);
    expect(lux3m("Aputure LS 1200d", 1200, 15)).toBe(12000);
    expect(lux3m("Astera Titan Tube", 50, 180)).toBe(280);
  });
  it("prefers an explicit per-fixture override", () => {
    expect(lux3m("ARRI SkyPanel S60", 450, 110, 999)).toBe(999);
    expect(lux3m("ARRI SkyPanel S60", 450, 110, 0)).toBe(2050); // zero/invalid override ignored
  });
  it("falls back to a watt/beam estimate for unlisted models", () => {
    const narrow = wattFallbackLux3m(100, 10);
    const wide = wattFallbackLux3m(100, 100);
    expect(narrow).toBeGreaterThan(wide); // same wattage, narrower beam = more concentrated
    expect(lux3m("Some Unknown Fixture 100W", 100, 10)).toBe(narrow);
  });
});

describe("illuminanceAt", () => {
  const light = { x: 0, y: 0, z: 3, rot: 0, tilt: 0, beam: 90, lux3m: 1000, level: 1 };
  it("matches the lux3m reference straight down at 3 m", () => {
    expect(illuminanceAt([0, 0, 0], [light], [], [])).toBeCloseTo(1000, 0);
  });
  it("falls off with inverse square distance", () => {
    const near = illuminanceAt([0, 0, 1], [{ ...light, z: 4 }], [], []); // 3m away
    const far = illuminanceAt([0, 0, 1], [{ ...light, z: 7 }], [], []); // 6m away
    expect(near / far).toBeCloseTo(4, 0);
  });
  it("is zero outside the beam angle", () => {
    const narrow = { ...light, beam: 10 };
    expect(illuminanceAt([5, 0, 0], [narrow], [], [])).toBe(0);
  });
  it("is zero when a wall blocks the light", () => {
    const walls = wallSegments([{ pts: [[0, -1], [0, 1]] }], 0);
    const lightAt = { ...light, x: -2, y: 0, z: 1, tilt: 90 };
    expect(illuminanceAt([2, 0, 0], [lightAt], walls, [])).toBe(0);
  });
  it("sums multiple lights and respects level/off", () => {
    const a = illuminanceAt([0, 0, 0], [light], [], []);
    const both = illuminanceAt([0, 0, 0], [light, { ...light, level: 0 }], [], []);
    const doubled = illuminanceAt([0, 0, 0], [light, light], [], []);
    expect(both).toBeCloseTo(a, 0);
    expect(doubled).toBeCloseTo(a * 2, 0);
  });
});

describe("footcandles", () => {
  it("converts lux to footcandles", () => expect(footcandles(10.764)).toBeCloseTo(1, 3));
});

describe("exposure / T-stop", () => {
  it("computes shutter time from fps & shutter angle, default 24fps/180°", () => {
    expect(shutterSeconds()).toBeCloseTo(1 / 48, 5);
    expect(shutterSeconds(25, 180)).toBeCloseTo(1 / 50, 5);
    expect(shutterSeconds(24, 360)).toBeCloseTo(1 / 24, 5);
  });
  it("computes a sane T-stop at a typical daylight-ish exposure", () => {
    const t = tStopFor(1000, 800, 1 / 48);
    expect(t).toBeGreaterThan(3.5);
    expect(t).toBeLessThan(6);
  });
  it("rounds to the nearest third stop with a readable label", () => {
    expect(roundToThirdStop(2.8).label).toBe("T2.8");
    expect(roundToThirdStop(2.8 * Math.pow(2, 1 / 6)).label).toContain("+1/3");
    expect(roundToThirdStop(0).label).toBe("—");
  });
  it("reports stops over/under between metered T and camera iris", () => {
    expect(stopsDifference(2.8, 2.8)).toBeCloseTo(0, 5);
    expect(stopsDifference(2.8, 5.6)).toBeCloseTo(2, 5); // one stop open-up in iris terms (f/5.6 = 2 T-stops over f/2.8's light)
    expect(stopsDifference(5.6, 2.8)).toBeCloseTo(-2, 5);
  });
});
