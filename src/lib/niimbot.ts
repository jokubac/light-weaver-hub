// Niimbot label printers (D11, D110, B1, B21) over Bluetooth LE.
// Packet layout follows the community-documented Niimbot protocol (niimprint / NiimBlue):
// 55 55 | cmd | len | data… | xor(cmd,len,data) | AA AA. Pure encoders are tested; the BLE
// transport uses the Capacitor plugin in installed apps and Web Bluetooth elsewhere.
import { isNativeApp } from "./native-udp";
import { hasDesktopBridge } from "./native-ble";

export const NIIMBOT_SERVICE = "e7810a71-73ae-499d-8c15-faa9aef0c3f2";
export const NIIMBOT_CHAR = "bef8d6c9-9c21-4c9e-b632-bd58c1009f9f";

export type NiimbotModel = "D11" | "D110" | "B1" | "B21";
/** Print-head width in dots (203 dpi ≈ 8 dots/mm) and the default label in mm. */
export const NIIMBOT_MODELS: Record<NiimbotModel, { headDots: number; label: [number, number]; rotate: boolean }> = {
  D11: { headDots: 96, label: [30, 12], rotate: true },
  D110: { headDots: 96, label: [30, 12], rotate: true },
  B1: { headDots: 384, label: [50, 30], rotate: false },
  B21: { headDots: 384, label: [50, 30], rotate: false },
};

export const CMD = {
  setDensity: 0x21, setLabelType: 0x23, startPrint: 0x01, endPrint: 0xf3,
  startPage: 0x03, endPage: 0xe3, setDimension: 0x13, bitmapRow: 0x85, status: 0xa3,
} as const;

export function packet(cmd: number, data: number[] | Uint8Array): Uint8Array {
  const d = Array.from(data);
  let x = cmd ^ d.length;
  for (const b of d) x ^= b;
  return Uint8Array.from([0x55, 0x55, cmd, d.length, ...d, x & 0xff, 0xaa, 0xaa]);
}

/** One monochrome bitmap row: y (BE16), three zero dot counts, repeat 1, then packed pixels (MSB first). */
export function rowPacket(y: number, bits: boolean[]): Uint8Array {
  const bytes = new Array(Math.ceil(bits.length / 8)).fill(0);
  bits.forEach((on, i) => { if (on) bytes[i >> 3] |= 0x80 >> (i & 7); });
  return packet(CMD.bitmapRow, [(y >> 8) & 0xff, y & 0xff, 0, 0, 0, 1, ...bytes]);
}

/** Full job for an image of `rows` lines, each `width` dots wide. */
export function printJob(rows: boolean[][], density = 3): Uint8Array[] {
  const h = rows.length, w = rows[0]?.length ?? 0;
  return [
    packet(CMD.setDensity, [Math.max(1, Math.min(5, density))]),
    packet(CMD.setLabelType, [1]),
    packet(CMD.startPrint, [1]),
    packet(CMD.startPage, [1]),
    packet(CMD.setDimension, [(h >> 8) & 0xff, h & 0xff, (w >> 8) & 0xff, w & 0xff]),
    ...rows.map((r, y) => rowPacket(y, r)),
    packet(CMD.endPage, [1]),
  ];
}

/** Threshold a canvas into printer rows; rotated 90° for narrow-head printers. */
export function canvasRows(c: HTMLCanvasElement, headDots: number, rotate: boolean): boolean[][] {
  const src = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
  const dark = (x: number, y: number) => { const i = (y * c.width + x) * 4; return src[i + 3]! > 128 && src[i]! + src[i + 1]! + src[i + 2]! < 384; };
  const rows: boolean[][] = [];
  if (rotate) for (let x = 0; x < c.width; x++) { const r: boolean[] = []; for (let k = 0; k < headDots; k++) { const y = c.height - 1 - k; r.push(y >= 0 && dark(x, y)); } rows.push(r); }
  else for (let y = 0; y < c.height; y++) { const r: boolean[] = []; for (let x = 0; x < headDots; x++) r.push(x < c.width && dark(x, y)); rows.push(r); }
  return rows;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Connect, send every label (one page each), then end the print. */
export async function printLabels(canvases: HTMLCanvasElement[], model: NiimbotModel, density = 3): Promise<void> {
  const m = NIIMBOT_MODELS[model];
  let write: (p: Uint8Array) => Promise<void>;
  let close: () => Promise<void>;
  if (isNativeApp() && !hasDesktopBridge()) {
    const { BleClient } = await import("@capacitor-community/bluetooth-le");
    await BleClient.initialize({ androidNeverForLocation: true });
    const dev = await BleClient.requestDevice({ services: [NIIMBOT_SERVICE] });
    await BleClient.connect(dev.deviceId);
    write = (p) => BleClient.writeWithoutResponse(dev.deviceId, NIIMBOT_SERVICE, NIIMBOT_CHAR, new DataView(p.buffer));
    close = () => BleClient.disconnect(dev.deviceId);
  } else {
    const nb = (navigator as Navigator & { bluetooth?: { requestDevice: (o: object) => Promise<any> } }).bluetooth;
    if (!nb) throw new Error("This browser can't use Bluetooth. Use the installed NOX app, Chrome or Edge — or save the labels as PDF/PNG.");
    const dev = await nb.requestDevice({ filters: [{ namePrefix: "D11" }, { namePrefix: "D110" }, { namePrefix: "B1" }, { namePrefix: "B21" }, { services: [NIIMBOT_SERVICE] }], optionalServices: [NIIMBOT_SERVICE] });
    const server = await dev.gatt.connect();
    const ch = await (await server.getPrimaryService(NIIMBOT_SERVICE)).getCharacteristic(NIIMBOT_CHAR);
    write = (p) => ch.writeValueWithoutResponse(p);
    close = async () => server.disconnect();
  }
  try {
    for (const c of canvases) {
      for (const p of printJob(canvasRows(c, m.headDots, m.rotate), density)) { await write(p); await wait(8); }
      await wait(400);
    }
    await write(packet(CMD.endPrint, [1]));
    await wait(300);
  } finally { await close().catch(() => {}); }
}
