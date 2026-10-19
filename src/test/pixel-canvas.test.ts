import { describe, expect, it } from "vitest";
import { createFixture, FIXTURE_LIBRARY } from "@/lib/dmx";
import { defaultLayer, layerArea, stageSize, migrateLayers, PIXEL_LIBRARY, renderCanvasImage, renderLayer, type PixelLayer } from "@/lib/pixels";

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

describe("resizable effect area", () => {
  it("lights outside a shrunk effect area stay dark, lights inside sample it", () => {
    const a = fixture("A", 2, 1), b = fixture("B", 30, 10);
    const layer = { ...defaultLayer("L", [a.uid, b.uid]), kind: "solid" as const, colors: ["#ff0000"], area: { x: 0, y: 0, w: 10, h: 6 } };
    const out = renderLayer(layer, [a, b], 1, null);
    expect(out.get(a.uid)![0]).toEqual([255, 0, 0]);
    expect(out.get(b.uid)!.every((c) => c[0] === 0 && c[1] === 0 && c[2] === 0)).toBe(true);
  });
  it("canvas is fixed and the area is clamped inside it", () => {
    expect(stageSize([fixture("Far", 200, 200)])).toEqual({ W: 48, H: 24 });
    expect(layerArea({ area: { x: 40, y: -3, w: 20, h: 5 } }, { W: 48, H: 24 })).toEqual({ x: 28, y: 0, w: 20, h: 5 });
  });
});
