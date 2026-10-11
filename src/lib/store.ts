// Project / scene state, stored privately per user in Lovable Cloud.

import { supabase } from "@/integrations/supabase/client";
import { normalizeFixture, type PatchedFixture } from "./dmx";
import { defaultPixelMap, type PixelMap } from "./pixels";

export interface Scene {
  id: string;
  name: string;
  createdAt: number;
  fixtures: PatchedFixture[];
  master: number;
  pixelMap?: PixelMap;
}

export type WallKind = "wall" | "window" | "door";
export interface Wall { id: string; kind: WallKind; x1: number; y1: number; x2: number; y2: number }
export interface PlotPos { x: number; y: number; rot: number }
export interface Plot { walls: Wall[]; positions: Record<string, PlotPos> }

export interface Project {
  id: string;
  name: string;
  color: string;
  createdAt: number;
  scenes: Scene[];
  plot?: Plot;
  universeCount?: number;
}

export const PROJECT_COLORS = ["#00E5FF", "#00E676", "#FFEA00", "#FF9100", "#FF3D00", "#F50057", "#D500F9", "#651FFF", "#2979FF", "#BDBDBD"];

const LEGACY_KEY = "crmx-console-projects-v1";

export function normalizeProject(p: Project): Project {
  return {
    ...p,
    plot: p.plot ?? { walls: [], positions: {} },
    universeCount: p.universeCount ?? 4,
    scenes: (p.scenes ?? []).map((s) => ({
      ...s,
      pixelMap: s.pixelMap ?? defaultPixelMap(),
      fixtures: (s.fixtures ?? []).map((f) => normalizeFixture(f as never)),
    })),
  };
}

const strip = (p: Project): Project => ({
  ...p,
  scenes: p.scenes.map((s) => ({ ...s, fixtures: s.fixtures.map((f) => ({ ...f, trigger: null })) })),
});

export async function loadProjects(): Promise<Project[]> {
  const { data, error } = await supabase.from("console_projects").select("id, data").order("updated_at", { ascending: false });
  if (error) throw error;
  let projects = (data ?? []).map((r) => normalizeProject(r.data as unknown as Project));
  // One-time import of projects saved on this device before login existed.
  if (projects.length === 0) {
    try {
      const raw = localStorage.getItem(LEGACY_KEY);
      if (raw) {
        projects = (JSON.parse(raw) as Project[]).map(normalizeProject);
        if (projects.length) await syncProjects(projects, new Map());
        localStorage.removeItem(LEGACY_KEY);
      }
    } catch {
      // ignore corrupted local data
    }
  }
  return projects;
}

/** Upserts changed projects and deletes removed ones. Returns the new snapshot map. */
export async function syncProjects(projects: Project[], prev: Map<string, string>): Promise<Map<string, string>> {
  const next = new Map<string, string>();
  const changed: { id: string; data: never; updated_at: string }[] = [];
  for (const p of projects) {
    const json = JSON.stringify(strip(p));
    next.set(p.id, json);
    if (prev.get(p.id) !== json) changed.push({ id: p.id, data: JSON.parse(json) as never, updated_at: new Date().toISOString() });
  }
  if (changed.length) {
    const { error } = await supabase.from("console_projects").upsert(changed);
    if (error) throw error;
  }
  const removed = [...prev.keys()].filter((id) => !next.has(id));
  if (removed.length) {
    const { error } = await supabase.from("console_projects").delete().in("id", removed);
    if (error) throw error;
  }
  return next;
}

export function snapshot(projects: Project[]) {
  return new Map(projects.map((p) => [p.id, JSON.stringify(strip(p))]));
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
