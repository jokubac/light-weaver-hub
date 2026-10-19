// 50 procedural pixel generators. Each maps a pixel position on the layer's map to a colour.
// Pure and browser-safe so the same output plays live, in REC and on the TIMELINE.

export type RGB = [number, number, number];
export interface GenCtx {
  x: number; y: number; W: number; H: number; t: number;
  /** palette colour blended by phase 0..1 (custom colours of the layer) */
  pal: (phase: number) => RGB;
  /** true when the layer uses its own colours instead of the generator's natural ones */
  custom: boolean;
}
export interface PixelGenerator { id: string; label: string; group: string; fn: (c: GenCtx) => RGB }

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const fract = (v: number) => v - Math.floor(v);
const hash = (n: number) => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453);
const hash2 = (x: number, y: number) => hash(x * 12.9898 + y * 78.233);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const sm = (k: number) => k * k * (3 - 2 * k);
function noise(x: number, y: number) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = sm(x - ix), fy = sm(y - iy);
  return lerp(lerp(hash2(ix, iy), hash2(ix + 1, iy), fx), lerp(hash2(ix, iy + 1), hash2(ix + 1, iy + 1), fx), fy);
}
const fbm = (x: number, y: number) => noise(x, y) * 0.55 + noise(x * 2.1, y * 2.1) * 0.3 + noise(x * 4.3, y * 4.3) * 0.15;
const mix = (a: RGB, b: RGB, k: number): RGB => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
const sc = (a: RGB, k: number): RGB => [a[0] * k, a[1] * k, a[2] * k];
const hsv = (h: number, s = 1, v = 1): RGB => {
  h = fract(h) * 6; const i = Math.floor(h), f = h - i, p = v * (1 - s), q = v * (1 - s * f), u = v * (1 - s * (1 - f));
  const r = [[v, u, p], [q, v, p], [p, v, u], [p, q, v], [u, p, v], [v, p, q]][i % 6]!;
  return [r[0]! * 255, r[1]! * 255, r[2]! * 255];
};
/** heat 0..1 through a list of stops */
const ramp = (stops: RGB[], k: number): RGB => { const p = clamp(k) * (stops.length - 1); const i = Math.min(stops.length - 2, Math.floor(p)); return mix(stops[i]!, stops[i + 1]!, p - i); };
const K: RGB = [0, 0, 0], WH: RGB = [255, 255, 255];
/** natural palette, or the layer's colours when customised (intensity kept) */
const pick = (c: GenCtx, natural: RGB, k: number, phase = k): RGB => (c.custom ? sc(c.pal(phase), clamp(k)) : natural);

const FIRE: RGB[] = [K, [120, 0, 0], [220, 40, 0], [255, 130, 0], [255, 220, 90], WH];
const BLUEFIRE: RGB[] = [K, [0, 0, 90], [0, 50, 220], [40, 160, 255], [180, 230, 255], WH];
const GREENFIRE: RGB[] = [K, [0, 50, 0], [0, 160, 20], [90, 255, 40], [220, 255, 160], WH];
const LAVA: RGB[] = [[20, 0, 0], [140, 10, 0], [255, 60, 0], [255, 170, 30]];
const OCEAN: RGB[] = [[0, 10, 40], [0, 60, 130], [0, 140, 200], [120, 220, 255]];
const AURORA: RGB[] = [K, [0, 120, 60], [0, 255, 140], [80, 120, 255], [200, 60, 255]];

// fire helper: hottest at the bottom, flames rise; 1-row maps flicker along the length
function flame(c: GenCtx, speed = 1, height = 1, turb = 1) {
  const ny = c.H > 1 ? 1 - c.y / (c.H - 1 || 1) : 0.35;
  const n = fbm(c.x * 0.35 * turb, c.y * 0.35 * turb + c.t * 2.2 * speed);
  const flick = noise(c.t * 7 * speed, c.x * 0.4);
  return clamp((1 - ny * (1.15 / height)) * 0.7 + n * 0.6 - 0.25 + flick * 0.25);
}

