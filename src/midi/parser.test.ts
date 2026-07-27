import { describe, expect, it } from "vitest";
import { parseMidiMessage } from "./parser";

describe("parseMidiMessage", () => {
  it("parses note-on with channel and velocity", () => {
    expect(parseMidiMessage([0x92, 60, 101], 42)).toEqual({
      kind: "note",
      event: {
        type: "noteon",
        note: 60,
        velocity: 101,
        channel: 2,
        source: "midi",
        timestamp: 42,
      },
    });
  });

  it("treats a zero-velocity note-on as note-off", () => {
    const message = parseMidiMessage([0x90, 64, 0], 12);
    expect(message.kind).toBe("note");
    if (message.kind === "note") expect(message.event.type).toBe("noteoff");
  });

  it("parses note-off and sustain controller messages", () => {
    expect(parseMidiMessage([0x80, 67, 45], 3)).toMatchObject({
      kind: "note",
      event: { type: "noteoff", note: 67 },
    });
    expect(parseMidiMessage([0xb0, 64, 127], 3)).toEqual({
      kind: "sustain",
      down: true,
      value: 127,
      channel: 0,
    });
    expect(parseMidiMessage([0xb0, 64, 20], 3)).toEqual({
      kind: "sustain",
      down: false,
      value: 20,
      channel: 0,
    });
  });
});
