// Beam optics for the live plot: default spread per light type, plus modifiers the user can fit.
export type Optic = "bare" | "fresnel" | "parallel" | "dish" | "softbox" | "lantern" | "panel" | "tube";
export const OPTICS: { id: Optic; label: string; angle: number; min: number; max: number }[] = [
  { id: "bare", label: "Bare reflector", angle: 55, min: 40, max: 70 },
  { id: "fresnel", label: "Fresnel (spot ↔ flood)", angle: 30, min: 12, max: 60 },
  { id: "parallel", label: "Parallel beam", angle: 10, min: 4, max: 20 },
  { id: "dish", label: "Dish / hyper reflector", angle: 26, min: 15, max: 45 },
  { id: "softbox", label: "Softbox / bowl", angle: 100, min: 70, max: 130 },
  { id: "lantern", label: "Lantern / space light", angle: 180, min: 120, max: 180 },
  { id: "panel", label: "Panel (bare)", angle: 110, min: 30, max: 120 },
  { id: "tube", label: "Tube / bare LED", angle: 140, min: 100, max: 180 },
];
export const OPTIC_BY_ID = Object.fromEntries(OPTICS.map((o) => [o.id, o])) as Record<Optic, (typeof OPTICS)[number]>;

/** Optic a light ships with, guessed from its model name. */
export function defaultOptic(model: string): Optic {
  const m = model.toLowerCase();
  if (/titan|helios|hyperion|tube|infinibar|pavotube|pixel ?bar|strip|lightblade|ax1|nyx/.test(m)) return "tube";
  if (/fresnel|l7|l10|l5|t12|t24|\bt[0-9]|m18|m40|m90|arrimax|daylight|joker|hmi|max/.test(m)) return "fresnel";
  if (/parabeam|parallel|dino|maxi|brute/.test(m)) return "parallel";
  if (/skypanel|panel|litemat|astra|gemini|vortex|orbiter|mat|kino|freestyle|celeb|select|s30|s60|s120|s360|p360|quasar/.test(m)) return "panel";
  if (/lantern|space|balloon|chimera/.test(m)) return "lantern";
  return "bare"; // COB monolights (Nanlux, Aputure LS, Forza …)
}
