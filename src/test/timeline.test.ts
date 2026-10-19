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
