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

import { stretchTrack } from "@/lib/timeline";
describe("adjustment boost and layer stretch", () => {
  it("adjustment at 200% lifts 10% lights to 20%", () => {
    const t: Timeline = { tracks: [{ id: "adj", name: "A", adjust: true }, { id: "l", name: "L" }], clips: [
      { id: "c", track: "l", kind: "level", name: "c", start: 0, length: 10, uids: ["a"], from: { intensity: 0.1 }, to: { intensity: 0.1 } },
      { id: "a", track: "adj", kind: "adjust", name: "A", start: 0, length: 10, keys: [{ id: "k", t: 0, intensity: 2 }] }] };
    expect(timelineAt(t, 5, [f], [], new Map()).states.get("a")?.intensity).toBeCloseTo(0.2);
  });
  it("stretching a layer to 50% speed doubles timing and points", () => {
    const t: Timeline = { tracks: [{ id: "l", name: "L" }], clips: [{ id: "c", track: "l", kind: "level", name: "c", start: 2, length: 4, fadeIn: 1, keys: [{ id: "k", t: 3, intensity: 1 }] }, { id: "d", track: "l", kind: "rec", name: "d", start: 6, length: 2 }] };
    const s = stretchTrack(t, "l", 2);
    expect(s.clips[0]).toMatchObject({ start: 2, length: 8, fadeIn: 2 }); expect(s.clips[0]!.keys![0]!.t).toBe(6);
    expect(s.clips[1]).toMatchObject({ start: 10, length: 4, rate: 0.5 });
  });
});

import { placeAtTop, snapTime } from "@/components/console/TimelinePanel";
describe("new clips go to the highest free layer", () => {
  it("uses layer 1 when free, the next layer when busy, and adds a layer when all are busy", () => {
    const t = tl();
    const c = { id: "n", track: "bottom", kind: "level" as const, name: "n", start: 7, length: 2 };
    expect(placeAtTop(t, c).clips.find((x) => x.id === "n")?.track).toBe("top");
    const busy = placeAtTop(t, { ...c, start: 3 });
    expect(busy.clips.find((x) => x.id === "n")?.track).not.toBe("top");
    expect(busy.tracks.length).toBe(3);
  });
  it("magnet snaps within range only", () => {
    expect(snapTime(4.1, [4, 8], 0.25)).toBe(4);
    expect(snapTime(5, [4, 8], 0.25)).toBe(5);
  });
});

import { applyFilter } from "@/lib/timeline";
describe("adjustment filter and layer mixing", () => {
  it("hue shift of 90° turns a red light green-ish (hue 90)", () => {
    expect(applyFilter({ intensity: 1, hue: 0, saturation: 1, cctOnly: false }, { hueShift: 90 }).hue).toBe(90);
  });
  it("CCT shift +800K moves cct by 0.1", () => {
    expect(applyFilter({ cct: 0.5 }, { cctShift: 800 }).cct).toBeCloseTo(0.6);
  });
  it("layer at 50% opacity mixes halfway with the layer below", () => {
    const t = tl(); t.tracks[0]!.opacity = 0.5;
    // below 0.2, top clip at t=4 is 0.5 → 0.35
    expect(timelineAt(t, 4, [f], [], new Map()).states.get("a")?.intensity).toBeCloseTo(0.35);
  });
  it("HTP keeps the brighter of the two layers", () => {
    const t = tl(); t.tracks[0]!.blend = "htp";
    expect(timelineAt(t, 2.4, [f], [], new Map()).states.get("a")?.intensity).toBeCloseTo(0.2);
  });
  it("solo plays only the solo layer", () => {
    const t = tl(); t.tracks[1]!.solo = true;
    expect(timelineAt(t, 4, [f], [], new Map()).states.get("a")?.intensity).toBeCloseTo(0.2);
  });
});

import { splitClip, easeK } from "@/lib/timeline";
describe("split, stagger and curves", () => {
  it("split at 3s of a 0→1 ramp over 4s gives two clips meeting at 75%", () => {
    const [a, b] = splitClip(tl().clips[1]!, 5)!;
    expect(a).toMatchObject({ start: 2, length: 3 }); expect(b).toMatchObject({ start: 5, length: 1 });
    expect(a.to!.intensity).toBeCloseTo(0.75); expect(b.from!.intensity).toBeCloseTo(0.75);
  });
  it("stagger 1s: second light has not started 0.5s in", () => {
    const t: Timeline = { tracks: [{ id: "l", name: "L" }], clips: [{ id: "c", track: "l", kind: "level", name: "c", start: 0, length: 5, uids: ["a", "b"], stagger: 1, from: { intensity: 1 }, to: { intensity: 1 } }] };
    const s = timelineAt(t, 0.5, [f, { ...f, uid: "b" }], [], new Map()).states;
    expect(s.get("a")?.intensity).toBe(1); expect(s.has("b")).toBe(false);
  });
  it("step curve holds until the point, smooth is 50% at the middle", () => {
    expect(easeK("step", 0.9)).toBe(0); expect(easeK("smooth", 0.5)).toBe(0.5);
  });
});
