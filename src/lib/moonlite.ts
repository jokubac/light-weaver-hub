import type { BluetoothRoute, Connection } from "./store";

export const MOONLITE_SERVICE = "bfa00000-247d-6e1c-448c-223dfa0bd00c";
export const MOONLITE_CHANNEL = "bfa00001-247d-6e1c-448c-223dfa0bd00c";
let bleModule: Promise<typeof import("@capacitor-community/bluetooth-le")> | undefined;
const loadBle = () => bleModule ??= import("@capacitor-community/bluetooth-le");

/** TimoTwo BLE slot changes: count in bits 15..9, zero-based slot in bits 8..0. */
export function moonlitePackets(frame: Uint8Array, previous?: Uint8Array, maxWrite = 20): Uint8Array[] {
  if (frame.length !== 512) throw new Error("MoonLite requires 512 DMX slots");
  const limit = Math.min(127, Math.max(1, Math.floor(maxWrite) - 2));
  const packets: Uint8Array[] = [];
  for (let start = 0; start < 512;) {
    if (previous && frame[start] === previous[start]) { start++; continue; }
    let count = 1;
    while (count < limit && start + count < 512 && (!previous || frame[start + count] !== previous[start + count])) count++;
    const packet = new Uint8Array(count + 2);
    const header = (count << 9) | start;
    packet[0] = header & 255; packet[1] = header >> 8;
    packet.set(frame.subarray(start, start + count), 2);
    packets.push(packet); start += count;
  }
  return packets;
}

interface Session { previous?: Uint8Array | undefined; pending?: Promise<void> | undefined; error?: boolean }
const sessions = new Map<string, Session>();
const listeners = new Set<() => void>();
let version = 0;
const notify = () => { version++; listeners.forEach((fn) => fn()); };
export function subscribeMoonLite(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
export function moonLiteVersion() { return version; }
export function isMoonLiteConnected(id: string) { return sessions.has(id); }
export function moonLiteStatus(id: string): "off" | "ok" | "error" { const s = sessions.get(id); return !s ? "off" : s.error ? "error" : "ok"; }

/** Preserve old single-device connections without mistaking Wi-Fi IPs for BLE IDs. */
export function moonliteRoutes(conn: Connection): BluetoothRoute[] {
  if (conn.bluetoothRoutes) return conn.bluetoothRoutes;
  return conn.transport === "bluetooth" && conn.node
    ? [{ id: conn.node.ip, name: conn.node.name, universe: conn.bluetoothUniverse ?? 1 }] : [];
}

export async function reconnectMoonLite(id: string): Promise<void> {
  if (sessions.has(id)) return;
  const { BleClient } = await loadBle();
  await BleClient.initialize({ androidNeverForLocation: true });
  const session: Session = {};
  await BleClient.connect(id, () => {
    if (sessions.get(id) === session) { sessions.delete(id); notify(); }
  });
  try {
    const services = await BleClient.getServices(id);
    if (!services.some((s) => s.uuid.toLowerCase() === MOONLITE_SERVICE && s.characteristics.some((c) => c.uuid.toLowerCase() === MOONLITE_CHANNEL))) {
      throw new Error("This device does not support MoonLite DMX");
    }
    sessions.set(id, session); notify();
  } catch (error) { await BleClient.disconnect(id).catch(() => {}); throw error; }
}

export async function connectMoonLite(): Promise<{ name: string; ip: string }> {
  const { BleClient } = await loadBle();
  await BleClient.initialize({ androidNeverForLocation: true });
  // MoonLite's 128-bit service UUID often doesn't fit in the 31-byte advert, so filtering
  // by service hides it. List nearby devices and only require the service after connecting.
  const device = await BleClient.requestDevice({ optionalServices: [MOONLITE_SERVICE] });
  await reconnectMoonLite(device.deviceId);
  return { name: device.name || "LumenRadio MoonLite", ip: device.deviceId };
}

export async function disconnectMoonLite(id?: string) {
  const ids = id ? [id] : [...sessions.keys()];
  for (const deviceId of ids) sessions.delete(deviceId);
  notify();
  const { BleClient } = await loadBle();
  await Promise.all(ids.map((deviceId) => BleClient.disconnect(deviceId)));
}

export async function sendMoonLite(id: string, frame: Uint8Array): Promise<void> {
  const session = sessions.get(id);
  if (!session) throw new Error("Reconnect MoonLite via Bluetooth");
  if (session.pending) return session.pending;
  const copy = frame.slice();
  const task = (async () => {
    try {
      const { BleClient } = await loadBle();
      // Minimum-MTU packets and previous frames are independent for each transmitter.
      for (const packet of moonlitePackets(copy, session.previous)) {
        if (sessions.get(id) !== session) throw new Error("MoonLite disconnected");
        await BleClient.write(id, MOONLITE_SERVICE, MOONLITE_CHANNEL, new DataView(packet.buffer));
      }
      session.previous = copy;
      if (session.error) { session.error = false; notify(); }
    } catch (error) { session.previous = undefined; if (!session.error) { session.error = true; notify(); } throw error; }
    finally { session.pending = undefined; }
  })();
  session.pending = task;
  return task;
}

export async function sendMoonLiteUniverses(conn: Connection, universes: Map<number, Uint8Array>): Promise<"off" | "ok" | "error"> {
  const routes = moonliteRoutes(conn);
  if (!routes.length) return "off";
  const results = await Promise.allSettled(routes.map((route) =>
    sendMoonLite(route.id, universes.get(route.universe) ?? new Uint8Array(512))));
  return results.some((result) => result.status === "rejected") ? "error" : "ok";
}