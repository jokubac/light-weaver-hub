import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { isVerifiedDef } from "@/lib/dmx";
import { asteraChannels, asteraSpec } from "@/lib/astera";

const idx = JSON.parse(readFileSync("public/gdtf-library/library.json", "utf8"));
const library: any[] = [];
for (let i = 1; i <= idx.parts; i++) library.push(...JSON.parse(readFileSync(`public/gdtf-library/library-${i + 1 === i + 1 ? i + 1 : 1}.json`, "utf8")).slice(0, 0));

// simpler, correct loader
const load = () => {
  const all: any[] = [];
  for (let i = 1; i <= idx.parts; i++) all.push(...JSON.parse(readFileSync(`public/gdtf-library/library-${i}.json`, "utf8")));
  return all;
};

const astera = load().filter((d) => d.brand === "Astera");

describe("Astera verified library profiles", () => {
  it("keeps all 19 Astera models, every one verified with the official 1750-20000K range", () => {
    expect(astera.length).toBe(19);
    for (const d of astera) {
      expect(isVerifiedDef(d), d.model).toBe(true);
      expect(d.cctRange, d.model).toEqual([1750, 20000]);
    }
  });

  it("every visible mode's channel count matches its official profile token layout", () => {
    for (const d of astera) {
      for (const m of d.modes.filter((m: any) => !m.legacy)) {
        expect(m.astera, `${d.model} ${m.name}`).toBeTruthy();
        expect(m.channels, `${d.model} ${m.name}`).toBe(asteraChannels(m.astera));
      }
    }
  });

  it("Titan profile 98 is the official 4-pixel CRO layout", () => {
    const titan = astera.find((d) => d.model === "FP1 Titan Tube");
    const m = titan.modes.find((m: any) => m.astera?.code === 98);
    expect(m.astera.px).toBe(4);
    expect(m.astera.cell).toBe("CRO");
    expect(m.channels).toBe(asteraChannels(asteraSpec(98)!));
  });

  it("AX10 is renamed to its official SpotMax name", () => {
    expect(astera.some((d) => d.model === "AX10 SpotMax" && !d.modes.some((m: any) => m.legacy))).toBe(true);
    expect(astera.filter((d) => d.model === "AX10 SpotMax")).toHaveLength(1);
  });

  it("QuikPunch fan profiles stay hidden so verified modes lead the mode list", () => {
    const qp = astera.find((d) => d.model === "QuikPunch");
    const fan = qp.modes.filter((m: any) => /^\s*1[45]\d\b/.test(m.name));
    expect(fan.length).toBeGreaterThan(0);
    expect(fan.every((m: any) => m.legacy)).toBe(true);
    expect(qp.modes.filter((m: any) => !m.legacy).every((m: any) => m.astera)).toBe(true);
  });
});
