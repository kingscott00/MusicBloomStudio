import type {
  HeldNote,
  NoteLifecycle,
  ReleasedNote,
  VisualNoteVoice,
} from "../types";
import { clamp } from "../utils/math";

const RELEASE_HISTORY_MS = 5200;

export function createNoteLifecycles(
  notes: HeldNote[],
  releases: ReleasedNote[],
  now: number,
): NoteLifecycle[] {
  const active = notes.map<NoteLifecycle>((note) => ({
    id: voiceId(note.note, note.startedAt, note.source),
    note: note.note,
    velocity: note.velocity,
    startedAt: note.startedAt,
    releasedAt: null,
    physicallyHeld: note.physicallyHeld,
    sustained: note.sustained,
    releasedFromSustain: false,
  }));
  const recentReleases = releases
    .filter((note) => now - note.releasedAt < RELEASE_HISTORY_MS)
    .map<NoteLifecycle>((note) => ({
      id: voiceId(note.note, note.startedAt, note.source),
      note: note.note,
      velocity: note.velocity,
      startedAt: note.startedAt,
      releasedAt: note.releasedAt,
      physicallyHeld: false,
      sustained: false,
      releasedFromSustain: note.releasedFromSustain,
    }));
  return [...recentReleases, ...active];
}

export function calculateVisualVoices(
  lifecycles: NoteLifecycle[],
  now: number,
): VisualNoteVoice[] {
  return lifecycles
    .map((note) => calculateVoice(note, now))
    .filter((voice) => voice.energy > 0.008);
}

function calculateVoice(note: NoteLifecycle, now: number): VisualNoteVoice {
  const velocity =
    0.22 + Math.pow(clamp(note.velocity / 127, 0, 1), 0.72) * 0.78;
  const age = Math.max(0, now - note.startedAt);
  const heldDuration = Math.max(
    0,
    (note.releasedAt === null ? now : note.releasedAt) - note.startedAt,
  );
  const attack = note.releasedAt === null ? Math.exp(-age / 170) * velocity : 0;
  const maturedHold =
    velocity * (0.42 + (1 - Math.exp(-heldDuration / 1100)) * 0.58);

  if (note.releasedAt !== null) {
    const releaseAge = Math.max(0, now - note.releasedAt);
    const durationDepth = 0.32 + clamp(heldDuration / 2000, 0, 1) * 0.68;
    const timeConstant = note.releasedFromSustain
      ? 1900
      : 720 + durationDepth * 520;
    const release = Math.exp(-releaseAge / timeConstant) * maturedHold;
    return {
      id: note.id,
      note: note.note,
      velocity: note.velocity,
      phase: "release",
      age,
      heldDuration,
      attack: 0,
      hold: 0,
      release,
      sustain: 0,
      energy: release,
    };
  }

  if (note.sustained) {
    const sustain = maturedHold * (0.72 + Math.sin(age * 0.0017) * 0.05);
    return {
      id: note.id,
      note: note.note,
      velocity: note.velocity,
      phase: "sustain",
      age,
      heldDuration,
      attack,
      hold: maturedHold * 0.38,
      release: 0,
      sustain,
      energy: Math.max(attack, sustain),
    };
  }

  const hold = maturedHold * (0.9 + Math.sin(age * 0.0019) * 0.04);
  return {
    id: note.id,
    note: note.note,
    velocity: note.velocity,
    phase: age < 190 ? "attack" : "held",
    age,
    heldDuration,
    attack,
    hold,
    release: 0,
    sustain: 0,
    energy: Math.max(attack, hold),
  };
}

function voiceId(note: number, startedAt: number, source: string): string {
  return `${source}:${note}:${startedAt}`;
}
