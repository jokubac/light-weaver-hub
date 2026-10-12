// Native UDP transport used only inside the installed Android/iOS app (Capacitor).
// Keeps the plugin import fully dynamic so the web/PWA build never touches it.

export function isNativeApp(): boolean {
  try {
    // Avoid a static import so bundlers never pull Capacitor code into the web build's
    // critical path; this file is safe to import from anywhere (browser or native).
    const w = globalThis as unknown as { Capacitor?: { isNativePlatform?: () => boolean } };
    if (w.Capacitor?.isNativePlatform) return w.Capacitor.isNativePlatform();
  } catch {
    // ignore — not in a Capacitor environment
  }
  return false;
}

async function getCore() {
  const mod = await import("@capacitor/core");
  return mod;
}

async function getUdpPlugin() {
  const mod = await import("capacitor-udp-socket");
  return mod.UdpSocket;
}

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

let socketId: number | null = null;
async function getSocket(): Promise<number> {
  if (socketId !== null) return socketId;
  const Udp = await getUdpPlugin();
  const { socketId: id } = await Udp.create({ properties: { name: "kroma-dmx" } });
  await Udp.bind({ socketId: id, port: 0 });
  await Udp.setBroadcast({ socketId: id, enabled: true });
  socketId = id;
  return id;
}

/** Sends a single UDP datagram from the device. Throws on failure. */
export async function sendUdp(host: string, port: number, bytes: Uint8Array): Promise<void> {
  const Udp = await getUdpPlugin();
  const id = await getSocket();
  await Udp.send({ socketId: id, address: host, port, buffer: toBase64(bytes) });
}

export interface ScannedNode { name: string; ip: string; universes?: number | undefined }

/** Broadcasts an ArtPoll and listens ~2s for ArtPollReply packets. */
export async function scanArtNet(): Promise<ScannedNode[]> {
  const [{ buildArtPoll, parseArtPollReply, ARTNET_UDP_PORT }, Udp] = await Promise.all([
    import("./artnet"),
    getUdpPlugin(),
  ]);
  const id = await getSocket();
  const found = new Map<string, ScannedNode>();
  const handle = await Udp.addListener("receive", (event: { socketId: number; buffer?: string; remoteAddress?: string }) => {
    if (event.socketId !== id || !event.buffer) return;
    const bytes = fromBase64(event.buffer);
    const info = parseArtPollReply(bytes, event.remoteAddress ?? "");
    if (info) found.set(info.ip, info);
  });
  try {
    await Udp.send({ socketId: id, address: "255.255.255.255", port: ARTNET_UDP_PORT, buffer: toBase64(buildArtPoll()) });
    await new Promise((r) => setTimeout(r, 2000));
  } finally {
    handle.remove();
  }
  return [...found.values()];
}

export { getCore };
