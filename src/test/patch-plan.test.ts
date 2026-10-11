import { describe, expect, it } from "vitest";
import { planPatch } from "@/lib/patch-plan";

describe("planPatch", () => {
  it("reports overflow without moving universes", () => {
    const p = planPatch([], 1, 500, 10, 3, 0, false);
    expect(p.overflows).toBe(true);
    expect(p.problem).toMatch(/512/);
  });
  it("moves the fixture that would not fit to the next universe", () => {
    const p = planPatch([], 1, 495, 10, 3, 0, true);
    expect(p.problem).toBeNull();
    expect(p.slots).toEqual([{ universe: 1, address: 495 }, { universe: 2, address: 1 }, { universe: 2, address: 11 }]);
  });
});
