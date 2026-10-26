import { describe, expect, it } from "vitest";
import { VERIFIED_FIXTURES } from "@/lib/verified-fixtures";

// amaran F21C & F22C DMX Profile Specification V1.0
describe("amaran F21c/F22c official chart", () => {
  for (const model of ["F21C", "F22C"]) {
    const d = VERIFIED_FIXTURES.find((f) => f.model === model)!;
    it(`${model} footprints match the chart`, () => {
      expect(d.modes.map((m) => m.channels)).toEqual([10, 6, 9, 7, 6, 8, 9]);
    });
    it(`${model} CCT+RGB mode controls CCT, G/M and crossfade`, () => {
      expect(d.modes[0]!.channelMap!.slice(0, 4).map((c) => c.attr)).toEqual(["Dimmer", "CCT", "GM", "Crossfade"]);
    });
  }
});

// amaran F21X & F22X Pro DMX Profile Specification V1.0
describe("amaran F21x/F22x official chart", () => {
  for (const model of ["F21X", "F22X"]) {
    it(`${model} footprints match the chart`, () => {
      const d = VERIFIED_FIXTURES.find((f) => f.model === model)!;
      expect(d.modes.map((m) => m.channels)).toEqual([2, 5]);
    });
  }
});

// Nanlite PavoSlim DMX Reference Guide: full / reduced footprints per mode
describe("Nanlite PavoSlim official chart", () => {
  it("footprints match the chart", () => {
    const d = VERIFIED_FIXTURES.find((f) => f.model === "PavoSlim 120C")!;
    expect(d.modes.map((m) => m.channels)).toEqual([11, 20, 8, 15, 9, 16, 6, 11, 6, 11, 3, 6, 6, 11, 3, 6, 8, 15, 5, 10, 6, 11, 3, 6]);
  });
});

// Nanlite Forza II DMX Reference Guides
describe("Nanlite Forza II official charts", () => {
  const counts = (model: string) => VERIFIED_FIXTURES.find((f) => f.model === model)!.modes.map((m) => m.channels);
  it("Forza 60 II", () => expect(counts("Forza 60 II")).toEqual([3, 10]));
  it("Forza 60B II", () => expect(counts("Forza 60B II")).toEqual([6, 2, 11]));
  it("Forza 300 II", () => expect(counts("Forza 300 II")).toEqual([6, 2, 11]));
});

describe("lights without DMX input are hidden from PATCH", async () => {
  const { getDef } = await import("@/lib/dmx");
  for (const id of ["aputure-mc", "aputure-accent-b7c", "aputure-ls-60x", "aputure-amaran-100x"]) {
    it(id, () => expect(getDef(id).id === id && getDef(id).modes.every((m) => m.legacy)).toBe(true));
  }
});

describe("Nanlite PavoTube II 15C/30C official chart", () => {
  it("footprints match", () => {
    const d = VERIFIED_FIXTURES.find((f) => f.model === "PavoTube II 30C")!;
    expect(d.modes.map((m) => m.channels)).toEqual([9, 16, 7, 12, 4, 7, 4, 7, 6, 11, 43]);
  });
});

describe("Kino Flo True Match 5.0 lights use the official personalities", async () => {
  const { getDef } = await import("@/lib/dmx");
  for (const id of ["kino-flo-celeb-450", "kino-flo-freestyle-41", "kino-flo-select-30"]) {
    it(id, () => {
      const live = getDef(id).modes.filter((m) => !m.legacy);
      expect(live.length).toBe(29);
      expect(live.every((m) => m.source === "manufacturer")).toBe(true);
    });
  }
});
