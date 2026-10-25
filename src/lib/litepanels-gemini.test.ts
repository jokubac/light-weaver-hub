import { describe, expect, it } from "vitest";
import { GEMINI_MODES } from "./litepanels-gemini";

const fp = Object.fromEntries(GEMINI_MODES.map((m) => [m.name.slice(0, 3), m.channels]));

describe("Litepanels Gemini official chart V4.2", () => {
  it("has all 40 chart profiles", () => expect(GEMINI_MODES).toHaveLength(40));
  it("footprints match the chart", () => {
    expect(fp).toMatchObject({ P01: 12, P02: 6, P06: 20, P09: 14, P14: 16, P18: 17, P22: 13, P40: 22, S02: 7, S11: 18, S16: 20, S17: 38 });
  });
  it("RGBW 8-bit keeps the chart's split order (W,R before mode/fan, then G,B)", () => {
    const p04 = GEMINI_MODES.find((m) => m.name.startsWith("P04"))!;
    expect(p04.channelMap!.map((c) => c.attr)).toEqual(["Dimmer", "CCT", "White", "Red", "Spare", "Spare", "Green", "Blue"]);
  });
});
