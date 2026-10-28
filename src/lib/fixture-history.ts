import type { PatchedFixture } from './dmx';
import { copyFixtureSettings, type FixtureSettings } from './fixture-settings';
export type FixtureEdit = { uid: string; before: FixtureSettings; after: FixtureSettings }[];
/**
 * What changed between two patch states. Lights are compared by identity first — an update
 * copies the light it touches, so everything else is skipped without touching its settings.
 * A uid lookup keeps this one pass over the patch instead of a scan per light.
 */
export function fixtureEdit(before: PatchedFixture[], after: PatchedFixture[]): FixtureEdit {
  if (before === after) return [];
  const old = new Map(before.map((f) => [f.uid, f]));
  const edit: FixtureEdit = [];
  for (const f of after) {
    const o = old.get(f.uid);
    if (!o || o === f) continue;
    const a = copyFixtureSettings(o), b = copyFixtureSettings(f);
    if (JSON.stringify(a) !== JSON.stringify(b)) edit.push({ uid: f.uid, before: a, after: b });
  }
  return edit;
}
export function restoreFixtureEdit(fixtures: PatchedFixture[], edit: FixtureEdit, direction: 'before' | 'after') {
  const changes = new Map(edit.map((e) => [e.uid, e]));
  return fixtures.map((f) => {
    const change = changes.get(f.uid);
    return change ? { ...f, ...structuredClone(change[direction]), trigger: null } : f;
  });
}
