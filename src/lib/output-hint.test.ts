import { describe, expect, it } from "vitest";
import { outputChanged } from "./output-hint";
import type { PatchedFixture } from "./dmx";

const light = (over: Partial<PatchedFixture> = {}): PatchedFixture =>
  ({
    uid: "a",
    defId: "astera-titan-tube",
    modeIdx: 0,
    name: "Titan 1",
    universe: 1,
    address: 1,
    intensity: 0.5,
    cct: 0.5,
    gm: 0,
    hue: 0,
    saturation: 0,
    crossfade: 0,
    cctOnly: false,
    fx: { kind: "none", speed: 0.5, size: 0.5 },
    trigger: null,
    on: true,
    fxPlaying: true,
    ...over,
  }) as unknown as PatchedFixture;

describe("outputChanged", () => {
  it("spots an intensity move on a light that was already patched", () => {
    expect(outputChanged([light()], [light({ intensity: 0.9 })])).toBe(true);
  });

  it("spots a colour, switch and trigger move", () => {
    expect(outputChanged([light()], [light({ hue: 120 })])).toBe(true);
    expect(outputChanged([light()], [light({ on: false })])).toBe(true);
    expect(outputChanged([light()], [light({ trigger: { kind: "flash", at: 3 } })])).toBe(true);
  });

  it("ignores moves that do not change the light's output", () => {
    expect(outputChanged([light()], [light()])).toBe(false);
    expect(outputChanged([light()], [light({ name: "Renamed", universe: 4, address: 20 })])).toBe(false);
    expect(outputChanged([light()], [light({ power: { kind: "vmount", kwh: 0.098, charge: 1, watts: 80, usedWh: 12 } })])).toBe(false);
  });

  it("ignores patching a new light in or taking one out", () => {
    const a = light();
    const b = light({ uid: "b" });
    expect(outputChanged([a], [a, b])).toBe(false);
    expect(outputChanged([a, b], [a])).toBe(false);
  });

  it("spots a move made on one light of many", () => {
    const a = light();
    const b = light({ uid: "b", name: "Titan 2" });
    expect(outputChanged([a, b], [a, light({ uid: "b", name: "Titan 2", cct: 0.2 })])).toBe(true);
  });
});
