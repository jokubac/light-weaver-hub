import { describe, expect, it } from "vitest";
import { MACRO_CELL, applySize, boxOf, fixtureBox, layoutTables, spanOf, type GridItem } from "@/components/console/GridBoard";

const SZ = 0.92;
const table = (over: Partial<GridItem> = {}): GridItem => ({ id: "t1", kind: "table", text: "Macros", cols: 4, rows: 3, x: 0, y: 0, w: 4 * MACRO_CELL, h: 3 * MACRO_CELL + 0.4, ...over });
const macro = (over: Partial<GridItem> = {}): GridItem => ({ id: "m1", kind: "macro", tbl: "t1", x: 0.1, y: 0.5, macro: { action: "cct_step_up", amount: 100, label: "CCT +100K" }, ...over });

describe("macro table resizing", () => {
  it("keeps its column count when dragged narrower — cells shrink instead of collapsing to one column", () => {
    const t = table();
    const laid = layoutTables([t, macro({ x: 0.1, y: 0.5 })], SZ);
    const cols = laid.find((i) => i.id === "t1")!.cols;
    expect(cols).toBe(4);
    const narrow = layoutTables(laid.map((i) => (i.id === "t1" ? { ...i, w: 2.2 } : i)), SZ);
    const nt = narrow.find((i) => i.id === "t1")!;
    expect(nt.cols).toBe(4);
    // cell width follows the narrower table
    expect(nt.w! / nt.cols!).toBeCloseTo(2.2 / 4, 5);
  });

  it("gains columns when dragged wider", () => {
    const t = table({ w: 6.6 });
    const laid = layoutTables([t, macro({ x: 5, y: 0.5 })], SZ);
    expect(laid.find((i) => i.id === "t1")!.cols).toBe(6);
  });

  it("shrinks its height when the bottom edge is dragged up", () => {
    const t = table();
    const laid = layoutTables([t, macro({ x: 0.1, y: 0.5 })], SZ);
    const before = laid.find((i) => i.id === "t1")!.h!;
    const shrunk = layoutTables(laid.map((i) => (i.id === "t1" ? { ...i, h: 2.0 } : i)), SZ);
    const after = shrunk.find((i) => i.id === "t1")!.h!;
    expect(after).toBeLessThan(before);
  });

  it("never grows taller than the macros need", () => {
    const t = table();
    const laid = layoutTables([t, macro({ x: 0.1, y: 0.5 })], SZ);
    const nt = laid.find((i) => i.id === "t1")!;
    const m = laid.find((i) => i.id === "m1")!;
    expect(nt.h!).toBeLessThanOrEqual(3 * MACRO_CELL + 0.4 + 0.01);
    // the macro sits inside the table
    expect(m.x!).toBeGreaterThan(nt.x!);
  });
});

describe("size stops", () => {
  it("a stop below 1 shrinks the macro inside its cells and keeps it centred", () => {
    const t = table();
    const full = layoutTables([t, macro({ x: 0.1, y: 0.5 })], SZ);
    const mFull = full.find((i) => i.id === "m1")!;
    const half = layoutTables([t, macro({ x: 0.1, y: 0.5, sk: 0.5 })], SZ);
    const mHalf = half.find((i) => i.id === "m1")!;
    expect(mHalf.w!).toBeCloseTo(mFull.w! * 0.5 + (mFull.w! * 0.06) / (1 - 0.06) / 2 * 0, 2); // roughly half
    expect(mHalf.w!).toBeLessThan(mFull.w!);
    const fullCx = mFull.x! + mFull.w! / 2, halfCx = mHalf.x! + mHalf.w! / 2;
    expect(Math.abs(fullCx - halfCx)).toBeLessThan(0.02);
    expect(Math.abs(mFull.y! + mFull.h! / 2 - (mHalf.y! + mHalf.h! / 2))).toBeLessThan(0.02);
  });

  it("a stop of 2 or more takes that many cells", () => {
    const t = table();
    const laid = layoutTables([t, macro({ x: 0.1, y: 0.5, cs: 3, rs: 1 })], SZ);
    const m = laid.find((i) => i.id === "m1")!;
    const tb = boxOf(laid.find((i) => i.id === "t1")!, SZ);
    const cols = laid.find((i) => i.id === "t1")!.cols!;
    const cw = tb.w / cols;
    expect(m.w!).toBeCloseTo(3 * cw * (1 - 0.12), 2); // 3 cells minus padding on both sides
  });

  it("corner resize resets the stop to full cells", () => {
    const t = table();
    const s = spanOf(1.05, 1.0, t, SZ);
    expect(s.cs).toBe(1);
    expect(s.rs).toBe(1);
    expect(s.sk).toBe(1);
  });

  it("fixture size stops scale the light about its centre", () => {
    const fx: GridItem = { id: "f1", kind: "fixture", uid: "u1", x: 5, y: 5 };
    const def = fixtureBox(SZ).w;
    const out = applySize([fx], ["f1"], def * 0.5, SZ);
    expect(out[0]!.s).toBeCloseTo(def * 0.5, 5);
    expect(out[0]!.x).toBeGreaterThan(fx.x - 0.001); // stays roughly in place, centred
  });
});
