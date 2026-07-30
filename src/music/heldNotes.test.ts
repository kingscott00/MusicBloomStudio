import { describe, expect, it } from "vitest";
import {
  applyNoteEvent,
  applySustain,
  createHeldNoteState,
  releaseSource,
  sustainSourcesActive,
} from "./heldNotes";
import type { NoteEvent } from "../types";

const event = (
  type: NoteEvent["type"],
  note = 60,
  source: NoteEvent["source"] = "midi",
  timestamp = 10,
): NoteEvent => ({
  type,
  note,
  velocity: type === "noteon" ? 90 : 0,
  channel: 0,
  source,
  timestamp,
});

describe("held note state", () => {
  it("adds and removes ordinary notes", () => {
    const on = applyNoteEvent(createHeldNoteState(), event("noteon"));
    expect(on.notes.get(60)?.physicallyHeld).toBe(true);
    const off = applyNoteEvent(on, event("noteoff", 60, "midi", 60));
    expect(off.notes.size).toBe(0);
    expect(off.releases[0]).toMatchObject({
      note: 60,
      startedAt: 10,
      releasedAt: 60,
    });
  });

  it("holds released notes while sustain is down and clears them when lifted", () => {
    const on = applyNoteEvent(createHeldNoteState(), event("noteon"));
    const pedal = applySustain(on, true);
    const released = applyNoteEvent(pedal, event("noteoff"));
    expect(released.notes.get(60)).toMatchObject({
      physicallyHeld: false,
      sustained: true,
    });
    const pedalUp = applySustain(released, false, 200);
    expect(pedalUp.notes.size).toBe(0);
    expect(pedalUp.releases[0]).toMatchObject({
      releasedAt: 200,
      releasedFromSustain: true,
    });
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

  it("releasing one chord tone preserves the remaining notes", () => {
    let state = createHeldNoteState();
    for (const note of [59, 63, 66])
      state = applyNoteEvent(state, event("noteon", note));
    state = applyNoteEvent(state, event("noteoff", 63, "midi", 80));

    expect([...state.notes.keys()]).toEqual([59, 66]);
    expect(state.releases.at(-1)?.note).toBe(63);
  });

  it("keeps sustain active while either the MIDI pedal or Spacebar is down", () => {
    expect(sustainSourcesActive(false, false)).toBe(false);
    expect(sustainSourcesActive(true, false)).toBe(true);
    expect(sustainSourcesActive(false, true)).toBe(true);
    expect(sustainSourcesActive(true, true)).toBe(true);
  });
});
