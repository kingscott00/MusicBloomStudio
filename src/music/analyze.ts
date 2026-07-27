import type { ChordQuality, HeldNote, MusicalState } from "../types";
import { detectChord } from "./chords";
import { clamp } from "../utils/math";

const qualityTension: Partial<Record<ChordQuality, number>> = {
  major: 0.12,
  minor: 0.28,
  diminished: 0.9,
  augmented: 0.78,
  sus2: 0.44,
  sus4: 0.5,
  major7: 0.35,
  dominant7: 0.58,
  minor7: 0.42,
  minorMajor7: 0.72,
  major9: 0.34,
  minor9: 0.46,
  power: 0.18,
  collection: 0.65,
};

export class MusicalAnalyzer {
  private recentOnsets: number[] = [];
  private previousNote: number | null = null;
  private lastOnset = 0;
  private sequence = 0;

  registerOnset(note: number, timestamp: number): void {
    this.recentOnsets.push(timestamp);
    this.recentOnsets = this.recentOnsets.filter(
      (time) => timestamp - time < 4000,
    );
    this.previousNote = this.previousNote === null ? note : this.previousNote;
    this.sequence += 1;
  }

  analyze(
    notes: HeldNote[],
    sustain: boolean,
    now: number,
    preferFlats: boolean,
  ): MusicalState {
    const currentChord = detectChord(notes, preferFlats);
    const velocities = notes.map((note) => note.velocity);
    const averageVelocity = velocities.length
      ? velocities.reduce((a, b) => a + b, 0) / velocities.length
      : 0;
    const averageRegister = notes.length
      ? notes.reduce((sum, note) => sum + note.note, 0) / notes.length / 127
      : 0.5;
    const lastNote = notes.length ? notes[notes.length - 1].note : null;
    const lastInterval =
      lastNote === null || this.previousNote === null
        ? 0
        : lastNote - this.previousNote;
    const timeBetweenNotes = this.lastOnset ? now - this.lastOnset : 1000;
    if (lastNote !== null) {
      this.previousNote = lastNote;
      this.lastOnset = now;
    }
    const recent = this.recentOnsets.filter((time) => now - time < 2000);
    const noteDensity = clamp(recent.length / 12, 0, 1);
    const rhythmicActivity = clamp(
      recent.length / 8 + Math.max(0, 1 - timeBetweenNotes / 800) * 0.3,
      0,
      1,
    );
    const tension =
      qualityTension[currentChord.quality] ??
      intervalTension(currentChord.pitchClasses);
    const energy = clamp(
      0.12 +
        (averageVelocity / 127) * 0.45 +
        noteDensity * 0.3 +
        notes.length * 0.045,
      0,
      1,
    );

    return {
      notes,
      chord: currentChord,
      sustain,
      averageVelocity,
      noteDensity,
      rhythmicActivity,
      averageRegister,
      tension,
      lastInterval,
      timeBetweenNotes,
      energy,
      sequence: this.sequence,
      lastNote,
    };
  }
}

function intervalTension(pitchClasses: number[]): number {
  let tension = 0;
  let pairs = 0;
  for (let i = 0; i < pitchClasses.length; i += 1) {
    for (let j = i + 1; j < pitchClasses.length; j += 1) {
      const interval = Math.min(
        (pitchClasses[j] - pitchClasses[i] + 12) % 12,
        (pitchClasses[i] - pitchClasses[j] + 12) % 12,
      );
      tension += [1, 2, 6].includes(interval)
        ? 0.9
        : [3, 4, 5, 7].includes(interval)
          ? 0.2
          : 0.5;
      pairs += 1;
    }
  }
  return pairs ? clamp(tension / pairs, 0, 1) : 0.1;
}
