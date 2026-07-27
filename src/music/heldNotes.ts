import type { HeldNote, NoteEvent } from "../types";

export interface HeldNoteState {
  notes: Map<number, HeldNote>;
  sustain: boolean;
}

export function createHeldNoteState(): HeldNoteState {
  return { notes: new Map(), sustain: false };
}

export function applyNoteEvent(
  state: HeldNoteState,
  event: NoteEvent,
): HeldNoteState {
  const notes = new Map(state.notes);
  if (event.type === "noteon" && event.velocity > 0) {
    notes.set(event.note, {
      note: event.note,
      velocity: event.velocity,
      startedAt: event.timestamp,
      source: event.source,
      physicallyHeld: true,
      sustained: false,
    });
  } else {
    const existing = notes.get(event.note);
    if (existing && state.sustain) {
      notes.set(event.note, {
        ...existing,
        physicallyHeld: false,
        sustained: true,
      });
    } else {
      notes.delete(event.note);
    }
  }
  return { ...state, notes };
}

export function applySustain(
  state: HeldNoteState,
  down: boolean,
): HeldNoteState {
  if (down) return { ...state, sustain: true };
  const notes = new Map(state.notes);
  for (const [note, held] of notes) {
    if (!held.physicallyHeld) notes.delete(note);
  }
  return { notes, sustain: false };
}

export function releaseSource(
  state: HeldNoteState,
  source: HeldNote["source"],
): HeldNoteState {
  const notes = new Map(state.notes);
  for (const [note, held] of notes) {
    if (held.source === source) notes.delete(note);
  }
  return { ...state, notes };
}
