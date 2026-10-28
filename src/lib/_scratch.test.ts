import { describe, expect, it } from "vitest";
import { addCustomFixture } from "./custom-fixtures";
import { buildUniverses } from "./output";
import { normalizeFixture, seedOf, type PatchedFixture } from "./dmx";
import { moveOffset } from "./aim";

addCustomFixture({ id: "test-head", brand: "Test", model: "Head", modes: [{ name: "Basic", channels: 4, kind: "full", channelMap: [{ attr: "Dimmer" }, { attr: "Pan" }, { attr: "Tilt" }, { attr: "Zoom" }] }] });
const head = (over: Record<string, unknown> = {}): PatchedFixture => normalizeFixture({ uid: "h1", defId: "test-head", modeIdx: 0, name: "Head 1", universe: 1, address: 1, intensity: 1, on: true, ...over });

describe("scratch", () => {
  it("shows what the encoder sees", () => {
    const a = head({ uid: "a", move: { shape: "random", rate: 0.5, size: 1 } });
    console.log("move on fixture:", JSON.stringify(a.move), "seed", seedOf(a.uid));
    console.log("offset at t=4:", moveOffset(a.move!, 4, seedOf(a.uid)));
    console.log("byte:", buildUniverses([a], 4, 1, new Map()).get(1)![1]);
    const c = head({ beam: { Pan: 0.9 }, move: { shape: "circle", rate: 1, size: 1 } });
    console.log("circle offset t=0:", moveOffset(c.move!, 0, seedOf(c.uid)), "byte:", buildUniverses([c], 0, 1, new Map()).get(1)![1]);
    console.log("circle offset t=0.25:", moveOffset(c.move!, 0.25, seedOf(c.uid)), "byte:", buildUniverses([c], 0.25, 1, new Map()).get(1)![1]);
    expect(true).toBe(true);
  });
});
