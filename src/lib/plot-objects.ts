export const SET_OBJECTS = [
  { kind: "bed", label: "Bed", w: 1.6, d: 2, h: 0.6 },
  { kind: "cabinet", label: "Cabinet", w: 0.8, d: 0.45, h: 0.9 },
  { kind: "table", label: "Table", w: 1.4, d: 0.8, h: 0.75 },
  { kind: "sofa", label: "Sofa", w: 2.1, d: 0.9, h: 0.85 },
  { kind: "chair", label: "Chair", w: 0.5, d: 0.5, h: 0.85 },
  { kind: "person", label: "Person", w: 0.5, d: 0.4, h: 1.75 },
  { kind: "car", label: "Car", w: 1.8, d: 4.5, h: 1.5 },
  { kind: "tree", label: "Tree", w: 3, d: 3, h: 6 },
] as const;
export type SetObjectKind = typeof SET_OBJECTS[number]["kind"];
export interface SetObject { id: string; kind: SetObjectKind; name: string; x: number; y: number; w: number; d: number; h: number; rot: number; floor: number }
export function objectContains(o: SetObject, x: number, y: number) {
  const a = -o.rot * Math.PI / 180, dx = x - o.x, dy = y - o.y;
  return Math.abs(dx * Math.cos(a) - dy * Math.sin(a)) <= o.w / 2 && Math.abs(dx * Math.sin(a) + dy * Math.cos(a)) <= o.d / 2;
}
