// Makes every <input type="range"> behave like a real fader: tapping never jumps the value,
// it only moves by how far you drag from where you touched.
const setter = typeof window !== "undefined" ? Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set : undefined;

export function installFaders() {
  let st: { el: HTMLInputElement; id: number; x: number; v: number; min: number; max: number; step: number; w: number } | null = null;
  const isRange = (t: EventTarget | null): t is HTMLInputElement => t instanceof HTMLInputElement && t.type === "range" && !t.disabled;
  const write = (el: HTMLInputElement, v: number) => {
    if (String(v) === el.value) return;
    setter?.call(el, String(v));
    el.dispatchEvent(new Event("input", { bubbles: true }));
  };
  const down = (e: PointerEvent) => {
    if (!isRange(e.target) || e.button > 0) return;
    const el = e.target;
    e.preventDefault();
    const min = +el.min || 0, max = el.max === "" ? 100 : +el.max, step = el.step === "any" || !el.step ? 0 : +el.step;
    st = { el, id: e.pointerId, x: e.clientX, v: +el.value, min, max, step, w: Math.max(40, el.getBoundingClientRect().width) };
    try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  };
  const move = (e: PointerEvent) => {
    if (!st || e.pointerId !== st.id) return;
    e.preventDefault();
    const fine = e.shiftKey ? 0.2 : 1;
    let v = st.v + ((e.clientX - st.x) / st.w) * (st.max - st.min) * fine;
    if (st.step) v = st.min + Math.round((v - st.min) / st.step) * st.step;
    v = Math.max(st.min, Math.min(st.max, +v.toFixed(6)));
    write(st.el, v);
  };
  const up = (e: PointerEvent) => {
    if (!st || e.pointerId !== st.id) return;
    st.el.dispatchEvent(new Event("change", { bubbles: true }));
    st = null;
  };
  const touch = (e: TouchEvent) => { if (isRange(e.target)) e.preventDefault(); };
  const click = (e: MouseEvent) => { if (isRange(e.target)) e.preventDefault(); };
  document.addEventListener("pointerdown", down, { capture: true, passive: false });
  document.addEventListener("pointermove", move, { capture: true, passive: false });
  document.addEventListener("pointerup", up, true);
  document.addEventListener("pointercancel", up, true);
  document.addEventListener("touchstart", touch, { capture: true, passive: false });
  document.addEventListener("mousedown", click, { capture: true, passive: false });
  return () => {
    document.removeEventListener("pointerdown", down, true);
    document.removeEventListener("pointermove", move, true);
    document.removeEventListener("pointerup", up, true);
    document.removeEventListener("pointercancel", up, true);
    document.removeEventListener("touchstart", touch, true);
    document.removeEventListener("mousedown", click, true);
  };
}
