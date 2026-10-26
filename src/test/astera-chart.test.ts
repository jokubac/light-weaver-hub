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
