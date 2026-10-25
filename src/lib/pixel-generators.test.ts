import { describe, expect, it } from "vitest";
import { PIXEL_GENERATORS } from "./pixel-generators";

describe("pixel generators", () => {
  it("offers 58 unique generators", () => {
    expect(PIXEL_GENERATORS).toHaveLength(58);
    expect(new Set(PIXEL_GENERATORS.map((g) => g.id)).size).toBe(58);
  });
  it("every generator returns valid colours on 1-row and 2D maps", () => {
    for (const g of PIXEL_GENERATORS) for (const [W, H] of [[16, 1], [12, 8]] as const) for (let t = 0; t < 3; t += 0.7) {
      const c = g.fn({ x: 3, y: H - 1, W, H, t, pal: () => [255, 0, 0], custom: false });
      for (const v of c) { expect(Number.isFinite(v)).toBe(true); expect(v).toBeGreaterThanOrEqual(-0.001); expect(v).toBeLessThanOrEqual(255.001); }
    }
  });
});
