import { describe, expect, it } from "vitest";
import { keyName, macroCommand } from "@/lib/macros";

describe("macro pad", () => {
  it("intensity +5 raises selected lights by 5%", () => {
    expect(macroCommand({ id: "a", key: null, action: "int_up", amount: 5 })).toEqual({ levelDelta: 0.05 });
  });
  it("intensity -5 lowers by 5%", () => {
    expect(macroCommand({ id: "a", key: null, action: "int_down", amount: 5 })).toEqual({ levelDelta: -0.05 });
  });
  it("CCT -100 lowers kelvin by 100", () => {
    expect(macroCommand({ id: "a", key: null, action: "cct_down", amount: 100 })).toEqual({ cctDelta: -100 });
  });
  it("names keys with modifiers", () => {
    expect(keyName({ code: "KeyA", key: "a", ctrlKey: true, shiftKey: true, altKey: false, metaKey: false })).toBe("Ctrl+Shift+KeyA");
  });
});

describe("v1.1.1 macros", () => {
  it("reset colour sets 5600K and on/off set full/zero", () => {
    expect(macroCommand({ id: "a", key: null, action: "cct_reset", amount: 0 })).toEqual({ cct: 5600 });
    expect(macroCommand({ id: "a", key: null, action: "light_on", amount: 0 })).toEqual({ level: 1 });
    expect(macroCommand({ id: "a", key: null, action: "light_off", amount: 0 })).toEqual({ level: 0 });
  });
});
