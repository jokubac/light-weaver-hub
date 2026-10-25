#!/usr/bin/env node
// NOX bridge — receives DMX from the NOX app and sends it as
// Art-Net or sACN (E1.31) to your CRMX transmitter (LumenRadio, Astera ART7, Ratpac, DMXking…).
//
// Run on a laptop / Raspberry Pi on the same network as the transmitter:
//   node crmx-bridge.mjs            (needs Node.js 18+, no installs)
//   node crmx-bridge.mjs --port 8765 --bind 0.0.0.0
//
// Then in the app: CONNECT → Bridge address "localhost:8765" → Scan → pick the transmitter.

import http from "node:http";
import dgram from "node:dgram";
import os from "node:os";
import crypto from "node:crypto";

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const PORT = +arg("port", 8765);
const BIND = arg("bind", "0.0.0.0");
const ARTNET_PORT = 6454, SACN_PORT = 5568;
const CID = crypto.randomBytes(16);

const udp = dgram.createSocket({ type: "udp4", reuseAddr: true });
udp.bind(ARTNET_PORT, () => { udp.setBroadcast(true); });
udp.on("error", (e) => console.error("UDP:", e.message));

const broadcasts = () => {
  const list = ["255.255.255.255", "2.255.255.255", "10.255.255.255"];
  for (const ifs of Object.values(os.networkInterfaces())) for (const i of ifs ?? []) {
    if (i.family !== "IPv4" || i.internal) continue;
    const ip = i.address.split(".").map(Number), mask = i.netmask.split(".").map(Number);
    list.push(ip.map((b, k) => (b & mask[k]) | (~mask[k] & 255)).join("."));
  }
  return [...new Set(list)];
};

/* ---------- Art-Net ---------- */
const header = (op) => { const b = Buffer.alloc(12); b.write("Art-Net\0", 0, "ascii"); b.writeUInt16LE(op, 8); b.writeUInt16BE(14, 10); return b; };
const seq = new Map();
function artDmx(universe, data) {
  const s = ((seq.get(universe) ?? 0) % 255) + 1; seq.set(universe, s);
  const port = universe - 1; // app universe 1 = Art-Net port address 0
  const head = header(0x5000);
  const b = Buffer.alloc(6);
  b[0] = s; b[1] = 0; b[2] = port & 0xff; b[3] = (port >> 8) & 0x7f; b.writeUInt16BE(512, 4);
  return Buffer.concat([head, b, Buffer.from(data)]);
}
function artPoll() { const b = Buffer.alloc(2); b[0] = 0x06; b[1] = 0; return Buffer.concat([header(0x2000), b]); }

const found = new Map();
udp.on("message", (msg, rinfo) => {
  if (msg.length < 26 || msg.toString("ascii", 0, 7) !== "Art-Net" || msg.readUInt16LE(8) !== 0x2100) return;
  const ip = `${msg[10]}.${msg[11]}.${msg[12]}.${msg[13]}`;
  const short = msg.toString("ascii", 26, 44).replace(/\0.*$/, "");
  const long = msg.length > 108 ? msg.toString("ascii", 44, 108).replace(/\0.*$/, "") : "";
  const ports = msg.length > 174 ? msg.readUInt16BE(172) : undefined;
  if (!isLocal(ip)) found.set(ip, { name: long || short || "Art-Net node", ip: ip === "0.0.0.0" ? rinfo.address : ip, universes: ports });
});
const isLocal = (ip) => Object.values(os.networkInterfaces()).flat().some((i) => i?.address === ip);

