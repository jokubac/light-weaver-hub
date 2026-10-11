// Turns the console state into 512-channel DMX universes and streams them to the
// local CRMX bridge, which sends Art-Net / sACN to the transmitter.
// Channel layouts are generic per mode type — check against each fixture's DMX chart.

import { fixtureState, getMode, kelvin, type PatchedFixture } from "./dmx";
import type { Connection } from "./store";
import { asteraTokens, CELL_TOKENS } from "./astera";
import { getTransmitter, reorder, type ColorOrder } from "./transmitters";

type RGB = [number, number, number];

const to8 = (x: number) => Math.max(0, Math.min(255, Math.round(x * 255)));

function writer(buf: Uint8Array, start: number, wide: boolean) {
  let p = start - 1;
  return (x: number) => {
    const v = Math.max(0, Math.min(1, x));
    if (wide) {
      const n = Math.round(v * 65535);
      if (p >= 0 && p < 512) buf[p] = n >> 8;
      if (p + 1 < 512) buf[p + 1] = n & 255;
      p += 2;
    } else {
      if (p >= 0 && p < 512) buf[p] = to8(v);
      p += 1;
    }
  };
}

const CELL_HAS = CELL_TOKENS as Record<string, string[]>;

function rgbToHs(r: number, g: number, b: number): [number, number] {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [((h * 60 + 360) % 360) / 360, max ? d / max : 0];
}

/** sRGB → CIE 1931 xy (0-1); white falls back to D65. */
function rgbToXy(r: number, g: number, b: number): [number, number] {
  const lin = (c: number) => (c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92);
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const X = 0.4124 * R + 0.3576 * G + 0.1805 * B, Y = 0.2126 * R + 0.7152 * G + 0.0722 * B, Z = 0.0193 * R + 0.1192 * G + 0.9505 * B;
  const s = X + Y + Z;
  return s ? [X / s, Y / s] : [0.3127, 0.329];
}

function encode(f: PatchedFixture, buf: Uint8Array, t: number, level: number, pixels: RGB[] | undefined, order: ColorOrder) {
  const mode = getMode(f);
  const wide = /16/.test(mode.name);
  const st = fixtureState(f, t, level);
  const v = st.v;
  const [r, g, b] = reorder(st.rgb.map((c) => c / 255) as RGB, order);

  if (mode.astera && !f.split) {
    const tokens = asteraTokens(mode.astera);
    const hasDim = tokens.some((x) => x.token.startsWith("D"));
    const pv = f.on === false ? 0 : f.intensity * level;
    tokens.forEach(({ token, px }, i) => {
      const idx = f.address - 1 + i;
      if (idx < 0 || idx >= 512) return;
      const c = pixels?.[px];
      const [pr, pg, pb] = c ? reorder([c[0] / 255, c[1] / 255, c[2] / 255], order) : [r, g, b];
      const lv = c ? pv : v;
      const [ph, ps] = c ? rgbToHs(pr, pg, pb) : [f.hue / 360, f.cctOnly ? 0 : f.saturation];
      const k = (hasDim ? 1 : lv); // colour channels carry level when there's no dimmer channel
      const white = Math.min(pr, pg, pb);
      const has = (t: string) => CELL_HAS[mode.astera!.cell]?.includes(t);
      let val = 0, raw: number | null = null;
      switch (token) {
        case "D": val = lv; break;
        case "D16": raw = Math.round(lv * 65535) >> 8; break;
        case "D16b": raw = Math.round(lv * 65535) & 255; break;
        case "CCT": val = (kelvin(f.cct) - 1750) / 8160; break;
        case "GM": raw = f.gm === 0 ? 0 : Math.max(5, Math.min(255, Math.round(128 * (f.gm + 1)))); break;
        case "CRO": val = c ? 1 : f.cctOnly ? 0 : f.crossfade; break;
        case "HUE": val = ph; break;
        case "HUE16": raw = Math.round(ph * 65535) >> 8; break;
        case "HUE16b": raw = Math.round(ph * 65535) & 255; break;
        case "SAT": val = c ? ps : ps * (f.cctOnly ? 0 : f.crossfade || 1); break;
        case "R": val = (has("W") ? pr - white : pr) * k; break;
        case "G": val = (has("W") ? pg - white : pg) * k; break;
        case "B": val = (has("W") ? pb - white : pb) * k; break;
        case "W": val = white * k; break;
        case "X16": case "X16b": case "Y16": case "Y16b": {
          const [x, y] = rgbToXy(pr, pg, pb);
          const n = Math.round((token.startsWith("X") ? x : y) * 65535);
          raw = token.endsWith("b") ? n & 255 : n >> 8; break;
        }
        default: val = 0; // A (amber), IND (index colour off), S (strobe off), "." spare
      }
      buf[idx] = raw ?? to8(val);
    });
    return;
  }

  if (mode.profile) {
    const put = (channel: number, value: number) => {
      const index = f.address + channel - 2;
      if (index >= 0 && index < 512) buf[index] = to8(value);
    };
    put(1, v);
    if (mode.profile === "nanlux-evoke-cct") {
      put(2, 0); put(3, (kelvin(f.cct) - 2700) / 3800);
      put(11, (f.fan === "off" ? 224 : f.fan === "low" ? 160 : f.fan === "high" ? 96 : 0) / 255);
    } else if (mode.profile.startsWith("nanlux-dyno")) {
      put(7, (f.fan === "off" ? 213 : f.fan === "low" ? 128 : 0) / 255);
      if (mode.profile === "nanlux-dyno-cct") {
        put(2, 0); put(3, (kelvin(f.cct) - 2700) / 17300);
        put(4, (f.gm < 0 ? 120 + f.gm * 100 : f.gm > 0 ? 145 + f.gm * 100 : 128) / 255);
        put(5, 128 / 255);
      } else if (mode.profile === "nanlux-dyno-hsi") {
        put(2, 48 / 255); put(3, f.hue / 360); put(4, f.cctOnly ? 0 : f.saturation);
      } else {
        const white = Math.min(r, g, b);
        put(2, 80 / 255); put(3, r - white); put(4, g - white); put(5, b - white); put(6, white);
      }
    } else {
      put(2, (kelvin(f.cct) - 1750) / 8160); put(3, f.gm === 0 ? 0 : Math.max(5, Math.min(255, 128 * (f.gm + 1))) / 255);
      put(4, f.hue / 360); put(5, f.cctOnly ? 0 : f.saturation * f.crossfade);
      if (mode.profile === "astera-hsi-strobe") put(6, 0);
    }
    return;
  }

  if (f.split) {
    const w = writer(buf, f.address, false);
    w(r * v); w(g * v); w(b * v);
    if (f.split.cpp >= 4) w(Math.min(r, g, b) * v);
    return;
  }
  if (mode.pixels && pixels) {
    const cpp = Math.max(3, Math.floor(mode.channels / mode.pixels));
    const pv = f.on === false ? 0 : f.intensity * level;
    pixels.forEach((c, i) => {
      const w = writer(buf, f.address + i * cpp, false);
      const [pr, pg, pb] = reorder([c[0] / 255, c[1] / 255, c[2] / 255], order);
      const white = cpp >= 4 ? Math.min(pr, pg, pb) : 0;
      w((pr - white) * pv); w((pg - white) * pv); w((pb - white) * pv);
      if (cpp >= 4) w(white * pv);
    });
    return;
  }
  const w = writer(buf, f.address, wide);
  const cct = f.cct, gm = (f.gm + 1) / 2;
  switch (mode.kind) {
    case "dim": w(v); break;
    case "cct": w(v); w(cct); break;
    case "cctgm": w(v); w(cct); w(gm); break;
    case "hsi": w(v); w(f.hue / 360); w(f.cctOnly ? 0 : f.saturation); w(cct); break;
    case "rgb": w(r * v); w(g * v); w(b * v); break;
    case "rgbw": { const wh = Math.min(r, g, b); w(v); w(r - wh); w(g - wh); w(b - wh); w(wh); break; }
    case "full": w(v); w(cct); w(gm); w(f.cctOnly ? 0 : f.crossfade); w(f.hue / 360); w(f.saturation); break;
  }
}

