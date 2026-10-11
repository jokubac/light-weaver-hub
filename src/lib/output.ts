// Turns the console state into 512-channel DMX universes and streams them to the
// local CRMX bridge, which sends Art-Net / sACN to the transmitter.
// Channel layouts are generic per mode type — check against each fixture's DMX chart.

import { fixtureState, getMode, kelvin, type PatchedFixture } from "./dmx";
import type { Connection } from "./store";
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

function encode(f: PatchedFixture, buf: Uint8Array, t: number, level: number, pixels: RGB[] | undefined, order: ColorOrder) {
  const mode = getMode(f);
  const wide = /16/.test(mode.name);
  const st = fixtureState(f, t, level);
  const v = st.v;
  const [r, g, b] = reorder(st.rgb.map((c) => c / 255) as RGB, order);

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
      put(2, (kelvin(f.cct) - 1750) / 8250); put(3, (f.gm + 1) / 2);
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
