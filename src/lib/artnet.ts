// Pure packet builders for Art-Net and sACN (E1.31), ported byte-for-byte from
// public/crmx-bridge.mjs so the native app can send UDP directly without the bridge.

const ARTNET_PORT = 6454;
const SACN_PORT = 5568;

function artHeader(op: number): Uint8Array {
  const b = new Uint8Array(12);
  const id = "Art-Net\0";
  for (let i = 0; i < id.length; i++) b[i] = id.charCodeAt(i);
  b[8] = op & 0xff; b[9] = (op >> 8) & 0xff; // OpCode little-endian
  b[10] = 0; b[11] = 14; // ProtVer big-endian = 14
  return b;
}

/** Builds an ArtDMX packet. `universe` is the app's 1-based universe; Art-Net port address = universe - 1. */
export function buildArtDmx(universe: number, data: Uint8Array, sequence: number): Uint8Array {
  const port = universe - 1;
  const head = artHeader(0x5000);
  const b = new Uint8Array(6);
  b[0] = sequence & 0xff; // Sequence
  b[1] = 0; // Physical
  b[2] = port & 0xff; // SubUni
  b[3] = (port >> 8) & 0x7f; // Net
  b[4] = (data.length >> 8) & 0xff; b[5] = data.length & 0xff; // Length (big-endian), always 512
  const out = new Uint8Array(head.length + b.length + data.length);
  out.set(head, 0); out.set(b, head.length); out.set(data, head.length + b.length);
  return out;
}

export function buildArtPoll(): Uint8Array {
  const head = artHeader(0x2000);
  const b = new Uint8Array(2);
  b[0] = 0x06; b[1] = 0;
  const out = new Uint8Array(head.length + b.length);
  out.set(head, 0); out.set(b, head.length);
  return out;
}

export interface ArtPollReplyInfo { ip: string; name: string; universes?: number }

/** Parses an ArtPollReply; returns null if the buffer isn't one. */
export function parseArtPollReply(msg: Uint8Array, fromIp: string): ArtPollReplyInfo | null {
  if (msg.length < 26) return null;
  const id = Array.from(msg.slice(0, 7)).map((c) => String.fromCharCode(c)).join("");
  if (id !== "Art-Net") return null;
  const op = msg[8]! | (msg[9]! << 8);
  if (op !== 0x2100) return null;
  const ip = `${msg[10]}.${msg[11]}.${msg[12]}.${msg[13]}`;
  const ascii = (start: number, end: number) => {
    let s = "";
    for (let i = start; i < end && i < msg.length; i++) { if (msg[i] === 0) break; s += String.fromCharCode(msg[i]!); }
    return s;
  };
  const short = ascii(26, 44);
  const long = msg.length > 108 ? ascii(44, 108) : "";
  const universes = msg.length > 174 ? (msg[172]! << 8) | msg[173]! : undefined;
  return { ip: ip === "0.0.0.0" ? fromIp : ip, name: long || short || "Art-Net node", universes };
}

/** 16-byte random CID for sACN source identification. */
export function randomCid(): Uint8Array {
  const b = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  return b;
}

const writeAscii = (b: Uint8Array, offset: number, s: string) => { for (let i = 0; i < s.length; i++) b[offset + i] = s.charCodeAt(i); };
const writeU16BE = (b: Uint8Array, offset: number, v: number) => { b[offset] = (v >> 8) & 0xff; b[offset + 1] = v & 0xff; };
const writeU32BE = (b: Uint8Array, offset: number, v: number) => { b[offset] = (v >>> 24) & 0xff; b[offset + 1] = (v >>> 16) & 0xff; b[offset + 2] = (v >>> 8) & 0xff; b[offset + 3] = v & 0xff; };

/** Builds an sACN (E1.31) data packet for one universe. */
export function buildSacn(universe: number, data: Uint8Array, sequence: number, cid: Uint8Array): Uint8Array {
  const b = new Uint8Array(126 + 512);
  // root layer
  writeU16BE(b, 0, 0x0010); writeU16BE(b, 2, 0);
  writeAscii(b, 4, "ASC-E1.17\0\0\0");
  writeU16BE(b, 16, 0x7000 | (638 - 16)); writeU32BE(b, 18, 0x00000004); b.set(cid, 22);
  // framing layer
  writeU16BE(b, 38, 0x7000 | (638 - 38)); writeU32BE(b, 40, 0x00000002);
  writeAscii(b, 44, "KROMA"); b[108] = 100; writeU16BE(b, 109, 0); b[111] = sequence & 0xff; b[112] = 0; writeU16BE(b, 113, universe);
  // DMP layer
  writeU16BE(b, 115, 0x7000 | (638 - 115)); b[117] = 0x02; b[118] = 0xa1;
  writeU16BE(b, 119, 0); writeU16BE(b, 121, 1); writeU16BE(b, 123, 513); b[125] = 0;
  b.set(data.subarray(0, 512), 126);
  return b;
}

/** Default sACN multicast address for a universe: 239.255.hi.lo. */
export function sacnMulticastAddress(universe: number): string {
  return `239.255.${(universe >> 8) & 255}.${universe & 255}`;
}

export const ARTNET_UDP_PORT = ARTNET_PORT;
export const SACN_UDP_PORT = SACN_PORT;
