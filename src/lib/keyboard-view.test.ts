import { describe, expect, it } from "vitest";
import { keyboardScroll, visibleBand } from "./keyboard-view";

describe("On-screen keyboard view", () => {
  it("uses the visual viewport, which the keyboard shrinks, not the layout window", () => {
    expect(visibleBand({ offsetTop: 0, height: 500 }, 855)).toEqual({ top: 0, bottom: 500 });
    expect(visibleBand(null, 855)).toEqual({ top: 0, bottom: 855 });
  });
  it("lifts a field hidden behind the keyboard", () => {
    const view = { top: 0, bottom: 500 };
    expect(keyboardScroll({ top: 520, bottom: 560 }, view, 16)).toBe(76);
  });
  it("brings back a field scrolled above the visible band", () => {
    const view = { top: 0, bottom: 500 };
    expect(keyboardScroll({ top: -40, bottom: 0 }, view, 16)).toBe(56);
  });
  it("leaves a field that is already clear alone", () => {
    const view = { top: 0, bottom: 500 };
    expect(keyboardScroll({ top: 100, bottom: 140 }, view, 16)).toBe(0);
    expect(keyboardScroll({ top: 400, bottom: 470 }, view, 16)).toBe(0);
  });
});
