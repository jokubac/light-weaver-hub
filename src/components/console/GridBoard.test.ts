import { describe, expect, it } from "vitest";
import { arrange } from "./GridBoard";

const pts = [{ id: "a", x: 1, y: 1 }, { id: "b", x: 5, y: 3 }, { id: "c", x: 3, y: 6 }];
describe("grid arrange", () => {
  it("aligns left to the leftmost square", () => expect(arrange(pts, "left").map((p) => p.x)).toEqual([1, 1, 1]));
  it("lines up in one row with equal steps", () => {
    const r = arrange(pts, "row", 0.08);
    expect(new Set(r.map((p) => p.y)).size).toBe(1);
    expect(r.map((p) => p.x)).toEqual([1, 2, 3]);
  });
  it("evenly spaces horizontally between the outer squares", () => expect(arrange(pts, "hspace").map((p) => p.x).sort()).toEqual([1, 3, 5]));
  it("puts squares on a circle at equal distance from the centre", () => {
    const r = arrange(pts, "circle");
    const cx = r.reduce((a, p) => a + p.x, 0) / 3, cy = r.reduce((a, p) => a + p.y, 0) / 3;
    const d = r.map((p) => Math.hypot(p.x - cx, p.y - cy));
    expect(Math.max(...d) - Math.min(...d)).toBeLessThan(1e-9);
  });
  it("packs into a square block", () => expect(arrange([...pts, { id: "d", x: 0, y: 0 }], "square", 0.08).map((p) => [p.x, p.y])).toEqual([[0, 0], [1, 0], [0, 1], [1, 1]]));
});
