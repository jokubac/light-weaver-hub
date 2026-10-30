import { describe, expect, it } from "vitest";
import { movePatchFixture, patchRows, togglePick, patchClashes, patchOffset, patchWindow } from "@/lib/patch-order";
import { getDef, normalizeFixture } from "@/lib/dmx";

const fixtures = [
  normalizeFixture({ uid: "a", name: "Zulu", universe: 2, address: 41 }),
  normalizeFixture({ uid: "b", name: "Alpha", universe: 1, address: 21 }),
  normalizeFixture({ uid: "c", name: "Middle", universe: 3, address: 1 }),
];

describe("Patch positions", () => {
  it("displays canonical positions without sorting names or addresses", () => {
    expect(patchRows(fixtures, null).map((r) => [r.fixture.uid, r.number])).toEqual([["a", 1], ["b", 2], ["c", 3]]);
  });
  it("sorts names without changing fixture numbers or canonical order", () => {
    const rows = patchRows(fixtures, { k: "name", dir: 1 });
    expect(rows.map((r) => [r.fixture.uid, r.number])).toEqual([["b", 2], ["c", 3], ["a", 1]]);
    expect(fixtures.map((f) => f.uid)).toEqual(["a", "b", "c"]);
  });
  it("sorts universe and address independently while preserving numbers", () => {
    expect(patchRows(fixtures, { k: "univ", dir: 1 }).map((r) => r.number)).toEqual([2, 1, 3]);
    expect(patchRows(fixtures, { k: "dmx", dir: 1 }).map((r) => r.number)).toEqual([3, 2, 1]);
  });
  it("drag insertion changes numbers but preserves the whole fixture and patch", () => {
    const moved = movePatchFixture(fixtures, "a", 2);
    expect(patchRows(moved, null).map((r) => [r.fixture.uid, r.number])).toEqual([["b", 1], ["c", 2], ["a", 3]]);
    expect(moved[2]).toBe(fixtures[0]);
    expect(moved[2]?.address).toBe(41);
    expect(moved[2]?.universe).toBe(2);
    expect(movePatchFixture(moved, "a", 0)).toEqual(fixtures);
  });
  it("a plain click keeps earlier picks and a second click on the same light drops only it", () => {
    let picked: string[] = [];
    picked = togglePick(picked, "a");
    expect(picked).toEqual(["a"]);
    picked = togglePick(picked, "b");
    expect(picked).toEqual(["a", "b"]);
    picked = togglePick(picked, "c");
    expect(picked).toEqual(["a", "b", "c"]);
    picked = togglePick(picked, "b");
    expect(picked).toEqual(["a", "c"]);
    picked = togglePick(picked, "c");
    picked = togglePick(picked, "a");
    expect(picked).toEqual([]);
  });
});

describe("Patch clash scan", () => {
  const ch = Math.max(1, getDef("generic-rgbw-par").modes[0]?.channels ?? 1);
  const at = (uid: string, universe: number, address: number) =>
    normalizeFixture({ uid, name: uid, universe, address, defId: "generic-rgbw-par" });
  it("flags both lights when their channels overlap", () => {
    expect([...patchClashes([at("a", 1, 1), at("b", 1, ch)])].sort()).toEqual(["a", "b"]);
  });
  it("leaves lights that sit side by side alone", () => {
    expect(patchClashes([at("a", 1, 1), at("c", 1, ch + 1)])).toEqual(new Set());
  });
  it("the same address in another universe is not a clash", () => {
    expect(patchClashes([at("a", 1, 1), at("b", 2, 1)])).toEqual(new Set());
  });
});

describe("Patch sheet band", () => {
  const ROW_H = 34;
  it("counts plain rows", () => {
    expect(patchWindow(1000, 0, 340, ROW_H, 0)).toEqual({ first: 0, last: 11 });
    expect(patchWindow(1000, 1000, 340, ROW_H, 0)).toEqual({ first: 29, last: 40 });
  });
  it("an open editor adds its real height to every row below it", () => {
    const open = { index: 5, extra: 200 };
    expect(patchOffset(5, ROW_H, open)).toBe(170);
    expect(patchOffset(6, ROW_H, open)).toBe(404);
    expect(patchOffset(5, ROW_H, null)).toBe(170);
  });
  it("keeps the row being edited in the band while the sheet is scrolled", () => {
    // the old maths divided by the plain row height, which put the band 7 rows past an open editor
    const open = { index: 43, extra: 220 };
    const at = 43 * ROW_H + 60;
    const w = patchWindow(1000, at, 340, ROW_H, 0, open);
    expect(w.first).toBeLessThanOrEqual(43);
    expect(w.last).toBeGreaterThan(43);
    expect(patchWindow(1000, at, 340, ROW_H, 0, null).first).toBeGreaterThan(43);
  });
  it("a row inside the open editor resolves to the editor itself", () => {
    const open = { index: 5, extra: 200 };
    expect(patchWindow(1000, 5 * ROW_H + 100, 340, ROW_H, 0, open).first).toBe(5);
  });
});
import { renameSequence } from "@/lib/patch-order";
describe("renameSequence", () => {
  it("adds padded sequence numbers after the name", () => {
    expect(renameSequence({ base: "Key", numbering: "after", start: 1, step: 1, pad: 2, sep: " " }, [{}, {}])).toEqual(["Key 01", "Key 02"]);
  });
  it("puts the number before with step", () => {
    expect(renameSequence({ base: "Fill", numbering: "before", start: 10, step: 5, pad: 1, sep: "-" }, [{}, {}])).toEqual(["10-Fill", "15-Fill"]);
  });
  it("numbers every light in order when no step is given", () => {
    expect(renameSequence({ base: "Key", numbering: "after", start: 1, pad: 1, sep: " " }, [{}, {}, {}])).toEqual(["Key 1", "Key 2", "Key 3"]);
  });
});
