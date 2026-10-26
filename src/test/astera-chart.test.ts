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
