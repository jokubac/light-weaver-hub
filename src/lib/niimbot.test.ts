import { describe, expect, it } from "vitest";
import { packet, rowPacket, printJob, CMD } from "./niimbot";

describe("niimbot packets", () => {
  it("frames with header, xor checksum and footer", () => {
    expect([...packet(CMD.setDensity, [3])]).toEqual([0x55, 0x55, 0x21, 1, 3, 0x21 ^ 1 ^ 3, 0xaa, 0xaa]);
  });
  it("packs a bitmap row MSB first with y and repeat", () => {
    const p = rowPacket(258, [true, false, false, false, false, false, false, true, true]);
    expect([...p.slice(4, 12)]).toEqual([1, 2, 0, 0, 0, 1, 0x81, 0x80]);
  });
  it("sets dimension as rows then width", () => {
    const job = printJob([[true, false], [false, true], [true, true]]);
    expect([...job[4]!.slice(4, 8)]).toEqual([0, 3, 0, 2]);
    expect(job).toHaveLength(5 + 3 + 1);
  });
});
