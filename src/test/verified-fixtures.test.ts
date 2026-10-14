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
