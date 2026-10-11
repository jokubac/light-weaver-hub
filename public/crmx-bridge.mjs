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
