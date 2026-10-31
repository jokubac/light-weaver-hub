import { describe, expect, it } from "vitest";
import { addCustomFixture } from "./custom-fixtures";
import { normalizeFixture } from "./dmx";
import { buildUniverses } from "./output";

addCustomFixture({
  id: "test-whole-pixel-rgb", brand: "Test", model: "Pixel tube",
  modes: [{ name: "4 cells", channels: 12, kind: "rgb", pixels: 4 }],
});
addCustomFixture({
  id: "test-whole-pixel-rgbw", brand: "Test", model: "Pixel RGBW tube",
  modes: [{ name: "4 cells", channels: 16, kind: "rgbw", pixels: 4 }],
});

const light = (defId = "test-whole-pixel-rgb") => normalizeFixture({
  uid: "tube", defId, name: "Tube", universe: 1, address: 7,
  intensity: 0.5, on: true, hue: 0, saturation: 1, crossfade: 1, cctOnly: false,
});

describe("ordinary settings control the whole pixel fixture", () => {
  it("sends intensity and colour to all four RGB cells without a pixel effect", () => {
    const output = buildUniverses([light()], 0, 1, new Map()).get(1);
    expect(Array.from(output?.slice(6, 18) ?? [])).toEqual(Array(4).fill([128, 0, 0]).flat());
    expect(output?.[5]).toBe(0);
    expect(output?.[18]).toBe(0);
  });

  it("sends a CCT white setting to all four RGBW cells", () => {
    const f = { ...light("test-whole-pixel-rgbw"), saturation: 0, crossfade: 0 };
    const output = buildUniverses([f], 0, 1, new Map()).get(1);
    const cells = Array.from({ length: 4 }, (_, i) => Array.from(output?.slice(6 + i * 4, 10 + i * 4) ?? []));
    expect(cells[0]?.[3]).toBeGreaterThan(0);
    expect(cells).toEqual(Array(4).fill(cells[0]));
  });

  it("blackout through fixture intensity darkens every cell", () => {
    const output = buildUniverses([{ ...light(), intensity: 0 }], 0, 1, new Map()).get(1);
    expect(Array.from(output?.slice(6, 18) ?? [])).toEqual(Array(12).fill(0));
  });

  it("keeps explicitly programmed pixel colours distinct", () => {
    const frame = new Map<string, [number, number, number][]>([["tube", [[255, 0, 0], [0, 255, 0], [0, 0, 255], [0, 0, 0]]]]);
    const output = buildUniverses([light()], 0, 1, frame).get(1);
    expect(Array.from(output?.slice(6, 18) ?? [])).toEqual([128, 0, 0, 0, 128, 0, 0, 0, 128, 0, 0, 0]);
  });
});