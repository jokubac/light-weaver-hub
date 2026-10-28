import { describe, expect, it } from "vitest";
import { cctFromKelvin, cctRangeOf, createFixture, getDef, kelvin } from "@/lib/dmx";
import { commandPatch } from "@/lib/console-command";

const vortex = () => createFixture(getDef("creamsource-vortex4"), 0, 1, 1, "Vortex");
const titan = () => createFixture(getDef("astera-titan-tube"), 0, 1, 1, "Titan");

describe("each light keeps its own kelvin span", () => {
  it("a Vortex stops at its own 2200 K floor instead of 2000 K", () => {
    const f = vortex();
    expect(cctRangeOf(f)).toEqual([2200, 15000]);
    expect(commandPatch(f, { cct: 2200 }).cct).toBe(0);
    expect(commandPatch(f, { cct: 2000 }).cct).toBe(0);
    expect(kelvin(commandPatch(f, { cct: 2200 }).cct ?? 0, cctRangeOf(f))).toBe(2200);
  });

  it("a Vortex can be driven all the way up to 15000 K", () => {
    const f = vortex();
    expect(commandPatch(f, { cct: 15000 }).cct).toBe(1);
    expect(kelvin(commandPatch(f, { cct: 15000 }).cct ?? 0, cctRangeOf(f))).toBe(15000);
  });

  it("a Titan reaches 1750 K and 20000 K, not 2000 K and 10000 K", () => {
    const f = titan();
    expect(cctRangeOf(f)).toEqual([1750, 20000]);
    expect(kelvin(0, cctRangeOf(f))).toBe(1750);
    expect(kelvin(1, cctRangeOf(f))).toBe(20000);
    expect(commandPatch(f, { cct: 1750 }).cct).toBe(0);
    expect(commandPatch(f, { cct: 20000 }).cct).toBe(1);
  });

  it("a new light starts at 5600 K on its own span", () => {
    expect(kelvin(vortex().cct, cctRangeOf(vortex()))).toBe(5600);
    expect(kelvin(titan().cct, cctRangeOf(titan()))).toBe(5600);
  });

  it("relative kelvin moves stay inside the light's span", () => {
    const cold = { ...titan(), cct: 0 };
    expect(commandPatch(cold, { cctDelta: -200 }).cct).toBe(0);
    expect(commandPatch(cold, { cctDelta: 200 }).cct).toBeCloseTo(200 / 18250);
    const hot = { ...vortex(), cct: 1 };
    expect(commandPatch(hot, { cctDelta: 500 }).cct).toBe(1);
  });

  it("a light with no declared span keeps the console's 2000–10000 K scale", () => {
    const f = createFixture(getDef("sgb-avery-p408"), 0, 1, 1, "Para");
    expect(cctRangeOf(f)).toEqual([2000, 10000]);
    expect(commandPatch(f, { cct: 3200 }).cct).toBeCloseTo(cctFromKelvin(3200));
    expect(kelvin(commandPatch(f, { cct: 3200 }).cct ?? 0)).toBe(3200);
  });
});
