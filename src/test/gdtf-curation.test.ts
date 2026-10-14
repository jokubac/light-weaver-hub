import { describe, it, expect } from "vitest";
import { canonicalBrand, modelKey, specWatts } from "@/lib/gdtf-curation";

describe("gdtf curation", () => {
  it("merges Astera brand variants", () => {
    expect(canonicalBrand("Astera LED Technology")).toBe("Astera");
    expect(canonicalBrand("ASTERA")).toBe("Astera");
  });
  it("drops unknown brands", () => {
    expect(canonicalBrand("User Test")).toBeNull();
    expect(canonicalBrand("SHEHDS")).toBeNull();
  });
  it("treats Titan variants as one model", () => {
    expect(modelKey("Astera", "Titan Tube")).toBe(modelKey("Astera", "FP1 Titan Tube"));
  });
  it("uses datasheet watts", () => {
    expect(specWatts("ARRI", "SkyPanel S60C")).toBe(450);
    expect(specWatts("Astera", "FP1 Titan Tube")).toBe(48);
  });
});
