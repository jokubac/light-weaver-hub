// Pixel mapping engine: lays pixel fixtures out in a grid and renders chase / rainbow / text effects.

import { getMode, hexToRgb, hsvToRgb, type PatchedFixture } from "./dmx";

export type PixelFx = "chase" | "rainbow" | "wave" | "sparkle" | "solid" | "text";

export interface PixelMap {
  playing: boolean;
  kind: PixelFx;
  colors: string[];
  speed: number; // 0.05 - 4
  size: number; // band width in pixels
  text: string;
  vertical: boolean; // true = fixtures standing upright side by side
  order: string[]; // fixture uids in layout order
  reverse: boolean;
}

export const PIXEL_FX: { id: PixelFx; label: string }[] = [
  { id: "chase", label: "Chase" },
  { id: "rainbow", label: "Rainbow" },
  { id: "wave", label: "Wave" },
  { id: "sparkle", label: "Sparkle" },
  { id: "solid", label: "Colour" },
  { id: "text", label: "Text" },
];

export const defaultPixelMap = (): PixelMap => ({
  playing: false,
  kind: "chase",
  colors: ["#ff0040", "#00e5ff", "#ffea00"],
  speed: 1,
  size: 3,
  text: "HELLO",
  vertical: true,
  order: [],
  reverse: false,
});

export const pixelCount = (f: PatchedFixture) => getMode(f).pixels ?? 0;
export const isPixelFixture = (f: PatchedFixture) => pixelCount(f) > 0;

type RGB = [number, number, number];

/** Renders text into a boolean mask `height` pixels tall (browser only). */
export function textMask(text: string, height: number): { w: number; h: number; on: (x: number, y: number) => boolean } {
  const h = Math.max(4, height);
  if (typeof document === "undefined" || !text) return { w: 1, h, on: () => false };
  const c = document.createElement("canvas");
  const ctx = c.getContext("2d")!;
  const font = `bold ${h}px monospace`;
  ctx.font = font;
  const w = Math.max(1, Math.ceil(ctx.measureText(text).width) + h); // trailing gap
  c.width = w;
  c.height = h;
  ctx.font = font;
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff";
  ctx.fillText(text, 0, h / 2 + 1);
  const data = ctx.getImageData(0, 0, w, h).data;
  return { w, h, on: (x, y) => data[(y * w + x) * 4 + 3]! > 110 };
}

const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

/**
 * Returns colours (0-255) per fixture uid, one entry per pixel.
 * Grid: horizontal → rows = fixtures, cols = pixels. Vertical → cols = fixtures, rows = pixels.
 */
export function renderPixels(pm: PixelMap, fixtures: PatchedFixture[], t: number, mask: ReturnType<typeof textMask> | null): Map<string, RGB[]> {
  const out = new Map<string, RGB[]>();
  const list = pm.order.map((u) => fixtures.find((f) => f.uid === u)).filter((f): f is PatchedFixture => !!f && isPixelFixture(f));
  if (!list.length) return out;
  const maxPx = Math.max(...list.map(pixelCount));
  const W = pm.vertical ? list.length : maxPx;
  const H = pm.vertical ? maxPx : list.length;
  const cols = pm.colors.length ? pm.colors.map(hexToRgb) : [[255, 255, 255] as RGB];
  const dir = pm.reverse ? -1 : 1;
  const tt = t * pm.speed;

  const at = (x: number, y: number): RGB => {
    switch (pm.kind) {
      case "solid": return cols[0]!;
      case "chase": {
        const p = x * dir - tt * 8;
        const band = Math.floor(p / Math.max(1, pm.size));
        const c = cols[((band % cols.length) + cols.length) % cols.length]!;
        return c;
      }
      case "rainbow": return hsvToRgb((((x / W + y / (H * 4)) * dir - tt * 0.3) * 360 % 360 + 360) % 360, 1, 1);
      case "wave": {
        const k = (Math.sin((x / Math.max(1, pm.size)) * dir - tt * 4) + 1) / 2;
        const a = cols[0]!, b = cols[1] ?? [0, 0, 0];
        return [a[0] * k + b[0] * (1 - k), a[1] * k + b[1] * (1 - k), a[2] * k + b[2] * (1 - k)];
      }
      case "sparkle": {
        const frame = Math.floor(tt * 12);
        const r = hash(x * 13.1 + y * 71.7 + frame * 3.3);
        return r > 0.85 ? cols[Math.floor(r * 1000) % cols.length]! : [0, 0, 0];
      }
      case "text": {
        if (!mask) return [0, 0, 0];
        const off = Math.floor(tt * 10);
        const mx = ((((x + off * dir) % mask.w) + mask.w) % mask.w);
        const my = Math.floor((y / H) * mask.h);
        return mask.on(mx, my) ? cols[0]! : [0, 0, 0];
      }
    }
  };

  list.forEach((f, fi) => {
    const n = pixelCount(f);
    const px: RGB[] = [];
    for (let i = 0; i < n; i++) {
      // vertical: pixel 0 at the top
      px.push(pm.vertical ? at(fi, i) : at(i, fi));
    }
    out.set(f.uid, px);
  });
  return out;
}

/** Grid height used for text masks. */
export function gridHeight(pm: PixelMap, fixtures: PatchedFixture[]) {
  const list = pm.order.map((u) => fixtures.find((f) => f.uid === u)).filter((f): f is PatchedFixture => !!f && isPixelFixture(f));
  if (!list.length) return 0;
  return pm.vertical ? Math.max(...list.map(pixelCount)) : list.length;
}
