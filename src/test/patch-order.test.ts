import { describe, expect, it } from "vitest";
import { movePatchFixture, patchRows, togglePick, patchClashes } from "@/lib/patch-order";
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