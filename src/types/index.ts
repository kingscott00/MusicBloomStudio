export type NoteSource = "midi" | "screen" | "computer";

export interface NoteEvent {
  type: "noteon" | "noteoff";
  note: number;
  velocity: number;
  channel: number;
  source: NoteSource;
  timestamp: number;
}

export interface HeldNote {
  note: number;
  velocity: number;
  startedAt: number;
  source: NoteSource;
  physicallyHeld: boolean;
  sustained: boolean;
}

export type ChordQuality =
  | "major"
  | "minor"
  | "diminished"
  | "augmented"
  | "sus2"
  | "sus4"
  | "major7"
  | "dominant7"
  | "minor7"
  | "minorMajor7"
  | "major6"
  | "minor6"
  | "add9"
  | "major9"
  | "minor9"
  | "power"
  | "collection"
  | "none";

export interface DetectedChord {
  root: number | null;
  quality: ChordQuality;
  label: string;
  inversion: number | null;
  pitchClasses: number[];
}

export interface MusicalState {
  notes: HeldNote[];
  chord: DetectedChord;
  sustain: boolean;
  averageVelocity: number;
  noteDensity: number;
  rhythmicActivity: number;
  averageRegister: number;
  tension: number;
  lastInterval: number;
  timeBetweenNotes: number;
  energy: number;
  sequence: number;
  lastNote: number | null;
}

export type VisualMode = "bloom" | "orbit" | "ribbons" | "constellation";

export interface VisualParameters {
  mode: VisualMode;
  paletteId: string;
  density: number;
  speed: number;
  rotation: number;
  symmetry: number;
  trails: number;
  glow: number;
  bloom: number;
  responsiveness: number;
  background: number;
  autoMotion: boolean;
  idle: number;
  reducedMotion: boolean;
}

export interface ColorPalette {
  id: string;
  name: string;
  colors: string[];
  background: string;
}

export interface Preset {
  id: string;
  name: string;
  builtIn: boolean;
  params: VisualParameters;
}

export type MidiStatus =
  | "idle"
  | "requesting"
  | "connected"
  | "disconnected"
  | "denied"
  | "unsupported";

export interface MidiDevice {
  id: string;
  name: string;
  manufacturer: string;
  state: "connected" | "disconnected";
}

export interface VisualGenerator {
  readonly mode: VisualMode;
  render(context: CanvasRenderingContext2D, frame: VisualFrame): void;
  noteTriggered(note: HeldNote, state: MusicalState): void;
  reset(width: number, height: number): void;
}

export interface VisualFrame {
  width: number;
  height: number;
  time: number;
  delta: number;
  params: VisualParameters;
  music: MusicalState;
  colors: string[];
  background: string;
}
