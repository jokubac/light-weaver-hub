import { describe, it, expect } from "vitest";
import { movePatchBlock, blockLanding, renamePattern } from "./patch-order";
const fx = (ids: string[]) => ids.map((uid) => ({ uid })) as never[];
const ids = (l: { uid: string }[]) => l.map((f) => f.uid).join("");
describe("patch block move", () => {
  it("moves a block of two down past one", () => expect(ids(movePatchBlock(fx(["a","b","c","d"]), ["a","b"], 1))).toBe("cabd"));
  it("moves a non-contiguous selection together", () => expect(ids(movePatchBlock(fx(["a","b","c","d"]), ["b","d"], 0))).toBe("bdac"));
  it("landing when dropping a,b on d", () => {
    const l = fx(["a","b","c","d"]); const { insertAt, rows } = blockLanding(l, ["a","b"], 3);
    expect(ids(movePatchBlock(l, ["a","b"], insertAt))).toBe("cdab"); expect(rows).toEqual([2, 3]);
  });
  it("landing when dropping c,d on a", () => {
    const l = fx(["a","b","c","d"]); const { insertAt } = blockLanding(l, ["c","d"], 0);
    expect(ids(movePatchBlock(l, ["c","d"], insertAt))).toBe("cdab");
  });
});
describe("renamePattern", () => {
  it("Key {n}", () => expect(renamePattern("Key {n}", 3)).toEqual(["Key 1", "Key 2", "Key 3"]));
  it("start 10 step 2", () => expect(renamePattern("Fill", 2, 10, 2)).toEqual(["Fill 10", "Fill 12"]));
  it("list", () => expect(renamePattern("Key, Fill, Back", 3)).toEqual(["Key", "Fill", "Back"]));
});