/* ---------- sACN (E1.31) ---------- */
const sseq = new Map();
function sacn(universe, data) {
  const s = ((sseq.get(universe) ?? 0) + 1) % 256; sseq.set(universe, s);
  const b = Buffer.alloc(126 + 512);
  // root layer
  b.writeUInt16BE(0x0010, 0); b.writeUInt16BE(0, 2);
  b.write("ASC-E1.17\0\0\0", 4, "ascii");
  b.writeUInt16BE(0x7000 | (638 - 16), 16); b.writeUInt32BE(0x00000004, 18); CID.copy(b, 22);
  // framing layer
  b.writeUInt16BE(0x7000 | (638 - 38), 38); b.writeUInt32BE(0x00000002, 40);
  b.write("KROMA", 44, "utf8"); b[108] = 100; b.writeUInt16BE(0, 109); b[111] = s; b[112] = 0; b.writeUInt16BE(universe, 113);
  // DMP layer
  b.writeUInt16BE(0x7000 | (638 - 115), 115); b[117] = 0x02; b[118] = 0xa1;
  b.writeUInt16BE(0, 119); b.writeUInt16BE(1, 121); b.writeUInt16BE(513, 123); b[125] = 0;
  Buffer.from(data).copy(b, 126);
  return b;
}
const multicast = (u) => `239.255.${(u >> 8) & 255}.${u & 255}`;

/* ---------- output loop ---------- */
let state = { protocol: "artnet", ip: "", universes: {} };
let lastFrame = 0;
function send() {
  for (const [u, data] of Object.entries(state.universes)) {
    const uni = +u;
    if (state.protocol === "sacn") {
      udp.send(sacn(uni, data), SACN_PORT, state.ip || multicast(uni));
    } else {
      udp.send(artDmx(uni, data), ARTNET_PORT, state.ip || "255.255.255.255");
    }
  }
}
// Keep refreshing so lights don't drop out (Art-Net / sACN expect regular frames).
setInterval(() => { if (Date.now() - lastFrame > 900 && Object.keys(state.universes).length) send(); }, 1000);


/* ---------- RDM over Art-Net (ArtTod / ArtRdm) ---------- */
// Minimal RDM client: discovers responder UIDs via ArtTodRequest/ArtTodData, then sends
// RDM GET commands wrapped in ArtRdm to read DEVICE_INFO / labels. See Art-Net 4 spec §7 (ArtTodRequest,
// ArtTodData, ArtRdm) and RDM spec ANSI E1.20. Art-Net carries RDM packets *without* the leading 0xCC
// START_CODE (the packet starts at the SUB_START_CODE 0x01 byte); the checksum is still computed as if
// the 0xCC byte were present, per the RDM spec.
const RDM_SUB_START_CODE = 0x01;
const RDM_START_CODE = 0xcc;

/** ArtTodRequest (OpCode 0x8000): ID, OpCode, ProtVer, Filler1-2, Spare1-7, Net, Command, AddCount, Address[]. */
function artTodRequest(net, subUni) {
  const b = Buffer.alloc(24);
  b.write("Art-Net\0", 0, "ascii");
  b.writeUInt16LE(0x8000, 8);
  b.writeUInt16BE(14, 10);
  // 12-13 Filler1/2, 14-20 Spare1-7 stay zero
  b[21] = net & 0x7f;
  b[22] = 0x00; // Command = 0 → TodRequest (return full ToD)
  b[23] = 1; // AddCount
  const addr = Buffer.from([subUni & 0xff]);
  return Buffer.concat([b, addr]);
}

/** Builds a raw RDM GET/SET command frame as carried inside ArtRdm (no leading 0xCC — starts at SUB_START_CODE),
 *  with the checksum computed as though the 0xCC START_CODE preceded it (RDM spec ANSI E1.20 §9.3.1). */
function buildRdmCmd(destUid, pid, sourceUid, tn = 0, cc = 0x20, data = Buffer.alloc(0), subdevice = 0) {
  const pdl = data.length;
  const msgLen = 24 + pdl; // RDM "Message Length" counts the (virtual, untransmitted) 0xCC start code too
  const bodyLen = msgLen - 1; // bytes we actually transmit (sub-start code through PD, no 0xCC)
  const b = Buffer.alloc(bodyLen + 2); // +2 checksum
  let o = 0;
  b[o++] = RDM_SUB_START_CODE;
  b[o++] = msgLen;
  destUid.copy(b, o); o += 6;
  sourceUid.copy(b, o); o += 6;
  b[o++] = tn;
  b[o++] = 0x01; // port id
  b[o++] = 0x00; // message count
  b.writeUInt16BE(subdevice, o); o += 2;
  b[o++] = cc; // 0x20 GET_COMMAND · 0x30 SET_COMMAND
  b.writeUInt16BE(pid, o); o += 2;
  b[o++] = pdl;
  data.copy(b, o); o += pdl;
  let sum = RDM_START_CODE; // include the untransmitted 0xCC in the checksum
  for (let i = 0; i < o; i++) sum += b[i];
  b.writeUInt16BE(sum & 0xffff, o);
  return b;
}

