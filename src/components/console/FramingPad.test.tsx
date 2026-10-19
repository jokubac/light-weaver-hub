import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { FramingPad } from "./FramingPad";
import type { BeamAttr } from "@/lib/dmx";

function Harness({ attrs, out }: { attrs: BeamAttr[]; out: Record<string, number> }) {
  const [v, setV] = useState<Record<string, number>>({});
  return <FramingPad has={(a) => attrs.includes(a)} value={(a) => v[a] ?? 0} set={(a, n) => setV((s) => { const nx = { ...s, [a]: n ?? 0 }; Object.assign(out, nx); return nx; })} />;
}
if (!("PointerEvent" in globalThis)) (globalThis as Record<string, unknown>).PointerEvent = class extends MouseEvent { pointerId: number; constructor(t: string, i: PointerEventInit = {}) { super(t, i); this.pointerId = i.pointerId ?? 1; } };
const rect = () => ({ left: 0, top: 0, width: 120, height: 120, right: 120, bottom: 120, x: 0, y: 0, toJSON: () => ({}) });
// viewBox -10..110 at 120px: client px = svg unit + 10
const at = (x: number, y: number) => ({ clientX: x + 10, clientY: y + 10, buttons: 1, pointerId: 1 });

describe("FramingPad", () => {
  for (const attrs of [["Blade1A", "Blade1B"], ["Blade1A", "Blade1Rot"]] as BeamAttr[][]) {
    it(`cuts a corner and slides the edge (${attrs.join("+")})`, () => {
      SVGElement.prototype.getBoundingClientRect = rect as never;
      (Element.prototype as unknown as { setPointerCapture: () => void }).setPointerCapture = () => {};
      const out: Record<string, number> = {};
      render(<Harness attrs={attrs} out={out} />);
      const dot = screen.getByLabelText("Blade 1 A");
      fireEvent.pointerDown(dot, at(15, 0));
      fireEvent.pointerMove(dot, at(15, 40));
      const cut = { ...out };
      expect(Object.values(cut).some((v) => v > 0.2)).toBe(true);
      const edge = screen.getByLabelText("Blade 1 edge");
      fireEvent.pointerDown(edge, at(50, 30));
      expect(out).not.toEqual(cut);
    });
  }
});
