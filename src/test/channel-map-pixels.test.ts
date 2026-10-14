import { describe, expect, it } from "vitest";
import { channelMapPixels } from "@/lib/dmx";

describe("channelMapPixels", () => {
  it("counts repeated RGB cells as pixels", () => {
    const map = [{ attr: "Dimmer" }, ...Array.from({ length: 16 }, () => [{ attr: "Red" }, { attr: "Green" }, { attr: "Blue" }]).flat()];
    expect(channelMapPixels(map as never)).toBe(16);
  });
  it("treats a single colour cell as a normal light", () => {
    expect(channelMapPixels([{ attr: "Red" }, { attr: "Green" }, { attr: "Blue" }] as never)).toBe(0);
  });
});
