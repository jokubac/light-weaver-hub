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
    expect(specWatts("Astera", "FP1 Titan Tube")).toBeUndefined();
  });
  it("does not assign AX1 power to AX10 or guess a family load", () => {
    expect(specWatts("Astera", "AX10")).toBeUndefined();
    expect(specWatts("Aputure", "600 unknown")).toBeUndefined();
  });
  it("merges exact Astera model aliases while preserving different models", () => {
    expect(modelKey("Astera", "AX3")).toBe(modelKey("Astera", "AX3 LightDrop"));
    expect(modelKey("Astera", "AX5")).toBe(modelKey("Astera", "AX5 TriplePAR"));
    expect(modelKey("Astera", "AX10")).not.toBe(modelKey("Astera", "AX1 PixelTube"));
  });
});
