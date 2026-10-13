import { describe, expect, it } from "vitest";
import { defaultLayer, copyPixelEffect, pastePixelEffect, applyPixelEffect } from "@/lib/pixels";

const src = () => ({ ...defaultLayer("Src", ["a", "b"]), kind: "runner" as const, speed: 2.5, size: 7, colors: ["#ff0000"], playing: true });

describe("pixel effect copy/paste", () => {
  it("copy carries effect settings but never identity, lights or playing", () => {
    const c = copyPixelEffect(src());
    expect(c).not.toHaveProperty("id");
    expect(c).not.toHaveProperty("order");
    expect(c).not.toHaveProperty("playing");
    expect(c.kind).toBe("runner");
    expect(c.speed).toBe(2.5);
    expect(c.size).toBe(7);
    expect(c.colors).toEqual(["#ff0000"]);
  });

  it("paste creates an independent layer aimed at other lights", () => {
    const c = copyPixelEffect(src());
    const l = pastePixelEffect("Pasted", ["x", "y"], c);
    expect(l.id).not.toBe(src().id);
    expect(l.order).toEqual(["x", "y"]);
    expect(l.playing).toBe(false);
    expect(l.speed).toBe(2.5);
    // mutating the paste must not touch the copied settings
    l.colors.push("#00ff00");
    expect(src().colors).toEqual(["#ff0000", "#00e5ff", "#ffea00"]);
  });

  it("apply keeps the target layer's lights and replaces the effect", () => {
    const c = copyPixelEffect({ ...src(), name: "Whatever" });
    const target = { ...defaultLayer("Target", ["keep1"]), kind: "solid" as const };
    const out = applyPixelEffect(target, c);
    expect(out.id).toBe(target.id);
    expect(out.name).toBe("Target");
    expect(out.order).toEqual(["keep1"]);
    expect(out.kind).toBe("runner");
    expect(out.playing).toBe(false);
  });
});
