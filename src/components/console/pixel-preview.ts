import type { PatchedFixture } from "@/lib/dmx";
import { layoutLayer, renderLayer, textMask, type PixelLayer } from "@/lib/pixels";

type RGB = [number, number, number];

/** Live output takes precedence over the selected layer's programming preview. */
/** liveOnly: skip the programming preview so nothing shows until the layer is playing. */
export function pixelPreview(layer: PixelLayer, fixtures: PatchedFixture[], live: Map<string, RGB[]>, now: number, liveOnly = false) {
  const programmed = layoutLayer(layer, fixtures);
  const frame = layer.playing || liveOnly ? new Map<string, RGB[]>() : renderLayer(layer, fixtures, now, layer.kind === "text" ? textMask(layer.text.toUpperCase(), programmed.H) : null);
  for (const [uid, pixels] of live) frame.set(uid, pixels);
  // Include outgoing-only lights and other playing layers without editing their saved order.
  const order = [...new Set([...layer.order, ...live.keys()])];
  return { ...layoutLayer({ ...layer, order }, fixtures), frame };
}