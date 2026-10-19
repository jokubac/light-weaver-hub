import { describe, expect, it } from "vitest";
import { defaultFx, type PatchedFixture } from "@/lib/dmx";
import { timelineAt, type Timeline } from "@/lib/timeline";

const f = { uid: "a", name: "A", intensity: 0.5, cct: 0.5, fx: defaultFx() } as unknown as PatchedFixture;
const tl = (): Timeline => ({
  tracks: [{ id: "top", name: "Layer 1" }, { id: "bottom", name: "Layer 2" }],
  clips: [
    { id: "lo", track: "bottom", kind: "level", name: "lo", start: 0, length: 10, uids: ["a"], from: { intensity: 0.2 }, to: { intensity: 0.2 } },
    { id: "hi", track: "top", kind: "level", name: "hi", start: 2, length: 4, uids: ["a"], from: { intensity: 0 }, to: { intensity: 1 } },
  ],
});

describe("timeline", () => {
  it("top layer wins where clips overlap", () => {
    expect(timelineAt(tl(), 4, [f], [], new Map()).states.get("a")?.intensity).toBeCloseTo(0.5);
    expect(timelineAt(tl(), 1, [f], [], new Map()).states.get("a")?.intensity).toBeCloseTo(0.2);
  });
  it("muted layer is skipped and nothing plays after the clips", () => {
    const t = tl(); t.tracks[0]!.muted = true;
    expect(timelineAt(t, 4, [f], [], new Map()).states.get("a")?.intensity).toBeCloseTo(0.2);
    expect(timelineAt(t, 11, [f], [], new Map()).states.size).toBe(0);
  });
  it("fade in scales the clip", () => {
    const t = tl(); t.clips[0]!.fadeIn = 2;
    expect(timelineAt(t, 1, [f], [], new Map()).states.get("a")?.intensity).toBeCloseTo(0.1);
  });
});

import { placeClip } from "@/components/console/TimelinePanel";
describe("timeline layers never overlap", () => {
  it("a clashing clip moves to a free layer", () => {
    const t = tl(); t.tracks = [t.tracks[0]!];
    const out = placeClip(t, { ...t.clips[1]!, id: "new", track: "top" });
    const a = out.clips.filter((c) => c.track === "top");
    expect(a.some((c) => c.id === "new") && a.some((c) => c.id === "hi")).toBe(false);
    expect(out.tracks.length).toBe(2);
  });
});

describe("timeline keyframes and adjustment layers", () => {
  const base = (): Timeline => ({ tracks: [{ id: "adj", name: "Adj", adjust: true }, { id: "l", name: "L" }], clips: [
    { id: "k", track: "l", kind: "level", name: "k", start: 0, length: 10, uids: ["a"], keys: [{ id: "1", t: 0, intensity: 0 }, { id: "2", t: 4, intensity: 1, hue: 120, sat: 1 }, { id: "3", t: 8, intensity: 0.5 }] },
  ] });
  it("interpolates intensity between points and holds after the last", () => {
    expect(timelineAt(base(), 2, [f], [], new Map()).states.get("a")?.intensity).toBeCloseTo(0.5);
    expect(timelineAt(base(), 6, [f], [], new Map()).states.get("a")?.intensity).toBeCloseTo(0.75);
    expect(timelineAt(base(), 9, [f], [], new Map()).states.get("a")?.intensity).toBeCloseTo(0.5);
  });
  it("colour points switch the light to hue/saturation", () => {
    const s = timelineAt(base(), 5, [f], [], new Map()).states.get("a");
    expect(s?.hue).toBe(120); expect(s?.cctOnly).toBe(false);
  });
  it("adjustment layer at 50% halves everything below", () => {
    const t = base(); t.clips.push({ id: "a1", track: "adj", kind: "adjust", name: "Adj", start: 0, length: 10, keys: [{ id: "x", t: 0, intensity: 0.5 }] });
    expect(timelineAt(t, 4, [f], [], new Map()).states.get("a")?.intensity).toBeCloseTo(0.5);
  });
});
