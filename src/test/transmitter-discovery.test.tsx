import { afterEach, expect, it, vi } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { useTransmitterDiscovery } from "@/hooks/use-transmitter-discovery";
import { defaultConnection } from "@/lib/store";
vi.mock("@/lib/native-udp", () => ({ isNativeApp: () => true, scanArtNet: vi.fn(async () => [{ name: "Exalux Connect+", ip: "2.0.0.20", universes: 2 }]) }));
afterEach(cleanup);
it("discovers transmitters without opening Connect or replacing the destination", async () => {
  const conn = { ...defaultConnection(), transport: "direct" as const, node: { name: "Existing", ip: "2.0.0.10" } };
  const { result } = renderHook(() => useTransmitterDiscovery(conn));
  await waitFor(() => expect(result.current.nodes).toEqual([{ name: "Exalux Connect+", ip: "2.0.0.20", universes: 2 }]));
  expect(conn.node.ip).toBe("2.0.0.10");
});