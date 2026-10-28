import { describe, expect, it } from "vitest";
import { chaseTimeline, encodeLtc, LtcDecoder, ltcSeconds, type LtcFrame } from "@/lib/ltc";

const run = (rate: 25 | 30 | 24, sr = 48000) => {
  const dec = new LtcDecoder(sr, rate); const got: LtcFrame[] = [];
  let lv = 0.5;
  for (let f = 0; f < 7; f++) {
    const a = encodeLtc({ h: 1, m: 2, s: 3, f, drop: false }, sr, rate, 0.5, lv);
    lv = a[a.length - 1]!;
    dec.feed(a, (x) => got.push(x));
  }
  return got;
};

describe("LTC audio timecode", () => {
  it("decodes 25 fps frames from audio", () => {
    const got = run(25);
    expect(got.length).toBeGreaterThanOrEqual(4);
    expect(got.at(-1)).toMatchObject({ h: 1, m: 2, s: 3, f: 5 });
  });
  it("decodes 30 fps at 44.1 kHz", () => {
    const got = run(30, 44100);
    expect(got.at(-1)).toMatchObject({ h: 1, m: 2, s: 3, f: 5 });
  });
  it("23.976 counts 24 frames per timecode second", () => {
    expect(ltcSeconds({ h: 0, m: 0, s: 1, f: 12, drop: false }, 23.976)).toBe(1.5);
  });
});

describe("timeline chase", () => {
  it("starts the timeline at timecode minus its start", () => {
    expect(chaseTimeline(3610, 3600, 60, null)).toEqual({ do: "play", t: 10 });
  });
  it("re-seeks when drift exceeds 0.1 s, not below", () => {
    expect(chaseTimeline(3610, 3600, 60, 10.05)).toBeNull();
    expect(chaseTimeline(3610, 3600, 60, 10.3)).toEqual({ do: "seek", t: 10 });
  });
  it("pauses before the start or past the end", () => {
    expect(chaseTimeline(3590, 3600, 60, 5)).toEqual({ do: "pause" });
    expect(chaseTimeline(3700, 3600, 60, 5)).toEqual({ do: "pause" });
  });
});
