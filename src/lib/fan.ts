// Fan / spread: distribute a value range across an ordered selection — pure.
export type FanMode = "linear" | "center";

/** Returns n values from `from` to `to`. "center" puts `from` in the middle and `to` at both ends. */
export function fanValues(n: number, from: number, to: number, mode: FanMode = "linear"): number[] {
  if (n <= 0) return [];
  if (n === 1) return [from];
  return Array.from({ length: n }, (_, i) => {
    let k = i / (n - 1);
    if (mode === "center") k = Math.abs(k - 0.5) * 2;
    return from + (to - from) * k;
  });
}
