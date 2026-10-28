/**
 * Keeping a text field visible while an on-screen keyboard is open.
 * Pure maths: the caller reads the rectangles, these say how far to scroll.
 */

/** The part of the window the keyboard has not covered; the visual viewport shrinks, the layout one does not. */
export function visibleBand(vv: { offsetTop: number; height: number } | null, innerHeight: number): { top: number; bottom: number } {
  return vv ? { top: vv.offsetTop, bottom: vv.offsetTop + vv.height } : { top: 0, bottom: innerHeight };
}

/**
 * How far a scroll container must move so `field` sits inside `view`.
 * Positive scrolls down, negative scrolls up, 0 means it is already clear of the keyboard.
 */
export function keyboardScroll(field: { top: number; bottom: number }, view: { top: number; bottom: number }, pad = 16): number {
  if (field.bottom > view.bottom - pad) return field.bottom - (view.bottom - pad);
  if (field.top < view.top + pad) return field.top - (view.top + pad);
  return 0;
}
