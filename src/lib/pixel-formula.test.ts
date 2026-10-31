import { describe, expect, it } from "vitest";
import { compileFormula, FORMULA_PRESETS } from "./pixel-formula";
import { shufflePixels, pixelSlot } from "./pixel-shuffle";

const p = { x: 0.5, y: 0, u: 0.75, v: 0.5, d: 0.5, a: 0, t: 0, i: 0, j: 0, W: 10, H: 1 };

describe("pixel formula", () => {
  it("evaluates a parabola", () => {
    const f = compileFormula("x^2");
    expect(typeof f).toBe("function");
    expect((f as (q: typeof p) => number)(p)).toBeCloseTo(0.25);
  });
  it("rejects code that is not maths", () => {
    expect(typeof compileFormula("window.alert(1)")).toBe("string");
    expect(typeof compileFormula("constructor")).toBe("string");
    expect(typeof compileFormula("x = 1")).toBe("string");
  });
  it("all presets compile", () => {
    for (const pr of FORMULA_PRESETS) expect(typeof compileFormula(pr.f)).toBe("function");
  });
});

describe("pixel shuffle", () => {
  it("is a permutation and restores identity when cleared", () => {
    const s = shufflePixels(12, () => 0.3);
    expect([...s].sort((a, b) => a - b)).toEqual([...Array(12).keys()]);
    expect(pixelSlot(undefined, 5)).toBe(5);
    expect(pixelSlot(s, 5)).toBe(s[5]);
  });
});
