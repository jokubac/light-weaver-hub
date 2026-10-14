type RGB = [number, number, number];
/** Final output gain after REC compositing; never changes programmed layers. */
export function applyPixelMaster(frame: Map<string, RGB[]>, gain: number): Map<string, RGB[]> {
  const k = Number.isFinite(gain) ? Math.min(1, Math.max(0, gain)) : 1;
  if (k === 1) return frame;
  return new Map([...frame].map(([uid, pixels]) => [uid, pixels.map((c) => c.map((v) => v * k) as RGB)]));
}