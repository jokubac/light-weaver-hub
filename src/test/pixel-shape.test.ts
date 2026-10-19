import { describe, it, expect } from "vitest";
import { pixelShape, knownLayout } from "@/lib/pixel-layout";

describe("manufacturer pixel order", () => {
  it("SkyPanel S360 is 4 across, 3 rows", () => expect(knownLayout("SkyPanel S360-C", 12)).toEqual([4, 3]));
  it("Sumomax 19 px is a 3-4-5-4-3 honeycomb numbered row by row", () => {
    const s = pixelShape("SUMOMAX", 19)!;
    expect(s.cells).toHaveLength(19);
    expect(s.cells.slice(0, 3)).toEqual([[2, 0], [4, 0], [6, 0]]);
    expect(s.cells.slice(7, 12)).toEqual([[0, 2], [2, 2], [4, 2], [6, 2], [8, 2]]);
  });
});
