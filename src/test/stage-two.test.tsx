import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SpeedControl } from "@/components/console/SpeedControl";
import { applyPixelMaster } from "@/lib/pixel-master";
import { moonlitePackets } from "@/lib/moonlite";
afterEach(cleanup);

it.each([1.25, 1.5, 2])("multiplies and divides speed by %s", (factor) => {
  const change = vi.fn();
  render(<SpeedControl label="Speed" value={3} unit="Hz" onChange={change} />);
  fireEvent.click(screen.getByRole("button", { name: `×${factor}` }));
  fireEvent.click(screen.getByRole("button", { name: "Increase Speed" }));
  expect(change).toHaveBeenLastCalledWith(3 * factor);
  fireEvent.click(screen.getByRole("button", { name: "Decrease Speed" }));
  expect(change).toHaveBeenLastCalledWith(3 / factor);
});

it("pixel master halves live pixel values without changing source frames", () => {
  const frame = new Map<string, [number, number, number][]>([["a", [[200, 100, 50]]]]);
  expect(applyPixelMaster(frame, 0.5).get("a")).toEqual([[100, 50, 25]]);
  expect(frame.get("a")).toEqual([[200, 100, 50]]);
  expect(applyPixelMaster(frame, 0).get("a")).toEqual([[0, 0, 0]]);
});

it("initializes every MoonLite slot exactly once using minimum-MTU packets", () => {
  const frame = Uint8Array.from({ length: 512 }, (_, i) => i % 256);
  const packets = moonlitePackets(frame);
  const restored = new Uint8Array(512);
  let count = 0;
  for (const p of packets) {
    expect(p.length).toBeLessThanOrEqual(20);
    const header = (p[0] ?? 0) | ((p[1] ?? 0) << 8);
    expect(header >> 9).toBe(p.length - 2);
    restored.set(p.subarray(2), header & 511); count += p.length - 2;
  }
  expect(count).toBe(512); expect(restored).toEqual(frame);
});

it("sends only changed MoonLite slots including slot 511", () => {
  const previous = new Uint8Array(512), frame = previous.slice();
  frame[511] = 255;
  expect(moonlitePackets(frame, previous)).toEqual([new Uint8Array([255, 3, 255])]);
  expect(moonlitePackets(frame, frame)).toEqual([]);
});