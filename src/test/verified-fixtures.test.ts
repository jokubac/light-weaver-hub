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

describe("Aputure Nova P600c official chart V1.1.1", () => {
  it("28 profiles with chart footprints", () => {
    const n = byId("gdtf-aputure-nova-p600c");
    expect(n.modes.map((m) => m.channels)).toEqual([8, 4, 8, 5, 5, 6, 4, 5, 21, 5, 28, 16, 12, 22, 15, 7, 15, 9, 9, 7, 7, 6, 35, 10, 56, 32, 24, 36]);
  });
});

describe("ARRI Orbiter V5.0 chart", () => {
  const orb = VERIFIED_FIXTURES.find((f) => f.model === "Orbiter")!;
  const ch = (name: string) => orb.modes.find((m) => m.name === name)?.channels;
  it("matches the chart footprints", () => {
    expect(orb.modes).toHaveLength(72);
    expect(ch("Mode 1 - CCT 8bit + ECC + Operation")).toBe(19);
    expect(ch("Mode 2 - CCT 16bit + ECC + Operation")).toBe(30);
    expect(ch("Mode 18 - Ultimate 16bit")).toBe(45);
    expect(ch("Mode 14 - RGBACL 16bit")).toBe(23);
  });
});

describe("Aputure Nova P300c chart V1.1", () => {
  it("has 9 modes with chart channel counts", () => {
    const f = VERIFIED_FIXTURES.find((x) => x.model === "Nova P300c")!;
    expect(f.modes.map((m) => m.channels)).toEqual([7, 3, 6, 5, 3, 2, 4, 3, 10]);
  });
});

describe("Aputure MC Pro official chart V2.0", () => {
  it("has all 24 modes with the chart's channel counts (Gel 16-bit table lists 7 ch)", () => {
    const f = VERIFIED_FIXTURES.find((d) => d.model === "MC Pro")!;
    expect(f.modes.map((m) => m.channels)).toEqual([8, 4, 7, 5, 5, 6, 4, 5, 10, 5, 11, 6, 15, 7, 13, 9, 9, 7, 7, 6, 11, 10, 16, 11]);
  });
});

describe("amaran PT4c official chart V1.0", () => {
  it("has all 14 modes with the chart's channel counts", () => {
    const f = VERIFIED_FIXTURES.find((d) => d.model === "PT4C")!;
    expect(f.modes.map((m) => m.channels)).toEqual([10, 6, 9, 7, 6, 7, 14, 28, 56, 112, 6, 12, 24, 48]);
  });
});

describe("Nanlux TK-140B/280B official chart V1", () => {
  it("has CCT 8/16-bit and Ultimate modes with 2/4/10 channels", () => {
    for (const model of ["TK-140B", "TK-280B"]) {
      expect(VERIFIED_FIXTURES.find((d) => d.model === model)!.modes.map((m) => m.channels)).toEqual([2, 4, 10]);
    }
  });
});

describe("Aputure Electro Storm CS15 official chart V1.1", () => {
  it("matches the chart's min–max channel range for every profile", () => {
    const modes = VERIFIED_FIXTURES.find((d) => d.model === "Electro Storm CS15")!.modes;
    const range = (no: number) => { const c = modes.filter((m) => m.name.startsWith(`Mode ${no} -`)).map((m) => m.channels); return [Math.min(...c), Math.max(...c)]; };
    const chart: Record<number, [number, number]> = { 1: [8, 13], 2: [4, 9], 3: [8, 13], 4: [5, 10], 5: [5, 10], 6: [6, 11], 7: [4, 9], 8: [5, 10], 9: [10, 15], 10: [6, 11], 12: [15, 23], 13: [7, 15], 14: [15, 23], 15: [9, 17], 16: [9, 17], 17: [7, 15], 18: [7, 15], 19: [6, 14], 20: [13, 21], 21: [11, 19] };
    for (const [no, r] of Object.entries(chart)) expect(range(Number(no))).toEqual(r);
  });
});
