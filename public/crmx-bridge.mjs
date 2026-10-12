#!/usr/bin/env node
// KROMA bridge — receives DMX from the KROMA app and sends it as
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
// RDM GET commands wrapped in ArtRdm to read DEVICE_INFO / labels. See Art-Net 4 spec §7, RDM spec (ANSI E1.20).
const RDM_SUB_START_CODE = 0x01;
const RDM_START_CODE = 0xcc;

function artTodRequest(net, subUni, universe) {
  const b = Buffer.alloc(16);
  b.write("Art-Net\0", 0, "ascii"); b.writeUInt16LE(0x8000, 8); b.writeUInt16BE(14, 10);
  b[12] = 0; b[13] = net & 0x7f; b[14] = 0x00; b[15] = 1; // RcPort=0, Net, Command=0(full tod), AddCount
  const addr = Buffer.from([subUni & 0xff]);
  return Buffer.concat([b, addr]);
}

function rdmChecksum(buf) {
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i];
  return sum & 0xffff;
}

/** Builds a raw RDM GET command frame (without the Art-Net wrapper), with a correct checksum. */
function buildRdmGet(destUid, pid, sourceUid, tn = 0, subdevice = 0) {
  const pdl = 0;
  const msgLen = 24 + pdl; // header(1)+len(1)+dst(6)+src(6)+tn(1)+port(1)+msgcount(1)+sub(2)+cc(1)+pid(2)+pdl(1) = 24
  const b = Buffer.alloc(msgLen + 2); // +2 checksum
  let o = 0;
  b[o++] = RDM_START_CODE;
  b[o++] = msgLen;
  destUid.copy(b, o); o += 6;
  sourceUid.copy(b, o); o += 6;
  b[o++] = tn;
  b[o++] = 0x01; // port id
  b[o++] = 0x00; // message count
  b.writeUInt16BE(subdevice, o); o += 2;
  b[o++] = 0x20; // GET_COMMAND
  b.writeUInt16BE(pid, o); o += 2;
  b[o++] = pdl;
  const sum = rdmChecksum(b.subarray(0, o));
  b.writeUInt16BE(sum, o);
  return b;
}

function parseUid(hex) { return Buffer.from(hex.replace(/:/g, ""), "hex"); }
function uidToStr(buf) { return buf.toString("hex").match(/.{1,2}/g).join(":").toUpperCase(); }

const SOURCE_UID = Buffer.concat([Buffer.from([0x4b, 0x52]), crypto.randomBytes(4)]); // "KR" + random, fake ESTA id

function artRdm(destUid, pid, net, tn) {
  const rdm = buildRdmGet(destUid, pid, SOURCE_UID, tn);
  const head = Buffer.alloc(16);
  head.write("Art-Net\0", 0, "ascii"); head.writeUInt16LE(0x8300, 8); head.writeUInt16BE(14, 10);
  head[12] = RDM_SUB_START_CODE; head[14] = net & 0x7f;
  destUid.copy(head, 15 - 6 + 1, 0, 0); // placeholder, overwritten below (kept for clarity)
  const frame = Buffer.alloc(21);
  frame.write("Art-Net\0", 0, "ascii"); frame.writeUInt16LE(0x8300, 8); frame.writeUInt16BE(14, 10);
  frame[12] = RDM_SUB_START_CODE; frame[13] = 0; frame[14] = net & 0x7f; frame[15] = 0;
  destUid.copy(frame, 15); // 6 bytes dest UID at 15..20 per Art-Net 4 ArtRdm layout (simplified, single-target)
  return Buffer.concat([frame, rdm]);
}

function rdmScan(ip, universe) {
  return new Promise((resolve) => {
    const uids = new Set();
    const onMsg = (msg) => {
      if (msg.length < 14 || msg.toString("ascii", 0, 7) !== "Art-Net") return;
      const op = msg.readUInt16LE(8);
      if (op === 0x8100) { // ArtTodData
        const uidCount = msg[13] ?? msg.length > 13 ? msg[13] : 0;
        const base = 14 + 10; // header fields before UID list vary by firmware; scan defensively below
        for (let o = 0; o + 6 <= msg.length; o += 6) {
          if (o < base) continue;
          const u = msg.subarray(o, o + 6);
          if (u.length === 6 && u.some((x) => x !== 0)) uids.add(uidToStr(u));
        }
      }
    };
    udp.on("message", onMsg);
    const net = (universe - 1) >> 8;
    const subUni = (universe - 1) & 0xff;
    udp.send(artTodRequest(net, subUni, universe), ARTNET_PORT, ip);
    setTimeout(async () => {
      udp.removeListener("message", onMsg);
      const devices = [];
      for (const uidHex of uids) {
        try {
          const uid = parseUid(uidHex);
          const info = await rdmGet(ip, uid, 0x0060, net); // DEVICE_INFO
          const model = await rdmGetLabel(ip, uid, 0x0080, net); // DEVICE_MODEL_DESCRIPTION
          const mfr = await rdmGetLabel(ip, uid, 0x0081, net); // MANUFACTURER_LABEL
          devices.push({
            uid: uidHex,
            manufacturer: mfr || "Unknown",
            model: model || "RDM device",
            footprint: info?.footprint ?? 1,
            address: info?.address ?? 1,
            personality: info?.personality ?? 1,
          });
        } catch { /* ignore unresponsive devices */ }
      }
      resolve(devices);
    }, 2500);
  });
}

function rdmGet(ip, uid, pid, net) {
  return new Promise((resolve, reject) => {
    const tn = Math.floor(Math.random() * 255);
    const onMsg = (msg) => {
      if (msg.length < 14 || msg.toString("ascii", 0, 7) !== "Art-Net" || msg.readUInt16LE(8) !== 0x8300) return;
      const rdm = msg.subarray(21);
      if (rdm.length < 26 || rdm[0] !== RDM_START_CODE) return;
      if (rdm[20] !== tn) return;
      clearTimeout(timer);
      udp.removeListener("message", onMsg);
      if (pid === 0x0060 && rdm.length >= 26 + 19) {
        const pd = rdm.subarray(24);
        const footprint = pd.readUInt16BE(12);
        const personality = pd[14];
        const address = pd.readUInt16BE(15);
        resolve({ footprint, personality, address });
      } else resolve(null);
    };
    udp.on("message", onMsg);
    udp.send(artRdm(uid, pid, net, tn), ARTNET_PORT, ip);
    const timer = setTimeout(() => { udp.removeListener("message", onMsg); reject(new Error("timeout")); }, 400);
  });
}

function rdmGetLabel(ip, uid, pid, net) {
  return new Promise((resolve, reject) => {
    const tn = Math.floor(Math.random() * 255);
    const onMsg = (msg) => {
      if (msg.length < 14 || msg.toString("ascii", 0, 7) !== "Art-Net" || msg.readUInt16LE(8) !== 0x8300) return;
      const rdm = msg.subarray(21);
      if (rdm.length < 26 || rdm[0] !== RDM_START_CODE) return;
      if (rdm[20] !== tn) return;
      clearTimeout(timer);
      udp.removeListener("message", onMsg);
      const pdl = rdm[23];
      const text = rdm.subarray(24, 24 + pdl).toString("ascii").replace(/\0.*$/, "");
      resolve(text);
    };
    udp.on("message", onMsg);
    udp.send(artRdm(uid, pid, net, tn), ARTNET_PORT, ip);
    const timer = setTimeout(() => { udp.removeListener("message", onMsg); reject(new Error("timeout")); }, 400);
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
