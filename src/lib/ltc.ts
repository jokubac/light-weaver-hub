// SMPTE LTC (audio timecode) decoder + timeline chase rule — pure and browser-safe.

export type TcRate = 23.976 | 24 | 25 | 29.97 | 30;
export const TC_RATES: { v: TcRate; label: string }[] = [
  { v: 23.976, label: "23.976" }, { v: 24, label: "24" }, { v: 25, label: "25" }, { v: 29.97, label: "29.97 DF" }, { v: 30, label: "30" },
];
/** frames counted per timecode second (23.976 counts 24, 29.97 counts 30) */
export const nominalFps = (r: TcRate) => Math.round(r);

export interface LtcFrame { h: number; m: number; s: number; f: number; drop: boolean }
/** Timecode label → seconds on the label clock, matching fmtTc/parseTc. */
export const ltcSeconds = (fr: LtcFrame, rate: TcRate) => fr.h * 3600 + fr.m * 60 + fr.s + fr.f / nominalFps(rate);

const SYNC = [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1];

/** Biphase-mark LTC decoder: feed audio samples, get frames back. Bit period adapts to the incoming speed. */
export class LtcDecoder {
  private sign = 0;
  private count = 0;
  private bp: number;
  private half = false;
  private bits: number[] = [];
  constructor(private sampleRate: number, rate: TcRate = 25) { this.bp = sampleRate / (80 * rate); }

  feed(samples: ArrayLike<number>, onFrame: (f: LtcFrame) => void) {
    for (let i = 0; i < samples.length; i++) {
      const x = samples[i]!;
      this.count++;
      const sg = x > 0.02 ? 1 : x < -0.02 ? -1 : this.sign;
      if (sg === this.sign || sg === 0) continue;
      const first = this.sign === 0;
      this.sign = sg;
      const n = this.count; this.count = 0;
      if (first) continue;
      if (n > this.bp * 1.6 || n < this.bp * 0.25) { this.half = false; continue; } // noise / dropout
      if (n > this.bp * 0.75) {
        this.half = false; this.bp = this.bp * 0.9 + n * 0.1; this.push(0, onFrame);
      } else if (this.half) {
        this.half = false; this.bp = this.bp * 0.9 + n * 2 * 0.1; this.push(1, onFrame);
      } else this.half = true;
    }
  }

  private push(b: number, onFrame: (f: LtcFrame) => void) {
    const bits = this.bits; bits.push(b); if (bits.length > 80) bits.shift();
    if (bits.length < 80) return;
    for (let i = 0; i < 16; i++) if (bits[64 + i] !== SYNC[i]) return;
    const u = (o: number, n: number) => { let v = 0; for (let i = 0; i < n; i++) v |= bits[o + i]! << i; return v; };
    const fr: LtcFrame = { f: u(0, 4) + 10 * u(8, 2), drop: bits[10] === 1, s: u(16, 4) + 10 * u(24, 3), m: u(32, 4) + 10 * u(40, 3), h: u(48, 4) + 10 * u(56, 2) };
    if (fr.f > 29 || fr.s > 59 || fr.m > 59 || fr.h > 23) return;
    onFrame(fr);
  }
}

/** Encodes one LTC frame as biphase audio (used by tests). */
export function encodeLtc(fr: LtcFrame, sampleRate: number, rate: TcRate, level = 0.5, startLevel = level): Float32Array {
  const bits = new Array<number>(80).fill(0);
  const put = (o: number, n: number, v: number) => { for (let i = 0; i < n; i++) bits[o + i] = (v >> i) & 1; };
  put(0, 4, fr.f % 10); put(8, 2, Math.floor(fr.f / 10)); bits[10] = fr.drop ? 1 : 0;
  put(16, 4, fr.s % 10); put(24, 3, Math.floor(fr.s / 10)); put(32, 4, fr.m % 10); put(40, 3, Math.floor(fr.m / 10));
  put(48, 4, fr.h % 10); put(56, 2, Math.floor(fr.h / 10)); SYNC.forEach((v, i) => { bits[64 + i] = v; });
  const per = sampleRate / (80 * rate); const out = new Float32Array(Math.round(per * 80));
  let lv = startLevel, t = 0;
  bits.forEach((b, i) => {
    lv = -lv; const end = (i + 1) * per, mid = i * per + per / 2;
    for (; t < end && t < out.length; t++) { if (b && t >= mid && t - 1 < mid) lv = -lv; out[t] = lv; }
  });
  return out;
}

export type ChaseAction = { do: "play" | "seek"; t: number } | { do: "pause" } | null;
/**
 * What the timeline should do for an incoming timecode: tcStart is the timecode where the timeline's 0 sits.
 * Outside the timeline it pauses; drift beyond `tol` seconds re-seeks so lights stay frame-accurate with sound and camera.
 */
export function chaseTimeline(tc: number, tcStart: number, length: number, playingAt: number | null, tol = 0.1): ChaseAction {
  const t = tc - tcStart;
  if (t < 0 || t >= length) return playingAt != null ? { do: "pause" } : null;
  if (playingAt == null) return { do: "play", t };
  return Math.abs(playingAt - t) > tol ? { do: "seek", t } : null;
}
