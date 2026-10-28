// Patch labels: what a label says and how it is drawn at print resolution (203 dpi ≈ 8 dots/mm).
// The wording is a pure function so it can be tested; the drawing lives here so the printer
// dialog, PNG export and PDF export all show exactly the same label.
import { getDef, type PatchedFixture } from "./dmx";

export const DPMM = 8;
const FAMILY = '"Manrope", system-ui, sans-serif';

export interface LabelText {
  /** The light's own name, or its model when nobody named it. */
  name: string;
  /** "Brand Model", e.g. "ARRI SkyPanel S60 Pro". */
  make: string;
  /** Universe as `U`, DMX address as `@`: "U3 @12", or "U3 @12–27" when the mode spans channels. */
  pos: string;
  /** Mode name, e.g. "RGBW 8ch". */
  mode: string;
}

/** The four strings a patch label carries. */
export function labelLines(f: PatchedFixture, modeIdx = f.modeIdx): LabelText {
  const d = getDef(f.defId);
  const m = d.modes[modeIdx];
  const ch = Math.max(1, m?.channels ?? 1);
  return {
    name: f.name.trim() || d.model.trim(),
    make: `${d.brand} ${d.model}`.trim(),
    pos: `U${f.universe} @${f.address}${ch > 1 ? `–${f.address + ch - 1}` : ""}`,
    mode: m?.name ?? "",
  };
}

const font = (px: number, weight: number) => `${weight} ${Math.round(px)}px ${FAMILY}`;

/** Biggest size (≤ max, ≥ min) at which `text` still fits `maxW`; 0 when even min is too wide. */
function fitPx(g: CanvasRenderingContext2D, text: string, maxW: number, max: number, min: number, weight: number) {
  let lo = Math.max(1, Math.round(min)), hi = Math.max(1, Math.round(max)), best = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    g.font = font(mid, weight);
    if (g.measureText(text).width <= maxW) { best = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return best;
}

/** Shorten `text` with a trailing … so it fits; the font must already be set. */
function ellipsize(g: CanvasRenderingContext2D, text: string, maxW: number) {
  let s = text;
  while (s.length > 1 && g.measureText(`${s}…`).width > maxW) s = s.slice(0, -1);
  return `${s.trimEnd()}…`;
}

/** Break `text` into at most maxLines lines at word edges (the tail is kept whole and shrinks). */
function wrap(g: CanvasRenderingContext2D, text: string, maxW: number, px: number, weight: number, maxLines: number) {
  g.font = font(px, weight);
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (let i = 0; i < words.length; i++) {
    const t = cur ? `${cur} ${words[i]}` : words[i]!;
    if (!cur || g.measureText(t).width <= maxW) cur = t;
    else {
      lines.push(cur);
      cur = lines.length === maxLines - 1 ? words.slice(i).join(" ") : words[i]!;
      if (lines.length === maxLines - 1) break;
    }
  }
  lines.push(cur);
  return lines.filter(Boolean);
}

/** Name block: one line if it can stay big, otherwise two lines that let the type grow back. */
function nameBlock(g: CanvasRenderingContext2D, name: string, maxW: number, maxPx: number, weight: number, maxLines: number) {
  let best = { lines: [name], px: fitPx(g, name, maxW, maxPx, 8, weight) };
  if (maxLines > 1 && best.px < maxPx * 0.68) {
    const lines = wrap(g, name, maxW, Math.max(9, Math.round(maxPx * 0.6)), weight, maxLines);
    if (lines.length > 1) {
      const px = Math.min(...lines.map((l) => fitPx(g, l, maxW, maxPx, 8, weight)));
      if (px > best.px) best = { lines, px };
    }
  }
  if (!best.px) best = { lines: best.lines, px: 8 };
  return best;
}

/** One line of text, auto-fit and vertically centred inside the band [y, y+bandH]. */
function drawLine(g: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, bandH: number, weight: number, align: "left" | "right" = "left") {
  if (!text || maxW <= 4) return;
  const px = fitPx(g, text, maxW, Math.max(8, bandH * 0.88), 8, weight) || 8;
  g.font = font(px, weight);
  const s = g.measureText(text).width > maxW ? ellipsize(g, text, maxW) : text;
  g.textAlign = align;
  g.textBaseline = "middle";
  g.fillText(s, align === "right" ? x + maxW : x, y + bandH / 2);
  g.textAlign = "left";
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}

/** Patch number in a solid corner chip: visible, but it never eats the name's line. */
function drawBadge(g: CanvasRenderingContext2D, x: number, y: number, size: number, num: number) {
  const s = String(num);
  roundRect(g, x, y, size, size, size * 0.28);
  g.fill();
  const px = fitPx(g, s, size * 0.8, size * 0.7, 8, 800) || 8;
  g.font = font(px, 800);
  g.fillStyle = "#fff";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(s, x + size / 2, y + size / 2);
  g.textAlign = "left";
  g.fillStyle = "#000";
}

/** Draw one patch label (black on white) at printer resolution. */
export function drawLabel(f: PatchedFixture, num: number, wMm: number, hMm: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(16, Math.round(wMm * DPMM));
  c.height = Math.max(16, Math.round(hMm * DPMM));
  const g = c.getContext("2d")!;
  g.fillStyle = "#fff";
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = "#000";
  g.strokeStyle = "#000";

  const L = labelLines(f);
  const tall = c.height >= 140; // ≥ ~18 mm: room for the maker line too
  const lw = Math.max(2, Math.round(c.height * 0.028));
  const inset = Math.max(3, Math.round(Math.min(c.width, c.height) * 0.05));
  roundRect(g, inset, inset, c.width - inset * 2, c.height - inset * 2, Math.min(c.width, c.height) * 0.16);
  g.lineWidth = lw;
  g.stroke();

  const ix = inset + lw * 2;
  const iy = inset + lw * 2;
  const iw = c.width - ix * 2;
  const ih = c.height - iy * 2;
  const gap = Math.max(2, Math.round(lw * 1.1));
  const band = Math.round(Math.max(12, ih * (tall ? 0.26 : 0.33))); // chip + "U3 @12"
  const sub = tall ? Math.round(ih * 0.17) : 0; // "ARRI SkyPanel S60 Pro · RGBW 8ch"
  const nameH = Math.max(10, ih - band - sub - gap * (tall ? 2 : 1));

  const nb = nameBlock(g, L.name, iw, Math.round(nameH * (tall ? 0.6 : 0.92)), 800, tall ? 2 : 1);
  const lh = nameH / nb.lines.length;
  nb.lines.forEach((line, i) => drawLine(g, line, ix, y(i), iw, lh, 800));

  let y = (i = 0) => iy + i * lh;
  y = (i = 0) => iy + i * lh;
  nb.lines.forEach((line, i) => drawLine(g, line, ix, y(i), iw, lh, 800));

  let bottom = iy + nameH + gap;
  if (tall) {
    drawLine(g, [L.make, L.mode].filter(Boolean).join(" · "), ix, bottom, iw, sub, 600);
    bottom += sub + gap;
  }
  g.fillRect(ix, bottom - gap, iw, Math.max(1, Math.round(lw * 0.5))); // hairline above the address row
  const bs = band;
  drawBadge(g, ix, bottom, bs, num);
  drawLine(g, L.pos, ix + bs + gap, bottom, iw - bs - gap, band, 700);
  return c;
}
