// Account sync: projects + favourites + saved effects follow the signed-in user.
// Local storage stays the working copy; the cloud is merged in on sign-in and updated after changes.
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { Project } from "./store";
import { FXLIB_KEY, readFxLib, writeFxLib, type FxLibrary } from "./fxlib";

const FAV_KEY = "crmx-console-favorites-v1";

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { setUser(data.user ?? null); setReady(true); });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED" || event === "INITIAL_SESSION") setUser(session?.user ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  return { user, ready };
}

const readFav = (): { gels?: string[]; fixtures?: string[]; modes?: string[] } => { try { return JSON.parse(localStorage.getItem(FAV_KEY) ?? "{}"); } catch { return {}; } };
const union = (a: string[] = [], b: string[] = []) => Array.from(new Set([...a, ...b]));
const byId = <T extends { id: string }>(a: T[], b: T[]) => [...a, ...b.filter((x) => !a.some((y) => y.id === x.id))];

/** Pull cloud data and merge it with what's on this device. Returns the merged project list. */
export async function pullAndMerge(local: Project[]): Promise<Project[]> {
  const [{ data: rows, error }, { data: ud }] = await Promise.all([
    supabase.from("console_projects").select("id,data"),
    supabase.from("console_user_data").select("data").maybeSingle(),
  ]);
  if (error) throw error;
  const remote = (rows ?? []).map((r) => r.data as unknown as Project);
  const merged = byId(local, remote).sort((a, b) => b.createdAt - a.createdAt);

  const cloud = (ud?.data ?? {}) as { favorites?: { gels?: string[]; fixtures?: string[]; modes?: string[] }; effects?: FxLibrary };
  const fav = readFav();
  const nextFav = { gels: union(fav.gels, cloud.favorites?.gels), fixtures: union(fav.fixtures, cloud.favorites?.fixtures), modes: union(fav.modes, cloud.favorites?.modes) };
  localStorage.setItem(FAV_KEY, JSON.stringify(nextFav));
  window.dispatchEvent(new Event("crmx-favorites"));
  const lib = readFxLib();
  writeFxLib({ fx: byId(lib.fx, cloud.effects?.fx ?? []), pixel: byId(lib.pixel, cloud.effects?.pixel ?? []) }, true);
  return merged;
}

export async function pushProjects(userId: string, projects: Project[]) {
  if (projects.length) {
    const { error } = await supabase.from("console_projects").upsert(projects.map((p) => ({ id: p.id, user_id: userId, data: p as unknown as Json, updated_at: new Date().toISOString() })));
    if (error) throw error;
  }
  const ids = projects.map((p) => p.id);
  const q = supabase.from("console_projects").delete().eq("user_id", userId);
  const { error } = ids.length ? await q.not("id", "in", `(${ids.map((i) => `"${i}"`).join(",")})`) : await q;
  if (error) throw error;
}

export async function pushUserData(userId: string) {
  const data = { favorites: readFav(), effects: JSON.parse(localStorage.getItem(FXLIB_KEY) ?? "{}") } as unknown as Json;
  const { error } = await supabase.from("console_user_data").upsert({ user_id: userId, data, updated_at: new Date().toISOString() });
  if (error) throw error;
}
