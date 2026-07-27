import { describe, expect, it } from "vitest";
import {
  applyNoteEvent,
  applySustain,
  createHeldNoteState,
  releaseSource,
} from "./heldNotes";
import type { NoteEvent } from "../types";

const event = (
  type: NoteEvent["type"],
  note = 60,
  source: NoteEvent["source"] = "midi",
): NoteEvent => ({
  type,
  note,
  velocity: type === "noteon" ? 90 : 0,
  channel: 0,
  source,
  timestamp: 10,
});

describe("held note state", () => {
  it("adds and removes ordinary notes", () => {
    const on = applyNoteEvent(createHeldNoteState(), event("noteon"));
    expect(on.notes.get(60)?.physicallyHeld).toBe(true);
    expect(applyNoteEvent(on, event("noteoff")).notes.size).toBe(0);
  });

  it("holds released notes while sustain is down and clears them when lifted", () => {
    const on = applyNoteEvent(createHeldNoteState(), event("noteon"));
    const pedal = applySustain(on, true);
    const released = applyNoteEvent(pedal, event("noteoff"));
    expect(released.notes.get(60)).toMatchObject({
      physicallyHeld: false,
      sustained: true,
    });
    expect(applySustain(released, false).notes.size).toBe(0);
  });

  it("clears only notes from a disconnected source", () => {
    let state = applyNoteEvent(
      createHeldNoteState(),
      event("noteon", 60, "midi"),
    );
    state = applyNoteEvent(state, event("noteon", 64, "screen"));
    const cleared = releaseSource(state, "midi");
    expect([...cleared.notes.keys()]).toEqual([64]);
  });
});
