const SHARPS = [
  "C",
  "C♯",
  "D",
  "D♯",
  "E",
  "F",
  "F♯",
  "G",
  "G♯",
  "A",
  "A♯",
  "B",
];
const FLATS = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"];

export function noteName(
  note: number,
  preferFlats = false,
  includeOctave = true,
): string {
  const normalized = Math.max(0, Math.min(127, Math.round(note)));
  const names = preferFlats ? FLATS : SHARPS;
  const name = names[normalized % 12];
  return includeOctave ? `${name}${Math.floor(normalized / 12) - 1}` : name;
}

export function pitchClassName(
  pitchClass: number,
  preferFlats = false,
): string {
  return (preferFlats ? FLATS : SHARPS)[((pitchClass % 12) + 12) % 12];
}
