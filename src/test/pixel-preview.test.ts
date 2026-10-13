import { describe, expect, it } from "vitest";
import { createFixture, FIXTURE_LIBRARY } from "@/lib/dmx";
import { defaultLayer, renderLayer } from "@/lib/pixels";
import { mixFrames } from "@/lib/recordings";
import { pixelPreview } from "@/components/console/pixel-preview";

function fixture(name: string) {
  const def = FIXTURE_LIBRARY.find((d) => d.modes.some((m) => (m.pixels ?? 0) >= 4));
  if (!def) throw new Error("Pixel fixture required");
  return createFixture(def, def.modes.findIndex((m) => (m.pixels ?? 0) >= 4), 1, 1, name);
}

describe("pixel map live overlap", () => {
  it("shows both cue frames even when the selected programming layer is stopped", () => {
    const f = fixture("Tube");
    const old = { ...defaultLayer("Old", [f.uid]), kind: "rainbow" as const, playing: true };
    const next = { ...defaultLayer("Next", [f.uid]), kind: "chase" as const, colors: ["#0000ff"], playing: true };
    const a = renderLayer(old, [f], 1, null);
    const b = renderLayer(next, [f], 1, null);
    const mixed = mixFrames(a, b, 0.5);
    const result = pixelPreview({ ...next, playing: false }, [f], mixed, 1);
    expect(result.frame.get(f.uid)).toEqual(mixed.get(f.uid));
    expect(result.frame.get(f.uid)).not.toEqual(b.get(f.uid));
    expect(result.frame.get(f.uid)).not.toEqual(a.get(f.uid));
  });

  it("keeps outgoing-only fixtures visible without changing the selected layer order", () => {
    const a = fixture("Old tube"), b = fixture("New tube");
    const layer = defaultLayer("New", [b.uid]);
    const live = new Map<string, [number, number, number][]>([[a.uid, [[255, 0, 0]]], [b.uid, [[0, 0, 255]]]]);
    const result = pixelPreview(layer, [a, b], live, 1);
    expect(result.placed.map((p) => p.f.uid)).toEqual([b.uid, a.uid]);
    expect(result.frame.get(a.uid)).toEqual([[255, 0, 0]]);
    expect(layer.order).toEqual([b.uid]);
  });

  it("retains the programming preview when no live output exists", () => {
    const f = fixture("Tube"), layer = defaultLayer("Preview", [f.uid]);
    expect(pixelPreview(layer, [f], new Map(), 1).frame.get(f.uid)).toEqual(renderLayer(layer, [f], 1, null).get(f.uid));
  });
});