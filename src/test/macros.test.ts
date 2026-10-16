import { describe, expect, it } from "vitest";
import { colourStep, keyName, macroCommand, MACRO_ACTIONS, stepSelection } from "@/lib/macros";

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
  it("offers next/previous actions", () => {
    const ids: string[] = MACRO_ACTIONS.map((a) => a.id);
    expect(["next", "prev"].every((i) => ids.includes(i))).toBe(true);
  });
});

describe("new macro set", () => {
  it("hue +5% turns the wheel 18° and wraps", () => {
    expect(colourStep({ id: "a", key: null, action: "hue_up", amount: 5 }, { hue: 350, saturation: 0.5 })).toEqual({ hue: 8 });
  });
  it("saturation -5% clamps at 0", () => {
    expect(colourStep({ id: "a", key: null, action: "sat_down", amount: 5 }, { hue: 0, saturation: 0.02 })).toEqual({ saturation: 0 });
  });
  it("intensity fader sets the level, CCT fader sets kelvin", () => {
    expect(macroCommand({ id: "a", key: null, action: "int_fader", amount: 40 })).toEqual({ level: 0.4 });
    expect(macroCommand({ id: "a", key: null, action: "cct_fader", amount: 3200 })).toEqual({ cct: 3200 });
  });
  it("faders default to a 3×1 box; Check out! and Locate! are hold buttons", () => {
    expect(MACRO_ACTIONS.filter((a) => a.fader).map((a) => a.id)).toEqual(["int_fader", "cct_fader", "gm_fader"]);
    expect(MACRO_ACTIONS.filter((a) => a.hold).map((a) => a.id)).toEqual(["checkout", "locate"]);
  });
});
