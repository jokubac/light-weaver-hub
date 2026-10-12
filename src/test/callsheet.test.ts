import { describe, expect, it } from "vitest";
import { createFixture, getDef } from "@/lib/dmx";
import { balancePhases, buildCallSheet } from "@/lib/callsheet";

function mk(id: string, uid: string) {
  const def = getDef(id);
  const f = createFixture(def, 0, 1, 1, uid);
  f.uid = uid;
  return f;
}

describe("balancePhases", () => {
  it("splits even loads evenly across three phases", () => {
    const fixtures = [mk("arri-skypanel-s60-c", "a"), mk("arri-skypanel-s60-c", "b"), mk("arri-skypanel-s60-c", "c")];
    const phases = balancePhases(fixtures);
    const watts = phases.map((p) => p.watts);
    expect(new Set(watts).size).toBe(1); // perfectly balanced, 450W each
    expect(phases.reduce((a, p) => a + p.watts, 0)).toBe(450 * 3);
  });

  it("greedily keeps an uneven set of loads close to balanced", () => {
    const fixtures = [
      mk("arri-skypanel-s360-c", "a"), // 1600 W
      mk("arri-skypanel-s120-c", "b"), // 800 W
      mk("arri-skypanel-s60-c", "c"), // 450 W
      mk("arri-skypanel-s60-c", "d"), // 450 W
    ];
    const phases = balancePhases(fixtures);
    const watts = phases.map((p) => p.watts).sort((a, b) => b - a);
    expect(watts[0]).toBe(1600);
    // the two 450W lights should land on separate phases from each other if possible
    expect(Math.max(...watts) - Math.min(...watts)).toBeLessThanOrEqual(1600);
    expect(phases.reduce((a, p) => a + p.watts, 0)).toBe(1600 + 800 + 450 + 450);
  });

  it("computes amps at 230V per phase", () => {
    const fixtures = [mk("arri-skypanel-s60-c", "a")];
    const phases = balancePhases(fixtures);
    const loaded = phases.find((p) => p.watts > 0)!;
    expect(loaded.amps).toBeCloseTo(450 / 230, 5);
  });
});

describe("generator sizing", () => {
  it("suggests the smallest generator with 80% headroom for a small single-phase rig", () => {
    const fixtures = [mk("aputure-mc", "a")]; // 5W, tiny load
    const { power } = buildCallSheet(fixtures);
    expect(power.generatorKva).toBe(2.2);
    expect(power.generatorThreePhase).toBe(false);
  });

  it("steps up to a larger three-phase generator for a heavy rig", () => {
    const fixtures = Array.from({ length: 10 }, (_, i) => mk("arri-skypanel-s360-c", `s${i}`)); // 16kW total
    const { power } = buildCallSheet(fixtures);
    expect(power.totalKw).toBeCloseTo(16, 1);
    expect(power.generatorKva).toBeGreaterThanOrEqual(20);
    expect(power.generatorThreePhase).toBe(true);
  });

  it("never returns a generator smaller than required apparent power with headroom", () => {
    const fixtures = [mk("arri-m40-eb-max-ballast", "a")]; // 4000W
    const { power } = buildCallSheet(fixtures);
    const requiredKva = (power.totalKw / 0.9) / 0.8;
    expect(power.generatorKva).toBeGreaterThanOrEqual(requiredKva);
  });
});

describe("buildCallSheet", () => {
  it("produces equipment and battery sections without throwing on an empty rig", () => {
    const sheet = buildCallSheet([], { shiftHours: 10 });
    expect(sheet.equipment).toEqual([]);
    expect(sheet.battery).toEqual([]);
    expect(sheet.power.totalW).toBe(0);
    expect(sheet.opts.shiftHours).toBe(10);
  });

  it("groups equipment by fixture model with correct quantities", () => {
    const fixtures = [mk("aputure-mc", "a"), mk("aputure-mc", "b"), mk("arri-skypanel-s60-c", "c")];
    const sheet = buildCallSheet(fixtures);
    const mc = sheet.equipment.find((l) => l.id.includes("aputure-mc"));
    expect(mc?.qty).toBe(2);
  });
});
