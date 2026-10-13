import { describe, expect, it } from "vitest";
import { keyName, macroCommand, MACRO_ACTIONS, stepSelection } from "@/lib/macros";

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

describe("extra macros", () => {
  it("intensity 50% sets half", () => {
    expect(macroCommand({ id: "a", key: null, action: "int_half", amount: 0 })).toEqual({ level: 0.5 });
  });
});

describe("next / previous light", () => {
  const order = ["a", "b", "c"];
  it("plain next moves the selection to just the next light", () => {
    expect(stepSelection(order, ["a"], "a", 1)).toEqual({ selection: ["b"], lastPick: "b" });
  });
  it("next with keeps selection adds the new light and keeps earlier picks", () => {
    expect(stepSelection(order, ["a"], "a", 1, true)).toEqual({ selection: ["a", "b"], lastPick: "b" });
  });
  it("previous wraps from the first light to the last", () => {
    expect(stepSelection(order, ["b"], "a", -1)).toEqual({ selection: ["c"], lastPick: "c" });
  });
  it("offers plain and keeps-selection next/previous as separate actions", () => {
    const ids: string[] = MACRO_ACTIONS.map((a) => a.id);
    expect(["next", "prev", "next_add", "prev_add"].every((i) => ids.includes(i))).toBe(true);
  });
});
