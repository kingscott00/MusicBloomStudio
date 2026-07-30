import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MusicalAnalyzer } from "../music/analyze";
import { detectChord } from "../music/chords";
import {
  applyNoteEvent,
  applySustain,
  createHeldNoteState,
  releaseSource,
  sustainSourcesActive,
} from "../music/heldNotes";
import type { DetectedChord, NoteEvent, NoteSource } from "../types";

export function usePerformance(preferFlats: boolean) {
  const [heldState, setHeldState] = useState(createHeldNoteState);
  const [stableChord, setStableChord] = useState<DetectedChord>(() =>
    detectChord([]),
  );
  const analyzer = useRef(new MusicalAnalyzer());
  const physicalSustainRef = useRef(false);
  const simulatedSustainRef = useRef(false);
  const [physicalSustain, setPhysicalSustainState] = useState(false);
  const [simulatedSustain, setSimulatedSustainState] = useState(false);

  const sendEvent = useCallback((event: NoteEvent) => {
    if (event.type === "noteon" && event.velocity > 0)
      analyzer.current.registerOnset(
        event.note,
        event.velocity,
        event.timestamp,
      );
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
  const applyCombinedSustain = useCallback(() => {
    const down = sustainSourcesActive(
      physicalSustainRef.current,
      simulatedSustainRef.current,
    );
    setHeldState((state) => applySustain(state, down, performance.now()));
  }, []);
  const setPhysicalSustain = useCallback(
    (down: boolean) => {
      physicalSustainRef.current = down;
      setPhysicalSustainState(down);
      applyCombinedSustain();
    },
    [applyCombinedSustain],
  );
  const setSimulatedSustain = useCallback(
    (down: boolean) => {
      simulatedSustainRef.current = down;
      setSimulatedSustainState(down);
      applyCombinedSustain();
    },
    [applyCombinedSustain],
  );
  const clearSource = useCallback(
    (source: NoteSource) =>
      setHeldState((state) => releaseSource(state, source, performance.now())),
    [],
  );
  const clearAll = useCallback(() => {
    analyzer.current.reset();
    physicalSustainRef.current = false;
    simulatedSustainRef.current = false;
    setPhysicalSustainState(false);
    setSimulatedSustainState(false);
    setHeldState(createHeldNoteState());
  }, []);

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
        heldState.releases,
        stableChord,
      ),
    }),
    [notes, heldState.sustain, heldState.releases, preferFlats, stableChord],
  );

  return {
    music,
    noteOn,
    noteOff,
    setPhysicalSustain,
    setSimulatedSustain,
    physicalSustain,
    simulatedSustain,
    sendEvent,
    clearSource,
    clearAll,
  };
}
