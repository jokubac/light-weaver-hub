import { describe, it, expect } from "vitest";
import { VERIFIED_FIXTURES } from "@/lib/verified-fixtures";

// Nanlux Evoke 2400B DMX Reference Guide: CCT 8bit 10/6 (reduced), CCT 16bit 15/9, Ultimate 15.
describe("Evoke 2400B chart", () => {
  it("mode channel counts", () => {
    const f = VERIFIED_FIXTURES.find((x) => x.brand === "Nanlux" && x.model === "Evoke 2400B")!;
    expect(f.modes.map((m) => m.channels)).toEqual([10, 6, 15, 9, 15, 15]);
  });
});
