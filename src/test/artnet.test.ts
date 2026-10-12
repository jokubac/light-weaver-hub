import { describe, expect, it } from "vitest";
import { buildArtDmx, buildArtPoll, buildSacn, parseArtPollReply, randomCid, sacnMulticastAddress, ARTNET_UDP_PORT, SACN_UDP_PORT } from "@/lib/artnet";

describe("artnet packet builders", () => {
  it("ports", () => {
    expect(ARTNET_UDP_PORT).toBe(6454);
    expect(SACN_UDP_PORT).toBe(5568);
  });

  it("builds an ArtDMX header matching the spec", () => {
    const data = new Uint8Array(512).fill(42);
    const pkt = buildArtDmx(1, data, 7);
    const id = Array.from(pkt.slice(0, 7)).map((c) => String.fromCharCode(c)).join("");
    expect(id).toBe("Art-Net");
    expect(pkt[7]).toBe(0);
    expect(pkt[8] | (pkt[9] << 8)).toBe(0x5000); // OpOutput
    expect(pkt[10]).toBe(0); expect(pkt[11]).toBe(14); // ProtVer BE = 14
    expect(pkt[12]).toBe(7); // sequence
    expect(pkt[13]).toBe(0); // physical
    expect(pkt[14]).toBe(0); expect(pkt[15]).toBe(0); // universe 1 -> port 0
    expect((pkt[16] << 8) | pkt[17]).toBe(512); // length BE
    expect(pkt.slice(18)).toEqual(data);
  });

  it("shifts universe to port address (universe 2 -> port 1)", () => {
    const pkt = buildArtDmx(2, new Uint8Array(512), 1);
    expect(pkt[14]).toBe(1); expect(pkt[15]).toBe(0);
  });

  it("builds an ArtPoll packet", () => {
    const pkt = buildArtPoll();
    expect(pkt.length).toBe(14);
    expect(pkt[8] | (pkt[9] << 8)).toBe(0x2000);
    expect(pkt[12]).toBe(0x06);
  });

  it("parses an ArtPollReply", () => {
    const msg = new Uint8Array(240);
    const id = "Art-Net\0";
    for (let i = 0; i < id.length; i++) msg[i] = id.charCodeAt(i);
    msg[8] = 0x00; msg[9] = 0x21; // OpPollReply LE
    msg[10] = 10; msg[11] = 0; msg[12] = 0; msg[13] = 5;
    const name = "Test Node";
    for (let i = 0; i < name.length; i++) msg[44 + i] = name.charCodeAt(i);
    const info = parseArtPollReply(msg, "10.0.0.5");
    expect(info).not.toBeNull();
    expect(info!.ip).toBe("10.0.0.5");
    expect(info!.name).toBe("Test Node");
  });

  it("returns null for non-ArtPollReply packets", () => {
    expect(parseArtPollReply(new Uint8Array(30), "1.1.1.1")).toBeNull();
    const artDmx = buildArtDmx(1, new Uint8Array(512), 1);
    expect(parseArtPollReply(artDmx, "1.1.1.1")).toBeNull();
  });

  it("builds an sACN packet with the CID and universe", () => {
    const cid = randomCid();
    expect(cid.length).toBe(16);
    const data = new Uint8Array(512).fill(99);
    const pkt = buildSacn(5, data, 3, cid);
    expect(pkt.length).toBe(126 + 512);
    expect((pkt[0] << 8) | pkt[1]).toBe(0x0010); // preamble size
    expect(pkt.slice(22, 38)).toEqual(cid);
    expect(pkt[111]).toBe(3); // sequence
    expect((pkt[113] << 8) | pkt[114]).toBe(5); // universe
    expect(pkt.slice(126)).toEqual(data);
  });

  it("derives the sACN multicast address from the universe", () => {
    expect(sacnMulticastAddress(1)).toBe("239.255.0.1");
    expect(sacnMulticastAddress(300)).toBe("239.255.1.44");
  });
});
