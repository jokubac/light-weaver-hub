import { describe, expect, it } from "vitest";
import { applySize, arrange } from "./GridBoard";
import type { GridItem } from "./GridBoard";

const pts = [{ id: "a", x: 1, y: 1 }, { id: "b", x: 5, y: 3 }, { id: "c", x: 3, y: 6 }];
describe("grid arrange", () => {
  it("middle alignment never stacks squares", () => { const r = arrange([{ id: "a", x: 1, y: 1 }, { id: "b", x: 1.2, y: 5 }], "hcenter", 0.1, 1); expect(r[1]!.x - r[0]!.x).toBeGreaterThanOrEqual(1.1 - 1e-9); });
  it("triangle places squares on the outside corners", () => {
    const r = arrange(pts, "triangle", 0, 1);
    expect(r).toHaveLength(3);
    const d = (p: typeof r[0], q: typeof r[0]) => Math.hypot(p.x - q.x, p.y - q.y);
    const ds = [d(r[0]!, r[1]!), d(r[1]!, r[2]!), d(r[2]!, r[0]!)];
    expect(Math.max(...ds) - Math.min(...ds)).toBeLessThan(1e-3);
    expect(Math.min(...ds)).toBeGreaterThan(0);
  });
  it("rotate moves each light to the next clockwise spot", () => { const r = arrange(pts, "rotate"); expect(new Set(r.map((p) => `${p.x},${p.y}`))).toEqual(new Set(pts.map((p) => `${p.x},${p.y}`))); expect(r.every((p) => { const o = pts.find((q) => q.id === p.id)!; return o.x !== p.x || o.y !== p.y; })).toBe(true); });
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
  it("square grid places squares around the outside only", () => {
    const r = arrange([{ id: "a", x: 0, y: 0 }, { id: "b", x: 5, y: 5 }, { id: "c", x: 2, y: 9 }, { id: "d", x: 7, y: 1 }], "grid", 0.08);
    expect(r).toHaveLength(4);
    const d = (p: typeof r[0], q: typeof r[0]) => Math.hypot(p.x - q.x, p.y - q.y);
    const ds = [d(r[0]!, r[1]!), d(r[1]!, r[2]!), d(r[2]!, r[3]!), d(r[3]!, r[0]!), d(r[0]!, r[2]!), d(r[1]!, r[3]!)].sort((a, b) => a - b);
    expect(ds[3]! - ds[0]!).toBeLessThan(1e-9); // four equal sides
    expect(ds[5]! / ds[0]!).toBeCloseTo(Math.SQRT2, 6); // diagonals
  });
  it("pentagon places squares around the outside at equal distance from the centre", () => {
    const five = [{ id: "a", x: 0, y: 0 }, { id: "b", x: 5, y: 5 }, { id: "c", x: 2, y: 9 }, { id: "d", x: 7, y: 1 }, { id: "e", x: 4, y: 4 }];
    const r = arrange(five, "pentagon");
    const cx = r.reduce((a, p) => a + p.x, 0) / 5, cy = r.reduce((a, p) => a + p.y, 0) / 5;
    const d = r.map((p) => Math.hypot(p.x - cx, p.y - cy));
    expect(Math.max(...d) - Math.min(...d)).toBeLessThan(1e-9);
  });
});

describe("fixture size slider", () => {
  const items: GridItem[] = [
    { id: "a", kind: "fixture", uid: "f1", x: 2, y: 2 },
    { id: "b", kind: "fixture", uid: "f2", x: 6, y: 4 },
    { id: "m", kind: "macro", x: 3, y: 8, macro: { action: "cct_up", amount: 100, label: "" } },
  ];
  it("changes size only of the selected squares — others keep size and position", () => {
    const r = applySize(items, ["a"], 1.5, 0.92);
    expect(r.find((i) => i.id === "a")!.s).toBe(1.5);
    const b = r.find((i) => i.id === "b")!;
    expect(b.s).toBeUndefined();
    expect(b.x).toBe(6); expect(b.y).toBe(4);
  });
  it("a lone selected square grows about its own centre", () => {
    const r = applySize(items, ["a"], 1.4, 0.92);
    const a = r.find((i) => i.id === "a")!;
    expect(a.x + a.s! / 2).toBeCloseTo(2 + 0.92 / 2, 9);
    expect(a.y + a.s! / 2).toBeCloseTo(2 + 0.92 / 2, 9);
  });
  it("a selected group keeps its layout when resized together", () => {
    const base: GridItem[] = [{ id: "a", kind: "fixture", uid: "f1", x: 4, y: 4 }, { id: "b", kind: "fixture", uid: "f2", x: 8, y: 6 }];
    const r = applySize(base, ["a", "b"], 1.84, 0.92); // exactly ×2
    const a = r.find((i) => i.id === "a")!, b = r.find((i) => i.id === "b")!;
    const ca = { x: a.x + a.s! / 2, y: a.y + a.s! / 2 }, cb = { x: b.x + b.s! / 2, y: b.y + b.s! / 2 };
    const o = { x: (4 + 0.92 / 2 + 8 + 0.92 / 2) / 2, y: (4 + 0.92 / 2 + 6 + 0.92 / 2) / 2 };
    expect(Math.hypot(cb.x - ca.x, cb.y - ca.y)).toBeCloseTo(2 * Math.hypot(6 - 2, 4 - 2), 9);
    expect((ca.x + cb.x) / 2).toBeCloseTo(o.x, 9);
    expect((ca.y + cb.y) / 2).toBeCloseTo(o.y, 9);
  });
  it("never pushes a square outside the board", () => {
    const r = applySize([{ id: "a", kind: "fixture", uid: "f1", x: 0, y: 0 }], ["a"], 2, 0.92);
    const a = r[0]!;
    expect(a.x).toBeGreaterThanOrEqual(0); expect(a.y).toBeGreaterThanOrEqual(0);
    expect(a.x + a.s!).toBeLessThanOrEqual(24); expect(a.y + a.s!).toBeLessThanOrEqual(16);
  });
  it("with nothing selected the squares are untouched (global size changes instead)", () => {
    expect(applySize(items, [], 1.5, 0.92)).toBe(items);
  });
});

import { resizeBoxes } from "./GridBoard";
describe("resizeBoxes", () => {
  it("stretches a group only on X from the bottom-right corner (circle → oval), top-left stays", () => {
    const r = resizeBoxes([{ id: "a", x: 1, y: 1, w: 1, h: 1 }, { id: "b", x: 3, y: 1, w: 1, h: 1 }], "br", 7, 2);
    expect(r[0]).toEqual({ id: "a", x: 1, y: 1, w: 2, h: 1 });
    expect(r[1]).toEqual({ id: "b", x: 5, y: 1, w: 2, h: 1 });
  });
  it("top-left corner keeps the bottom-right fixed", () => {
    const [a] = resizeBoxes([{ id: "a", x: 2, y: 2, w: 2, h: 2 }], "tl", 0, 3);
    expect(a).toEqual({ id: "a", x: 0, y: 3, w: 4, h: 1 });
  });
});
