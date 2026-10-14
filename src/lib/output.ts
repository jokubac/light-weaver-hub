// Turns the console state into 512-channel DMX universes and streams them to the
// local CRMX bridge, which sends Art-Net / sACN to the transmitter.
// Channel layouts are generic per mode type — check against each fixture's DMX chart.

import { fixtureState, resolveCctMix, getMode, kelvin, type PatchedFixture } from "./dmx";
import type { Connection } from "./store";
import { asteraTokens, CELL_TOKENS } from "./astera";
import { getTransmitter, reorder, type ColorOrder } from "./transmitters";
import { buildArtDmx, buildSacn, randomCid, sacnMulticastAddress, ARTNET_UDP_PORT, SACN_UDP_PORT } from "./artnet";
import { isNativeApp, sendUdp } from "./native-udp";
import { sendMoonLite } from "./moonlite";

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

function encode(f0: PatchedFixture, buf: Uint8Array, t: number, level: number, pixels: RGB[] | undefined, order: ColorOrder) {
  // white-light overlaps output a real blended colour temperature on CCT channels
  const f = resolveCctMix(f0, t) ?? f0;
  const mode = getMode(f);
  const wide = /16/.test(mode.name);
  const st = fixtureState(f, t, level);
  const v = st.v;
  const [r, g, b] = reorder(st.rgb.map((c) => c / 255) as RGB, order);
  const paletteActive = (f.fxPlaying !== false && f.fx.kind !== "none" && !!f.fx.colors?.length) || !!f.mix;
  const [hue, saturation] = paletteActive ? rgbToHs(r, g, b) : [f.hue / 360, f.cctOnly ? 0 : f.saturation];

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
      const [ph, ps] = c ? rgbToHs(pr, pg, pb) : [hue, saturation];
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
        case "CRO": val = c || paletteActive ? 1 : f.cctOnly ? 0 : f.crossfade; break;
        case "HUE": val = ph; break;
        case "HUE16": raw = Math.round(ph * 65535) >> 8; break;
        case "HUE16b": raw = Math.round(ph * 65535) & 255; break;
        case "SAT": val = c || paletteActive ? ps : ps * (f.cctOnly ? 0 : f.crossfade || 1); break;
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
        put(2, 48 / 255); put(3, hue); put(4, saturation);
      } else {
        const white = Math.min(r, g, b);
        put(2, 80 / 255); put(3, r - white); put(4, g - white); put(5, b - white); put(6, white);
      }
    } else {
      put(2, (kelvin(f.cct) - 1750) / 8160); put(3, f.gm === 0 ? 0 : Math.max(5, Math.min(255, 128 * (f.gm + 1))) / 255);
      put(4, hue); put(5, paletteActive ? saturation : f.cctOnly ? 0 : f.saturation * f.crossfade);
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
  if (mode.channelMap) {
    // imported (GDTF / Fixture builder) layouts: one entry per DMX slot, "fine" = low byte of a 16-bit pair
    const valueFor = (attr: string): number => {
      switch (attr) {
        case "Dimmer": return v;
        case "CCT": return f.cct;
        case "GM": return (f.gm + 1) / 2;
        case "Hue": return hue;
        case "Saturation": return saturation;
        case "Red": return r * v;
        case "Green": return g * v;
        case "Blue": return b * v;
        case "White": return Math.min(r, g, b) * v;
        case "Crossfade": return paletteActive ? 1 : f.cctOnly ? 0 : f.crossfade;
        default: return 0; // Amber, Strobe, Spare
      }
    };
    const has16 = new Set(mode.channelMap.filter((e) => e.fine).map((e) => e.attr));
    mode.channelMap.forEach((e, i) => {
      const idx = f.address - 1 + i;
      if (idx < 0 || idx >= 512) return;
      const raw = e.attr === "CCT" && e.physicalRange ? (kelvin(f.cct) - e.physicalRange[0]) / (e.physicalRange[1] - e.physicalRange[0]) : valueFor(e.attr);
      const val = Math.max(0, Math.min(1, raw));
      if (has16.has(e.attr)) { const n = Math.round(val * 65535); buf[idx] = e.fine ? n & 255 : n >> 8; }
      else buf[idx] = to8(val);
    });
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
    case "hsi": w(v); w(hue); w(saturation); w(cct); break;
    case "rgb": w(r * v); w(g * v); w(b * v); break;
    case "rgbw": { const wh = Math.min(r, g, b); w(v); w(r - wh); w(g - wh); w(b - wh); w(wh); break; }
    case "full": w(v); w(cct); w(gm); w(paletteActive ? 1 : f.cctOnly ? 0 : f.crossfade); w(hue); w(saturation); break;
  }
}

