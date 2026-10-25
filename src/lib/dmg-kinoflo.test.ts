import { describe, expect, it } from "vitest";
import { DMG_FIXTURES, DMG_MODES } from "./dmg";
import { KINOFLO_FIXTURES, KINOFLO_TM5_MODES } from "./kinoflo";

describe("DMG DMX Profiles (Nov 2022)", () => {
  it("every mode matches the chart's channel count", () => {
    const chart = [3, 4, 7, 16, 20, 12, 22, 6, 8, 14, 31, 39, 23, 43, 23, 41, 7, 45, 81, 14];
    chart.forEach((n, i) => expect(DMG_MODES[i + 1]!.channels, `mode ${i + 1}`).toBe(n));
  });
  it("MAXI has all 20 modes, SL1/MINI the 10 the chart allows", () => {
    expect(DMG_FIXTURES.find((f) => f.model === "Rosco DMG MAXI")!.modes).toHaveLength(20);
    expect(DMG_FIXTURES.find((f) => f.model === "MINIMIX")!.modes).toHaveLength(10);
  });
});

describe("Kino Flo True Match 5.0 personalities", () => {
  it("P1–P29 match the RDM personality footprints", () => {
    const chart = [3, 6, 6, 8, 3, 4, 7, 7, 9, 4, 3, 5, 3, 5, 4, 8, 5, 10, 3, 6, 8, 10, 7, 13, 8, 15, 6, 12, 9];
    expect(KINOFLO_TM5_MODES.map((m) => m.channels)).toEqual(chart);
  });
  it("FreeStyle Air keeps its old first modes (P3, P8, P25, P26)", () => {
    const air = KINOFLO_FIXTURES[0]!.modes.slice(0, 4).map((m) => m.name.split(" ")[0]);
    expect(air).toEqual(["P3", "P8", "P25", "P26"]);
  });
});
