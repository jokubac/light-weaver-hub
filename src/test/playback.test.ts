import { describe, expect, it } from "vitest";
import { applyBank, nextCueNumber, snapBank, releaseBank, moveLinked } from "@/lib/playback";
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
  it("snapshot fades levels and leaves other faders", () => {
    const b = [{ id: "a", name: "a", kind: "group" as const, level: 0 }, { id: "b", name: "b", kind: "group" as const, level: 0.3 }];
    const out = snapBank(b, { id: "s", name: "s", levels: { a: 1 } }, { a: 0 }, 0.5);
    expect(out[0]!.level).toBe(0.5);
    expect(out[1]!.level).toBe(0.3);
  });
  it("release resets intensity to full and colour to untouched", () => {
    const out = releaseBank([{ id: "a", name: "a", kind: "group", level: 0.2, off: true }, { id: "h", name: "h", kind: "group", param: "hue", level: 0.7, touched: 5 }]);
    expect(out[0]!.level).toBe(1); expect(out[0]!.off).toBe(false);
    expect(out[1]!.level).toBe(0); expect(out[1]!.touched).toBeUndefined();
  });
  it("linked faders move by the same amount", () => {
    const b = [{ id: "a", name: "a", kind: "group" as const, level: 0.5 }, { id: "b", name: "b", kind: "group" as const, level: 0.9 }, { id: "c", name: "c", kind: "group" as const, level: 0.5 }];
    const out = moveLinked(b, 0, 0.7, new Set(["a", "b"]));
    expect(out.map((x) => x.level)).toEqual([0.7, 1, 0.5]);
  });
  it("numbers point cues between existing ones", () => {
    const c = (n: number) => ({ id: String(n), number: n, name: "", fade: 0, states: [] });
    expect(nextCueNumber([c(1), c(2)])).toBe(3);
    expect(nextCueNumber([c(1), c(2), c(3)], 2)).toBe(2.5);
  });
});
