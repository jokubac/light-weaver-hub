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

it("connecting a new MoonLite replaces the previous one — only one link at a time", async () => {
  ble.requestDevice.mockResolvedValueOnce({ deviceId: "a", name: "MoonLite A" }).mockResolvedValueOnce({ deviceId: "b", name: "MoonLite B" });
  await connectMoonLite(); await connectMoonLite();
  expect(isMoonLiteConnected("a")).toBe(false);
  expect(isMoonLiteConnected("b")).toBe(true);
  expect(ble.disconnect).toHaveBeenCalledWith("a");
});

it("sends the assigned universe with full initialization, then only changed slots", async () => {
  await reconnectMoonLite("a");
  const conn = { ...defaultConnection(), bluetoothRoutes: [{ id: "a", name: "A", universe: 2 }] };
  const frame = new Uint8Array(512).fill(80);
  expect(await sendMoonLiteUniverses(conn, new Map([[1, new Uint8Array(512).fill(20)], [2, frame]]))).toBe("ok");
  const restored = new Uint8Array(512);
  expect(ble.write.mock.calls.length).toBe(29);
  for (const [, , , view] of ble.write.mock.calls) { const p = new Uint8Array(view.buffer); restored.set(p.subarray(2), view.getUint16(0, true) & 511); }
  expect(restored).toEqual(new Uint8Array(512).fill(80));
  ble.write.mockClear();
  await sendMoonLiteUniverses(conn, new Map([[2, frame]]));
  expect(ble.write).not.toHaveBeenCalled();
  frame[0] = 30;
  await sendMoonLiteUniverses(conn, new Map([[2, frame]]));
  expect(ble.write).toHaveBeenCalledTimes(1);
});

it("a disconnected MoonLite reports an error instead of writing", async () => {
  await reconnectMoonLite("a");
  await disconnectMoonLite("a");
  expect(isMoonLiteConnected("a")).toBe(false);
  expect(await sendMoonLiteUniverses({ ...defaultConnection(), bluetoothRoutes: [{ id: "a", name: "A", universe: 1 }] }, new Map())).toBe("error");
  expect(ble.write).not.toHaveBeenCalled();
});

it("a busy write queues instead of overlapping, and a failed write is not cached as sent", async () => {
  await reconnectMoonLite("a");
  let release: (() => void) | undefined;
  const blocked = new Promise<void>((resolve) => { release = resolve; });
  ble.write.mockImplementation(async () => { await blocked; });
  const first = sendMoonLite("a", new Uint8Array(512));
  const again = sendMoonLite("a", new Uint8Array(512));
  release?.(); await Promise.all([first, again]);
  expect(ble.write).toHaveBeenCalledTimes(29);
  ble.write.mockImplementation(async () => {});
});

it("saves the universe assignment and migrates legacy MoonLite", () => {
  const routes = [{ id: "a", name: "A", universe: 7 }];
  saveConnection({ ...defaultConnection(), bluetoothRoutes: routes });
  expect(moonliteRoutes(loadConnection())).toEqual(routes);
  expect(moonliteRoutes({ ...defaultConnection(), transport: "bluetooth", node: { name: "Old", ip: "old" }, bluetoothUniverse: 3 })).toEqual([{ id: "old", name: "Old", universe: 3 }]);
  expect(moonliteRoutes({ ...defaultConnection(), node: { name: "Wi-Fi", ip: "2.0.0.1" } })).toEqual([]);
});
