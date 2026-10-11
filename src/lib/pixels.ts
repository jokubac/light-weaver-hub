// Pixel mapping engine: lays pixel fixtures out on one shared grid so effects flow
// from one fixture into the next, supports 2D fixtures (e.g. SkyPanel S360 4×3) and
// several independent layers playing at once.

import { getMode, hexToRgb, hsvToRgb, type PatchedFixture } from "./dmx";

export type PixelFx =
  | "runner" | "chase" | "meteor" | "bounce" | "rainbow" | "wave" | "gradient" | "plasma"
  | "fire" | "sparkle" | "twinkle" | "strobe" | "police" | "solid" | "text";

/** line = fixtures end-to-end in one long row; stack = horizontal fixtures stacked; upright = tubes standing side by side */
export type PixelLayout = "line" | "stack" | "upright";

export interface PixelLayer {
  id: string;
  name: string;
  playing: boolean;
  kind: PixelFx;
  colors: string[];
  speed: number; // 0.001–100 multiplier
  size: number; // band width in pixels
  text: string;
  layout: PixelLayout;
  order: string[]; // fixture uids in layout order
  reverse: boolean;
  /** police: flashes per side (1 single, 2 double, 3 triple, 4 quad) */
  flashes?: number;
  /** police: alternate sides, both together, or slow wig-wag */
  policeMode?: "alternate" | "together" | "wigwag";
  /** runner: number of moving segments spread over the whole map */
  runners?: number;
  brightness?: number; // output gain 0–1
  background?: number; // minimum output 0–1
  softness?: number; // moving segment edge softness 0–1
  duty?: number; // strobe on-time fraction
  density?: number; // sparkle probability
  phase?: number; // time offset in effect units
}

export const POLICE_FLASHES = [{ n: 1, l: "Single" }, { n: 2, l: "Double" }, { n: 3, l: "Triple" }, { n: 4, l: "Quad" }];

/** @deprecated single-layer format from older saves */
export interface PixelMap {
  playing: boolean; kind: PixelFx; colors: string[]; speed: number; size: number; text: string;
  vertical: boolean; order: string[]; reverse: boolean;
}

export const PIXEL_FX: { id: PixelFx; label: string }[] = [
  { id: "runner", label: "Runner" },
  { id: "chase", label: "Chase" },
  { id: "meteor", label: "Meteor" },
  { id: "bounce", label: "Bounce" },
  { id: "rainbow", label: "Rainbow" },
  { id: "wave", label: "Wave" },
  { id: "gradient", label: "Gradient" },
  { id: "plasma", label: "Plasma" },
  { id: "fire", label: "Fire" },
  { id: "sparkle", label: "Sparkle" },
  { id: "twinkle", label: "Twinkle" },
  { id: "strobe", label: "Strobe" },
  { id: "police", label: "Police" },
  { id: "solid", label: "Colour" },
  { id: "text", label: "Text" },
];

const newId = () => Math.random().toString(36).slice(2, 10);

export const defaultLayer = (name = "Layer 1", order: string[] = []): PixelLayer => ({
  id: newId(),
  name,
  playing: false,
  kind: "chase",
  colors: ["#ff0040", "#00e5ff", "#ffea00"],
  speed: 1,
  size: 3,
  text: "HELLO",
  layout: "line",
  order,
  reverse: false,
});

export function migrateLayers(s: { pixelLayers?: PixelLayer[]; pixelMap?: PixelMap }): PixelLayer[] {
  if (s.pixelLayers?.length) return s.pixelLayers.map((l) => ({ ...defaultLayer(), ...l, playing: false }));
  if (s.pixelMap) {
    const { vertical, ...rest } = s.pixelMap;
    return [{ ...defaultLayer(), ...rest, layout: vertical ? "upright" : "stack", playing: false }];
  }
  return [defaultLayer()];
}

export const pixelCount = (f: PatchedFixture) => (f.split ? 0 : getMode(f).pixels ?? 0);
export const isPixelFixture = (f: PatchedFixture) => pixelCount(f) > 0;
/** Physical pixel grid of one fixture [cols, rows]; pixels are numbered row by row from top-left. */
export const pixelGrid = (f: PatchedFixture): [number, number] => {
  const mo = getMode(f);
  return mo.grid ?? [mo.pixels ?? 0, 1];
};

type RGB = [number, number, number];

