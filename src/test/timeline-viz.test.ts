import { describe, it, expect } from "vitest";
import { emptyTimeline, setLightKeyAt, clipValue } from "@/lib/timeline";
describe("visualiser keyframes", () => {
  it("creates a clip at the playhead and updates the same point", () => {
    const a = setLightKeyAt(emptyTimeline(), "L1", "Titan", 5, { intensity: 0.4 });
    const b = setLightKeyAt(a.timeline, "L1", "Titan", 5, { intensity: 0.8 });
    const c = b.timeline.clips.find((x) => x.id === a.clipId)!;
    expect(b.timeline.clips).toHaveLength(1);
    expect(c.start).toBe(5);
    expect(clipValue(c, 0).intensity).toBe(0.8);
  });
  it("adds a second point later in the same clip", () => {
    const a = setLightKeyAt(emptyTimeline(), "L1", "T", 2, { intensity: 0 });
    const b = setLightKeyAt(a.timeline, "L1", "T", 6, { intensity: 1 });
    const c = b.timeline.clips[0]!;
    expect(c.keys).toHaveLength(2);
    expect(clipValue(c, 2).intensity).toBeCloseTo(0.5);
  });
});
