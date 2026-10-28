import { describe, expect, it } from "vitest";
import { chaseTimeline, encodeLtc, LtcDecoder, ltcSeconds, realScale, type LtcFrame } from "@/lib/ltc";

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

describe("real cable signals", () => {
  it("decodes a quiet, offset, softened and noisy LTC signal", () => {
    const sr = 48000, dec = new LtcDecoder(sr, 25); const got: LtcFrame[] = [];
    let lv = 0.5, y = 0, seed = 1;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5; };
    for (let f = 0; f < 10; f++) {
      const a = encodeLtc({ h: 10, m: 0, s: 0, f, drop: false }, sr, 25, 0.5, lv); lv = a[a.length - 1]!;
      const b = new Float32Array(a.length);
      for (let i = 0; i < a.length; i++) { y += (a[i]! * 0.02 - y) * 0.35; b[i] = y + 0.01 + rnd() * 0.002; }
      dec.feed(b, (x) => got.push(x));
    }
    expect(got.at(-1)).toMatchObject({ h: 10, s: 0, f: 8 });
  });
  it("23.976 timecode maps to the slower real clock", () => {
    expect(chaseTimeline(3624, 3600, 600, null, 0.1, realScale(23.976))).toEqual({ do: "play", t: 24 * 24000 / 1001 / 24 });
  });
});
