// Project / scene state with localStorage persistence.

import type { PatchedFixture } from "./dmx";

export interface Scene {
  id: string;
  name: string;
  createdAt: number;
  fixtures: PatchedFixture[];
  master: number;
}

export interface Project {
  id: string;
  name: string;
  color: string;
  createdAt: number;
  scenes: Scene[];
}

export const PROJECT_COLORS = ["#00E5FF", "#00E676", "#FFEA00", "#FF3D00", "#D500F9", "#F50057"];

const KEY = "crmx-console-projects-v1";

export function loadProjects(): Project[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Project[];
  } catch {
    // corrupted storage — start fresh
  }
  return [];
}

export function saveProjects(projects: Project[]) {
  localStorage.setItem(KEY, JSON.stringify(projects));
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
