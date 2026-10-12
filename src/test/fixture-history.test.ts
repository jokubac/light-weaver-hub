import { describe, expect, it } from 'vitest';
import { fixtureEdit, restoreFixtureEdit } from '@/lib/fixture-history';
import type { PatchedFixture } from '@/lib/dmx';
const light = { uid: 'a', intensity: 0.2, cct: 0.4, hue: 0, saturation: 1, crossfade: 0, gm: 0, fx: { kind: 'none' }, address: 1, universe: 1 } as PatchedFixture;
describe('fixture settings history', () => {
  it('undo restores intensity and redo reapplies the change', () => {
    const after = [{ ...light, intensity: 0.8 }];
    const edit = fixtureEdit([light], after);
    const undone = restoreFixtureEdit(after, edit, 'before');
    expect(undone[0]?.intensity).toBe(0.2);
    expect(restoreFixtureEdit(undone, edit, 'after')[0]?.intensity).toBe(0.8);
  });
  it('restores colour without reverting DMX patch or other fixtures', () => {
    const after = [{ ...light, cct: 0.9 }];
    const edit = fixtureEdit([light], after);
    const restored = restoreFixtureEdit([{ ...light, cct: 0.9, address: 50 }, { ...light, uid: 'b', intensity: 0.7 }], edit, 'before');
    expect(restored[0]?.cct).toBe(0.4);
    expect(restored[0]?.address).toBe(50);
    expect(restored[1]?.intensity).toBe(0.7);
  });
});