function parseUid(hex) { return Buffer.from(hex.replace(/:/g, ""), "hex"); }
function uidToStr(buf) { return buf.toString("hex").match(/.{1,2}/g).join(":").toUpperCase(); }

const SOURCE_UID = Buffer.concat([Buffer.from([0x4b, 0x52]), crypto.randomBytes(4)]); // "KR" + random, fake ESTA id

/** ArtRdm (OpCode 0x8300): ID, OpCode, ProtVer, RdmVer, Filler, Spare1-7, Net, Command, Address, then the RDM packet. */
function artRdm(destUid, pid, net, subUni, tn, cc, data) {
  const rdm = buildRdmCmd(destUid, pid, SOURCE_UID, tn, cc, data);
  const head = Buffer.alloc(24);
  head.write("Art-Net\0", 0, "ascii");
  head.writeUInt16LE(0x8300, 8);
  head.writeUInt16BE(14, 10);
  head[12] = 0x01; // RdmVer = RDM STANDARD V1.0
  head[13] = 0x00; // Filler
  // 14-20 Spare1-7 stay zero
  head[21] = net & 0x7f;
  head[22] = 0x00; // Command = 0 → ArtRdm process directed
  head[23] = subUni & 0xff; // Address
  return Buffer.concat([head, rdm]);
}

/** Sends one RDM GET/SET in ArtRdm and resolves the ACK's PD (parameter data), or null on NACK. */
function rdmRequest(ip, uid, pid, net, subUni, cc = 0x20, data = Buffer.alloc(0)) {
  return new Promise((resolve, reject) => {
    const tn = Math.floor(Math.random() * 255);
    const onMsg = (msg) => {
      if (msg.length < 25 || msg.toString("ascii", 0, 7) !== "Art-Net" || msg.readUInt16LE(8) !== 0x8300) return;
      const rdm = msg.subarray(24); // RDM data, no leading 0xCC
      if (rdm.length < 24 || rdm[0] !== RDM_SUB_START_CODE) return;
      if (rdm[14] !== tn) return; // transaction number
      clearTimeout(timer);
      udp.removeListener("message", onMsg);
      if (rdm[19] !== cc + 1 || rdm[15] !== 0x00) return resolve(null); // not an ACK to our command
      const pdl = rdm[22];
      resolve(rdm.subarray(23, 23 + pdl));
    };
    udp.on("message", onMsg);
    udp.send(artRdm(uid, pid, net, subUni, tn, cc, data), ARTNET_PORT, ip);
    const timer = setTimeout(() => { udp.removeListener("message", onMsg); reject(new Error("timeout")); }, 600);
  });
}

/** DEVICE_INFO (PID 0x0060) response layout (RDM spec §10.5.1), values read directly from PD. */
async function rdmGet(ip, uid, pid, net, subUni) {
  const pd = await rdmRequest(ip, uid, pid, net, subUni);
  if (!pd || pd.length < 19) return null;
  return { modelId: pd.readUInt16BE(2), footprint: pd.readUInt16BE(10), personality: pd[12], personalities: pd[13], address: pd.readUInt16BE(14), sensors: pd[18] };
}

/** Reads an ASCII label PID (e.g. MANUFACTURER_LABEL 0x0081, DEVICE_MODEL_DESCRIPTION 0x0080, DEVICE_LABEL 0x0082). */
async function rdmGetLabel(ip, uid, pid, net, subUni) {
  const pd = await rdmRequest(ip, uid, pid, net, subUni).catch(() => null);
  if (!pd) return "";
  return pd.toString("ascii").replace(/\0.*$/, "").trim();
}

