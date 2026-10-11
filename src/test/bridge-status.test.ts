import { afterEach, describe, expect, it, vi } from "vitest";
import { createSender, type BridgeStatus } from "@/lib/output";
import { defaultConnection } from "@/lib/store";

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("bridge health", () => {
  const connected = { ...defaultConnection(), node: { name: "Test node", ip: "192.168.1.20" } };
  it("reports green only after a successful response and resets on disconnect", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    const states: BridgeStatus[] = [];
    const sender = createSender((s) => states.push(s));
    await sender(connected, new Map());
    await sender(defaultConnection(), new Map());
    expect(states).toEqual(["ok", "off"]);
  });
  it("reports poor responsiveness while waiting and recovers after the response", async () => {
    vi.useFakeTimers();
    let resolve: ((r: { ok: boolean }) => void) | undefined;
    vi.stubGlobal("fetch", vi.fn(() => new Promise((r) => { resolve = r; })));
    const states: BridgeStatus[] = [];
    const work = createSender((s) => states.push(s))(connected, new Map());
    await vi.advanceTimersByTimeAsync(501);
    expect(states).toEqual(["slow"]);
    resolve?.({ ok: true });
    await work;
    expect(states.at(-1)).not.toBe("error");
  });
  it("marks failed HTTP responses and unreachable bridges red", async () => {
    const states: BridgeStatus[] = [];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    await createSender((s) => states.push(s))(connected, new Map());
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await createSender((s) => states.push(s))(connected, new Map());
    expect(states).toEqual(["error", "error"]);
  });
  it("aborts a hanging request rather than leaving a stale green connection", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_url: string, opts: RequestInit) => new Promise((_resolve, reject) => {
      opts.signal?.addEventListener("abort", () => reject(new Error("timeout")));
    })));
    const states: BridgeStatus[] = [];
    const work = createSender((s) => states.push(s))(connected, new Map());
    await vi.advanceTimersByTimeAsync(3000);
    await work;
    expect(states).toEqual(["slow", "error"]);
  });
});