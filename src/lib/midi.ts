// MIDI controller mapping (Web MIDI — Chrome / Edge / Android; not available on iPad Safari).

export interface MidiMap { key: string; target: string; label: string }
export interface MidiMsg { key: string; value: number; isNote: boolean; on: boolean }

const KEY = "crmx-console-midi-v1";
export function loadMidi(): { enabled: boolean; maps: MidiMap[] } {
  try { const r = localStorage.getItem(KEY); if (r) return JSON.parse(r); } catch { /* ignore */ }
  return { enabled: false, maps: [] };
}
export function saveMidi(m: { enabled: boolean; maps: MidiMap[] }) { localStorage.setItem(KEY, JSON.stringify(m)); }

export function parseMidi(data: Uint8Array): MidiMsg | null {
  const [st = 0, d1 = 0, d2 = 0] = data;
  const type = st & 0xf0, ch = (st & 0x0f) + 1;
  if (type === 0xb0) return { key: `CC ${ch}/${d1}`, value: d2 / 127, isNote: false, on: d2 > 0 };
  if (type === 0x90 || type === 0x80) return { key: `Note ${ch}/${d1}`, value: d2 / 127, isNote: true, on: type === 0x90 && d2 > 0 };
  return null;
}

/** Subscribes to every MIDI input. Returns an unsubscribe function. */
export async function listenMidi(cb: (m: MidiMsg, device: string) => void, onDevices?: (names: string[]) => void) {
  const nav = navigator as Navigator & { requestMIDIAccess?: () => Promise<any> };
  if (!nav.requestMIDIAccess) throw new Error("This browser has no MIDI support. Use Chrome or Edge.");
  const access = await nav.requestMIDIAccess();
  const bind = () => {
    const names: string[] = [];
    access.inputs.forEach((inp: any) => {
      names.push(inp.name);
      inp.onmidimessage = (e: { data: Uint8Array }) => { const m = parseMidi(e.data); if (m) cb(m, inp.name); };
    });
    onDevices?.(names);
  };
  bind();
  access.onstatechange = bind;
  return () => { access.inputs.forEach((inp: any) => { inp.onmidimessage = null; }); access.onstatechange = null; };
}
