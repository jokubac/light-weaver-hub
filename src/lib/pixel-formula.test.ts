import { describe, expect, it } from "vitest";
import { buildFormula, compileFormula, detectFormulaShape, FORMULA_KNOBS, FORMULA_PRESETS, FORMULA_SHAPES } from "./pixel-formula";
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

describe("formula builder", () => {
  const q = { x: -0.4, y: 0.3, u: 0.2, v: 0.8, d: 0.6, a: 1.1, t: 1.2, i: 4, j: 7, W: 24, H: 14 };
  const run = (src: string, v: typeof p) => {
    const f = compileFormula(src);
    expect(typeof f).toBe("function");
    return (f as (x: typeof p) => number)(v);
  };

  it("every shape stays plain maths for every dial setting", () => {
    for (const s of FORMULA_SHAPES) {
      for (const k of [FORMULA_KNOBS, { scale: 3, soft: 0.6, invert: true }, { scale: 0.5, soft: 1, invert: false }]) {
        expect(Number.isFinite(run(buildFormula(s.id, k), p)), s.id).toBe(true);
        expect(Number.isFinite(run(buildFormula(s.id, k), q)), s.id).toBe(true);
      }
    }
  });

  it("a shape with the dials left alone writes the classic formula", () => {
    for (const [shape, preset] of [["wave", "Sine wave"], ["ripple", "Ripple"], ["spiral", "Spiral"], ["diagonal", "Diagonal"], ["checker", "Checker"], ["scan", "Scanner"], ["breathe", "Breathing"]] as const) {
      expect(buildFormula(shape)).toBe(FORMULA_PRESETS.find((pr) => pr.label === preset)!.f);
    }
  });

  it("the dials change the picture", () => {
    const one = run(buildFormula("ripple", FORMULA_KNOBS), q);
    const two = run(buildFormula("ripple", { ...FORMULA_KNOBS, scale: 2.4 }), q);
    expect(one).not.toBeCloseTo(two);
    const soft = run(buildFormula("ripple", { ...FORMULA_KNOBS, soft: 0.8 }), q);
    expect(soft).toBeGreaterThanOrEqual(Math.max(0, Math.min(1, one)));
  });

  it("invert mirrors what the lights show", () => {
    const plain = Math.max(0, Math.min(1, run(buildFormula("spiral", { scale: 2, soft: 0, invert: false }), q)));
    const flipped = run(buildFormula("spiral", { scale: 2, soft: 0, invert: true }), q);
    expect(flipped).toBeCloseTo(1 - plain);
  });

  it("knows which picture a saved formula came from", () => {
    expect(detectFormulaShape(buildFormula("spiral"))).toBe("spiral");
    expect(detectFormulaShape("x^2")).toBe(null);
    expect(detectFormulaShape(undefined)).toBe(null);
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
