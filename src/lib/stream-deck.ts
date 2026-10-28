// Elgato Stream Deck over WebHID (Chrome/Edge/Windows app). Keys show saved looks in the
// look's own colour; the last key is Blackout. Loaded lazily so SSR never touches WebHID.
export interface DeckKey { label: string; color: string; active?: boolean }

type Deck = {
  CONTROLS: readonly { type: string; index: number; feedbackType?: string; pixelSize?: { width: number; height: number } }[];
  fillKeyCanvas(i: number, c: HTMLCanvasElement): Promise<void>;
  fillKeyColor(i: number, r: number, g: number, b: number): Promise<void>;
  clearPanel(): Promise<void>;
  on(ev: "down", cb: (c: { type: string; index: number }) => void): void;
  on(ev: "error", cb: (e: unknown) => void): void;
  close(): Promise<void>;
  PRODUCT_NAME: string;
};

let deck: Deck | null = null;

export function deckSupported(): boolean {
  return typeof navigator !== "undefined" && "hid" in navigator;
}

export async function connectDeck(onPress: (key: number) => void, ask = true): Promise<{ name: string; keys: number } | null> {
  if (!deckSupported()) throw new Error("Stream Deck needs Chrome, Edge or the NOX Windows app (WebHID).");
  const lib = await import("@elgato-stream-deck/webhid");
  const list = (ask ? await lib.requestStreamDecks() : await lib.getStreamDecks()) as unknown as Deck[];
  const d = list[0];
  if (!d) return null;
  await deck?.close().catch(() => {});
  deck = d;
  d.on("down", (c) => { if (c.type === "button") onPress(c.index); });
  d.on("error", () => {});
  await d.clearPanel().catch(() => {});
  return { name: d.PRODUCT_NAME, keys: buttons(d).length };
}

export async function disconnectDeck() { await deck?.clearPanel().catch(() => {}); await deck?.close().catch(() => {}); deck = null; }
export const deckConnected = () => !!deck;

const buttons = (d: Deck) => d.CONTROLS.filter((c) => c.type === "button");

/** Paint every key: background in the look colour, name in black or white for contrast. */
export async function paintDeck(keys: (DeckKey | null)[]): Promise<void> {
  const d = deck; if (!d) return;
  for (const b of buttons(d)) {
    const k = keys[b.index] ?? null;
    const rgb = hexRgb(k?.color ?? "#000000");
    if (b.feedbackType === "rgb") { await d.fillKeyColor(b.index, ...rgb).catch(() => {}); continue; }
    if (b.feedbackType !== "lcd") continue;
    const s = b.pixelSize?.width ?? 72;
    const c = document.createElement("canvas"); c.width = s; c.height = b.pixelSize?.height ?? s;
    const g = c.getContext("2d")!;
    g.fillStyle = k ? k.color : "#000"; g.fillRect(0, 0, c.width, c.height);
    if (k?.active) { g.strokeStyle = "#ffb000"; g.lineWidth = Math.max(4, s / 14); g.strokeRect(0, 0, c.width, c.height); }
    if (k) {
      const light = rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114 > 150;
      g.fillStyle = light ? "#000" : "#fff"; g.textAlign = "center"; g.textBaseline = "middle";
      g.font = `800 ${Math.round(s / 5.5)}px Manrope, system-ui, sans-serif`;
      const words = k.label.split(/\s+/).slice(0, 3);
      words.forEach((w, i) => g.fillText(w.slice(0, 9), c.width / 2, c.height / 2 + (i - (words.length - 1) / 2) * (s / 4.6)));
    }
    await d.fillKeyCanvas(b.index, c).catch(() => {});
  }
}

export function hexRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [0, 0, 0];
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
