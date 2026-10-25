import { describe, expect, it } from "vitest";
import { createFixture, FIXTURE_LIBRARY } from "@/lib/dmx";
import { defaultLayer, renderLayers, layerArea, stageSize, migrateLayers, PIXEL_LIBRARY, renderCanvasImage, renderLayer, type PixelLayer } from "@/lib/pixels";

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
  it("lights outside a shrunk effect area are left alone, lights inside sample it", () => {
    const a = fixture("A", 2, 1), b = fixture("B", 30, 10);
    const layer = { ...defaultLayer("L", [a.uid, b.uid]), kind: "solid" as const, colors: ["#ff0000"], area: { x: 0, y: 0, w: 10, h: 6 } };
    const out = renderLayer(layer, [a, b], 1, null);
    expect(out.get(a.uid)![0]).toEqual([255, 0, 0]);
    expect(out.get(b.uid)).toBeUndefined();
  });
  it("a small effect above a full one doesn't black out the lights outside its box", () => {
    const a = fixture("A", 30, 10);
    const full = { ...defaultLayer("Full", [a.uid]), kind: "solid" as const, colors: ["#ff0000"], playing: true, area: { x: 0, y: 0, w: 128, h: 72 } };
    const small = { ...defaultLayer("Small", [a.uid]), kind: "solid" as const, colors: ["#0000ff"], playing: true, area: { x: 0, y: 0, w: 8, h: 5 } };
    const out = renderLayers([full, small], [a], 1, new Map());
    expect(out.get(a.uid)![0]).toEqual([255, 0, 0]);
  });
  it("canvas is fixed and the area is clamped inside it", () => {
    expect(stageSize([fixture("Far", 200, 200)])).toEqual({ W: 128, H: 72 });
    expect(layerArea({ area: { x: 40, y: -3, w: 20, h: 5 } }, { W: 48, H: 24 })).toEqual({ x: 28, y: 0, w: 20, h: 5 });
  });
  it("an empty default effect starts at 1/16 of the map, centred, not full", () => {
    const [l] = migrateLayers({});
    expect(l!.empty).toBe(true);
    expect(l!.area).toEqual({ x: Math.round((128 - Math.round(128 / 16)) / 2), y: Math.round((72 - Math.round(72 / 16)) / 2), w: Math.round(128 / 16), h: Math.round(72 / 16) });
  });
});

describe("several effects in one window", () => {
  it("two layers with separate areas both reach the same light", () => {
    const def = FIXTURE_LIBRARY.find((d) => d.modes.some((m) => (m.pixels ?? 0) >= 8))!;
    const f = { ...createFixture(def, def.modes.findIndex((m) => (m.pixels ?? 0) >= 8), 1, 1, "Bar"), pixelPos: { x: 0, y: 0 } };
    const red = { ...defaultLayer("R", [f.uid]), kind: "solid" as const, colors: ["#ff0000"], playing: true, area: { x: 0, y: 0, w: 2, h: 24 } };
    const blue = { ...defaultLayer("B", [f.uid]), kind: "solid" as const, colors: ["#0000ff"], playing: true, area: { x: 2, y: 0, w: 46, h: 24 } };
    const px = renderLayers([red, blue], [f], 1, new Map()).get(f.uid)!;
    expect(px[0]).toEqual([255, 0, 0]);
    expect(px[3]).toEqual([0, 0, 255]);
  });
});

describe("shrunk effect keeps its pattern", () => {
  it("a 1/2 box shows the same chase steps as the full box, not every second one", () => {
    const f = fixture("A", 0, 0);
    const base = { ...defaultLayer("L", [f.uid]), kind: "chase" as const, colors: ["#ff0000", "#00ff00", "#0000ff"], size: 1 };
    const full = renderCanvasImage({ ...base, area: { x: 0, y: 0, w: 128, h: 72 } }, [f], 0, null);
    const half = renderCanvasImage({ ...base, area: { x: 0, y: 0, w: 61, h: 36 } }, [f], 0, null);
    expect(half.img.slice(0, 6)).toEqual(full.img.slice(0, 6));
  });
});

describe("spread and edge fade", () => {
  it("edge fade darkens the box edge and spread softens a hard chase", () => {
    const f = fixture("A", 0, 0);
    const base = { ...defaultLayer("L", [f.uid]), kind: "chase" as const, colors: ["#ff0000", "#0000ff"], size: 1, area: { x: 0, y: 0, w: 20, h: 10 } };
    const plain = renderCanvasImage(base, [f], 0, null).img[5 * 128 + 5]!;
    const spread = renderCanvasImage({ ...base, blur: 2 }, [f], 0, null).img[5 * 128 + 5]!;
    expect(spread[0] > 0 && spread[2] > 0).toBe(true);
    expect(spread).not.toEqual(plain);
    const faded = renderCanvasImage({ ...base, kind: "solid" as const, feather: 4 }, [f], 0, null).img;
    expect(faded[5 * 128 + 0]![0]).toBeLessThan(faded[5 * 128 + 10]![0]);
  });
});

it("spread widens a lit pixel into its neighbour at full strength", () => {
  const f = fixture("A", 0, 0);
  const base = { ...defaultLayer("L", [f.uid]), kind: "chase" as const, colors: ["#ff0000", "#000000"], size: 1, area: { x: 0, y: 0, w: 20, h: 10 } };
  const img = renderCanvasImage({ ...base, spread: 1 }, [f], 0, null).img;
  expect(img[5 * 128 + 5]![0]).toBe(255);
  expect(img[5 * 128 + 6]![0]).toBe(255);
});

import { STAGE_MIN as SM } from "@/lib/pixels";
test("PIXEL map is exactly 16:9 like Full HD 1920×1080", () => { expect(SM[0] / SM[1]).toBeCloseTo(1920 / 1080, 5); });
