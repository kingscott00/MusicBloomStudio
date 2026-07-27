import type { NoteEvent } from "../types";

export type ParsedMidiMessage =
  | { kind: "note"; event: NoteEvent }
  | { kind: "sustain"; down: boolean; value: number; channel: number }
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
    return { kind: "sustain", down: velocity >= 64, value: velocity, channel };
  }
  return { kind: "other" };
}
