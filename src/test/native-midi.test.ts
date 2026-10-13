import { describe, expect, it } from "vitest";
import { nativeMidiToBytes, parseMidi } from "@/lib/midi";

describe("Android MIDI messages", () => {
  it("turns a control change on channel 1 into a CC key", () => {
    expect(parseMidi(nativeMidiToBytes({ type: "UNKNOWN - -80", note: 7, velocity: 127 })!)).toMatchObject({ key: "CC 1/7", value: 1 });
  });
  it("keeps note on presses as notes", () => {
    expect(parseMidi(nativeMidiToBytes({ type: "NoteOn", note: 41, velocity: 100 })!)).toMatchObject({ key: "Note 1/41", on: true });
  });
});

describe("iPad CoreMIDI byte stream", () => {
  it("splits a packet with two fader moves into two CC messages", async () => {
    const { splitMidiBytes } = await import("@/lib/midi");
    const msgs = splitMidiBytes([0xb0, 7, 127, 0xb0, 8, 0]).map((b) => parseMidi(b)?.key);
    expect(msgs).toEqual(["CC 1/7", "CC 1/8"]);
  });
});
