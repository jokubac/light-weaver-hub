// Encodes the console state into 512-channel DMX universes.
// Channel layouts follow a generic order per mode type (intensity first, then colour);
// check each fixture's DMX chart and adjust if a manufacturer uses a different order.

import { fixtureBaseRgb, fixtureLevel, getMode, pixelCount, type PatchedFixture } from "./dmx";
import { itemCells, pixelColor, type PixelMap } from "./pixels";

const c01 = (x: number) => Math.min(1, Math.max(0, x));

export function encodeUniverses(fixtures: PatchedFixture[], t: number, master: number, pixelMap?: PixelMap): Map<number, Uint8Array> {
  const out = new Map<number, Uint8Array>();
  const uni = (u: number) => {
    let a = out.get(u);
    if (!a) { a = new Uint8Array(512); out.set(u, a); }
    return a;
  };

  for (const f of fixtures) {
    const mode = getMode(f);
    const buf = uni(f.universe);
    const sixteen = /16-bit/.test(mode.name);
    let ch = f.address - 1;
    const end = ch + mode.channels;
    const put = (v: number) => {
      const x = Math.round(c01(v) * (sixteen ? 65535 : 255));
      if (sixteen) {
        if (ch < end && ch < 512) buf[ch++] = x >> 8;
        if (ch < end && ch < 512) buf[ch++] = x & 255;
      } else if (ch < end && ch < 512) buf[ch++] = x;
    };
    const putByte = (v: number) => { if (ch < end && ch < 512) buf[ch++] = Math.round(c01(v) * 255); };

    const level = c01(f.intensity * fixtureLevel(f, t) * master);
    const [r, g, b] = fixtureBaseRgb(f).map((x) => x / 255) as [number, number, number];
    const px = pixelCount(f);

    if (px > 1) {
      const item = pixelMap?.items.find((i) => i.uid === f.uid);
      const usePixels = item && pixelMap && pixelMap.effect.kind !== "off";
      const perPx = mode.kind === "rgb" ? 3 : 4;
      const hasDim = mode.channels === px * perPx + 1;
      if (hasDim) putByte(usePixels ? master : level);
      const cells = item ? itemCells(item, px) : [];
      for (let i = 0; i < px; i++) {
        let pr = r * (hasDim ? 1 : level), pg = g * (hasDim ? 1 : level), pb = b * (hasDim ? 1 : level);
        if (usePixels) {
          const [x, y] = cells[i]!;
          const [cr, cg, cb] = pixelColor(pixelMap!, x, y, t);
          const k = hasDim ? 1 : master;
          pr = (cr / 255) * k; pg = (cg / 255) * k; pb = (cb / 255) * k;
        }
        const w = perPx === 4 ? Math.min(pr, pg, pb) : 0;
        putByte(pr - w); putByte(pg - w); putByte(pb - w);
        if (perPx === 4) putByte(w);
      }
      continue;
    }

    switch (mode.kind) {
      case "dim": put(level); break;
      case "cct": put(level); put(f.cct); break;
      case "cctgm": put(level); put(f.cct); put((f.gm + 1) / 2); break;
      case "hsi": put(level); put(f.hue / 360); put(f.cctOnly ? 0 : f.saturation * f.crossfade); break;
      case "rgb":
        if (mode.channels % 3 === 1) { put(level); put(r); put(g); put(b); }
        else { put(r * level); put(g * level); put(b * level); }
        break;
      case "rgbw": {
        const w = Math.min(r, g, b);
        if (mode.channels % 4 === 1) put(level);
        const k = mode.channels % 4 === 1 ? 1 : level;
        put((r - w) * k); put((g - w) * k); put((b - w) * k); put(w * k);
        break;
      }
      case "full":
        put(level); put(f.cct); put((f.gm + 1) / 2); put(f.cctOnly ? 0 : f.crossfade); put(f.hue / 360); put(f.saturation);
        break;
    }
  }
  return out;
}
