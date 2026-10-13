// NOX for Windows: serves the offline app bundle (app/) from a private app:// origin and
// gives the page direct UDP (Art-Net / sACN) over any network card, plus Web MIDI and Bluetooth.
const { app, BrowserWindow, protocol, ipcMain, net } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const dgram = require("node:dgram");
const { pathToFileURL } = require("node:url");

protocol.registerSchemesAsPrivileged([{ scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
const ROOT = path.join(__dirname, "app");

let sock;
function socket() {
  if (sock) return sock;
  sock = dgram.createSocket({ type: "udp4", reuseAddr: true });
  sock.bind(0, () => sock.setBroadcast(true));
  return sock;
}

ipcMain.handle("udp-send", (_e, host, port, bytes) => new Promise((res, rej) => {
  socket().send(Buffer.from(bytes), port, host, (err) => (err ? rej(err) : res()));
}));

ipcMain.handle("artnet-scan", async () => {
  const s = socket();
  const found = new Map();
  const onMsg = (msg, rinfo) => {
    if (msg.length < 26 || msg.toString("ascii", 0, 7) !== "Art-Net" || msg.readUInt16LE(8) !== 0x2100) return;
    const name = msg.toString("ascii", 26, 44).replace(/\0.*$/, "") || "Art-Net node";
    found.set(rinfo.address, { ip: rinfo.address, name });
  };
  s.on("message", onMsg);
  const poll = Buffer.from([...Buffer.from("Art-Net\0"), 0x00, 0x20, 0, 14, 0x06, 0]);
  for (const ip of ["255.255.255.255", "2.255.255.255", "10.255.255.255"]) s.send(poll, 6454, ip, () => {});
  await new Promise((r) => setTimeout(r, 2000));
  s.off("message", onMsg);
  return [...found.values()];
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1400, height: 900, backgroundColor: "#17131c", title: "NOX", autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, nodeIntegration: false },
  });
  const ses = win.webContents.session;
  ses.setPermissionRequestHandler((_wc, perm, cb) => cb(["midi", "midiSysex", "bluetooth", "fullscreen"].includes(perm)));
  ses.setPermissionCheckHandler(() => true);
  win.webContents.on("select-bluetooth-device", (e, list, cb) => { e.preventDefault(); if (list.length) cb(list[0].deviceId); });
  win.loadURL("app://nox/");
}

app.whenReady().then(() => {
  protocol.handle("app", (req) => {
    const p = decodeURIComponent(new URL(req.url).pathname);
    let file = path.join(ROOT, p);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(ROOT, "index.html");
    return net.fetch(pathToFileURL(file).toString());
  });
  createWindow();
});
app.on("window-all-closed", () => app.quit());
