import { describe, expect, it } from "vitest";
import { applySize, arrange } from "./GridBoard";
import type { GridItem } from "./GridBoard";

const pts = [{ id: "a", x: 1, y: 1 }, { id: "b", x: 5, y: 3 }, { id: "c", x: 3, y: 6 }];
describe("grid arrange", () => {
  it("middle alignment never stacks squares", () => { const r = arrange([{ id: "a", x: 1, y: 1 }, { id: "b", x: 1.2, y: 5 }], "hcenter", 0.1, 1); expect(r[1]!.x - r[0]!.x).toBeGreaterThanOrEqual(1.1 - 1e-9); });
  it("triangle puts 1 then 2 squares per row", () => expect(arrange(pts, "triangle", 0, 1).map((p) => p.y)).toEqual([1, 2, 2]));
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
  it("packs into a square block", () => expect(arrange([...pts, { id: "d", x: 0, y: 0 }], "grid", 0.08).map((p) => [p.x, p.y])).toEqual([[0, 0], [1, 0], [0, 1], [1, 1]]));
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
