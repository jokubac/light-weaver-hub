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
