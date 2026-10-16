import { describe, expect, it } from "vitest";
import { normalizeFixture, type PatchedFixture } from "@/lib/dmx";
import {
  addToGroup, clearGroups, groupNamesOf, groupText, groupsOf, groupsPatch,
  inGroup, membersOf, removeFromGroup, renameGroupsOn, setGroups, toggleGroup,
} from "@/lib/fixture-groups";
import { faderMembers } from "@/lib/playback";
import { patchRows } from "@/lib/patch-order";
import type { BankFader } from "@/lib/store";

const light = (uid: string, extra: Record<string, unknown> = {}) =>
  normalizeFixture({ uid, name: uid, universe: 1, address: 1, ...extra }) as PatchedFixture;

const groupFader = (ref: string): BankFader => ({ id: `f-${ref}`, name: ref, kind: "group", ref, level: 1 });

describe("a light can sit in several groups at once", () => {
  it("reads the single group saved by older projects", () => {
    expect(groupsOf(light("a", { group: "Key" }))).toEqual(["Key"]);
  });

  it("reads a group list, keeping the legacy field first", () => {
    expect(groupsOf(light("a", { group: "Key", groups: ["Key", "Front"] }))).toEqual(["Key", "Front"]);
    expect(groupsOf(light("a", { groups: ["Front"] }))).toEqual(["Front"]);
  });

  it("adds a second group without losing the first", () => {
    const added = addToGroup(light("a", { group: "Key" }), "Front");
    expect(groupsOf(added)).toEqual(["Key", "Front"]);
    expect(added.group).toBe("Key");
    expect(added.groups).toEqual(["Key", "Front"]);
  });

  it("names the first group as primary when the light had none", () => {
    const added = addToGroup(light("a"), "Front");
    expect(added.group).toBe("Front");
    expect(groupsOf(added)).toEqual(["Front"]);
  });

  it("leaving one group keeps the others and moves the primary over", () => {
    const left = removeFromGroup(light("a", { group: "Key", groups: ["Key", "Front"] }), "Key");
    expect(groupsOf(left)).toEqual(["Front"]);
    expect(left.group).toBe("Front");
  });

  it("leaving the last group clears both fields", () => {
    const left = removeFromGroup(light("a", { group: "Key", groups: ["Key"] }), "Key");
    expect(groupsOf(left)).toEqual([]);
    expect("group" in left).toBe(false);
    expect("groups" in left).toBe(false);
  });

  it("taps the same group twice to add then remove it", () => {
    const once = toggleGroup(light("a", { group: "Key" }), "Front");
    expect(groupsOf(once)).toEqual(["Key", "Front"]);
    expect(groupsOf(toggleGroup(once, "Front"))).toEqual(["Key"]);
  });

  it("replaces the whole list, and an empty list clears it", () => {
    const set = setGroups(light("a", { group: "Key" }), [" Back ", "Back", "Top"]);
    expect(groupsOf(set)).toEqual(["Back", "Top"]);
    expect(set.group).toBe("Back");
    expect(groupsOf(clearGroups(set))).toEqual([]);
  });

  it("builds a patch object for the comma separated patch sheet field", () => {
    expect(groupsPatch(["Key", " Front"])).toEqual({ groups: ["Key", "Front"], group: "Key" });
    expect(groupsPatch(["", "  "])).toEqual({ groups: [] });
  });

  it("shows every group in tables", () => {
    expect(groupText(light("a", { groups: ["Key", "Front"] }))).toBe("Key, Front");
  });

  it("lists a light under each group it belongs to", () => {
    const fixtures = [
      light("a", { groups: ["Key", "Front"] }),
      light("b", { group: "Front" }),
      light("c"),
    ];
    expect(membersOf(fixtures, "Key").map((f) => f.uid)).toEqual(["a"]);
    expect(membersOf(fixtures, "Front").map((f) => f.uid)).toEqual(["a", "b"]);
    expect(groupNamesOf(fixtures)).toEqual(["Key", "Front"]);
    expect(inGroup(fixtures[0]!, "Front")).toBe(true);
    expect(inGroup(fixtures[2]!, "Front")).toBe(false);
  });

  it("selects the light on a fader for each of its groups", () => {
    const fixtures = [light("a", { groups: ["Key", "Front"] }), light("b", { group: "Front" })];
    expect([...faderMembers(groupFader("Key"), fixtures, [])]).toEqual(["a"]);
    expect([...faderMembers(groupFader("Front"), fixtures, [])]).toEqual(["a", "b"]);
  });

  it("sorts the patch sheet by the light's first group", () => {
    const fixtures = [light("z", { groups: ["Zebra"] }), light("k", { groups: ["Key", "Zebra"] })];
    expect(patchRows(fixtures, { k: "group", dir: 1 }).map((r) => r.fixture.uid)).toEqual(["k", "z"]);
  });

  it("renames a group everywhere it appears on a light", () => {
    const renamed = renameGroupsOn(light("a", { group: "Key", groups: ["Key", "Front"] }), "Key", "Keys");
    expect(groupsOf(renamed)).toEqual(["Keys", "Front"]);
    expect(renamed.group).toBe("Keys");
    // a light that is not in that group is untouched
    const other = light("b", { group: "Front" });
    expect(renameGroupsOn(other, "Key", "Keys")).toBe(other);
  });

  it("keeps the group list through the project loader", () => {
    const stored = normalizeFixture({ uid: "a", name: "A", group: "Key", groups: ["Key", "Front"] });
    expect(groupsOf(stored)).toEqual(["Key", "Front"]);
    expect(normalizeFixture({ uid: "a", name: "A", groups: [] }).groups).toEqual([]);
  });
});
