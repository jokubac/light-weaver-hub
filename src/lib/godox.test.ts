import { describe, expect, it } from "vitest";
import { GODOX_AM1600R_MODES, GODOX_M300R_M1000R_MODES, GODOX_M600BI_PRO_MODES, GODOX_M600R_MODES } from "./godox";

const fp = (modes: { name: string; channels: number }[]) => Object.fromEntries(modes.map((m) => [m.name, m.channels]));

describe("Godox official DMX charts", () => {
  it("M600R footprints match the chart (Extend adds 3)", () => {
    const f = fp(GODOX_M600R_MODES);
    expect(f["01 CCT 8-bit"]).toBe(3);
    expect(f["01 CCT 8-bit + Extend"]).toBe(6);
    expect(f["05 RGBWW 8-bit + Extend"]).toBe(9);
    expect(f["07 CCT+RGBW 8-bit"]).toBe(8);
    expect(f["09 GEL 8-bit + Extend"]).toBe(10);
    expect(f["13 RGBW 16-bit + Extend"]).toBe(13);
    expect(f["14 X-Y 16-bit"]).toBe(6);
    expect(f["15 FX 16-bit + Extend"]).toBe(13);
    expect(f["16 GEL 16-bit + Extend"]).toBe(12);
    expect(GODOX_M600R_MODES[0]?.channels).toBe(8);
  });
  it("AM1600R keeps its old 11-ch mode first and Ultimate matches", () => {
    const f = fp(GODOX_AM1600R_MODES);
    expect(GODOX_AM1600R_MODES[0]?.channels).toBe(11);
    expect(f["17 Ultimate 8-bit + Extend"]).toBe(11);
    expect(f["18 Ultimate 16-bit + Extend"]).toBe(14);
    expect(f["05 X-Y 8-bit"]).toBe(3);
  });
  it("M300R/M1000R and M600Bi Pro footprints", () => {
    expect(fp(GODOX_M300R_M1000R_MODES)["12 RGBW 16-bit + Extend"]).toBe(13);
    const b = fp(GODOX_M600BI_PRO_MODES);
    expect(b["01 CCT 8-bit + Extend"]).toBe(5);
    expect(b["04 FX 16-bit + Extend"]).toBe(12);
    expect(b["05 Ultimate 8-bit + Extend"]).toBe(9);
    expect(b["06 Ultimate 16-bit + Extend"]).toBe(13);
  });
});
