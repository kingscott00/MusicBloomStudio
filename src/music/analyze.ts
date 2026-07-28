import type {
  ChordQuality,
  HeldNote,
  MusicalNoteImpulse,
  MusicalState,
} from "../types";
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
  private recentOnsets: MusicalNoteImpulse[] = [];
  private recentReleases: Array<{ note: number; timestamp: number }> = [];
  private previousNote: number | null = null;
  private lastOnset = 0;
  private lastIntervalValue = 0;
  private lastTimeBetween = 1000;
  private sequence = 0;
  private chordLabel = "Listening";
  private chordChangedAt = 0;

  registerOnset(note: number, velocity: number, timestamp: number): void {
    this.sequence += 1;
    this.lastIntervalValue =
      this.previousNote === null ? 0 : note - this.previousNote;
    this.lastTimeBetween = this.lastOnset ? timestamp - this.lastOnset : 1000;
    this.previousNote = note;
    this.lastOnset = timestamp;
    this.recentOnsets.push({
      sequence: this.sequence,
      note,
      velocity,
      timestamp,
    });
    this.recentOnsets = this.recentOnsets.filter(
      (event) => timestamp - event.timestamp < 6000,
    );
  }

  registerRelease(note: number, timestamp: number): void {
    this.recentReleases.push({ note, timestamp });
    this.recentReleases = this.recentReleases.filter(
      (event) => timestamp - event.timestamp < 3000,
    );
  }

  reset(): void {
    this.recentOnsets = [];
    this.recentReleases = [];
    this.previousNote = null;
    this.lastOnset = 0;
    this.lastIntervalValue = 0;
    this.lastTimeBetween = 1000;
    this.sequence += 1;
  }

  analyze(
    notes: HeldNote[],
    sustain: boolean,
    now: number,
    preferFlats: boolean,
  ): MusicalState {
    const currentChord = detectChord(notes, preferFlats);
    if (currentChord.label !== this.chordLabel) {
      this.chordLabel = currentChord.label;
      this.chordChangedAt = now;
    }
    const recentNotes = this.recentOnsets.filter(
      (event) => now - event.timestamp < 4000,
    );
    const recentReleases = this.recentReleases.filter(
      (event) => now - event.timestamp < 2200,
    );
    const velocities = notes.map((note) => note.velocity);
    const averageVelocity = velocities.length
      ? velocities.reduce((a, b) => a + b, 0) / velocities.length
      : 0;
    const averageRegister = notes.length
      ? notes.reduce((sum, note) => sum + note.note, 0) / notes.length / 127
      : 0.5;
    const lastAttack = recentNotes[recentNotes.length - 1] ?? null;
    const lastNote = lastAttack?.note ?? null;
    const rollingAverageVelocity = recentNotes.length
      ? recentNotes.reduce((sum, event) => {
          const weight = Math.exp(-(now - event.timestamp) / 2400);
          return sum + event.velocity * weight;
        }, 0) /
        recentNotes.reduce(
          (sum, event) => sum + Math.exp(-(now - event.timestamp) / 2400),
          0,
        )
      : 0;
    const eventsInTwoSeconds = recentNotes.filter(
      (event) => now - event.timestamp < 2000,
    );
    const noteDensity = clamp(eventsInTwoSeconds.length / 11, 0, 1);
    const weightedRhythm = eventsInTwoSeconds.reduce(
      (sum, event) => sum + Math.exp(-(now - event.timestamp) / 700),
      0,
    );
    const rhythmicActivity = clamp(
      weightedRhythm / 5 + Math.max(0, 1 - this.lastTimeBetween / 650) * 0.28,
      0,
      1,
    );
    const tension =
      qualityTension[currentChord.quality] ??
      intervalTension(currentChord.pitchClasses);
    const heldEnergy = clamp(
      notes.reduce((sum, note) => sum + note.velocity / 127, 0) /
        Math.max(1, Math.sqrt(notes.length)),
      0,
      1,
    );
    const sustainEnergy = clamp(
      notes
        .filter((note) => note.sustained)
        .reduce((sum, note) => sum + note.velocity / 127, 0) /
        Math.max(1, notes.length),
      0,
      1,
    );
    const releaseEnergy = clamp(
      recentReleases.reduce(
        (sum, event) => sum + Math.exp(-(now - event.timestamp) / 650),
        0,
      ) / 3,
      0,
      1,
    );
    const attackImpulse = lastAttack
      ? clamp(
          (lastAttack.velocity / 127) *
            Math.exp(-(now - lastAttack.timestamp) / 190),
          0,
          1,
        )
      : 0;
    const energy = clamp(
      0.1 +
        heldEnergy * 0.42 +
        (rollingAverageVelocity / 127) * 0.18 +
        noteDensity * 0.2 +
        rhythmicActivity * 0.16 +
        sustainEnergy * 0.1,
      0,
      1,
    );
    const chordStability = clamp((now - this.chordChangedAt) / 900, 0, 1);

    return {
      notes,
      chord: currentChord,
      sustain,
      averageVelocity,
      rollingAverageVelocity,
      noteDensity,
      rhythmicActivity,
      averageRegister,
      tension,
      lastInterval: this.lastIntervalValue,
      timeBetweenNotes: this.lastTimeBetween,
      energy,
      attackImpulse,
      heldEnergy,
      releaseEnergy,
      lastReleaseAt: recentReleases[recentReleases.length - 1]?.timestamp ?? 0,
      sustainEnergy,
      chordStability,
      chordChangedAt: this.chordChangedAt,
      sequence: this.sequence,
      lastNote,
      lastAttack,
      recentNotes,
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
