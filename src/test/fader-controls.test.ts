import { describe, expect, it } from "vitest";
import { applyBank, faderCurve, paramValue } from "@/lib/playback";
import type { BankFader } from "@/lib/store";
import type { PatchedFixture } from "@/lib/dmx";

const fx = (uid: string) => ({ uid, name: uid, intensity: 1, cct: 0.5, gm: 0, hue: 0, saturation: 0, crossfade: 0, on: true, fx: { min: 0, max: 1, rate: 1 } } as unknown as PatchedFixture);
const fader = (p: Partial<BankFader>): BankFader => ({ id: "f", name: "F", kind: "fixtures", uids: ["a"], level: 0.5, ...p });

describe("fader curves", () => {
  it("linear passes through, exp is finer at the bottom, log is faster at the start", () => {
    expect(faderCurve("linear", 0.5)).toBe(0.5);
    expect(faderCurve("exp", 0.5)).toBe(0.25);
    expect(faderCurve("log", 0.5)).toBeCloseTo(Math.log10(5.5));
    expect(faderCurve("s", 0.5)).toBe(0.5);
  });
  it("an intensity fader at 50% with exp curve outputs 25%", () => {
    expect(applyBank([fx("a")], [fader({ curve: "exp" })], [])[0]!.intensity).toBe(0.25);
  });
});

describe("new fader parameters", () => {
  it("Green/Magenta maps 0..1 to magenta..green", () => {
    expect(paramValue("gm", fx("a"), 0).gm).toBe(-1);
    expect(paramValue("gm", fx("a"), 1).gm).toBe(1);
  });
  it("Pan writes the moving-head beam value", () => {
    expect(paramValue("pan", fx("a"), 0.3).beam).toEqual({ Pan: 0.3 });
  });
});

describe("REC / timeline faders", () => {
  it("scale their lights while up and leave them alone at zero", () => {
    const extra = { "rec:r1": ["a"] };
    expect(applyBank([fx("a")], [fader({ kind: "rec", ref: "r1", level: 0.4, uids: undefined })], [], null, null, extra)[0]!.intensity).toBeCloseTo(0.4);
    expect(applyBank([fx("a")], [fader({ kind: "rec", ref: "r1", level: 0, uids: undefined })], [], null, null, extra)[0]!.intensity).toBe(1);
  });
});
