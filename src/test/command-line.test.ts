import { describe, expect, it } from "vitest";
import { parseCommand } from "@/lib/command-line";

describe("parseCommand", () => {
  it("adds lights and sets a level", () => expect(parseCommand("1 + 3 + 5 @ 80", 10)).toEqual({ select: [1, 3, 5], level: 0.8 }));
  it("handles THRU, minus and FULL", () => expect(parseCommand("1 THRU 6 - 4 @ FULL", 10)).toEqual({ select: [1, 2, 3, 5, 6], level: 1 }));
  it("levels the current selection", () => expect(parseCommand("@ 50", 10)).toEqual({ level: 0.5 }));
  it("selects only", () => expect(parseCommand("2 thru 4", 10)).toEqual({ select: [2, 3, 4] }));
  it("ignores lights that don't exist", () => expect(parseCommand("9 THRU 20", 10).select).toEqual([9, 10]));
  it("reports errors", () => expect(parseCommand("50", 10).error).toBeTruthy());
});
