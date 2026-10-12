import { describe, expect, it } from "vitest";
import { parseCommand } from "@/lib/command-line";
import { commandPatch, inverseFlash } from "@/lib/console-command";
import { createFixture, getDef, cctFromKelvin, kelvin } from "@/lib/dmx";

describe("parseCommand", () => {
  it("adds lights and sets a level", () => expect(parseCommand("1 + 3 + 5 @ 80", 10)).toEqual({ select: [1, 3, 5], level: 0.8 }));
  it("handles THRU, minus and FULL", () => expect(parseCommand("1 THRU 6 - 4 @ FULL", 10)).toEqual({ select: [1, 2, 3, 5, 6], level: 1 }));
  it("levels the current selection", () => expect(parseCommand("@ 50", 10)).toEqual({ level: 0.5 }));
  it("selects only", () => expect(parseCommand("2 thru 4", 10)).toEqual({ select: [2, 3, 4] }));
  it("ignores lights that don't exist", () => expect(parseCommand("9 THRU 20", 10).select).toEqual([9, 10]));
  it("reports errors", () => expect(parseCommand("50", 10).error).toBeTruthy());
  it("supports independent relative levels and temperatures", () => {
    expect(parseCommand("2 + 4 @ +10 CCT -200", 10)).toEqual({ select: [2, 4], levelDelta: .1, cctDelta: -200 });
    expect(parseCommand("@ -5%", 10)).toEqual({ levelDelta: -.05 });
    expect(parseCommand("CCT +500", 10)).toEqual({ cctDelta: 500 });
    const f = { ...createFixture(getDef("astera-titan-tube"), 0, 1, 1, "Test"), intensity: .4, cct: cctFromKelvin(5000) };
    const patch = commandPatch(f, parseCommand("@ +10 CCT -200", 10));
    expect(patch.intensity).toBeCloseTo(.5);
    expect(kelvin(patch.cct ?? 0)).toBe(4800);
    expect(commandPatch({ ...f, intensity: .98, cct: 1 }, { levelDelta: .1, cctDelta: 500 })).toMatchObject({ intensity: 1, cct: 1 });
    expect(parseCommand("CCT 5000 + 20", 10).error).toBeTruthy();
  });
  it("inverts FLASH and returns to unchanged programming", () => {
    const f = { ...createFixture(getDef("astera-titan-tube"), 0, 1, 1, "Test"), intensity: .7, on: true };
    expect(inverseFlash(f, .25, .7, 0).intensity).toBeCloseTo(.35);
    expect(inverseFlash(f, .5, .7, 0).intensity).toBe(0);
    expect(inverseFlash(f, .75, .7, 0).intensity).toBeCloseTo(.35);
    expect(inverseFlash(f, 1, .7, 0)).toBe(f);
    expect(inverseFlash({ ...f, on: false }, .5, 0, 1)).toMatchObject({ intensity: 1, on: true });
  });
});
