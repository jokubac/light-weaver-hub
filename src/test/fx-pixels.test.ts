import { describe, it, expect } from "vitest";
import { fxPixels } from "@/lib/output";
import { defaultFx, type PatchedFixture } from "@/lib/dmx";
const f = (kind: string, playing = true) => ({ intensity: 1, on: true, fx: { ...defaultFx(), kind }, fxPlaying: playing }) as unknown as PatchedFixture;
describe("fixture effect on pixel layer", () => {
  it("pulse at 50% halves pixel fire brightness", () => {
    expect(fxPixels([[200, 100, 0]], f("pulse"), 0.5, 1)![0]).toEqual([100, 50, 0]);
  });
  it("no effect leaves pixels unchanged", () => {
    expect(fxPixels([[200, 100, 0]], f("none"), 0.5, 1)![0]).toEqual([200, 100, 0]);
    expect(fxPixels([[200, 100, 0]], f("pulse", false), 0.5, 1)![0]).toEqual([200, 100, 0]);
  });
});
