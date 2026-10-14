import { describe, it, expect } from "vitest";
import { searchGdtfLibrary, type LibraryDef } from "@/lib/gdtf-library";
const d = (brand: string, model: string) => ({ id: model, brand, model, modes: [] }) as LibraryDef;
describe("GDTF library search", () => {
  it("matches every word across brand and model", () => {
    const list = [d("ARRI", "SkyPanel S60C"), d("Astera", "Titan Tube")];
    expect(searchGdtfLibrary(list, "arri s60").map((x) => x.model)).toEqual(["SkyPanel S60C"]);
    expect(searchGdtfLibrary(list, "")).toEqual([]);
  });
});
