import type { ChordQuality, DetectedChord, HeldNote } from "../types";
import { noteName, pitchClassName } from "./notes";

interface ChordPattern {
  intervals: number[];
  quality: ChordQuality;
  suffix: string;
}

// Longer, more descriptive harmonies are evaluated first to avoid classifying Cmaj9 as Cmaj7.
const PATTERNS: ChordPattern[] = [
  { intervals: [0, 4, 7, 11, 2], quality: "major9", suffix: "maj9" },
  { intervals: [0, 3, 7, 10, 2], quality: "minor9", suffix: "m9" },
  { intervals: [0, 4, 7, 11], quality: "major7", suffix: "maj7" },
  { intervals: [0, 4, 7, 10], quality: "dominant7", suffix: "7" },
  { intervals: [0, 3, 7, 10], quality: "minor7", suffix: "m7" },
  { intervals: [0, 3, 7, 11], quality: "minorMajor7", suffix: "m(maj7)" },
  { intervals: [0, 4, 7, 9], quality: "major6", suffix: "6" },
  { intervals: [0, 3, 7, 9], quality: "minor6", suffix: "m6" },
  { intervals: [0, 4, 7, 2], quality: "add9", suffix: "add9" },
  { intervals: [0, 4, 8], quality: "augmented", suffix: "aug" },
  { intervals: [0, 3, 6], quality: "diminished", suffix: "dim" },
  { intervals: [0, 2, 7], quality: "sus2", suffix: "sus2" },
  { intervals: [0, 5, 7], quality: "sus4", suffix: "sus4" },
  { intervals: [0, 4, 7], quality: "major", suffix: "" },
  { intervals: [0, 3, 7], quality: "minor", suffix: "m" },
  { intervals: [0, 7], quality: "power", suffix: "5" },
];

export function detectChord(
  notes: Array<number | HeldNote>,
  preferFlats = false,
): DetectedChord {
  const midiNotes = notes
    .map((item) => (typeof item === "number" ? item : item.note))
    .sort((a, b) => a - b);
  const pitchClasses = [...new Set(midiNotes.map((note) => note % 12))];

  if (pitchClasses.length < 2) {
    return {
      root: null,
      quality: "none",
      label: midiNotes.length
        ? noteName(midiNotes[0], preferFlats)
        : "Listening",
      inversion: null,
      pitchClasses,
    };
  }

  const bass = midiNotes[0] % 12;
  // Ambiguous sets such as C6/Am7 and Csus4/Fsus2 are most naturally
  // named from their bass when the bass is a valid root.
  for (const preferBassRoot of [true, false]) {
    for (const pattern of PATTERNS) {
      if (pattern.intervals.length !== pitchClasses.length) continue;
      for (let root = 0; root < 12; root += 1) {
        if (preferBassRoot !== (root === bass)) continue;
        const expected = pattern.intervals.map(
          (interval) => (root + interval) % 12,
        );
        if (!expected.every((pitch) => pitchClasses.includes(pitch))) continue;
        const inversion = pattern.intervals.findIndex(
          (interval) => (root + interval) % 12 === bass,
        );
        const slash =
          inversion > 0 ? ` / ${pitchClassName(bass, preferFlats)}` : "";
        return {
          root,
          quality: pattern.quality,
          label: `${pitchClassName(root, preferFlats)}${pattern.suffix}${slash}`,
          inversion,
          pitchClasses,
        };
      }
    }
  }

  return {
    root: null,
    quality: "collection",
    label: pitchClasses
      .map((pitch) => pitchClassName(pitch, preferFlats))
      .join(" · "),
    inversion: null,
    pitchClasses,
  };
}
