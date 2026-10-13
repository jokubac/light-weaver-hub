// Bluetooth battery readout. Uses the native Bluetooth plugin inside the installed
// Android/iOS app and Web Bluetooth in browsers / the Windows app.
import { isNativeApp } from "./native-udp";

export interface BtFound { id: string; name: string }

export async function connectBluetoothBattery(onDevice: (d: BtFound) => void, onBattery: (id: string, pct: number) => void): Promise<void> {
  if (isNativeApp() && !hasDesktopBridge()) {
    const { BleClient } = await import("@capacitor-community/bluetooth-le");
    await BleClient.initialize({ androidNeverForLocation: true });
    const dev = await BleClient.requestDevice({ optionalServices: ["0000180f-0000-1000-8000-00805f9b34fb"] });
    onDevice({ id: dev.deviceId, name: dev.name || "Bluetooth device" });
    await BleClient.connect(dev.deviceId);
    const svc = "0000180f-0000-1000-8000-00805f9b34fb", chr = "00002a19-0000-1000-8000-00805f9b34fb";
    try {
      onBattery(dev.deviceId, (await BleClient.read(dev.deviceId, svc, chr)).getUint8(0));
      await BleClient.startNotifications(dev.deviceId, svc, chr, (v) => onBattery(dev.deviceId, v.getUint8(0))).catch(() => {});
    } catch { /* no standard battery service */ }
    return;
  }
  const nb = (navigator as Navigator & { bluetooth?: { requestDevice: (o: object) => Promise<any> } }).bluetooth;
  if (!nb) throw new Error("This browser can't use Bluetooth. Use the installed NOX app, Chrome or Edge.");
  const dev = await nb.requestDevice({ acceptAllDevices: true, optionalServices: ["battery_service", "device_information"] });
  onDevice({ id: dev.id, name: dev.name || "Bluetooth device" });
  const server = await dev.gatt.connect();
  try {
    const ch = await (await server.getPrimaryService("battery_service")).getCharacteristic("battery_level");
    onBattery(dev.id, (await ch.readValue()).getUint8(0));
    await ch.startNotifications().catch(() => {});
    ch.addEventListener("characteristicvaluechanged", (e: any) => onBattery(dev.id, e.target.value.getUint8(0)));
  } catch { /* no standard battery service */ }
}

export function hasDesktopBridge(): boolean {
  return typeof window !== "undefined" && !!(window as unknown as { noxDesktop?: unknown }).noxDesktop;
}
