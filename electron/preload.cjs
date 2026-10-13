const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("noxDesktop", {
  sendUdp: (host, port, bytes) => ipcRenderer.invoke("udp-send", host, port, bytes),
  scanArtNet: () => ipcRenderer.invoke("artnet-scan"),
});
