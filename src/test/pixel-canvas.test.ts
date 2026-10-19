import { describe, expect, it } from "vitest";
import { createFixture, FIXTURE_LIBRARY } from "@/lib/dmx";
import { defaultLayer, migrateLayers, PIXEL_LIBRARY, renderCanvasImage, renderLayer, type PixelLayer } from "@/lib/pixels";

function fixture(name: string, x: number, y: number) {
  const def = FIXTURE_LIBRARY.find((d) => d.modes.some((m) => (m.pixels ?? 0) >= 4))!;
  return { ...createFixture(def, def.modes.findIndex((m) => (m.pixels ?? 0) >= 4), 1, 1, name), pixelPos: { x, y } };
}

describe("pixel canvas works like a video", () => {
  it("each light shows the canvas image at the spot it sits on", () => {
    const a = fixture("A", 2, 1), b = fixture("B", 20, 10);
    const layer = { ...defaultLayer("L", [a.uid, b.uid]), kind: "generator" as const, gen: "ocean" };
    const out = renderLayer(layer, [a, b], 2.3, null);
    const { W, img } = renderCanvasImage(layer, [a, b], 2.3, null);
    expect(out.get(a.uid)![0]).toEqual(img[1 * W + 2]);
    expect(out.get(b.uid)![0]).toEqual(img[10 * W + 20]);
  });

  it("each effect appears once in the library", () => {
    const labels = PIXEL_LIBRARY.map((x) => x.label.toLowerCase());
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("old duplicate effects are moved to the single library entry", () => {
    const old = [{ ...defaultLayer(), kind: "fire", layout: "line" }, { ...defaultLayer(), kind: "generator", gen: "stars" }] as PixelLayer[];
    const [f, s] = migrateLayers({ pixelLayers: old });
    expect(f).toMatchObject({ kind: "generator", gen: "fire-classic", layout: "canvas" });
    expect(s!.kind).toBe("twinkle");
  });
});
