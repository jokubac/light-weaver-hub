import { describe, expect, it } from "vitest";
import { movePatchFixture, patchRows } from "@/lib/patch-order";
import { normalizeFixture } from "@/lib/dmx";

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
});