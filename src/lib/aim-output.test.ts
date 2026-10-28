import { describe, expect, it } from "vitest";
import { addCustomFixture } from "./custom-fixtures";
import { buildUniverses } from "./output";
import { normalizeFixture, type PatchedFixture } from "./dmx";

// A moving head with a plain 8-bit chart: Dimmer, Pan, Tilt, Zoom.
addCustomFixture({
  id: "test-head",
  brand: "Test",
  model: "Head",
  modes: [{ name: "Basic", channels: 4, kind: "full", channelMap: [{ attr: "Dimmer" }, { attr: "Pan" }, { attr: "Tilt" }, { attr: "Zoom" }] }],
});

const head = (over: Record<string, unknown> = {}): PatchedFixture =>
  normalizeFixture({ uid: "h1", defId: "test-head", modeIdx: 0, name: "Head 1", universe: 1, address: 1, intensity: 1, on: true, ...over });

const byteAt = (f: PatchedFixture, t: number, channel: number) => buildUniverses([f], t, 1, new Map()).get(1)![channel]!;

describe("moving-head wander in DMX output", () => {
  it("holds the aimed position when no movement is set", () => {
    const f = head({ beam: { Pan: 0.5, Tilt: 0.4 } });
    expect(byteAt(f, 0, 1)).toBe(byteAt(f, 12, 1));
    expect(byteAt(f, 0, 2)).toBe(byteAt(f, 12, 2));
  });

  it("swings the Pan byte while the aim is held", () => {
    const f = head({ beam: { Pan: 0.5, Tilt: 0.4 }, move: { shape: "sweep", rate: 1, size: 1 } });
    // sweep at t=0 sits centred; a quarter period later it has travelled the full half-travel
    expect(byteAt(f, 0, 1)).toBe(128);
    expect(byteAt(f, 0.25, 1)).toBe(255);
    // tilt never moves in a side-to-side sweep
    expect(byteAt(f, 0.25, 2)).toBe(byteAt(f, 0, 2));
  });

  it("keeps a circle inside the head's travel at the edge of its aim", () => {
    const f = head({ beam: { Pan: 0.9 }, move: { shape: "circle", rate: 1, size: 1 } });
    expect(byteAt(f, 0, 1)).toBe(255); // 0.9 + 0.5 clamps to full
  });

  it("wanders around the manufacturer default when the console never set a pan", () => {
    const f = head({ move: { shape: "sweep", rate: 1, size: 1 } });
    // no beam.Pan: the chart's home (0.5) becomes the centre of the sweep
    expect(byteAt(f, 0, 1)).toBe(128);
    expect(byteAt(f, 0.25, 1)).toBe(255);
  });

  it("gives two lights on the same shape their own drift", () => {
    const a = head({ uid: "a", move: { shape: "random", rate: 0.5, size: 1 } });
    const b = head({ uid: "b", move: { shape: "random", rate: 0.5, size: 1 } });
    expect(byteAt(a, 4, 1)).not.toBe(byteAt(b, 4, 1));
  });
});
