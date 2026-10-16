import { describe, expect, it } from "vitest";
import { pixelLayout } from "./pixel-layout";
describe("pixelLayout", () => {
  it("SkyPanel S360-C 12 px is 6 wide × 2 tall", () => expect(pixelLayout("SkyPanel S360C", "", 12)).toEqual([6, 2]));
  it("SkyPanel S60-C 2 px side by side", () => expect(pixelLayout("SkyPanel S60C", "", 2)).toEqual([2, 1]));
  it("bars stay one row", () => expect(pixelLayout("ACME DOTLINE360", "", 12)).toEqual([12, 1]));
  it("5x5 in the mode name", () => expect(pixelLayout("Some Matrix", "Pixel 5x5", 25)).toEqual([5, 5]));
  it("unknown odd count stays unset", () => expect(pixelLayout("MAC Aura", "", 19)).toBeUndefined());
});
