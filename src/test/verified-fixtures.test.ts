import { describe, it, expect } from "vitest";
import { VERIFIED_FIXTURES } from "@/lib/verified-fixtures";

const sumo = VERIFIED_FIXTURES.find((f) => f.id === "gdtf-sumolight-sumomax")!;

describe("SUMOMAX official chart", () => {
  it("has all 29 personalities, 700 W and 1800-10000 K", () => {
    expect(sumo.modes).toHaveLength(29);
    expect(sumo.watts).toBe(700);
    expect(sumo.cctRange).toEqual([1800, 10000]);
  });
  it("matches chart footprints", () => {
    const ch = sumo.modes.map((m) => m.channels);
    expect(ch[0]).toBe(3); // CCT 8-bit
    expect(ch[2]).toBe(58); // CCT multi: master + 19×3
    expect(ch[18]).toBe(96); // RGBWW multi 8-bit
    expect(ch[15]).toBe(344); // CCT RGBWW 16-bit multi
    sumo.modes.forEach((m) => expect(m.channelMap?.length).toBe(m.channels));
  });
});

const byId = (id: string) => VERIFIED_FIXTURES.find((f) => f.id === id)!;

describe("Creamsource official charts", () => {
  it("Vortex8: 650 W, 2200-15000 K, 8-zone multizone footprints", () => {
    const v8 = byId("gdtf-creamsource-vortex-8");
    expect(v8.watts).toBe(650);
    expect(v8.cctRange).toEqual([2200, 15000]);
    const mz = v8.modes.find((m) => m.name.startsWith("32 "))!;
    expect(mz.channels).toBe(66); // chart: 8 zones × 8 + Fan + Control
  });
  it("Vortex8 footprints match the V3.1 mode index", () => {
    const v8 = byId("gdtf-creamsource-vortex-8");
    const ch = (n: number) => v8.modes.find((m) => m.name.startsWith(`${n} `))!.channels;
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(ch)).toEqual([10, 5, 8, 7, 5, 18, 8, 14, 12, 8]);
    expect([15, 16, 18, 19, 21, 24, 25, 27, 29, 30].map(ch)).toEqual([14, 16, 20, 24, 6, 7, 13, 10, 15, 21]);
    expect([31, 33, 35, 38, 39, 40, 41, 44, 48, 52, 56, 60, 64, 65, 66, 67, 69, 75].map(ch)).toEqual([131, 26, 130, 50, 98, 19, 9, 35, 35, 67, 34, 66, 32, 37, 64, 72, 98, 50]);
    v8.modes.forEach((m) => expect(m.channelMap?.length).toBe(m.channels));
  });
  it("Vortex24 has 24 zones, Vortex8 Soft has none", () => {
    const v24 = byId("gdtf-creamsource-vortex-24");
    expect(v24.modes.find((m) => m.name.startsWith("32 "))!.channels).toBe(194);
    expect(byId("gdtf-creamsource-vortex-8-soft").modes.some((m) => m.name.includes("Multi-Zone"))).toBe(false);
  });
  it("SpaceX scenario 1 is 10 slots with Amber and Fan", () => {
    const sx = byId("gdtf-creamsource-spacex-csx-1200-c");
    const s1 = sx.modes[0]!;
    expect(s1.channels).toBe(10);
    expect(s1.channelMap!.map((c) => c.attr)).toEqual(["Dimmer", "CCT", "GM", "Crossfade", "Red", "Green", "Blue", "White", "Amber", "Spare"]);
  });
});

describe("Aputure STORM 1200x official chart", () => {
  it("has all 32 profiles, 1200 W, 2500-10000 K", () => {
    const s = byId("gdtf-aputure-storm-1200x");
    expect(s.modes).toHaveLength(32);
    expect(s.watts).toBe(1200);
    expect(s.cctRange).toEqual([2500, 10000]);
    expect(s.modes.map((m) => m.channels)).toEqual([3, 6, 6, 9, 10, 13, 3, 6, 6, 9, 10, 13, 6, 12, 9, 15, 7, 14, 10, 17, 5, 10, 8, 13, 3, 6, 6, 9, 4, 8, 7, 11]);
  });
});

describe("Astera Fresnel official chart", () => {
  it("AF80/AF250 share 12 core personalities", () => {
    const af80 = byId("gdtf-astera-led-technology-af80-plutofresnel");
    expect(af80.watts).toBe(80);
    expect(byId("gdtf-astera-led-technology-af250-leofresnel").watts).toBe(250);
    expect(af80.modes.map((m) => m.channels)).toEqual([3, 4, 5, 4, 5, 6, 6, 7, 5, 8, 7, 6]);
  });
});

describe("Quasar RR official chart", () => {
  it("RR50 has 8 pixels, RR100 has 16, per-pixel footprints", () => {
    const rr50 = byId("gdtf-quasar-science-double-rainbow-2ft");
    const hsic = rr50.modes[0]!;
    expect(hsic.pixels).toBe(8);
    expect(hsic.channels).toBe(8 * 5);
    expect(byId("gdtf-quasar-science-double-rainbow-4ft").modes[0]!.channels).toBe(16 * 5);
  });
});

describe("Aputure LS 600c Pro official chart V1.6", () => {
  it("22 profiles with chart footprints, 2300-10000 K", () => {
    const a = byId("gdtf-aputure-ls-600c-pro");
    expect(a.cctRange).toEqual([2300, 10000]);
    expect(a.modes.map((m) => m.channels)).toEqual([8, 4, 8, 5, 5, 6, 4, 5, 10, 5, 11, 15, 7, 15, 9, 9, 7, 7, 6, 12, 10, 16]);
  });
});