/** Renders text into a boolean mask `height` pixels tall (browser only). */
export function textMask(text: string, height: number): { w: number; h: number; on: (x: number, y: number) => boolean } {
  const h = Math.max(4, height);
  if (typeof document === "undefined" || !text) return { w: 1, h, on: () => false };
  const c = document.createElement("canvas");
  const ctx = c.getContext("2d")!;
  const font = `bold ${h}px monospace`;
  ctx.font = font;
  const w = Math.max(1, Math.ceil(ctx.measureText(text).width) + h);
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
const smooth = (x: number) => { const i = Math.floor(x); const f = x - i; const u = f * f * (3 - 2 * f); return hash(i) * (1 - u) + hash(i + 1) * u; };
const mix = (a: RGB, b: RGB, k: number): RGB => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const scale = (a: RGB, k: number): RGB => [a[0] * k, a[1] * k, a[2] * k];
const BLACK: RGB = [0, 0, 0];

function fireColor(h: number): RGB {
  const x = Math.max(0, Math.min(1, h));
  if (x < 0.35) return [x / 0.35 * 200, 0, 0];
  if (x < 0.7) return [200 + (x - 0.35) / 0.35 * 55, (x - 0.35) / 0.35 * 120, 0];
  return [255, 120 + (x - 0.7) / 0.3 * 120, (x - 0.7) / 0.3 * 90];
}

interface Placed { f: PatchedFixture; cells: { x: number; y: number; s: number }[] }

/** Positions of every pixel of every fixture in the layer on one shared grid. */
export function layoutLayer(layer: PixelLayer, fixtures: PatchedFixture[]): { placed: Placed[]; W: number; H: number; S: number } {
  const list = layer.order.map((u) => fixtures.find((f) => f.uid === u)).filter((f): f is PatchedFixture => !!f && isPixelFixture(f));
  const placed: Placed[] = [];
  let ox = 0, oy = 0, W = 0, H = 0, seq = 0;
  for (const f of list) {
    let [c, r] = pixelGrid(f);
    const tube = r === 1;
    const rotate = layer.layout === "upright" && tube;
    if (rotate) [c, r] = [1, c];
    const cells: { x: number; y: number; s: number }[] = [];
    const n = pixelCount(f);
    for (let i = 0; i < n; i++) {
      const [lc, lr] = pixelGrid(f);
      const px = i % lc, py = Math.floor(i / lc);
      // upright tubes: pixel 0 at the top
      const lx = rotate ? 0 : px, ly = rotate ? i : (lr > 1 ? py : 0);
      cells.push({ x: ox + lx, y: oy + ly, s: seq++ });
    }
    placed.push({ f, cells });
    if (layer.layout === "stack") { oy += r; W = Math.max(W, c); H = oy; }
    else { ox += c; W = ox; H = Math.max(H, r); }
  }
  return { placed, W: Math.max(1, W), H: Math.max(1, H), S: Math.max(1, seq) };
}

export function layerHeight(layer: PixelLayer, fixtures: PatchedFixture[]) {
  return layoutLayer(layer, fixtures).H;
}

/** Colours (0-255) per fixture uid, one entry per pixel. */
export function renderLayer(layer: PixelLayer, fixtures: PatchedFixture[], t: number, mask: ReturnType<typeof textMask> | null, out = new Map<string, RGB[]>()) {
  const { placed, W, H, S } = layoutLayer(layer, fixtures);
  if (!placed.length) return out;
  const cols: RGB[] = layer.colors.length ? layer.colors.map(hexToRgb) : [[255, 255, 255]];
  const col = (i: number) => cols[((i % cols.length) + cols.length) % cols.length]!;
  const dir = layer.reverse ? -1 : 1;
  const tt = t * layer.speed + (layer.phase ?? 0);
  const size = Math.max(1, layer.size);

  // travelling effects follow the pixel path light → light (s), whatever the layout
  const at = (x: number, y: number, s: number): RGB => {
    const xd = layer.reverse ? W - 1 - x : x;
    const sd = layer.reverse ? S - 1 - s : s;
    switch (layer.kind) {
      case "solid": return cols[0]!;
      case "chase": return col(Math.floor((sd - tt * 8) / size));
      case "meteor": {
        const span = S + size * 2;
        const head = (tt * 10) % span;
        const d = head - sd;
        return d >= 0 && d < size * 2 ? scale(col(Math.floor(tt * 10 / span)), Math.pow(1 - d / (size * 2), 2)) : BLACK;
      }
      case "bounce": {
        const p = (Math.sin(tt * 2) + 1) / 2 * (W - 1);
        const d = Math.abs(x - p);
        return d < size ? scale(cols[0]!, 1 - d / size) : (cols[1] ? scale(cols[1], 0.15) : BLACK);
      }
      case "rainbow": return hsvToRgb((((x / W + y / (H * 4)) * dir - tt * 0.3) * 360 % 360 + 360) % 360, 1, 1);
      case "wave": {
        const k = (Math.sin((x / size) * dir - tt * 4) + 1) / 2;
        return mix(cols[1] ?? BLACK, cols[0]!, k);
      }
      case "gradient": {
        const p = (((x / W) * dir - tt * 0.2) % 1 + 1) % 1 * cols.length;
        const i = Math.floor(p);
        return mix(col(i), col(i + 1), p - i);
      }
      case "plasma": {
        const v = Math.sin(x * 0.4 + tt * 2) + Math.sin(y * 0.6 - tt * 1.5) + Math.sin((x + y) * 0.3 + tt);
        return hsvToRgb((((v + 3) / 6) * 360 + tt * 40) % 360, 1, 1);
      }
      case "fire": {
        // 2D: hottest at the bottom row. 1D: flickering embers along the length.
        const base = H > 1 ? (y + 1) / H : 0.75;
        const n = smooth(x * 0.9 + tt * 6 + y * 3.1) * 0.6 + smooth(x * 2.3 - tt * 11) * 0.4;
        const flick = smooth(tt * 9 + x * 0.5);
        return fireColor(base * (0.55 + n * 0.6) * (0.75 + flick * 0.35));
      }
      case "sparkle": {
        const r = hash(x * 13.1 + y * 71.7 + Math.floor(tt * 12) * 3.3);
         return r > 1 - (layer.density ?? 0.15) ? col(Math.floor(r * 1000)) : BLACK;
      }
      case "twinkle": {
        const ph = hash(x * 7.7 + y * 3.3) * 6.28;
        const k = Math.pow((Math.sin(tt * (1 + hash(x + y * 9)) * 2 + ph) + 1) / 2, 3);
        return scale(col(Math.floor(hash(x * 5 + y) * 100)), k);
      }
      case "strobe": return ((tt * 8) % 1 + 1) % 1 < (layer.duty ?? 0.5) ? col(Math.floor(tt * 8)) : BLACK;
      case "runner": {
        // N-pixel segments travelling across every light in the layer, one after another
        const n = Math.max(1, layer.runners ?? 1);
        const span = S / n;
        const pos = ((tt * 10) % S + S) % S;
        const d = (((sd - pos) % span) + span) % span;
        const lap = Math.floor(tt * 10 / S);
        const k = Math.floor((((sd - pos) % S) + S) % S / span);
        const edge = Math.min(size / 2, size * (layer.softness ?? 0));
        const gain = edge > 0 ? Math.min(1, d / edge, (size - d) / edge) : 1;
        return d < size ? scale(col(lap + k), Math.max(0, gain)) : BLACK;
      }
      case "police": {
        const half = x < W / 2 ? 0 : 1;
        const fl = Math.max(1, layer.flashes ?? 2);
        const mode = layer.policeMode ?? "alternate";
        const cA = cols[0]!, cB = cols[1] ?? [0, 60, 255];
        if (mode === "wigwag") return Math.floor(tt * 2) % 2 === half ? (half ? cB : cA) : BLACK;
        // one side: fl flashes (on/off pairs) then a short pause
        const slots = fl * 2 + 2;
        const step = Math.floor(tt * 14);
        const inSide = step % slots;
        const flashOn = inSide < fl * 2 && inSide % 2 === 0;
        if (mode === "together") return flashOn ? (half ? cB : cA) : BLACK;
        const side = Math.floor(step / slots) % 2;
        return side === half && flashOn ? (half ? cB : cA) : BLACK;
      }
      case "text": {
        if (!mask) return BLACK;
        const off = Math.floor(tt * 10);
        const mx = ((((x + off * dir) % mask.w) + mask.w) % mask.w);
        const my = Math.floor((y / H) * mask.h);
        return mask.on(mx, my) ? cols[0]! : BLACK;
      }
    }
  };

  const brightness = Math.min(1, Math.max(0, layer.brightness ?? 1));
  const background = Math.min(1, Math.max(0, layer.background ?? 0));
  for (const p of placed) out.set(p.f.uid, p.cells.map((c) => scale(mix(cols[0] ?? BLACK, at(c.x, c.y, c.s), 1 - background), brightness)));
  return out;
}

/** Renders all playing layers; later layers override earlier ones on shared fixtures. */
export function renderLayers(layers: PixelLayer[], fixtures: PatchedFixture[], t: number, masks: Map<string, ReturnType<typeof textMask>>) {
  const out = new Map<string, RGB[]>();
  for (const l of layers) if (l.playing) renderLayer(l, fixtures, t, masks.get(l.id) ?? null, out);
  return out;
}
