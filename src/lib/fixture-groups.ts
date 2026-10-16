// Group membership helpers — pure, browser-safe.
// A light may belong to several groups at once. `groups` is the list of them all;
// projects saved before this only carry the single `group` field, which is read
// as a one-item list until the light is grouped again.
import type { PatchedFixture } from "./dmx";

/** Every group a light belongs to, in the order they were added. */
export const groupsOf = (f: PatchedFixture): string[] =>
  Array.isArray(f.groups) ? [...new Set(f.groups.filter(Boolean))] : f.group ? [f.group] : [];

export const inGroup = (f: PatchedFixture, g: string) => groupsOf(f).includes(g);

/** All group names used across these lights, first-seen order. */
export const groupNamesOf = (fixtures: PatchedFixture[]): string[] =>
  [...new Set(fixtures.flatMap(groupsOf))];

/** Lights that belong to group `g`. */
export const membersOf = (fixtures: PatchedFixture[], g: string) =>
  fixtures.filter((f) => inGroup(f, g));

/** "Key, Front" — how groups are shown in tables. */
export const groupText = (f: PatchedFixture) => groupsOf(f).join(", ");

/** Add a light to a group. Its first group also stays in the legacy `group` field. */
export const addToGroup = (f: PatchedFixture, g: string): PatchedFixture => {
  const list = groupsOf(f);
  if (!g || list.includes(g)) return f;
  return { ...f, groups: [...list, g], group: f.group ?? g };
};

/** Take a light out of one group. Patch, settings and other groups stay. */
export const removeFromGroup = (f: PatchedFixture, g: string): PatchedFixture => {
  const list = groupsOf(f);
  if (!list.includes(g)) return f;
  const rest = list.filter((x) => x !== g);
  if (!rest.length) return clearGroups(f);
  return { ...f, groups: rest, group: rest[0]! };
};

/** Add or remove group `g` depending on whether the light is already in it. */
export const toggleGroup = (f: PatchedFixture, g: string): PatchedFixture =>
  inGroup(f, g) ? removeFromGroup(f, g) : addToGroup(f, g);

/** Drop every group the light belongs to. */
export const clearGroups = (f: PatchedFixture): PatchedFixture => {
  const { group: _group, groups: _groups, ...bare } = f;
  return bare as PatchedFixture;
};

/** Replace the whole list — the patch sheet types them comma separated. */
export const setGroups = (f: PatchedFixture, names: string[]): PatchedFixture => {
  const list = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  if (!list.length) return clearGroups(f);
  return { ...f, groups: list, group: list[0]! };
};

/** Patch object for editors that type groups as one comma separated line. */
export const groupsPatch = (names: string[]): Partial<PatchedFixture> => {
  const list = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  return list.length ? { groups: list, group: list[0]! } : { groups: [] };
};

/** Rename a group everywhere it appears on one light. */
export const renameGroupsOn = (f: PatchedFixture, from: string, to: string): PatchedFixture => {
  const list = groupsOf(f);
  if (!list.includes(from)) return f;
  const next = [...new Set(list.map((x) => (x === from ? to : x)))];
  if (f.group === from) return { ...f, groups: next, group: to };
  return { ...f, groups: next };
};
