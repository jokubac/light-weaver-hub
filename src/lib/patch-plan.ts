import { findFreeAddress, overlaps, type PatchedFixture } from "./dmx";

export interface PlannedAddress { universe: number; address: number }
export interface PatchPlan { slots: PlannedAddress[]; problem: string | null; overflows: boolean }

/**
 * Lays out `qty` fixtures of `ch` channels from universe/address with an `offset` gap.
 * With `overflow`, a fixture that would run past 512 starts at the first free address of the next universe,
 * leaving the remaining channels of the previous universe empty.
 */
export function planPatch(fixtures: PatchedFixture[], universe: number, address: number, ch: number, qty: number, offset: number, overflow: boolean): PatchPlan {
  const slots: PlannedAddress[] = [];
  let u = universe, a = address, overflows = false;
  for (let i = 0; i < qty; i++) {
    if (a + ch - 1 > 512) {
      overflows = true;
      if (!overflow) return { slots, problem: `Fixture ${i + 1} would run past channel 512.`, overflows };
      let free: number | null = null;
      while (free === null) {
        u += 1;
        if (u > 128) return { slots, problem: "Ran out of universes (max 128).", overflows };
        free = findFreeAddress(fixtures, u, ch);
      }
      a = free;
    }
    const hit = overlaps(fixtures, u, a, ch);
    if (hit.length) return { slots, problem: `Address ${a} overlaps "${hit[0]!.name}" (U${u}.${hit[0]!.address}).`, overflows };
    slots.push({ universe: u, address: a });
    a += ch + offset;
  }
  return { slots, problem: null, overflows };
}