/** DMX_PERSONALITY_DESCRIPTION (0x00E1) for every mode, so the app can show mode names. */
async function rdmPersonalities(ip, uid, count, net, subUni) {
  const out = [];
  for (let n = 1; n <= Math.min(count, 64); n++) {
    const pd = await rdmRequest(ip, uid, 0x00e1, net, subUni, 0x20, Buffer.from([n])).catch(() => null);
    out.push(pd && pd.length >= 3 ? { n, footprint: pd.readUInt16BE(1), name: pd.subarray(3).toString("ascii").replace(/\0.*$/, "").trim() } : { n, footprint: 0, name: "" });
  }
  return out;
}

// E1.20 sensor units (subset) for display
const UNITS = { 0: "", 1: "°C", 2: "V DC", 3: "V AC", 4: "A DC", 5: "A AC", 6: "Hz", 7: "Ω", 8: "W" };
/** Battery-like sensors (SENSOR_DEFINITION 0x0200 + SENSOR_VALUE 0x0201): description mentions battery, or a DC voltage. */
async function rdmBattery(ip, uid, count, net, subUni) {
  let pick = null;
  for (let s = 0; s < Math.min(count, 32); s++) {
    const d = await rdmRequest(ip, uid, 0x0200, net, subUni, 0x20, Buffer.from([s])).catch(() => null);
    if (!d || d.length < 13) continue;
    const desc = d.subarray(13).toString("ascii").replace(/\0.*$/, "").trim();
    const def = { s, type: d[1], unit: d[2], prefix: d[3], min: d.readInt16BE(4), max: d.readInt16BE(6), desc };
    if (/batt|charge|accu|soc/i.test(desc)) { pick = def; break; }
    if (!pick && def.unit === 2) pick = def;
  }
  if (!pick) return null;
  const v = await rdmRequest(ip, uid, 0x0201, net, subUni, 0x20, Buffer.from([pick.s])).catch(() => null);
  if (!v || v.length < 3) return null;
  const scale = pick.prefix >= 0x11 ? 10 ** (pick.prefix - 0x10) : pick.prefix >= 1 && pick.prefix <= 0x0a ? 10 ** -pick.prefix : 1;
  const raw = v.readInt16BE(1);
  const percent = /%|percent|level|soc|charge/i.test(pick.desc) || (pick.unit === 0 && pick.max === 100);
  return { value: Math.round(raw * scale * 100) / 100, unit: percent ? "%" : (UNITS[pick.unit] ?? ""), label: pick.desc || "Battery" };
}

async function rdmDevice(ip, uidHex, net, subUni) {
  const uid = parseUid(uidHex);
  const info = await rdmGet(ip, uid, 0x0060, net, subUni);
  const model = await rdmGetLabel(ip, uid, 0x0080, net, subUni);
  const mfr = await rdmGetLabel(ip, uid, 0x0081, net, subUni);
  const label = await rdmGetLabel(ip, uid, 0x0082, net, subUni);
  const personalities = info?.personalities ? await rdmPersonalities(ip, uid, info.personalities, net, subUni) : [];
  const battery = info?.sensors ? await rdmBattery(ip, uid, info.sensors, net, subUni).catch(() => null) : null;
  return {
    uid: uidHex, manufacturer: mfr || "Unknown", model: model || "RDM device", label,
    footprint: info?.footprint ?? 1, address: info?.address ?? 1, personality: info?.personality ?? 1,
    personalities, battery,
  };
}

