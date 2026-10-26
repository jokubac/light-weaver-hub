export const MOONLITE_SERVICE = "bfa00000-247d-6e1c-448c-223dfa0bd00c";
export const MOONLITE_CHANNEL = "bfa00001-247d-6e1c-448c-223dfa0bd00c";

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

let connected: string | null = null;
let previous: Uint8Array | undefined;
let busy = false;

export async function connectMoonLite(): Promise<{ name: string; ip: string }> {
  const { BleClient } = await import("@capacitor-community/bluetooth-le");
  await BleClient.initialize({ androidNeverForLocation: true });
  // MoonLite's 128-bit service UUID often doesn't fit in the 31-byte advert, so filtering
  // by service hides it. List nearby devices and only require the service after connecting.
  const device = await BleClient.requestDevice({ optionalServices: [MOONLITE_SERVICE] });
  if (connected) await BleClient.disconnect(connected).catch(() => {});
  connected = null; previous = undefined;
  await BleClient.connect(device.deviceId, () => { connected = null; previous = undefined; });
  connected = device.deviceId;
  return { name: device.name || "LumenRadio MoonLite", ip: device.deviceId };
}

export async function disconnectMoonLite() {
  const id = connected;
  connected = null; previous = undefined;
  if (id) { const { BleClient } = await import("@capacitor-community/bluetooth-le"); await BleClient.disconnect(id); }
}

export async function sendMoonLite(id: string, frame: Uint8Array): Promise<void> {
  if (id !== connected) throw new Error("Reconnect MoonLite via Bluetooth");
  if (busy) return;
  busy = true;
  try {
    const { BleClient } = await import("@capacitor-community/bluetooth-le");
    const copy = frame.slice();
    // 20-byte writes work at the BLE minimum MTU on Android, iOS and web.
    for (const packet of moonlitePackets(copy, previous)) {
      if (connected !== id) throw new Error("MoonLite disconnected");
      await BleClient.write(id, MOONLITE_SERVICE, MOONLITE_CHANNEL, new DataView(packet.buffer));
    }
    previous = copy;
  } catch (error) { previous = undefined; throw error; }
  finally { busy = false; }
}