import { expect, it } from "vitest";
import { applyAudio, follow } from "@/lib/audio-react";
import { defaultLayer } from "@/lib/pixels";
const lv = { bass: 1, mid: 0, high: 0.5, level: 0.5, beat: true };
it("loud bass doubles... speeds up a speed-on-bass effect, quiet leaves it", () => {
  const l = { ...defaultLayer(), speed: 1, audio: { enabled: true, speed: { on: true, band: "bass" as const, amount: 0.5 } } };
  expect(applyAudio(l, lv).speed).toBe(3);
  expect(applyAudio(l, { ...lv, bass: 0 }).speed).toBe(1);
});
it("disabled sound changes nothing", () => {
  const l = { ...defaultLayer(), audio: { enabled: false, speed: { on: true, band: "bass" as const, amount: 1 } } };
  expect(applyAudio(l, lv)).toBe(l);
});
it("envelope rises with attack and falls slower with release", () => {
  expect(follow(0, 1, 1, 0, 1)).toBe(1);
  expect(follow(1, 0, 0.1, 0, 1)).toBeGreaterThan(0.8);
});
