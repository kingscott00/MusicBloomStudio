export interface DevSimulation {
  notes: number[];
  duration: number | null;
  sustain: boolean;
  pedalUp: number | null;
}

function boundedMilliseconds(value: string | null): number | null {
  if (value === null) return null;
  const milliseconds = Number(value);
  if (!Number.isFinite(milliseconds)) return null;
  return Math.round(Math.min(12_000, Math.max(20, milliseconds)));
}

export function devSimulationFromSearch(search: string): DevSimulation {
  if (!import.meta.env.DEV)
    return { notes: [], duration: null, sustain: false, pedalUp: null };
  const params = new URLSearchParams(search);
  const value = params.get("devNotes");
  const notes = value
    ? [
        ...new Set(
          value
            .split(",")
            .map(Number)
            .filter(
              (note) => Number.isInteger(note) && note >= 0 && note <= 127,
            ),
        ),
      ].slice(0, 10)
    : [];
  return {
    notes,
    duration: boundedMilliseconds(params.get("devDuration")),
    sustain: params.get("devSustain") === "1",
    pedalUp: boundedMilliseconds(params.get("devPedalUp")),
  };
}

export function devNotesFromSearch(search: string): number[] {
  return devSimulationFromSearch(search).notes;
}
