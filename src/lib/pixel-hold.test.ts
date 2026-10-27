import { describe, it, expect } from "vitest";
import { normalizeFixture, type PatchedFixture } from "./dmx";
import { joinCellState, withPixelHold } from "./pixel-hold";

const cell = (i: number, intensity: number): PatchedFixture =>
  ({ ...normalizeFixture({ uid: `c${i}`, defId: "astera-titan-tube", modeIndex: 0, universe: 1, address: 1 + i * 3, name: `T px${i + 1}` } as PatchedFixture), intensity, on: true, fxPlaying: false });

describe("joining split pixels", () => {
  it("every other pixel lit stays every other pixel lit after joining", () => {
    const j = joinCellState([cell(0, 1), cell(1, 0), cell(2, 1), cell(3, 0)]);
    const lit = j.pixelHold!.map((c) => Math.max(...c) > 0);
    expect(lit).toEqual([true, false, true, false]);
    expect(j.pixelCells).toHaveLength(4);
  });
  it("identical pixels join into a plain light", () => {
    expect(joinCellState([cell(0, 0.5), cell(1, 0.5)]).pixelHold).toBeUndefined();
  });
  it("held pixels feed the output unless a pixel effect paints the light", () => {
    const f = { uid: "j", pixelHold: [[255, 0, 0]] } as unknown as PatchedFixture;
    expect(withPixelHold(new Map(), [f]).get("j")).toEqual([[255, 0, 0]]);
    expect(withPixelHold(new Map([["j", [[0, 0, 9]]]]), [f]).get("j")).toEqual([[0, 0, 9]]);
  });
});
