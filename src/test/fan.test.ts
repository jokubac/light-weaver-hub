import { describe, expect, it } from "vitest";
import { fanValues } from "@/lib/fan";

describe("fanValues", () => {
  it("spreads 20%→100% evenly across 5 lights", () => {
    expect(fanValues(5, 20, 100)).toEqual([20, 40, 60, 80, 100]);
  });
  it("spreads 3200K→5600K across 3 lights", () => {
    expect(fanValues(3, 3200, 5600)).toEqual([3200, 4400, 5600]);
  });
  it("center mode keeps the middle at the start value and the ends at the end value", () => {
    expect(fanValues(5, 0, 100, "center")).toEqual([100, 50, 0, 50, 100]);
  });
});
