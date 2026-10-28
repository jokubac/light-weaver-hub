import { describe, expect, it } from "vitest";
import { spreadSwatch } from "./fan";

const rgb = (s: string) => s.match(/\d+/g)!.map(Number);

describe("spread preview swatches", () => {
  it("keeps a CCT ramp on the black-body line — green is never the strongest channel", () => {
    for (const k of [1750, 2000, 3200, 5600, 9910, 20000]) {
      const [r, g, b] = rgb(spreadSwatch("cct", k));
      expect(g, `${k}K must not read as green`).toBeLessThan(Math.max(r, b));
    }
  });

  it("is warm at low kelvin and cool at high kelvin", () => {
    const warm = rgb(spreadSwatch("cct", 2000));
    const cool = rgb(spreadSwatch("cct", 10000));
    expect(warm[0]).toBe(255);
    expect(warm[2]).toBeLessThan(warm[1]);
    expect(cool[2]).toBe(255);
    expect(cool[0]).toBeLessThan(255);
  });

  it("shows intensity in the app's own colour and hue as its own colour", () => {
    expect(spreadSwatch("intensity", 60)).toBe("var(--primary)");
    expect(spreadSwatch("hue", 120)).toBe("hsl(120 100% 50%)");
  });
});
