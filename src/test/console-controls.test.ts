import { describe, expect, it } from "vitest";
import { clampSpeed, positionToSpeed, speedToPosition } from "@/lib/speed";
import { createFixture, cctFromKelvin, getDef, sampleEffect, defaultFx, fixtureState, EFFECTS } from "@/lib/dmx";
import { copyFixtureSettings } from "@/lib/fixture-settings";
import { defaultLayer, renderLayer } from "@/lib/pixels";
import { buildUniverses } from "@/lib/output";

describe("Fine speed adjustment", () => {
  it("round trips precise values across the full range", () => {
    for (const speed of [0.001, 0.01937, 1, 17.12345, 100]) expect(positionToSpeed(speedToPosition(speed))).toBeCloseTo(speed, 8);
    expect(clampSpeed(1000)).toBe(100);
    expect(clampSpeed(0)).toBe(0.001);
  });
  it("honours narrow on-times", () => {
    const fx = { ...defaultFx(), kind: "strobe" as const, rate: 1, duty: 0.001, attack: 0, release: 0 };
    expect(sampleEffect(fx, 0.0005)).toBe(1);
    expect(sampleEffect(fx, 0.002)).toBe(0);
  });
});

describe("Pixel controls", () => {
  const fixture = createFixture(getDef("generic-pixel-strip-16-px"), 0, 1, 1, "Strip");
  const layer = { ...defaultLayer("Test", [fixture.uid]), colors: ["#ff0000"], kind: "solid" as const };
  it("preserves legacy brightness and applies adjustable brightness", () => {
    expect(renderLayer(layer, [fixture], 0, null).get(fixture.uid)?.[0]).toEqual([255, 0, 0]);
    expect(renderLayer({ ...layer, brightness: 0.5 }, [fixture], 0, null).get(fixture.uid)?.[0]).toEqual([127.5, 0, 0]);
  });
  it("controls sparkle density", () => {
    expect(renderLayer({ ...layer, kind: "sparkle", density: 0 }, [fixture], 0, null).get(fixture.uid)?.every((rgb) => rgb.every((v) => v === 0))).toBe(true);
    expect(renderLayer({ ...layer, kind: "sparkle", density: 1 }, [fixture], 0, null).get(fixture.uid)?.every((rgb) => rgb[0] === 255)).toBe(true);
  });
});

describe("Manufacturer profiles", () => {
  it("appends Titan mode codes without shifting older pixel indices", () => {
    const def = getDef("astera-titan-tube");
    expect(def.modes[10]?.pixels).toBe(16);
    expect(def.modes[10]?.name).toContain("42 —");
    const index = def.modes.findIndex((mode) => mode.profile === "astera-hsi-strobe");
    expect(def.modes[index]?.channels).toBe(6);
    const fixture = { ...createFixture(def, index, 1, 10, "Titan"), intensity: 1, cct: cctFromKelvin(5494, def.cctRange ?? [2000, 10000]), gm: 0, hue: 180, saturation: 1, crossfade: 1 };
    const data = buildUniverses([fixture], 0, 1, new Map()).get(1);
    expect(Array.from(data?.slice(9, 15) ?? [])).toEqual([255, 52, 0, 128, 255, 0]);
  });
  it("writes Evoke Ultimate CCT and fan to their chart channels", () => {
    const def = getDef("nanlux-evoke-1200b");
    const index = def.modes.findIndex((mode) => mode.profile === "nanlux-evoke-cct");
    expect(index).toBeGreaterThan(-1);
    expect(def.modes[index]?.channels).toBe(11);
    const fixture = { ...createFixture(def, index, 1, 1, "Evoke"), intensity: 1, cct: (6500 - 2000) / 8000, fan: "off" as const };
    const data = buildUniverses([fixture], 0, 1, new Map()).get(1);
    expect(data?.[0]).toBe(255);
    expect(data?.[1]).toBe(0);
    expect(data?.[2]).toBe(255);
    expect(data?.[10]).toBe(224);
  });
  it("keeps Dyno Ultimate HSI mode selector and fan in their positions", () => {
    const def = getDef("nanlux-dyno-650c");
    const index = def.modes.findIndex((mode) => mode.profile === "nanlux-dyno-hsi");
    expect(def.modes[index]?.channels).toBe(15);
    const fixture = { ...createFixture(def, index, 1, 1, "Dyno"), intensity: 1, hue: 180, saturation: 1, cctOnly: false, fan: "low" as const };
    const data = buildUniverses([fixture], 0, 1, new Map()).get(1);
    expect(data?.[1]).toBe(48);
    expect(data?.[2]).toBe(128);
    expect(data?.[3]).toBe(255);
    expect(data?.[6]).toBe(128);
  });
});

describe("Effect palettes and settings transfer", () => {
  it("uses selected colours for every fixture effect without changing patch identity", () => {
    const f = { ...createFixture(getDef("generic-pixel-strip-16-px"), 0, 1, 1, "Source"), intensity: .73 };
    for (const effect of EFFECTS.filter((e) => e.id !== "none")) {
      expect(fixtureState({ ...f, fx: { ...defaultFx(), kind: effect.id, colors: ["#00ff00"] } }, .1).rgb).toEqual([0, 255, 0]);
    }
    const settings = copyFixtureSettings(f);
    expect(settings.intensity).toBe(.73);
    for (const field of ["uid", "name", "defId", "modeIdx", "universe", "address", "power", "group", "label", "trigger"]) expect(settings).not.toHaveProperty(field);
    settings.fx.steps[0] = { level: 0, hold: 1, fade: 0 };
    expect(f.fx.steps[0]?.level).toBe(1);
  });
  it("uses a custom palette for generated pixel effects while preserving their animation", () => {
    const f = createFixture(getDef("generic-pixel-strip-16-px"), 0, 1, 1, "Strip");
    for (const kind of ["rainbow", "plasma", "fire"] as const) {
      const layer = { ...defaultLayer("Test", [f.uid]), kind, colors: ["#00ff00"], customPalette: true };
      const values = renderLayer(layer, [f], .27, null).get(f.uid) ?? [];
      expect(values.length).toBe(16);
      expect(values.every(([r,g,b]) => r === 0 && g > 0 && b === 0)).toBe(true);
    }
  });
  it("encodes effect palette colours into HSI DMX channels", () => {
    const def = getDef("astera-titan-tube");
    const index = def.modes.findIndex((m) => m.profile === "astera-hsi-strobe");
    const f = { ...createFixture(def, index, 1, 1, "Titan"), intensity: 1, fx: { ...defaultFx(), kind: "fire" as const, colors: ["#00ff00"] } };
    const data = buildUniverses([f], .2, 1, new Map()).get(1);
    expect(data?.[3]).toBe(85);
    expect(data?.[4]).toBe(255);
  });
});