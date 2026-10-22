import { describe, it, expect } from "vitest";
import { placeInColumns } from "./pixels";
const fx = (uid: string, defId: string) => ({ uid, defId, modeIdx: 0, name: uid, universe: 1, address: 1 }) as never;
describe("placeInColumns", () => {
  it("puts at most 8 lights in one column", () => {
    const m = placeInColumns(Array.from({ length: 10 }, (_, i) => fx(`a${i}`, "same")));
    expect(new Set([...m.values()].map((p) => p.x)).size).toBe(2);
  });
  it("starts a new column when the model changes", () => {
    const m = placeInColumns([fx("a", "m1"), fx("b", "m1"), fx("c", "m2")]);
    expect(m.get("a")!.x).toBe(m.get("b")!.x);
    expect(m.get("c")!.x).not.toBe(m.get("a")!.x);
  });
});
