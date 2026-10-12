import type { PatchedFixture } from './dmx';
import { copyFixtureSettings, type FixtureSettings } from './fixture-settings';
export type FixtureEdit = { uid: string; before: FixtureSettings; after: FixtureSettings }[];
export function fixtureEdit(before: PatchedFixture[], after: PatchedFixture[]): FixtureEdit {
  return after.flatMap((f) => {
    const old = before.find((o) => o.uid === f.uid);
    if (!old) return [];
    const a = copyFixtureSettings(old), b = copyFixtureSettings(f);
    return JSON.stringify(a) === JSON.stringify(b) ? [] : [{ uid: f.uid, before: a, after: b }];
  });
}
export function restoreFixtureEdit(fixtures: PatchedFixture[], edit: FixtureEdit, direction: 'before' | 'after') {
  return fixtures.map((f) => {
    const change = edit.find((e) => e.uid === f.uid);
    return change ? { ...f, ...structuredClone(change[direction]), trigger: null } : f;
  });
}
