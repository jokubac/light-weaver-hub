import { describe, expect, it } from "vitest";
import { applySize, arrange, fixtureBox, tableCarry } from "./GridBoard";
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
    const FXW = 0.92 * 2 * Math.sqrt(3 / 2), FXH = 0.92 * 2 * Math.sqrt(2 / 3);
    expect(a.x + a.s! / 2).toBeCloseTo(2 + FXW / 2, 9);
    expect(a.y + a.s! / 2).toBeCloseTo(2 + FXH / 2, 9);
  });
  it("a selected group keeps its layout when resized together", () => {
    const base: GridItem[] = [{ id: "a", kind: "fixture", uid: "f1", x: 4, y: 4 }, { id: "b", kind: "fixture", uid: "f2", x: 8, y: 6 }];
    const r = applySize(base, ["a", "b"], 1.84, 0.92);
    const a = r.find((i) => i.id === "a")!, b = r.find((i) => i.id === "b")!;
    const ca = { x: a.x + a.s! / 2, y: a.y + a.s! / 2 }, cb = { x: b.x + b.s! / 2, y: b.y + b.s! / 2 };
    const FXW = 0.92 * 2 * Math.sqrt(3 / 2), FXH = 0.92 * 2 * Math.sqrt(2 / 3);
    const oa = { x: 4 + FXW / 2, y: 4 + FXH / 2 }, ob = { x: 8 + FXW / 2, y: 6 + FXH / 2 };
    const o = { x: (oa.x + ob.x) / 2, y: (oa.y + ob.y) / 2 };
    const k = 1.84 / FXW;
    expect(Math.hypot(cb.x - ca.x, cb.y - ca.y)).toBeCloseTo(Math.hypot(ob.x - oa.x, ob.y - oa.y) * k, 9);
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

describe("resizeBoxes keeps fixture proportions", () => {
  it("a lone fixture box scales uniformly, never stretches", () => {
    const [a] = resizeBoxes([{ id: "f", x: 0, y: 0, w: 4, h: 1 }], "br", 8, 1, 0.3, new Set(["f"]));
    expect(a!.w / a!.h).toBeCloseTo(4);
    expect(a!.w).toBeCloseTo(8);
  });
});

describe("default fixture box", () => {
  it("is a 3:2 rectangle — wider than tall", () => {
    const { w, h } = fixtureBox(0.92);
    expect(w / h).toBeCloseTo(1.5, 9);
    expect(w).toBeGreaterThan(h);
  });
});

describe("macros table", () => {
  const t1 = { id: "t1", kind: "table" as const, x: 0, y: 0, w: 8, h: 6 };
  const items: GridItem[] = [
    { id: "m1", kind: "macro", tbl: "t1", x: 1, y: 1, macro: { action: "cct_up", amount: 100, label: "" } },
    { id: "m2", kind: "macro", tbl: "t2", x: 9, y: 9, macro: { action: "cct_up", amount: 100, label: "" } },
    { id: "f1", kind: "fixture", uid: "f1", x: 2, y: 2 },
  ];
  it("a dragged table carries only its own macros — a fixture standing in the table never sticks", () => {
    expect(tableCarry(items, t1, 0.92).map((i) => i.id)).toEqual(["m1"]);
  });
  it("dragging one table over another steals nothing", () => {
    // t1 dragged on top of t2: m2 now sits inside t1 but belongs to t2, so it must not stick.
    expect(tableCarry(items, { ...t1, x: 8, y: 8 }, 0.92).map((i) => i.id)).toEqual(["m1"]);
  });
});

import { dropIntoTables, layoutTables } from "./GridBoard";
describe("macro tables", () => {
  const t1 = { id: "t1", kind: "table" as const, x: 0, y: 0, w: 4.4, h: 3.7, cols: 4, rows: 3 };
  const t2 = { id: "t2", kind: "table" as const, x: 10, y: 0, w: 4.4, h: 3.7, cols: 4, rows: 3 };
  it("macro dropped on another table moves there and lines up", () => {
    const m = { id: "m", kind: "macro" as const, tbl: "t1", x: 11, y: 1, w: 1, h: 1 };
    const out = layoutTables(dropIntoTables([t1, t2, m], new Set(["m"])));
    const r = out.find((i) => i.id === "m")!;
    expect(r.tbl).toBe("t2");
    expect(r.x).toBeGreaterThanOrEqual(10);
  });
  it("macro dropped outside every table returns to its table", () => {
    const m = { id: "m", kind: "macro" as const, tbl: "t1", x: 30, y: 30, w: 1, h: 1 };
    const r = layoutTables(dropIntoTables([t1, t2, m], new Set(["m"]))).find((i) => i.id === "m")!;
    expect(r.tbl).toBe("t1");
    expect(r.x).toBeLessThan(4.4);
  });
});

import { spanOf } from "./GridBoard";
describe("macro spans", () => {
  const t = { id: "t", kind: "table" as const, x: 0, y: 0, w: 4.4, h: 3.7 };
  it("table columns follow width and spans stay inside", () => {
    expect(spanOf(2.2, 1.1, t)).toEqual({ cs: 2, rs: 1, sk: 1 });
    expect(spanOf(20, 2.2, t)).toEqual({ cs: 4, rs: 2, sk: 1 });
    expect(spanOf(0.1, 0.1, t)).toEqual({ cs: 1, rs: 1, sk: 1 });
  });
  it("spanned macros never overlap", () => {
    const a = { id: "a", kind: "macro" as const, tbl: "t", x: 0, y: 0, cs: 2, rs: 2 };
    const b = { id: "b", kind: "macro" as const, tbl: "t", x: 0.1, y: 0.1 };
    const out = layoutTables([t, a, b]);
    const A = out.find((i) => i.id === "a")!, B = out.find((i) => i.id === "b")!;
    const overlap = A.x < B.x + B.w! && B.x < A.x + A.w! && A.y < B.y + B.h! && B.y < A.y + A.h!;
    expect(overlap).toBe(false);
  });
});

import { groupSlots } from "./GridBoard";
describe("group drop", () => {
  it("four lights land as a 2x2 block centred on the tap", () => {
    expect(groupSlots(4, 10, 6, 2, 1, 0.5)).toEqual([
      { x: 7.75, y: 4.75 }, { x: 10.25, y: 4.75 }, { x: 7.75, y: 6.25 }, { x: 10.25, y: 6.25 },
    ]);
  });
  it("a single light is centred exactly on the tap", () => {
    expect(groupSlots(1, 3, 4, 2, 1, 0.3)).toEqual([{ x: 2, y: 3.5 }]);
  });
  it("partial groups never stack on the same slot", () => {
    const s = groupSlots(3, 0, 0, 2, 1, 0.4);
    expect(s).toHaveLength(3);
    expect(new Set(s.map((p) => `${p.x},${p.y}`)).size).toBe(3);
  });
});

import { layoutTables as lt2 } from "./GridBoard";
import { describe as d2, it as i2, expect as e2 } from "vitest";
d2("macro table gaps", () => {
  i2("a macro dropped in a far cell stays there, leaving gaps", () => {
    const t = { id: "t", kind: "table" as const, x: 0, y: 0, w: 4.4, h: 3.7 };
    const m = { id: "m", kind: "macro" as const, tbl: "t", x: 3 * 1.1 + 0.2, y: 0.4 + 2 * 1.1 + 0.2, w: 0.7, h: 0.7, macro: { action: "undo" as never, amount: 0, label: "U" } };
    const out = lt2([t, m]).find((i) => i.id === "m")!;
    e2(Math.floor(out.x / 1.1)).toBe(3);
    e2(Math.floor((out.y - 0.4) / 1.1)).toBe(2);
  });
});

import { propSpot } from "./GridBoard";
import { describe as d3, it as i3, expect as e3 } from "vitest";
d3("prop placement", () => {
  i3("a picked prop lands centred on the tapped floor point", () => {
    const sp = propSpot(5, 8, 4, 1.8);
    e3(Math.abs(sp.x + 4 / 2 - 5)).toBeLessThanOrEqual(0.125);
    e3(Math.abs(sp.y + 1.8 / 2 - 8)).toBeLessThanOrEqual(0.125);
  });
  i3("the spot snaps to a quarter cell so props line up", () => {
    const sp = propSpot(5.09, 8.03, 4, 1.8);
    e3(Number.isInteger(sp.x * 4)).toBe(true);
    e3(Number.isInteger(sp.y * 4)).toBe(true);
    e3(sp.x).toBe(3);
    e3(sp.y).toBe(7.25);
  });
});