function rdmScan(ip, universe) {
  return new Promise((resolve) => {
    const uids = new Set();
    const onMsg = (msg) => {
      if (msg.length < 28 || msg.toString("ascii", 0, 7) !== "Art-Net") return;
      const op = msg.readUInt16LE(8);
      if (op === 0x8100) { // ArtTodData
        const uidCount = msg[27] ?? 0;
        const base = 28;
        for (let i = 0; i < uidCount; i++) {
          const o = base + i * 6;
          if (o + 6 > msg.length) break;
          const u = msg.subarray(o, o + 6);
          if (u.some((x) => x !== 0)) uids.add(uidToStr(u));
        }
      }
    };
    udp.on("message", onMsg);
    const net = ((universe - 1) >> 8) & 0x7f;
    const subUni = (universe - 1) & 0xff;
    udp.send(artTodRequest(net, subUni), ARTNET_PORT, ip);
    setTimeout(async () => {
      udp.removeListener("message", onMsg);
      const devices = [];
      for (const uidHex of uids) {
        try { devices.push(await rdmDevice(ip, uidHex, net, subUni)); } catch { /* ignore unresponsive devices */ }
      }
      resolve(devices);
    }, 2500);
  });
}

/* ---------- HTTP API for the app ---------- */
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Private-Network": "true",
};
http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (req.method === "OPTIONS") { res.writeHead(204, cors); return res.end(); }
  if (req.method === "GET" && url.pathname === "/nodes") {
    found.clear();
    const poll = artPoll();
    for (const ip of broadcasts()) udp.send(poll, ARTNET_PORT, ip);
    setTimeout(() => { res.writeHead(200, { ...cors, "Content-Type": "application/json" }); res.end(JSON.stringify([...found.values()])); }, 2000);
    return;
  }
  if (req.method === "GET" && url.pathname === "/rdm") {
    const ip = url.searchParams.get("ip");
    const universe = +(url.searchParams.get("universe") || 1);
    if (!ip) { res.writeHead(400, cors); return res.end("missing ip"); }
    rdmScan(ip, universe).then((devices) => {
      res.writeHead(200, { ...cors, "Content-Type": "application/json" });
      res.end(JSON.stringify(devices));
    }).catch((e) => {
      res.writeHead(500, cors);
      res.end(String(e && e.message || e));
    });
    return;
  }
  if (req.method === "POST" && url.pathname === "/rdm/set") {
    let body = "";
    req.on("data", (c) => { body += c; if (body.length > 1e4) req.destroy(); });
    req.on("end", async () => {
      try {
        const j = JSON.parse(body);
        const universe = +j.universe || 1;
        const net = ((universe - 1) >> 8) & 0x7f, subUni = (universe - 1) & 0xff;
        const pd = await rdmRequest(String(j.ip), parseUid(String(j.uid)), +j.pid, net, subUni, 0x30, Buffer.from((j.data || []).map((x) => x & 0xff)));
        if (pd === null) { res.writeHead(409, cors); return res.end("device refused"); }
        const dev = await rdmDevice(String(j.ip), String(j.uid), net, subUni).catch(() => null);
        res.writeHead(200, { ...cors, "Content-Type": "application/json" });
        res.end(JSON.stringify(dev));
      } catch (e) { res.writeHead(500, cors); res.end(String(e && e.message || e)); }
    });
    return;
  }
  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, { ...cors, "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true, name: "CRMX bridge", protocol: state.protocol, target: state.ip }));
  }
  if (req.method === "POST" && url.pathname === "/dmx") {
    let body = "";
    req.on("data", (c) => { body += c; if (body.length > 2e6) req.destroy(); });
    req.on("end", () => {
      try {
        const j = JSON.parse(body);
        const changed = j.ip !== state.ip || j.protocol !== state.protocol;
        state = { protocol: j.protocol === "sacn" ? "sacn" : "artnet", ip: String(j.ip || ""), universes: j.universes || {} };
        if (changed) console.log(`→ ${state.protocol === "sacn" ? "sACN" : "Art-Net"} to ${state.ip || "broadcast"}, universes ${Object.keys(state.universes).join(", ")}`);
        lastFrame = Date.now();
        send();
        res.writeHead(200, cors); res.end("ok");
      } catch { res.writeHead(400, cors); res.end("bad json"); }
    });
    return;
  }
  res.writeHead(404, cors); res.end();
}).listen(PORT, BIND, () => {
  console.log(`CRMX bridge running on http://localhost:${PORT}`);
  console.log("In the app: CONNECT → Bridge address localhost:" + PORT + " → Scan.");
});
