import { describe, it, expect } from "vitest";
import { asteraSpec, asteraTokens } from "@/lib/astera";

// Astera Titan Tube DMX Profiles: profile 25 "RGB.RGBS" (4 px) is 15 channels with strobe on channel 4.
describe("Astera profile 25", () => {
  it("has 15 channels with strobe on channel 4", () => {
    const t = asteraTokens(asteraSpec(25)!);
    expect(t.length).toBe(15);
    expect(t[3]!.token).toBe("S");
  });
});

import { asteraModes } from "@/lib/astera";
// Astera Helios/Hyperion charts: profile 98 is 2 px on Helios and 8 px on Hyperion (Titan: 4 px).
describe("Astera tube pixel tiers", () => {
  const px = (scale: number) => asteraModes([4], [], scale).find((m) => m.astera?.code === 98)!.astera!.px;
  it("Helios profile 98 is 2 px", () => expect(px(0.5)).toBe(2));
  it("Hyperion profile 98 is 8 px", () => expect(px(2)).toBe(8));
});

import { ASTERA_HEAD_XY, asteraChannels } from "@/lib/astera";
// Astera single-head chart V3: profiles 168/169/170/171 are 8/9/9/10 channels.
describe("Astera head xy profiles", () => {
  it("168–171 channel counts", () => expect(ASTERA_HEAD_XY.map(asteraChannels)).toEqual([8, 9, 9, 10]));
});

import { FIXTURE_LIBRARY as LIB2, isVerifiedDef as isV } from "@/lib/dmx";
describe("Astera single-head verified", () => {
  it("AX3/AX5/AX9/NYX are verified via chart profiles", () => {
    for (const model of ["AX3 LightDrop", "AX5 TriplePAR", "AX9 PowerPar", "NYX Bulb"]) {
      const d = LIB2.find((x) => x.brand === "Astera" && x.model === model)!;
      expect(isV(d)).toBe(true);
    }
  });
});

describe("HydraPanel official chart", () => {
  it("is verified and maps Titan tiers to 2/3/6 px", () => {
    const d = LIB2.find((x) => x.brand === "Astera" && x.model === "HydraPanel")!;
    expect(isV(d)).toBe(true);
    const by = (c: number) => d.modes.find((m) => m.astera?.code === c)!;
    expect(by(41).channels).toBe(23);
    expect(by(73).channels).toBe(12);
    expect(by(141).channels).toBe(102);
    expect(by(17).pixels).toBe(2);
  });
});
