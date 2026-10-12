// User-created / imported fixtures (GDTF import + manual Fixture Builder), kept in localStorage
// and merged into the built-in FIXTURE_LIBRARY by dmx.ts.
import { useEffect, useState } from "react";
import type { FixtureDef } from "./dmx";

const KEY = "kroma-custom-fixtures-v1";
const EVT = "kroma-custom-fixtures";

export function loadCustomFixtures(): FixtureDef[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as FixtureDef[];
  } catch { /* ignore */ }
  return [];
}

function write(list: FixtureDef[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* ignore */ }
  window.dispatchEvent(new Event(EVT));
}

export function saveCustomFixtures(list: FixtureDef[]) {
  write(list);
}

/** Adds (or replaces, by id) a custom fixture definition. */
export function addCustomFixture(def: FixtureDef) {
  const list = loadCustomFixtures();
  const i = list.findIndex((d) => d.id === def.id);
  if (i >= 0) list[i] = def; else list.push(def);
  write(list);
}

export function removeCustomFixture(id: string) {
  write(loadCustomFixtures().filter((d) => d.id !== id));
}

/** React hook that stays in sync with localStorage custom fixtures across components/tabs. */
export function useCustomFixtures() {
  const [list, setList] = useState<FixtureDef[]>(() => loadCustomFixtures());
  useEffect(() => {
    const sync = () => setList(loadCustomFixtures());
    sync();
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return { list, add: addCustomFixture, remove: removeCustomFixture };
}
