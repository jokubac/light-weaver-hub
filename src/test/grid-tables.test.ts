import { describe, expect, it } from "vitest";
import { MACRO_CELL, applySize, boxOf, fixtureBox, layoutTables, resizeTable, spanOf, TABLE_HEADER, type GridItem } from "@/components/console/GridBoard";

const SZ = 0.92;
const table = (over: Partial<GridItem> = {}): GridItem => ({ id: "t1", kind: "table", text: "Macros", cols: 4, rows: 3, x: 0, y: 0, w: 4 * MACRO_CELL, h: 3 * MACRO_CELL + 0.4, ...over });
const macro = (over: Partial<GridItem> = {}): GridItem => ({ id: "m1", kind: "macro", tbl: "t1", x: 0.1, y: 0.5, macro: { action: "cct_up", amount: 100, label: "CCT +" }, ...over });

describe("macro table resizing", () => {
  const box = (i: GridItem) => ({ id: i.id, x: i.x, y: i.y, w: i.w!, h: i.h! });
  it("buttons keep their size when the table is resized", () => {
    const laid = layoutTables([table(), macro()], SZ);
    const before = laid.find((i) => i.id === "m1")!;
    const t = laid.find((i) => i.id === "t1")!;
    const nb = resizeTable(box(t), "br", t.x + 10 * MACRO_CELL, t.y + 8 * MACRO_CELL);
    const after = layoutTables(laid.map((i) => (i.id === "t1" ? { ...i, ...nb } : i)), SZ).find((i) => i.id === "m1")!;
    expect(after.w).toBeCloseTo(before.w!, 5);
    expect(after.h).toBeCloseTo(before.h!, 5);
    expect(after.x).toBeCloseTo(before.x, 5);
  });
  it("an empty table shrinks from every side down to one cell", () => {
    const t = box(table());
    for (const c of ["tl", "tr", "bl", "br"] as const) {
      const nb = resizeTable(t, c, c[1] === "l" ? 99 : -99, c[0] === "t" ? 99 : -99);
      expect(nb.w).toBeCloseTo(MACRO_CELL, 5);
      expect(nb.h).toBeCloseTo(MACRO_CELL + TABLE_HEADER, 5);
    }
  });
  it("shrinks from the bottom and right past its macros down to one cell", () => {
    const laid = layoutTables([table(), macro()], SZ);
    const t = laid.find((i) => i.id === "t1")!, m = laid.find((i) => i.id === "m1")!;
    const nb = resizeTable(box(t), "br", -99, -99);
    expect(nb.w).toBeCloseTo(MACRO_CELL, 5);
    expect(nb.h).toBeCloseTo(MACRO_CELL + TABLE_HEADER, 5);
  });
  it("shrinks from the top and left past its macros down to one cell", () => {
    const t0 = table();
    const laid = layoutTables([t0, macro({ x: 3 * MACRO_CELL + 0.1, y: 2 * MACRO_CELL + 0.5 })], SZ);
    const t = laid.find((i) => i.id === "t1")!, m = laid.find((i) => i.id === "m1")!;
    const nb = resizeTable(box(t), "tl", 99, 99);
    expect(nb.x).toBeCloseTo(3 * MACRO_CELL, 5);
    expect(nb.y).toBeCloseTo(2 * MACRO_CELL, 5);
    expect(nb.w).toBeCloseTo(MACRO_CELL, 5);
    const after = layoutTables(laid.map((i) => (i.id === "t1" ? { ...i, ...nb } : i)), SZ).find((i) => i.id === "m1")!;
    expect(after.x).toBeCloseTo(m.x, 5);
    expect(after.y).toBeCloseTo(m.y, 5);
  });
  it("a table whose macros fill every cell still shrinks from the top-left corner", () => {
    const laid = layoutTables([table(), macro({ x: 0.1, y: 0.5 }), macro({ id: "m2", x: 3 * MACRO_CELL + 0.1, y: 2 * MACRO_CELL + 0.5 })], SZ);
    const t = laid.find((i) => i.id === "t1")!;
    const nb = resizeTable(box(t), "tl", 2 * MACRO_CELL, 2 * MACRO_CELL + TABLE_HEADER);
    expect(nb.x).toBeCloseTo(2 * MACRO_CELL, 5);
    expect(Math.round(nb.w / MACRO_CELL)).toBe(2);
    const after = layoutTables(laid.map((i) => (i.id === "t1" ? { ...i, ...nb } : i)), SZ).filter((i) => i.tbl === "t1");
    expect(after).toHaveLength(2);
    for (const m of after) expect(m.x).toBeGreaterThanOrEqual(nb.x - 1e-6);
  });

  it("grows without limit", () => {
    const nb = resizeTable(box(table()), "br", 500 * MACRO_CELL, 300 * MACRO_CELL);
    expect(Math.round(nb.w / MACRO_CELL)).toBe(500);
  });
});

describe("size stops", () => {
  it("a stop below 1 shrinks the macro inside its cells and keeps it centred", () => {
    const t = table();
    const full = layoutTables([t, macro({ x: 0.1, y: 0.5 })], SZ);
    const mFull = full.find((i) => i.id === "m1")!;
    const half = layoutTables([t, macro({ x: 0.1, y: 0.5, sk: 0.5 })], SZ);
    const mHalf = half.find((i) => i.id === "m1")!;
    expect(mHalf.w!).toBeLessThan(mFull.w!);
    expect(mHalf.w!).toBeGreaterThan(mFull.w! * 0.4);
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
    expect(m.w!).toBeCloseTo(3 * cw - 2 * cw * 0.06, 2); // 3 cells minus padding on both sides
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
