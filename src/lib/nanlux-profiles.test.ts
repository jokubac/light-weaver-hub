import { describe, expect, it } from "vitest";
import { VERIFIED_EXTRA_MODES, VERIFIED_FIXTURES } from "./verified-fixtures";

const def = (model: string) => VERIFIED_FIXTURES.find((d) => d.model === model)!;
const mode = (model: string, name: string) => def(model).modes.find((m) => m.name === name)!;

describe("Nanlux official charts", () => {
  it("Evoke 2400B CCT 8bit is 10 ch with Zoom on ch4", () => {
    expect(mode("Evoke 2400B", "CCT 8bit").channels).toBe(10);
    expect(mode("Evoke 2400B", "CCT 8bit").channelMap![3]!.attr).toBe("Zoom");
  });
  it("Evoke 150C/600C have all 22 chart modes plus reduced variants", () => {
    expect(def("Evoke 600C").modes).toHaveLength(44);
    expect(mode("Evoke 150C", "CCT & RGBW 16bit").channels).toBe(22);
    expect(mode("Evoke 150C", "CCT & HSI 8bit").channels).toBe(12);
  });
  it("Dyno gains 15-ch Ultimate modes", () => {
    const d = VERIFIED_EXTRA_MODES.find((x) => x.model === "Dyno 1200C")!;
    expect(d.modes.map((m) => m.channels)).toEqual([15, 15, 15, 15, 15, 15]);
  });
});
