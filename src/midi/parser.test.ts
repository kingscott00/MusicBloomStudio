import { describe, expect, it } from "vitest";
import { isEligibleLearnMessage, parseMidiMessage } from "./parser";

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
      controller: 64,
    });
    expect(parseMidiMessage([0xb0, 64, 20], 3)).toEqual({
      kind: "sustain",
      down: false,
      value: 20,
      channel: 0,
      controller: 64,
    });
  });

  it("parses CC, pitch bend, and channel pressure", () => {
    expect(parseMidiMessage([0xb3, 1, 99])).toMatchObject({
      kind: "control",
      controller: 1,
      value: 99,
      channel: 3,
    });
    expect(parseMidiMessage([0xe2, 0, 64])).toEqual({
      kind: "pitchbend",
      value: 8192,
      channel: 2,
    });
    expect(parseMidiMessage([0xd4, 88])).toEqual({
      kind: "pressure",
      value: 88,
      channel: 4,
    });
  });

  it("accepts control gestures for Learn and ignores musical notes", () => {
    expect(isEligibleLearnMessage(parseMidiMessage([0xb0, 74, 50]))).toBe(true);
    expect(isEligibleLearnMessage(parseMidiMessage([0xe0, 0, 64]))).toBe(true);
    expect(isEligibleLearnMessage(parseMidiMessage([0xd0, 72]))).toBe(true);
    expect(isEligibleLearnMessage(parseMidiMessage([0x90, 60, 90]))).toBe(
      false,
    );
    expect(isEligibleLearnMessage(parseMidiMessage([0x80, 60, 0]))).toBe(false);
  });
});
