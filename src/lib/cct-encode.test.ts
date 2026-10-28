import { describe, it, expect } from "vitest";
import { cctToFixture } from "./output";
describe("cctToFixture", () => {
  it("3200 K on a 2700–6500 K light", () => expect(cctToFixture(3200, [2700, 6500])).toBeCloseTo(500 / 3800));
  it("5600 K without range uses 2000–10000 K", () => expect(cctToFixture(5600)).toBeCloseTo(0.45));
  it("clamps above the light's maximum", () => expect(cctToFixture(10000, [2700, 6500])).toBe(1));
});
import { getDef } from "./dmx";
describe("Astera CCT", () => {
  it("Titan uses 1750–20000 K", () => expect(getDef("astera-titan-tube").cctRange).toEqual([1750, 20000]));
  it("10000 K on Titan is ~45%", () => expect(cctToFixture(10000, [1750, 20000])).toBeCloseTo(8250 / 18250));
});
