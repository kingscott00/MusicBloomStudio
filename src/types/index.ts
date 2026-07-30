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

export interface ReleasedNote {
  note: number;
  velocity: number;
  startedAt: number;
  releasedAt: number;
  source: NoteSource;
  releasedFromSustain: boolean;
}

export interface NoteLifecycle {
  id: string;
  note: number;
  velocity: number;
  startedAt: number;
  releasedAt: number | null;
  physicallyHeld: boolean;
  sustained: boolean;
  releasedFromSustain: boolean;
}

export interface MusicalNoteImpulse {
  sequence: number;
  note: number;
  velocity: number;
  timestamp: number;
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
  rollingAverageVelocity: number;
  noteDensity: number;
  rhythmicActivity: number;
  averageRegister: number;
  tension: number;
  lastInterval: number;
  timeBetweenNotes: number;
  energy: number;
  attackImpulse: number;
  heldEnergy: number;
  releaseEnergy: number;
  lastReleaseAt: number;
  sustainEnergy: number;
  chordStability: number;
  chordChangedAt: number;
  sequence: number;
  lastNote: number | null;
  lastAttack: MusicalNoteImpulse | null;
  recentNotes: MusicalNoteImpulse[];
  noteLifecycles: NoteLifecycle[];
}

export type VisualMode =
  | "bloom"
  | "orbit"
  | "ribbons"
  | "constellation"
  | "jellyfish"
  | "geometry"
  | "nebula"
  | "forest"
  | "metal"
  | "portal";
export type RenderQuality = "auto" | "high" | "balanced" | "low";

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
  quality: RenderQuality;
  recipeSeed: number;
}

export interface VisualDynamics {
  attack: number;
  held: number;
  release: number;
  sustain: number;
  rhythm: number;
  velocity: number;
  intensity: number;
  chordStability: number;
}

export interface RenderMetrics {
  fps: number;
  frameCostMs: number;
  activeElements: number;
  qualityScale: number;
  qualityLabel: string;
  heldNotes: number;
  chordRoot: number | null;
  chordQuality: ChordQuality;
  attackEnergy: number;
  heldEnergy: number;
  releaseEnergy: number;
  sustainEnergy: number;
  attackingNotes: number;
  heldPhaseNotes: number;
  sustainedNotes: number;
  releasingNotes: number;
  longestHeldDuration: number;
  simulatedSustain: boolean;
  physicalSustain: boolean;
  activeModulationRoutes: number;
  dualRender: boolean;
  laboratoryFrameCostMs: number;
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
  featured?: boolean;
  params: VisualParameters;
}

export type RandomizerLock =
  | "experience"
  | "palette"
  | "density"
  | "motion"
  | "trails"
  | "glow"
  | "symmetry";

export type RandomizerLocks = Record<RandomizerLock, boolean>;

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

export type MidiControlSource = "cc" | "pitchbend" | "pressure";
export type MidiSmoothing = "none" | "light" | "medium" | "heavy";
export type MidiTakeover = "pickup" | "jump";
export type MidiPitchMode = "permanent" | "momentary";

export interface MidiControlMessage {
  source: MidiControlSource;
  deviceId: string;
  deviceName: string;
  channel: number;
  controller: number | null;
  rawValue: number;
  value: number;
  timestamp: number;
}

export type MidiParameterTarget =
  | "density"
  | "speed"
  | "rotation"
  | "symmetry"
  | "trails"
  | "glow"
  | "bloom"
  | "responsiveness"
  | "background"
  | "idle"
  | "morph"
  | "macro-1"
  | "macro-2"
  | "macro-3"
  | "macro-4"
  | "macro-5"
  | "macro-6"
  | "macro-7"
  | "macro-8";

export type MidiActionTarget =
  | "surprise"
  | "previous-preset"
  | "next-preset"
  | "previous-experience"
  | "next-experience"
  | "reset"
  | "previous-instrument"
  | "next-instrument"
  | "mutate"
  | "load-scene-a"
  | "load-scene-b";

export interface MidiMapping {
  id: string;
  targetType: "parameter" | "action";
  target: MidiParameterTarget | MidiActionTarget;
  deviceId: string;
  deviceName: string;
  source: MidiControlSource;
  channel: number;
  controller: number | null;
  inputMin: number;
  inputMax: number;
  outputMin: number;
  outputMax: number;
  invert: boolean;
  smoothing: MidiSmoothing;
  takeover: MidiTakeover;
  pitchMode: MidiPitchMode;
}

export interface MidiMappingProfile {
  id: string;
  name: string;
  deviceId: string;
  deviceName: string;
  mappings: MidiMapping[];
}

export interface VisualGenerator {
  readonly mode: VisualMode;
  render(context: CanvasRenderingContext2D, frame: VisualFrame): void;
  noteTriggered(note: HeldNote, state: MusicalState): void;
  reset(width: number, height: number): void;
  getActiveCount(): number;
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
  qualityScale: number;
  dynamics: VisualDynamics;
  voices: VisualNoteVoice[];
  advanced: Record<string, number>;
}

export type VisualNotePhase = "attack" | "held" | "sustain" | "release";

export interface VisualNoteVoice {
  id: string;
  note: number;
  velocity: number;
  phase: VisualNotePhase;
  age: number;
  heldDuration: number;
  attack: number;
  hold: number;
  release: number;
  sustain: number;
  energy: number;
  development: number;
  structuralLayer: number;
  releaseProgress: number;
  releaseDepth: number;
}
