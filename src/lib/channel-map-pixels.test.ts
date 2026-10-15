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

import { asteraSpecFromName, asteraChannels } from "@/lib/astera";
describe("asteraSpecFromName", () => {
  it("reads the 145-channel Titan profile 193 as 16 pixels", () => {
    const s = asteraSpecFromName("193: D16 CCT GM C CRO XY S (16-bit)", 145)!;
    expect(s.px).toBe(16);
    expect(asteraChannels(s)).toBe(145);
  });
  it("reads profile 116 with 113 channels as 16 pixels", () => {
    expect(asteraSpecFromName("116: D CCT GM CRO RGB S", 113)!.px).toBe(16);
  });
});

import { namedPixelCells } from "@/lib/dmx";
describe("namedPixelCells", () => {
  it("expands an Infinibar 'LE RGB Mode Pixel 12' cell to 12 pixels", () => {
    const mo = namedPixelCells({ name: "LE RGB Mode Pixel 12", channels: 4, kind: "full", channelMap: [{ attr: "Dimmer" }, { attr: "Red" }, { attr: "Green" }, { attr: "Blue" }] } as never)!;
    expect(mo.pixels).toBe(12);
    expect(mo.channels).toBe(48);
  });
});
