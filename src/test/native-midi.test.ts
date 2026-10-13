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
