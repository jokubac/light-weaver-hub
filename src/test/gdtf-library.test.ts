import { describe, it, expect } from "vitest";
import { searchGdtfLibrary, type LibraryDef } from "@/lib/gdtf-library";
import { readFileSync } from "node:fs";
const d = (brand: string, model: string) => ({ id: model, brand, model, modes: [] }) as LibraryDef;
describe("GDTF library search", () => {
  it("matches every word across brand and model", () => {
    const list = [d("ARRI", "SkyPanel S60C"), d("Astera", "Titan Tube")];
    expect(searchGdtfLibrary(list, "arri s60").map((x) => x.model)).toEqual(["SkyPanel S60C"]);
    expect(searchGdtfLibrary(list, "")).toEqual([]);
  });
});

describe("curated bundled profiles", () => {
  const index = JSON.parse(readFileSync("public/gdtf-library/library.json", "utf8"));
  const library: LibraryDef[] = Array.from({ length: index.parts }, (_, i) => JSON.parse(readFileSync(`public/gdtf-library/library-${i + 1}.json`, "utf8"))).flat();
  it("retains the uploaded AM1600R eleven-byte layout without guessing watts", () => {
    const fixture = library.find((d) => d.brand === "Godox" && d.model === "Knowled AM1600R");
    expect(fixture?.modes[0]?.channels).toBe(11);
    expect(fixture?.modes[0]?.channelMap?.map((c) => c.attr)).toEqual(["Dimmer", "CCT", "GM", "Spare", "Red", "Green", "Blue", "White", "Spare", "Spare", "Spare"]);
    expect(fixture?.watts).toBeUndefined();
  });
  it("keeps the restored cinema manufacturers", () => {
    expect(library.some((d) => d.brand === "LiteGear" && /Spectrum 2L/i.test(d.model))).toBe(true);
    expect(library.some((d) => d.brand === "Lightstar" && /AIRLITE P1000/i.test(d.model))).toBe(true);
  });
});

import { isVerifiedDef as _isV } from "@/lib/dmx";
import { readFileSync as _rf } from "node:fs";
it("ARRI SkyPanel S60C GDTF matches the V4.4 chart and is marked official", () => {
  const idx = JSON.parse(_rf("public/gdtf-library/library.json", "utf8"));
  const all: any[] = []; for (let i = 1; i <= idx.parts; i++) all.push(...JSON.parse(_rf(`public/gdtf-library/library-${i}.json`, "utf8")));
  const d = all.find((x) => x.brand === "ARRI" && x.model === "SkyPanel S60C");
  expect(_isV(d)).toBe(true);
  const plain = d.modes.filter((m: any) => !/ECC|LE /.test(m.name)).map((m: any) => m.channels);
  expect(plain.slice(0, 10)).toEqual([12, 7, 10, 9, 7, 20, 10, 16, 14, 10]);
});
