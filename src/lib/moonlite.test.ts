import { beforeEach, expect, it, vi } from "vitest";
import { defaultConnection, loadConnection, saveConnection } from "./store";

const ble = vi.hoisted(() => ({
  initialize: vi.fn(async () => {}),
  connect: vi.fn(async (_id: string, _callback: () => void) => {}),
  disconnect: vi.fn(async (_id: string) => {}),
  requestDevice: vi.fn(),
  getServices: vi.fn(),
  write: vi.fn(async (_id: string, _service: string, _channel: string, _data: DataView) => {}),
}));
vi.mock("@capacitor-community/bluetooth-le", () => ({ BleClient: ble }));
import { connectMoonLite, disconnectMoonLite, isMoonLiteConnected, MOONLITE_SERVICE, MOONLITE_CHANNEL, moonliteRoutes, reconnectMoonLite, sendMoonLite, sendMoonLiteUniverses } from "./moonlite";

beforeEach(async () => {
  await disconnectMoonLite();
  vi.clearAllMocks();
  localStorage.clear();
  ble.getServices.mockResolvedValue([{ uuid: MOONLITE_SERVICE, characteristics: [{ uuid: MOONLITE_CHANNEL }] }]);
});

it("adding a second MoonLite keeps the first connected", async () => {
  ble.requestDevice.mockResolvedValueOnce({ deviceId: "a", name: "MoonLite A" }).mockResolvedValueOnce({ deviceId: "b", name: "MoonLite B" });
  await connectMoonLite(); await connectMoonLite();
  expect(isMoonLiteConnected("a")).toBe(true);
  expect(isMoonLiteConnected("b")).toBe(true);
  expect(ble.disconnect).not.toHaveBeenCalled();
});

it("sends universe 1 to A and universe 2 to B with independent full initialization", async () => {
  await reconnectMoonLite("a"); await reconnectMoonLite("b");
  const conn = { ...defaultConnection(), bluetoothRoutes: [{ id: "a", name: "A", universe: 1 }, { id: "b", name: "B", universe: 2 }] };
  const frameA = new Uint8Array(512).fill(20), frameB = new Uint8Array(512).fill(80);
  expect(await sendMoonLiteUniverses(conn, new Map([[1, frameA], [2, frameB]]))).toBe("ok");
  for (const [id, value] of [["a", 20], ["b", 80]] as const) {
    const restored = new Uint8Array(512);
    const calls = ble.write.mock.calls.filter(([device]) => device === id);
    expect(calls.length).toBe(29);
    for (const [, , , view] of calls) { const p = new Uint8Array(view.buffer); restored.set(p.subarray(2), view.getUint16(0, true) & 511); }
    expect(restored).toEqual(new Uint8Array(512).fill(value));
  }
  ble.write.mockClear();
  await sendMoonLiteUniverses(conn, new Map([[1, frameA], [2, frameB]]));
  expect(ble.write).not.toHaveBeenCalled();
  frameA[0] = 30;
  await sendMoonLiteUniverses(conn, new Map([[1, frameA], [2, frameB]]));
  expect(ble.write).toHaveBeenCalledTimes(1);
  expect(ble.write.mock.calls[0]?.[0]).toBe("a");
});

it("one disconnected MoonLite does not stop output to the other", async () => {
  await reconnectMoonLite("a"); await reconnectMoonLite("b");
  await disconnectMoonLite("a");
  expect(isMoonLiteConnected("b")).toBe(true);
  expect(await sendMoonLiteUniverses({ ...defaultConnection(), bluetoothRoutes: [{ id: "a", name: "A", universe: 1 }, { id: "b", name: "B", universe: 2 }] }, new Map())).toBe("error");
  expect(ble.write.mock.calls.every(([id]) => id === "b")).toBe(true);
  expect(ble.write).toHaveBeenCalledTimes(29);
});

it("a busy device does not block another device or claim a failed write succeeded", async () => {
  await reconnectMoonLite("a"); await reconnectMoonLite("b");
  let release: (() => void) | undefined;
  const blocked = new Promise<void>((resolve) => { release = resolve; });
  ble.write.mockImplementation(async (id) => { if (id === "a") await blocked; });
  const a = sendMoonLite("a", new Uint8Array(512));
  const again = sendMoonLite("a", new Uint8Array(512));
  await sendMoonLite("b", new Uint8Array(512));
  expect(ble.write.mock.calls.filter(([id]) => id === "b")).toHaveLength(29);
  release?.(); await Promise.all([a, again]);
  expect(ble.write.mock.calls.filter(([id]) => id === "a")).toHaveLength(29);
  ble.write.mockImplementation(async () => {});
});

it("saves independent universe assignments and migrates legacy MoonLite", () => {
  const routes = [{ id: "a", name: "A", universe: 1 }, { id: "b", name: "B", universe: 7 }];
  saveConnection({ ...defaultConnection(), bluetoothRoutes: routes });
  expect(moonliteRoutes(loadConnection())).toEqual(routes);
  expect(moonliteRoutes({ ...defaultConnection(), transport: "bluetooth", node: { name: "Old", ip: "old" }, bluetoothUniverse: 3 })).toEqual([{ id: "old", name: "Old", universe: 3 }]);
  expect(moonliteRoutes({ ...defaultConnection(), node: { name: "Wi-Fi", ip: "2.0.0.1" } })).toEqual([]);
});