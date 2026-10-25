import { expect, it } from "vitest";
import { RDM_PID, rdmData } from "@/lib/rdm";

it("encodes DMX address as 16-bit big endian, clamped to 1–512", () => {
  expect(rdmData.address(300)).toEqual([1, 44]);
  expect(rdmData.address(9999)).toEqual([2, 0]);
  expect(rdmData.address(0)).toEqual([0, 1]);
});

it("uses the standard E1.20 parameter IDs", () => {
  expect(RDM_PID).toEqual({ address: 0xf0, personality: 0xe0, label: 0x82, identify: 0x1000 });
});

it("limits device labels to 32 characters", () => {
  expect(rdmData.label("x".repeat(40))).toHaveLength(32);
  expect(rdmData.identify(true)).toEqual([1]);
});
