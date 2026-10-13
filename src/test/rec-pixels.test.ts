import { describe, expect, it } from "vitest";
import { makeStep } from "@/components/console/RecRail";
import { defaultLayer } from "@/lib/pixels";
import type { PatchedFixture } from "@/lib/dmx";

const fx = { uid: "u1", name: "F1" } as unknown as PatchedFixture;

describe("REC pixel capture", () => {
  it("stores a copy of the pixel layers in the cue", () => {
    const layers = [defaultLayer("Layer 1", ["u1"])];
    const step = makeStep([fx], 1, layers);
    expect(step.pixels?.length).toBe(1);
    expect(step.pixels?.[0]?.name).toBe("Layer 1");
    layers[0]!.name = "Changed";
    expect(step.pixels?.[0]?.name).toBe("Layer 1");
  });

  it("omits pixels when there are no layers", () => {
    expect(makeStep([fx], 1, []).pixels).toBeUndefined();
    expect(makeStep([fx], 1).pixels).toBeUndefined();
  });
});
