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
