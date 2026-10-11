// Pixel mapping: place pixel fixtures (tubes, bricks) on a grid and run effects across all pixels.

import { hsvToRgb } from "./dmx";

export type PixelEffectKind = "off" | "solid" | "chase" | "rainbow" | "wave" | "sparkle" | "text" | "tree" | "paint";

export interface PixelItem { uid: string; x: number; y: number; dir: "h" | "v" }
export interface PixelEffect {
  kind: PixelEffectKind;
  speed: number; // cells per second / cycles
  hue: number;
  hue2: number;
  size: number; // tail length / wave width (cells)
  direction: "right" | "left" | "up" | "down";
  text: string;
}
export interface PixelMap {
  cols: number;
  rows: number;
  items: PixelItem[];
  effect: PixelEffect;
  paint: Record<string, number>; // "x,y" -> hue (or -1 = white)
}

export const PIXEL_EFFECTS: { id: PixelEffectKind; label: string }[] = [
  { id: "off", label: "Off" },
  { id: "solid", label: "Solid" },
  { id: "chase", label: "Chase" },
  { id: "rainbow", label: "Rainbow" },
  { id: "wave", label: "Wave" },
  { id: "sparkle", label: "Sparkle" },
  { id: "text", label: "Text" },
  { id: "tree", label: "Tree" },
  { id: "paint", label: "Paint" },
];

export const defaultPixelMap = (): PixelMap => ({
  cols: 32,
  rows: 16,
  items: [],
  effect: { kind: "off", speed: 4, hue: 200, hue2: 320, size: 4, direction: "right", text: "HELLO" },
  paint: {},
});

/** Grid cells covered by an item, in pixel order. */
export function itemCells(it: PixelItem, count: number): [number, number][] {
  return Array.from({ length: count }, (_, i) => (it.dir === "h" ? [it.x + i, it.y] : [it.x, it.y + i]) as [number, number]);
}

function hash(n: number) {
  const s = Math.sin(n * 91.7 + 13.3) * 43758.5453;
  return s - Math.floor(s);
}

// Text rasterised with an offscreen canvas (browser only), cached.
const textCache = new Map<string, { w: number; mask: Uint8Array }>();
function textMask(text: string, rows: number) {
  const key = `${text}|${rows}`;
  const hit = textCache.get(key);
  if (hit) return hit;
  if (typeof document === "undefined") return { w: 1, mask: new Uint8Array(rows) };
  const c = document.createElement("canvas");
  const ctx = c.getContext("2d")!;
  const font = `bold ${rows}px sans-serif`;
  ctx.font = font;
  const w = Math.max(1, Math.ceil(ctx.measureText(text).width) + 2);
  c.width = w;
  c.height = rows;
  ctx.font = font;
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff";
  ctx.fillText(text, 1, rows / 2 + 1);
  const data = ctx.getImageData(0, 0, w, rows).data;
  const mask = new Uint8Array(w * rows);
  for (let i = 0; i < w * rows; i++) mask[i] = data[i * 4 + 3]! > 100 ? 1 : 0;
  const res = { w, mask };
  textCache.set(key, res);
  return res;
}

function treeShape(x: number, y: number, cols: number, rows: number): "leaf" | "trunk" | "star" | null {
  const cx = (cols - 1) / 2;
  const trunkH = Math.max(1, Math.round(rows * 0.15));
  if (y === 0 && Math.abs(x - cx) < 1) return "star";
  if (y >= rows - trunkH) return Math.abs(x - cx) <= Math.max(0.5, cols * 0.05) ? "trunk" : null;
  const h = rows - trunkH - 1;
  const half = ((y - 1) / Math.max(1, h)) * (Math.min(cols, rows * 1.2) / 2);
  return y >= 1 && Math.abs(x - cx) <= half ? "leaf" : null;
}

/** RGB 0-255 for a grid cell. */
export function pixelColor(map: PixelMap, x: number, y: number, t: number): [number, number, number] {
  const e = map.effect;
  const { cols, rows } = map;
  const axis = e.direction === "right" ? x : e.direction === "left" ? cols - 1 - x : e.direction === "down" ? y : rows - 1 - y;
  const len = e.direction === "right" || e.direction === "left" ? cols : rows;
  switch (e.kind) {
    case "off": return [0, 0, 0];
    case "solid": return hsvToRgb(e.hue, 1, 1);
    case "chase": {
      const head = (t * e.speed) % (len + e.size);
      const d = head - axis;
      if (d < 0 || d > e.size) return [0, 0, 0];
      return hsvToRgb(e.hue, 1, 1 - d / Math.max(1, e.size));
    }
    case "rainbow": return hsvToRgb((((axis / len) * 360 + t * e.speed * 30) % 360 + 360) % 360, 1, 1);
    case "wave": {
      const v = 0.5 + 0.5 * Math.sin((axis / Math.max(1, e.size)) * Math.PI - t * e.speed);
      const [r1, g1, b1] = hsvToRgb(e.hue, 1, 1);
      const [r2, g2, b2] = hsvToRgb(e.hue2, 1, 1);
      return [r1 + (r2 - r1) * v, g1 + (g2 - g1) * v, b1 + (b2 - b1) * v];
    }
    case "sparkle": {
      const slot = Math.floor(t * e.speed * 2);
      const h = hash(x * 131 + y * 71 + slot * 17);
      return h > 0.9 ? [255, 255, 255] : hsvToRgb(e.hue, 1, 0.12);
    }
    case "text": {
      const { w, mask } = textMask(e.text || " ", rows);
      const total = w + cols;
      const off = Math.floor((t * e.speed) % total);
      const tx = x + off - cols;
      if (tx < 0 || tx >= w) return [0, 0, 0];
      return mask[y * w + tx] ? hsvToRgb(e.hue, 1, 1) : [0, 0, 0];
    }
    case "tree": {
      const s = treeShape(x, y, cols, rows);
      if (s === "star") return [255, 220, 80];
      if (s === "trunk") return [120, 60, 20];
      if (s === "leaf") {
        const tw = hash(x * 37 + y * 11 + Math.floor(t * e.speed * 0.7) * 3);
        if (tw > 0.88) return hsvToRgb((hash(x + y * 7) * 360) | 0, 1, 1);
        return [0, 160, 40];
      }
      return [0, 0, 0];
    }
    case "paint": {
      const h = map.paint[`${x},${y}`];
      if (h === undefined) return [0, 0, 0];
      return h < 0 ? [255, 255, 255] : hsvToRgb(h, 1, 1);
    }
  }
}