export const PIXEL_GENERATORS: PixelGenerator[] = [
  // ── Fire ──
  { id: "fire-classic", label: "Fire", group: "Fire", fn: (c) => { const h = flame(c); return pick(c, ramp(FIRE, h), h); } },
  { id: "fire-blue", label: "Blue fire", group: "Fire", fn: (c) => { const h = flame(c, 1.2); return pick(c, ramp(BLUEFIRE, h), h); } },
  { id: "fire-green", label: "Green fire", group: "Fire", fn: (c) => { const h = flame(c, 0.9); return pick(c, ramp(GREENFIRE, h), h); } },
  { id: "inferno", label: "Inferno", group: "Fire", fn: (c) => { const h = clamp(flame(c, 1.8, 1.6, 1.4) * 1.2); return pick(c, ramp(FIRE, h), h); } },
  { id: "embers", label: "Embers", group: "Fire", fn: (c) => { const g = noise(c.x * 0.8, c.y * 0.8 + c.t * 0.6); const s = hash2(c.x, Math.floor(c.t * 6) + c.y * 31) > 0.97 ? 1 : 0; const h = clamp(g * 0.55 + s * 0.6); return pick(c, ramp(FIRE, h), h); } },
  { id: "candle", label: "Candle", group: "Fire", fn: (c) => { const f = 0.75 + noise(c.t * 5, 0) * 0.25 - hash(Math.floor(c.t * 18)) * 0.08; return pick(c, sc([255, 150, 50], f), f); } },
  { id: "torch", label: "Torch", group: "Fire", fn: (c) => { const f = 0.55 + noise(c.t * 9, c.x * 0.2) * 0.45; const h = clamp(flame(c, 1.5) * f + 0.15); return pick(c, ramp(FIRE, h), h); } },
  { id: "lava", label: "Lava", group: "Fire", fn: (c) => { const h = fbm(c.x * 0.15 + c.t * 0.1, c.y * 0.15 - c.t * 0.05); return pick(c, ramp(LAVA, h), h); } },
  // ── Water ──
  { id: "ocean", label: "Ocean", group: "Water", fn: (c) => { const h = clamp((Math.sin(c.x * 0.3 + c.t * 1.2) + Math.sin(c.x * 0.13 - c.y * 0.4 + c.t * 0.7)) / 4 + 0.5 * fbm(c.x * 0.2, c.y * 0.2 + c.t * 0.3) + 0.2); return pick(c, ramp(OCEAN, h), h); } },
  { id: "ripples", label: "Ripples", group: "Water", fn: (c) => { const d = Math.hypot(c.x - c.W / 2, c.y - c.H / 2); const h = (Math.sin(d * 0.8 - c.t * 4) + 1) / 2; return pick(c, ramp(OCEAN, h), h); } },
  { id: "rain", label: "Rain", group: "Water", fn: (c) => { const sp = 0.6 + hash(c.x) * 0.8; const p = fract(c.t * sp * 0.6 + hash(c.x * 3.3)); const head = p * (c.H + 6) - 3; const d = head - c.y; const k = d >= 0 && d < 4 ? 1 - d / 4 : 0; return pick(c, sc([140, 190, 255], k), k); } },
  { id: "caustics", label: "Underwater", group: "Water", fn: (c) => { const v = Math.abs(Math.sin(c.x * 0.4 + noise(c.y * 0.3, c.t) * 4) * Math.sin(c.y * 0.4 + noise(c.x * 0.3, c.t + 9) * 4)); const h = Math.pow(v, 0.5); return pick(c, mix([0, 40, 90], [120, 255, 240], h), h); } },
  { id: "waterfall", label: "Waterfall", group: "Water", fn: (c) => { const h = clamp(fbm(c.x * 0.6, c.y * 0.15 - c.t * 3) * 1.3 - 0.15); return pick(c, ramp([[0, 30, 80], [40, 120, 220], WH], h), h); } },
  { id: "bubbles", label: "Bubbles", group: "Water", fn: (c) => { const col = Math.floor(c.x / 3); const p = fract(c.t * (0.2 + hash(col) * 0.3) + hash(col * 7)); const by = (1 - p) * (c.H + 4) - 2; const d = Math.hypot(c.x - col * 3 - 1, c.y - by); const k = d < 1.5 ? 1 - d / 1.5 : 0; return pick(c, mix([0, 30, 70], [180, 240, 255], k), k); } },
  { id: "ice", label: "Ice", group: "Water", fn: (c) => { const h = fbm(c.x * 0.3, c.y * 0.3 + c.t * 0.1); const g = hash2(c.x, c.y + Math.floor(c.t * 3)) > 0.985 ? 1 : 0; return pick(c, mix(mix([20, 70, 140], [190, 240, 255], h), WH, g), h); } },
  // ── Sky ──
  { id: "aurora", label: "Aurora", group: "Sky", fn: (c) => { const band = Math.exp(-Math.pow((c.y / Math.max(1, c.H) - 0.5 - Math.sin(c.x * 0.08 + c.t * 0.4) * 0.25) * 3, 2)); const h = clamp(band * (0.5 + fbm(c.x * 0.1 + c.t * 0.2, c.t * 0.1) * 0.8)); return pick(c, ramp(AURORA, h), h); } },
  { id: "sunset", label: "Sunset", group: "Sky", fn: (c) => { const k = c.H > 1 ? c.y / (c.H - 1) : (Math.sin(c.t * 0.2) + 1) / 2; const h = clamp(k + Math.sin(c.t * 0.3) * 0.1); return pick(c, ramp([[40, 0, 90], [200, 30, 90], [255, 110, 30], [255, 200, 80]], h), h); } },
  { id: "lightning", label: "Lightning", group: "Sky", fn: (c) => { const slot = Math.floor(c.t * 4); const on = hash(slot) > 0.85 && fract(c.t * 4) < 0.35 ? 1 : 0; const bolt = Math.abs(c.x - c.W * hash(slot + 1) - noise(c.y * 0.5, slot) * 6) < 1.5 ? 1 : 0.25; const k = on * bolt; return pick(c, mix([5, 5, 20], [220, 220, 255], k), k); } },
  { id: "clouds", label: "Clouds", group: "Sky", fn: (c) => { const h = clamp(fbm(c.x * 0.12 + c.t * 0.25, c.y * 0.2) * 1.4 - 0.3); return pick(c, mix([40, 110, 220], [245, 245, 255], h), h); } },
  { id: "stars", label: "Stars", group: "Sky", fn: (c) => { const r = hash2(c.x, c.y); const k = r > 0.9 ? Math.pow((Math.sin(c.t * (1 + r * 3) + r * 40) + 1) / 2, 3) : 0; return pick(c, mix([0, 0, 15], [255, 250, 230], k), k, r); } },
  { id: "galaxy", label: "Galaxy", group: "Sky", fn: (c) => { const dx = c.x - c.W / 2, dy = (c.y - c.H / 2) * 2; const a = Math.atan2(dy, dx), d = Math.hypot(dx, dy); const h = clamp((Math.sin(a * 2 + d * 0.3 - c.t) + 1) / 2 * Math.exp(-d * 0.04) * 1.6); return pick(c, ramp([K, [60, 0, 120], [200, 80, 255], WH], h), h); } },
  { id: "nebula", label: "Nebula", group: "Sky", fn: (c) => { const h = fbm(c.x * 0.1 + c.t * 0.05, c.y * 0.1); const hue = fbm(c.x * 0.05 - c.t * 0.03, c.y * 0.05 + 7); return pick(c, sc(hsv(0.6 + hue * 0.4, 0.8, 1), h * h * 1.4), h); } },
  // ── Nature ──
  { id: "forest", label: "Forest light", group: "Nature", fn: (c) => { const h = clamp(fbm(c.x * 0.2 + Math.sin(c.t * 0.5) * 0.8, c.y * 0.2) * 1.5 - 0.3); return pick(c, mix([10, 50, 10], [200, 255, 120], h), h); } },
  { id: "fireflies", label: "Fireflies", group: "Nature", fn: (c) => { let k = 0; for (let i = 0; i < 6; i++) { const fx = (noise(i * 9, c.t * 0.3) * 1.2 - 0.1) * c.W, fy = (noise(i * 9 + 4, c.t * 0.3) * 1.2 - 0.1) * c.H; const d = Math.hypot(c.x - fx, c.y - fy); k = Math.max(k, clamp(1 - d / 2.5) * (0.5 + 0.5 * Math.sin(c.t * 3 + i))); } return pick(c, sc([200, 255, 60], k), k); } },
  { id: "lava-lamp", label: "Lava lamp", group: "Nature", fn: (c) => { let s = 0; for (let i = 0; i < 4; i++) { const bx = c.W * (0.2 + 0.6 * hash(i)), by = c.H * (0.5 + 0.5 * Math.sin(c.t * (0.3 + hash(i + 5) * 0.4) + i * 2)); s += 6 / (1 + Math.hypot(c.x - bx, (c.y - by) * 1.5) ** 2); } const h = clamp(s); return pick(c, mix([60, 0, 90], [255, 80, 160], h), h); } },
  { id: "snow", label: "Snow", group: "Nature", fn: (c) => { const p = fract(c.t * (0.1 + hash(c.x) * 0.15) + hash(c.x * 5)); const fy = p * (c.H + 2) - 1; const k = Math.abs(c.y - fy) < 0.7 ? 1 : 0; return pick(c, mix([5, 10, 30], WH, k), k); } },
  { id: "sandstorm", label: "Sandstorm", group: "Nature", fn: (c) => { const h = fbm(c.x * 0.3 - c.t * 3, c.y * 0.3); return pick(c, ramp([[60, 30, 5], [200, 130, 50], [255, 220, 150]], h), h); } },
  { id: "toxic", label: "Toxic", group: "Nature", fn: (c) => { const h = clamp(fbm(c.x * 0.25, c.y * 0.25 - c.t * 0.8) * 1.4 - 0.2); return pick(c, ramp([K, [30, 120, 0], [150, 255, 0], [230, 255, 150]], h), h); } },
  // ── Party ──
  { id: "matrix", label: "Matrix", group: "Party", fn: (c) => { const sp = 0.5 + hash(c.x) * 1.2; const head = fract(c.t * sp * 0.3 + hash(c.x * 9)) * (c.H + 8); const d = head - c.y; const k = d >= 0 && d < 8 ? (d < 1 ? 1 : 0.8 - d / 10) : 0; return pick(c, d >= 0 && d < 1 ? [200, 255, 200] : sc([0, 255, 70], k), k); } },
  { id: "scanner", label: "Scanner", group: "Party", fn: (c) => { const p = (Math.sin(c.t * 2) + 1) / 2 * (c.W - 1); const k = clamp(1 - Math.abs(c.x - p) / 3); return pick(c, sc([255, 0, 0], k), k); } },
  { id: "disco", label: "Disco", group: "Party", fn: (c) => { const cell = hash2(Math.floor(c.x / 2), Math.floor(c.y / 2) + Math.floor(c.t * 3) * 17); return pick(c, hsv(cell, 1, cell > 0.4 ? 1 : 0), cell > 0.4 ? 1 : 0, cell); } },
  { id: "equalizer", label: "Equalizer", group: "Party", fn: (c) => { const band = Math.floor(c.x / 2); const lvl = noise(band * 3, c.t * 4) * 0.8 + 0.2; const ny = c.H > 1 ? 1 - c.y / (c.H - 1) : 0.5; const k = c.H > 1 ? (ny <= lvl ? 1 : 0) : lvl; return pick(c, c.H > 1 ? ramp([[0, 255, 0], [255, 255, 0], [255, 0, 0]], ny) : sc(ramp([[0, 255, 0], [255, 0, 0]], lvl), lvl), k, ny); } },
  { id: "vu", label: "VU meter", group: "Party", fn: (c) => { const lvl = noise(0, c.t * 5) * 0.9 + 0.1; const nx = c.x / Math.max(1, c.W - 1); return nx <= lvl ? pick(c, ramp([[0, 255, 0], [255, 255, 0], [255, 0, 0]], nx), 1, nx) : K; } },
  { id: "checker", label: "Checker", group: "Party", fn: (c) => { const on = (Math.floor(c.x / 2) + Math.floor(c.y / 2) + Math.floor(c.t * 2)) % 2; return pick(c, on ? [255, 0, 180] : [0, 200, 255], 1, on ? 0 : 0.5); } },
  { id: "spiral", label: "Spiral", group: "Party", fn: (c) => { const dx = c.x - c.W / 2, dy = c.y - c.H / 2; const ph = Math.atan2(dy, dx) / (Math.PI * 2) + Math.hypot(dx, dy) * 0.05 - c.t * 0.4; return pick(c, hsv(ph), 1, fract(ph)); } },
  { id: "radar", label: "Radar", group: "Party", fn: (c) => { const a = fract(Math.atan2(c.y - c.H / 2, c.x - c.W / 2) / (Math.PI * 2) - c.t * 0.3); const k = Math.pow(1 - a, 6); return pick(c, sc([0, 255, 90], k), k); } },
  { id: "kaleido", label: "Kaleidoscope", group: "Party", fn: (c) => { const dx = Math.abs(c.x - c.W / 2), dy = Math.abs(c.y - c.H / 2); const v = Math.sin(dx * 0.5 + c.t) + Math.sin(dy * 0.5 - c.t * 1.3) + Math.sin((dx + dy) * 0.3 + c.t * 0.7); return pick(c, hsv(v / 6 + c.t * 0.05), 1, fract(v / 6)); } },
  { id: "tv-noise", label: "TV noise", group: "Party", fn: (c) => { const v = hash2(c.x + Math.floor(c.t * 25) * 13, c.y); return pick(c, [v * 255, v * 255, v * 255], v); } },
  // ── Shapes ──
  { id: "diagonal", label: "Diagonal stripes", group: "Shapes", fn: (c) => { const ph = fract((c.x + c.y) / 8 - c.t * 0.5); return pick(c, ph < 0.5 ? WH : K, ph < 0.5 ? 1 : 0, ph); } },
  { id: "rings", label: "Rings", group: "Shapes", fn: (c) => { const d = Math.hypot(c.x - c.W / 2, (c.y - c.H / 2) * 1.5); const ph = fract(d / 6 - c.t * 0.6); return pick(c, hsv(ph), 1, ph); } },
  { id: "pulse", label: "Centre pulse", group: "Shapes", fn: (c) => { const d = Math.abs(c.x - c.W / 2) / (c.W / 2 || 1); const r = fract(c.t * 0.7); const k = clamp(1 - Math.abs(d - r) * 6); return pick(c, sc([255, 255, 255], k), k); } },
  { id: "zigzag", label: "Zigzag", group: "Shapes", fn: (c) => { const ph = fract((c.x + Math.abs(fract(c.y / 4) - 0.5) * 8) / 10 - c.t * 0.5); return pick(c, hsv(ph, 0.9), 1, ph); } },
  { id: "diamond", label: "Diamond", group: "Shapes", fn: (c) => { const d = Math.abs(c.x - c.W / 2) + Math.abs(c.y - c.H / 2) * 2; const ph = fract(d / 8 - c.t * 0.7); const k = ph < 0.4 ? 1 : 0; return pick(c, sc([0, 220, 255], k), k, ph); } },
  { id: "tunnel", label: "Tunnel", group: "Shapes", fn: (c) => { const d = Math.hypot(c.x - c.W / 2, c.y - c.H / 2) + 0.5; const ph = fract(4 / d + c.t * 0.8); return pick(c, sc(hsv(ph), clamp(d / 4)), clamp(d / 4), ph); } },
  // ── Basic ──
  { id: "breathe", label: "Breathe", group: "Basic", fn: (c) => { const k = (Math.sin(c.t * 1.5) + 1) / 2; return pick(c, sc([255, 255, 255], k), k, 0); } },
  { id: "heartbeat", label: "Heartbeat", group: "Basic", fn: (c) => { const p = fract(c.t * 0.9); const k = Math.max(Math.exp(-Math.pow((p - 0.1) * 25, 2)), 0.7 * Math.exp(-Math.pow((p - 0.3) * 25, 2))); return pick(c, sc([255, 0, 30], k), k, 0); } },
  { id: "colour-cycle", label: "Colour cycle", group: "Basic", fn: (c) => pick(c, hsv(c.t * 0.1), 1, fract(c.t * 0.1)) },
  { id: "split", label: "Split colours", group: "Basic", fn: (c) => { const left = c.x < c.W / 2; const sw = Math.floor(c.t * 0.5) % 2 === 1; return pick(c, left !== sw ? [255, 60, 0] : [0, 120, 255], 1, left !== sw ? 0 : 0.5); } },
  { id: "vertical", label: "Vertical gradient", group: "Basic", fn: (c) => { const k = c.H > 1 ? c.y / (c.H - 1) : fract(c.t * 0.2); return pick(c, ramp([[255, 0, 120], [255, 160, 0], [0, 200, 255]], fract(k + c.t * 0.1)), 1, fract(k + c.t * 0.1)); } },
  { id: "glitch", label: "Glitch", group: "Basic", fn: (c) => { const row = Math.floor(c.y) + Math.floor(c.t * 8) * 7; const on = hash(row) > 0.6; const sh = on ? Math.floor(hash(row + 1) * 6) : 0; const v = hash2(Math.floor((c.x + sh) / 3), Math.floor(c.t * 8)); return pick(c, on ? hsv(v, 1, 1) : sc([0, 200, 255], 0.15), on ? 1 : 0.15, v); } },
];

export const PIXEL_GENERATOR_GROUPS = [...new Set(PIXEL_GENERATORS.map((g) => g.group))];
export const generatorById = (id?: string) => PIXEL_GENERATORS.find((g) => g.id === id) ?? PIXEL_GENERATORS[0]!;