/** One Uint8Array(512) per universe that has lights patched. */
export function buildUniverses(fixtures: PatchedFixture[], t: number, level: number, frame: Map<string, RGB[]>, conn?: Connection) {
  const out = new Map<number, Uint8Array>();
  const tx = conn?.autoMap && conn.transport !== "bluetooth" ? getTransmitter(conn.transmitter ?? undefined) : undefined;
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

export type BridgeStatus = "off" | "ok" | "slow" | "error";

/** Sends ArtDmx/sACN packets straight from the device over UDP — no bridge computer. */
function createDirectSender(onStatus: (s: BridgeStatus) => void) {
  let busy = false, last = "", lastAt = 0, status: BridgeStatus = "off";
  const sequence = new Map<number, number>();
  const cid = randomCid();
  const set = (s: BridgeStatus) => { if (s !== status) { status = s; onStatus(s); } };
  return async (conn: Connection, universes: Map<number, Uint8Array>) => {
    if (!conn.node || !universes.size) { set("off"); return; }
    if (busy) return;
    const body = JSON.stringify({ protocol: conn.protocol, ip: conn.node.ip, universes: Object.fromEntries([...universes].map(([u, b]) => [u, Array.from(b)])) });
    const now = performance.now();
    const changed = body !== last;
    if (!changed && now - lastAt < 1000) return; // 1 s keepalive refresh
    if (changed && now - lastAt < 33) return; // cap to ~30 fps
    busy = true;
    try {
      const ip = conn.node.ip;
      // send every universe at once so U1 and U32 leave in the same instant
      await Promise.all([...universes].map(([u, data]) => {
        const seq = ((sequence.get(u) ?? 0) % 255) + 1;
        sequence.set(u, seq);
        return conn.protocol === "sacn"
          ? sendUdp(ip || sacnMulticastAddress(u), SACN_UDP_PORT, buildSacn(u, data, seq, cid))
          : sendUdp(ip || "255.255.255.255", ARTNET_UDP_PORT, buildArtDmx(u, data, seq));
      }));
      set(now - lastAt > 500 && changed ? "slow" : "ok");
      last = body; lastAt = now;
    } catch {
      set("error");
    } finally {
      busy = false;
    }
  };
}

/** Sends frames to the bridge at up to ~30 fps, skipping frames while one is in flight. */
function createBridgeSender(onStatus: (s: BridgeStatus) => void) {
  let busy = false, last = "", lastAt = 0, status: BridgeStatus = "off";
  const set = (s: BridgeStatus) => { if (s !== status) { status = s; onStatus(s); } };
  return async (conn: Connection, universes: Map<number, Uint8Array>) => {
    if (!conn.node) { set("off"); return; }
    if (busy) return;
    const body = JSON.stringify({ protocol: conn.protocol, ip: conn.node.ip, universes: Object.fromEntries([...universes].map(([u, b]) => [u, Array.from(b)])) });
    const now = performance.now();
    if (body === last && now - lastAt < 1000) return; // bridge keeps refreshing on its own
    busy = true;
    const ctrl = new AbortController();
    const slowTimer = setTimeout(() => set("slow"), 500);
    const timeout = setTimeout(() => ctrl.abort(), 3000);
    try {
      const res = await fetch(`http://${conn.bridge}/dmx`, { method: "POST", body, signal: ctrl.signal, headers: { "Content-Type": "text/plain" } });
      set(res.ok ? (performance.now() - now > 500 ? "slow" : "ok") : "error");
      last = body; lastAt = now;
    } catch {
      set("error");
    } finally {
      clearTimeout(slowTimer);
      clearTimeout(timeout);
      busy = false;
    }
  };
}

/** Picks the direct-UDP or bridge-HTTP transport per connection; direct only runs inside the installed app. */
export function createSender(onStatus: (s: BridgeStatus) => void) {
  const direct = createDirectSender(onStatus);
  const bridge = createBridgeSender(onStatus);
  return async (conn: Connection, universes: Map<number, Uint8Array>) => {
    if (conn.transport === "bluetooth") {
      if (!conn.node) { onStatus("off"); return; }
      const data = universes.get(conn.bluetoothUniverse ?? 1) ?? new Uint8Array(512);
      try { await sendMoonLite(conn.node.ip, data); onStatus("ok"); }
      catch { onStatus("error"); }
      return;
    }
    if (conn.transport === "direct" && isNativeApp()) return direct(conn, universes);
    return bridge(conn, universes);
  };
}
