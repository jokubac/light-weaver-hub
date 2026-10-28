import { describe, expect, it } from "vitest";
import { createFixture, FIXTURE_LIBRARY, type FixtureDef } from "@/lib/dmx";
import { labelLines } from "./patch-label";

/** A real library entry: `labelLines` looks the light up by id, so a made-up one would fall back. */
const pick = (channels: number): { def: FixtureDef; modeIdx: number } => {
  for (const def of FIXTURE_LIBRARY) {
    const modeIdx = def.modes.findIndex((m) => m.channels === channels);
    if (modeIdx >= 0) return { def, modeIdx };
  }
  throw new Error(`no ${channels}-channel mode in the library`);
};

describe("patch label wording", () => {
  it("writes the universe as U and the DMX address as @", () => {
    const { def, modeIdx } = pick(1);
    const f = createFixture(def, modeIdx, 3, 12, "Key Light");
    const L = labelLines(f);
    expect(L.pos).toBe("U3 @12");
    expect(L.name).toBe("Key Light");
    expect(L.make).toBe(`${def.brand} ${def.model}`);
    expect(L.mode).toBe(def.modes[modeIdx]!.name);
  });

  it("shows the whole span when a mode covers several channels", () => {
    const { def, modeIdx } = pick(16);
    const f = createFixture(def, modeIdx, 2, 1, "Wall Wash");
    expect(labelLines(f).pos).toBe("U2 @1–16");
  });

  it("keeps a long name whole instead of cutting it off", () => {
    const { def, modeIdx } = pick(1);
    const name = "Downstage Left Key 1 — Follow Spot Reserve";
    expect(labelLines(createFixture(def, modeIdx, 1, 5, name)).name).toBe(name);
  });

  it("falls back to the model when a light was never named", () => {
    const { def, modeIdx } = pick(1);
    expect(labelLines(createFixture(def, modeIdx, 1, 5, "   ")).name).toBe(def.model);
  });
});
