import type { HeldNote, NoteEvent, ReleasedNote } from "../types";

export interface HeldNoteState {
  notes: Map<number, HeldNote>;
  sustain: boolean;
  releases: ReleasedNote[];
}

export function createHeldNoteState(): HeldNoteState {
  return { notes: new Map(), sustain: false, releases: [] };
}

export function applyNoteEvent(
  state: HeldNoteState,
  event: NoteEvent,
): HeldNoteState {
  const notes = new Map(state.notes);
  let releases = state.releases;
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
      if (existing)
        releases = appendRelease(releases, existing, event.timestamp);
    }
  }
  return { ...state, notes, releases };
}

export function applySustain(
  state: HeldNoteState,
  down: boolean,
  timestamp = 0,
): HeldNoteState {
  if (down) return { ...state, sustain: true };
  const notes = new Map(state.notes);
  let releases = state.releases;
  for (const [note, held] of notes) {
    if (!held.physicallyHeld) {
      notes.delete(note);
      releases = appendRelease(releases, held, timestamp, true);
    }
  }
  return { notes, sustain: false, releases };
}

export function releaseSource(
  state: HeldNoteState,
  source: HeldNote["source"],
  timestamp = 0,
): HeldNoteState {
  const notes = new Map(state.notes);
  let releases = state.releases;
  for (const [note, held] of notes) {
    if (held.source === source) {
      notes.delete(note);
      releases = appendRelease(releases, held, timestamp);
    }
  }
  return { ...state, notes, releases };
}

function appendRelease(
  releases: ReleasedNote[],
  note: HeldNote,
  releasedAt: number,
  releasedFromSustain = false,
): ReleasedNote[] {
  return [
    ...releases.slice(-31),
    {
      note: note.note,
      velocity: note.velocity,
      startedAt: note.startedAt,
      releasedAt,
      source: note.source,
      releasedFromSustain,
    },
  ];
}
