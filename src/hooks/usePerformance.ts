import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MusicalAnalyzer } from "../music/analyze";
import { detectChord } from "../music/chords";
import {
  applyNoteEvent,
  applySustain,
  createHeldNoteState,
  releaseSource,
} from "../music/heldNotes";
import type { DetectedChord, NoteEvent, NoteSource } from "../types";

export function usePerformance(preferFlats: boolean) {
  const [heldState, setHeldState] = useState(createHeldNoteState);
  const [stableChord, setStableChord] = useState<DetectedChord>(() =>
    detectChord([]),
  );
  const analyzer = useRef(new MusicalAnalyzer());

  const sendEvent = useCallback((event: NoteEvent) => {
    if (event.type === "noteon" && event.velocity > 0)
      analyzer.current.registerOnset(event.note, event.timestamp);
    setHeldState((state) => applyNoteEvent(state, event));
  }, []);

  const noteOn = useCallback(
    (note: number, velocity = 92, source: NoteSource = "screen") =>
      sendEvent({
        type: "noteon",
        note,
        velocity,
        channel: 0,
        source,
        timestamp: performance.now(),
      }),
    [sendEvent],
  );
  const noteOff = useCallback(
    (note: number, source: NoteSource = "screen") =>
      sendEvent({
        type: "noteoff",
        note,
        velocity: 0,
        channel: 0,
        source,
        timestamp: performance.now(),
      }),
    [sendEvent],
  );
  const sustain = useCallback(
    (down: boolean) => setHeldState((state) => applySustain(state, down)),
    [],
  );
  const clearSource = useCallback(
    (source: NoteSource) =>
      setHeldState((state) => releaseSource(state, source)),
    [],
  );
  const clearAll = useCallback(() => setHeldState(createHeldNoteState()), []);

  const notes = useMemo(
    () => [...heldState.notes.values()].sort((a, b) => a.note - b.note),
    [heldState.notes],
  );

  useEffect(() => {
    const timer = window.setTimeout(
      () => setStableChord(detectChord(notes, preferFlats)),
      85,
    );
    return () => window.clearTimeout(timer);
  }, [notes, preferFlats]);

  const music = useMemo(
    () => ({
      ...analyzer.current.analyze(
        notes,
        heldState.sustain,
        performance.now(),
        preferFlats,
      ),
      chord: stableChord,
    }),
    [notes, heldState.sustain, preferFlats, stableChord],
  );

  return { music, noteOn, noteOff, sustain, sendEvent, clearSource, clearAll };
}
