import { describe, expect, it } from "vitest";
import { createFixture, getDef } from "@/lib/dmx";
import { buildCallSheet } from "@/lib/callsheet";

function mk(id: string, uid: string) {
  const def = getDef(id);
  const f = createFixture(def, 0, 1, 1, uid);
  f.uid = uid;
  return f;
}

describe("buildCallSheet", () => {
  it("produces equipment and battery sections without throwing on an empty rig", () => {
    const sheet = buildCallSheet([], { shiftHours: 10 });
    expect(sheet.equipment).toEqual([]);
    expect(sheet.battery).toEqual([]);
    expect(sheet.opts.shiftHours).toBe(10);
  });

  it("groups equipment by fixture model with correct quantities", () => {
    const fixtures = [mk("aputure-mc", "a"), mk("aputure-mc", "b"), mk("arri-skypanel-s60-c", "c")];
    const sheet = buildCallSheet(fixtures);
    const mc = sheet.equipment.find((l) => l.id.includes("aputure-mc"));
    expect(mc?.qty).toBe(2);
  });
});

describe("battery plan", () => {
  it("plans swaps from runtime only and carries no wattage line", () => {
    const f = mk("arri-skypanel-s60-c", "a");
    f.intensity = 1;
    f.power = { kind: "vmount", kwh: 0.23, charge: 1, watts: 60, usedWh: 0 };
    const item = buildCallSheet([f], { shiftHours: 12 }).battery.find((b) => b.uid === "a")!;
    expect(item.runtimeHours).toBeCloseTo(230 / 60, 5); // 230 Wh at 60 W
    expect(item.batteriesPerShift).toBe(4);
    expect(item.swaps).toBe(3);
    expect("watts" in item).toBe(false);
  });
});