/** One Uint8Array(512) per universe that has lights patched. */
export function buildUniverses(fixtures: PatchedFixture[], t: number, level: number, frame: Map<string, RGB[]>, conn?: Connection) {
  const out = new Map<number, Uint8Array>();
  const tx = conn?.autoMap ? getTransmitter(conn.transmitter ?? undefined) : undefined;
  const order: ColorOrder = tx?.order ?? "RGB";
  for (const f of fixtures) {
    if (tx && f.universe > tx.universes) continue; // transmitter can't carry this universe
    // bridge numbers Art-Net as (u-1) and sACN as u; shift so app U1 lands on the transmitter's first input
    const u = tx ? f.universe + (conn!.protocol === "artnet" ? tx.artnetStart : tx.sacnStart - 1) : f.universe;
    let buf = out.get(u);
    if (!buf) { buf = new Uint8Array(512); out.set(u, buf); }
    encode(f, buf, t, level, frame.get(f.uid), order);
  }
  return out;
}

export type BridgeStatus = "off" | "ok" | "error";

/** Sends frames to the bridge at up to ~30 fps, skipping frames while one is in flight. */
export function createSender(onStatus: (s: BridgeStatus) => void) {
  let busy = false, last = "", lastAt = 0, status: BridgeStatus = "off";
  const set = (s: BridgeStatus) => { if (s !== status) { status = s; onStatus(s); } };
  return async (conn: Connection, universes: Map<number, Uint8Array>) => {
    if (!conn.node || busy) return;
    const body = JSON.stringify({ protocol: conn.protocol, ip: conn.node.ip, universes: Object.fromEntries([...universes].map(([u, b]) => [u, Array.from(b)])) });
    const now = performance.now();
    if (body === last && now - lastAt < 1000) return; // bridge keeps refreshing on its own
    busy = true;
    try {
      const res = await fetch(`http://${conn.bridge}/dmx`, { method: "POST", body, headers: { "Content-Type": "text/plain" } });
      set(res.ok ? "ok" : "error");
      last = body; lastAt = now;
    } catch {
      set("error");
    } finally {
      busy = false;
    }
  };
}
