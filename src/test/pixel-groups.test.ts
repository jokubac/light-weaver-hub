import { describe, expect, it } from "vitest";
import { PIXEL_GENERATORS } from "@/lib/pixel-generators";
import { PIXEL_GROUPS, PIXEL_LIBRARY } from "@/lib/pixels";

describe("PIXEL effect picker groups", () => {
  it("shows every generator group in the picker", () => {
    const used = [...new Set(PIXEL_GENERATORS.map((g) => g.group))];
    for (const g of used) expect(PIXEL_GROUPS).toContain(g);
  });

  it("has no empty group in the picker", () => {
    for (const g of PIXEL_GROUPS) expect(PIXEL_LIBRARY.filter((x) => x.group === g).length).toBeGreaterThan(0);
  });

  it("lists the sound-reactive Music effects", () => {
    const music = PIXEL_LIBRARY.filter((x) => x.group === "Music");
    expect(music.length).toBeGreaterThanOrEqual(10);
    expect(music.map((x) => x.label)).toContain("VU meter");
    expect(music.map((x) => x.label)).toContain("Spectrum bars");
    expect(music.every((x) => x.kind === "generator" && x.gen)).toBe(true);
  });
});
