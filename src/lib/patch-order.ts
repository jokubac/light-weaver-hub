import { getDef, type PatchedFixture } from "./dmx";
import { groupsOf } from "./fixture-groups";

export type PatchSortKey = "number" | "name" | "fixture" | "mode" | "univ" | "dmx" | "ch" | "group";

/** Sorting never changes canonical console positions. */
export function patchRows(fixtures: PatchedFixture[], sort: { k: PatchSortKey; dir: 1 | -1 } | null) {
  const rows = fixtures.map((fixture, index) => ({ fixture, number: index + 1 }));
  if (!sort) return rows;
  const value = (row: typeof rows[number]): string | number => {
    const f = row.fixture, d = getDef(f.defId), m = d.modes[f.modeIdx];
    switch (sort.k) {
      case "number": return row.number;
      case "name": return f.name;
      case "fixture": return `${d.brand} ${d.model}`;
      case "mode": return m?.name ?? "";
      case "univ": return f.universe;
      case "dmx": return f.address;
      case "ch": return m?.channels ?? 1;
      case "group": return groupsOf(f)[0] ?? "\uffff";
    }
  };
  return rows.sort((a, b) => {
    const x = value(a), y = value(b);
    const cmp = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true });
    return cmp * sort.dir || a.number - b.number;
  });
}

export function movePatchFixture(fixtures: PatchedFixture[], uid: string, targetIndex: number): PatchedFixture[] {
  const from = fixtures.findIndex((f) => f.uid === uid);
  if (from < 0 || targetIndex < 0 || targetIndex >= fixtures.length || from === targetIndex) return fixtures;
  const result = [...fixtures];
  const [fixture] = result.splice(from, 1);
  if (!fixture) return fixtures;
  result.splice(targetIndex, 0, fixture);
  return result;
}