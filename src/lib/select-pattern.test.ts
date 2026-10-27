import { describe, it, expect } from "vitest";
import { pickPattern } from "./select-pattern";
const all = [1, 2, 3, 4, 5, 6];
describe("pickPattern", () => {
  it("odd of all", () => expect(pickPattern(all, [], "odd")).toEqual([1, 3, 5]));
  it("even of all", () => expect(pickPattern(all, [], "even")).toEqual([2, 4, 6]));
  it("every 3rd", () => expect(pickPattern(all, [], 3)).toEqual([1, 4]));
  it("odd within selection", () => expect(pickPattern(all, [2, 3, 4, 5], "odd")).toEqual([2, 4]));
});
