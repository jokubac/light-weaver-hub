import { describe, expect, it } from "vitest";
import { applyPark, cueAtTimecode, cueTarget, MtcDecoder, parseTc, programmerDiff } from "@/lib/show-control";
import type { Cue, LookState } from "@/lib/store";
import type { PatchedFixture } from "@/lib/dmx";

const fx = (uid: string, intensity = 0.5): PatchedFixture => ({ uid, name: uid, intensity, cct: 0.5, gm: 0, hue: 0, saturation: 0, crossfade: 0, on: true } as unknown as PatchedFixture);
const st = (intensity: number) => ({ intensity, cct: 0.5, gm: 0, hue: 0, saturation: 0, crossfade: 0, on: true } as unknown as LookState);
const cue = (id: string, number: number, states: [string, number][], mode?: Cue["mode"], tc?: number): Cue =>
  ({ id, number, name: id, fade: 0, mode, tc, states: states.map(([uid, i]) => ({ uid, name: uid, state: st(i) })) });

describe("tracking vs cue-only", () => {
  const a = fx("a"), b = fx("b");
  it("tracking carries a value into later cues", () => {
    const t = cueTarget([cue("1", 1, [["a", 1]]), cue("2", 2, [["b", 0.3]])], 1, [a, b]);
    expect(t.get("a")!.intensity).toBe(1);
    expect(t.get("b")!.intensity).toBe(0.3);
  });
  it("a cue-only value does not carry into the next cue", () => {
    const t = cueTarget([cue("1", 1, [["a", 0.2]]), cue("2", 2, [["a", 1]], "cueonly"), cue("3", 3, [["b", 0.4]])], 2, [a, b]);
    expect(t.get("a")!.intensity).toBe(0.2);
  });
});

describe("park and programmer", () => {
  it("parked light outputs its parked level, others untouched", () => {
    const out = applyPark([fx("a", 0.9), fx("b", 0.9)], { a: st(0.1) });
    expect(out[0]!.intensity).toBe(0.1);
    expect(out[1]!.intensity).toBe(0.9);
  });
  it("programmer lists only lights changed from the stored cue", () => {
    expect(programmerDiff([fx("a", 0.5), fx("b", 0.8)], new Map([["a", st(0.5)], ["b", st(0.2)]]))).toEqual(["b"]);
  });
});


describe("MIDI timecode", () => {
  it("full-frame 01:02:03:00 at 25 fps is 3723 s", () => {
    expect(new MtcDecoder().message([0xf0, 0x7f, 0x7f, 0x01, 0x01, 0x20 | 1, 2, 3, 0, 0xf7])).toBe(3723);
  });
  it("fires the cue whose timecode was crossed", () => {
    const s = [cue("1", 1, [], undefined, 10), cue("2", 2, [], undefined, 20)];
    expect(cueAtTimecode(s, 9.9, 10.1)?.id).toBe("1");
    expect(cueAtTimecode(s, 10.1, 10.2)).toBeNull();
  });
  it("parses 00:00:10:00 as 10 s", () => expect(parseTc("00:00:10:00")).toBe(10));
});
