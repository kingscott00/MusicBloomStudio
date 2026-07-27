import { useEffect, useMemo, useRef } from "react";
import type { MusicalState } from "../types";

interface PianoKeyboardProps {
  music: MusicalState;
  onNoteOn: (
    note: number,
    velocity?: number,
    source?: "screen" | "computer",
  ) => void;
  onNoteOff: (note: number, source?: "screen" | "computer") => void;
}

const START = 48;
const END = 72;
const BLACK = new Set([1, 3, 6, 8, 10]);
const COMPUTER_KEYS: Record<string, number> = {
  a: 60,
  w: 61,
  s: 62,
  e: 63,
  d: 64,
  f: 65,
  t: 66,
  g: 67,
  y: 68,
  h: 69,
  u: 70,
  j: 71,
  k: 72,
};
const NOTE_KEYS = Object.fromEntries(
  Object.entries(COMPUTER_KEYS).map(([key, note]) => [note, key.toUpperCase()]),
);

export function PianoKeyboard({
  music,
  onNoteOn,
  onNoteOff,
}: PianoKeyboardProps) {
  const pressed = useRef(new Set<string>());
  const active = useMemo(
    () => new Set(music.notes.map((note) => note.note)),
    [music.notes],
  );
  const whiteNotes = useMemo(
    () =>
      Array.from(
        { length: END - START + 1 },
        (_, index) => START + index,
      ).filter((note) => !BLACK.has(note % 12)),
    [],
  );
  const blackNotes = useMemo(
    () =>
      Array.from(
        { length: END - START + 1 },
        (_, index) => START + index,
      ).filter((note) => BLACK.has(note % 12)),
    [],
  );

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        target.matches("input, select, textarea, button") ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      )
        return;
      const key = event.key.toLowerCase();
      const note = COMPUTER_KEYS[key];
      if (note === undefined || event.repeat || pressed.current.has(key))
        return;
      event.preventDefault();
      pressed.current.add(key);
      onNoteOn(note, 92, "computer");
    };
    const keyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const note = COMPUTER_KEYS[key];
      if (note === undefined) return;
      pressed.current.delete(key);
      onNoteOff(note, "computer");
    };
    const releaseAll = () => {
      for (const key of pressed.current)
        onNoteOff(COMPUTER_KEYS[key], "computer");
      pressed.current.clear();
    };
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    window.addEventListener("blur", releaseAll);
    return () => {
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("blur", releaseAll);
    };
  }, [onNoteOn, onNoteOff]);

  const pointerDown = (
    note: number,
    event: React.PointerEvent<HTMLButtonElement>,
  ) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    onNoteOn(note, 96, "screen");
  };
  const pointerUp = (
    note: number,
    event: React.PointerEvent<HTMLButtonElement>,
  ) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    onNoteOff(note, "screen");
  };

  return (
    <section
      className="keyboard-panel glass-card"
      aria-labelledby="keyboard-heading"
    >
      <div className="keyboard-title">
        <div>
          <span className="eyebrow">PLAY WITHOUT MIDI</span>
          <h2 id="keyboard-heading">Studio piano</h2>
        </div>
        <span className="keyboard-hint">Computer keys A–K</span>
      </div>
      <div className="piano" role="group" aria-label="On-screen piano keyboard">
        <div className="white-keys">
          {whiteNotes.map((note) => (
            <button
              className={`piano-key white ${active.has(note) ? "active" : ""}`}
              key={note}
              aria-label={`MIDI note ${note}`}
              onPointerDown={(event) => pointerDown(note, event)}
              onPointerUp={(event) => pointerUp(note, event)}
              onPointerCancel={(event) => pointerUp(note, event)}
              onContextMenu={(event) => event.preventDefault()}
            >
              {NOTE_KEYS[note] && <span>{NOTE_KEYS[note]}</span>}
            </button>
          ))}
        </div>
        {blackNotes.map((note) => {
          const whiteBefore = Array.from(
            { length: note - START + 1 },
            (_, index) => START + index,
          ).filter((value) => !BLACK.has(value % 12)).length;
          const position = (whiteBefore / whiteNotes.length) * 100;
          return (
            <button
              className={`piano-key black ${active.has(note) ? "active" : ""}`}
              style={{ left: `${position}%` }}
              key={note}
              aria-label={`MIDI note ${note}`}
              onPointerDown={(event) => pointerDown(note, event)}
              onPointerUp={(event) => pointerUp(note, event)}
              onPointerCancel={(event) => pointerUp(note, event)}
              onContextMenu={(event) => event.preventDefault()}
            >
              {NOTE_KEYS[note] && <span>{NOTE_KEYS[note]}</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}
