import { describe, expect, it } from "vitest";
import type { NoteEvent } from "../types";
import { applyNoteEvent, applySustain, createHeldNoteState } from "./heldNotes";
import { calculateVisualVoices, createNoteLifecycles } from "./envelopes";

const noteEvent = (type: NoteEvent["type"], timestamp: number): NoteEvent => ({
  type,
  note: 59,
  velocity: type === "noteon" ? 100 : 0,
  channel: 0,
  source: "midi",
  timestamp,
});

describe("per-note visual envelopes", () => {
  it("distinguishes a 50 ms tap from a two-second held note", () => {
    let tap = applyNoteEvent(createHeldNoteState(), noteEvent("noteon", 0));
    tap = applyNoteEvent(tap, noteEvent("noteoff", 50));
    const tapVoice = calculateVisualVoices(
      createNoteLifecycles([...tap.notes.values()], tap.releases, 2000),
      2000,
    )[0];

    const held = applyNoteEvent(createHeldNoteState(), noteEvent("noteon", 0));
    const heldVoice = calculateVisualVoices(
      createNoteLifecycles([...held.notes.values()], held.releases, 2000),
      2000,
    )[0];

    expect(tapVoice.phase).toBe("release");
    expect(heldVoice.phase).toBe("held");
    expect(heldVoice.heldDuration).toBe(2000);
    expect(heldVoice.hold).toBeGreaterThan(tapVoice.release);
  });

  it("does not begin release decay until sustain is lifted", () => {
    let state = applyNoteEvent(createHeldNoteState(), noteEvent("noteon", 0));
    state = applySustain(state, true, 20);
    state = applyNoteEvent(state, noteEvent("noteoff", 100));
    const sustained = calculateVisualVoices(
      createNoteLifecycles([...state.notes.values()], state.releases, 1000),
      1000,
    )[0];

    expect(sustained.phase).toBe("sustain");
    expect(state.releases).toHaveLength(0);

    state = applySustain(state, false, 1100);
    const released = calculateVisualVoices(
      createNoteLifecycles([...state.notes.values()], state.releases, 1200),
      1200,
    )[0];

    expect(released.phase).toBe("release");
    expect(released.release).toBeGreaterThan(0.5);
  });

  it("adds a chord tone without replacing existing visual voices", () => {
    let state = createHeldNoteState();
    for (const note of [59, 66]) {
      state = applyNoteEvent(state, {
        ...noteEvent("noteon", note),
        note,
      });
    }
    const dyad = calculateVisualVoices(
      createNoteLifecycles([...state.notes.values()], state.releases, 100),
      100,
    );
    state = applyNoteEvent(state, {
      ...noteEvent("noteon", 150),
      note: 63,
    });
    const triad = calculateVisualVoices(
      createNoteLifecycles([...state.notes.values()], state.releases, 200),
      200,
    );

    expect(dyad.map((voice) => voice.note)).toEqual([59, 66]);
    expect(triad.map((voice) => voice.note)).toEqual([59, 66, 63]);
    expect(triad.map((voice) => voice.id)).toEqual(
      expect.arrayContaining(dyad.map((voice) => voice.id)),
    );
  });
});
