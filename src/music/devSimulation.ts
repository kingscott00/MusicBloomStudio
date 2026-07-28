export function devNotesFromSearch(search: string): number[] {
  if (!import.meta.env.DEV) return [];
  const value = new URLSearchParams(search).get("devNotes");
  if (!value) return [];
  return [
    ...new Set(
      value
        .split(",")
        .map(Number)
        .filter((note) => Number.isInteger(note) && note >= 0 && note <= 127),
    ),
  ].slice(0, 10);
}
