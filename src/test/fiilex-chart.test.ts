import { describe, expect, it } from "vitest";
import K from "@/lib/fiilex-k-color-v2.json";
import { FIXTURE_LIBRARY } from "@/lib/dmx";

describe("Fiilex K10/K40 COLOR V2 chart", () => {
  const by = (n: number) => (K as { name: string; channels: number }[]).find((m) => m.name.startsWith(`Mode ${n}:`))!;
  it("uses the V2 footprints", () => {
    expect(by(401).channels).toBe(6);
    expect(by(409).channels).toBe(9);
    expect(by(411).channels).toBe(13);
    expect(by(504).channels).toBe(259);
  });
  it("hides the old guessed G3/G6 rental entries", () => {
    const g3 = FIXTURE_LIBRARY.find((d) => d.id === "fiilex-g3-color")!;
    expect(g3.modes.every((m) => m.legacy)).toBe(true);
  });
});
