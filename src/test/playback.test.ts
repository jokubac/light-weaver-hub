import { describe, expect, it } from "vitest";
import { applyBank, nextCueNumber } from "@/lib/playback";
import type { PatchedFixture } from "@/lib/dmx";

const fx = (uid: string, group?: string) => ({ uid, name: uid, intensity: 0.8, cct: 0.5, gm: 0, hue: 0, saturation: 0, crossfade: 0, cctOnly: true, fx: { kind: "none" }, on: true, ...(group ? { group } : {}) }) as unknown as PatchedFixture;

describe("playback bank", () => {
  it("scales group intensity, flash and solo", () => {
    const fs = [fx("a", "Key"), fx("b", "Fill")];
    const bank = [{ id: "1", name: "Key", kind: "group" as const, ref: "Key", level: 0.5 }];
    expect(applyBank(fs, bank, [])[0]!.intensity).toBeCloseTo(0.4);
    expect(applyBank(fs, bank, [], "1")[0]!.intensity).toBeCloseTo(0.8);
    expect(applyBank(fs, bank, [], null, "1")[1]!.intensity).toBe(0);
    expect(fs[0]!.intensity).toBe(0.8);
  });
  it("last moved colour fader wins (LTP)", () => {
    const fs = [fx("a", "Key")];
    const A = { id: "A", name: "A", kind: "group" as const, ref: "Key", param: "hue" as const, level: 0.25, touched: 200 };
    const B = { id: "B", name: "B", kind: "group" as const, ref: "Key", param: "hue" as const, level: 0.5, touched: 100 };
    expect(applyBank(fs, [A, B], [])[0]!.hue).toBe(90);
    expect(applyBank(fs, [A, { ...B, touched: 300 }], [])[0]!.hue).toBe(180);
  });
  it("untouched colour fader changes nothing, off intensity fader darkens", () => {
    const fs = [fx("a", "Key")];
    expect(applyBank(fs, [{ id: "c", name: "c", kind: "group", ref: "Key", param: "cct", level: 0 }], [])[0]!.cct).toBe(0.5);
    expect(applyBank(fs, [{ id: "i", name: "i", kind: "group", ref: "Key", level: 1, off: true }], [])[0]!.intensity).toBe(0);
  });
  it("numbers point cues between existing ones", () => {
    const c = (n: number) => ({ id: String(n), number: n, name: "", fade: 0, states: [] });
    expect(nextCueNumber([c(1), c(2)])).toBe(3);
    expect(nextCueNumber([c(1), c(2), c(3)], 2)).toBe(2.5);
  });
});
