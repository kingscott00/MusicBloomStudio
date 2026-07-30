import type { NoteEvent } from "../types";

export type ParsedMidiMessage =
  | { kind: "note"; event: NoteEvent }
  | {
      kind: "sustain";
      down: boolean;
      value: number;
      channel: number;
      controller: 64;
    }
  | { kind: "control"; controller: number; value: number; channel: number }
  | { kind: "pitchbend"; value: number; channel: number }
  | { kind: "pressure"; value: number; channel: number }
  | { kind: "other" };

export function parseMidiMessage(
  data: ArrayLike<number>,
  timestamp = performance.now(),
): ParsedMidiMessage {
  const status = data[0] ?? 0;
  const command = status & 0xf0;
  const channel = status & 0x0f;
  const note = Math.max(0, Math.min(127, data[1] ?? 0));
  const velocity = Math.max(0, Math.min(127, data[2] ?? 0));

  if (command === 0x90) {
    return {
      kind: "note",
      event: {
        type: velocity === 0 ? "noteoff" : "noteon",
        note,
        velocity,
        channel,
        source: "midi",
        timestamp,
      },
    };
  }
  if (command === 0x80) {
    return {
      kind: "note",
      event: {
        type: "noteoff",
        note,
        velocity,
        channel,
        source: "midi",
        timestamp,
      },
    };
  }
  if (command === 0xb0 && note === 64) {
    return {
      kind: "sustain",
      down: velocity >= 64,
      value: velocity,
      channel,
      controller: 64,
    };
  }
  if (command === 0xb0)
    return { kind: "control", controller: note, value: velocity, channel };
  if (command === 0xe0)
    return {
      kind: "pitchbend",
      value: note | (velocity << 7),
      channel,
    };
  if (command === 0xd0) return { kind: "pressure", value: note, channel };
  return { kind: "other" };
}

export function isEligibleLearnMessage(message: ParsedMidiMessage): boolean {
  return (
    message.kind === "control" ||
    message.kind === "sustain" ||
    message.kind === "pitchbend" ||
    message.kind === "pressure"
  );
}
