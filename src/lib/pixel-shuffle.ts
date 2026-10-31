/** Random permutation of pixel slots (Fisher–Yates); pixel i is drawn and sampled at slot result[i]. */
export function shufflePixels(n: number, rnd: () => number = Math.random): number[] {
  const a = [...Array(n).keys()];
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}
/** Slot of DMX pixel i; invalid or missing shuffles keep the physical order. */
export const pixelSlot = (order: number[] | undefined, i: number) => {
  const s = order?.[i];
  return s === undefined || s < 0 ? i : s;
};
