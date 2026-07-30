import type {
  ColorPalette,
  MidiParameterTarget,
  RandomizerLocks,
  VisualMode,
  VisualParameters,
} from "../types";

export const LAB_STATE_VERSION = 1;
export const MAX_MODULATION_ROUTES = 16;

export type AdvancedValues = Record<string, number>;
export type MacroCurve = "linear" | "ease-in" | "ease-out" | "s-curve";
export type ModulationSource =
  | "lfo-slow"
  | "lfo-medium"
  | "lfo-fast"
  | "random-drift"
  | "velocity"
  | "register"
  | "held-count"
  | "rhythm"
  | "tension"
  | "attack"
  | "held"
  | "release"
  | "sustain";
export type LfoShape = "sine" | "triangle" | "saw" | "square" | "smooth-random";
export type ModulationPolarity = "unipolar" | "bipolar";
export type MutationStrength = "subtle" | "moderate" | "wild";

export interface MusicalResponseSettings {
  velocity: number;
  register: number;
  rhythm: number;
  tension: number;
  attack: number;
  release: number;
}

export interface MacroAssignment {
  id: string;
  target: string;
  min: number;
  max: number;
  invert: boolean;
  curve: MacroCurve;
  weight: number;
}

export interface MacroControl {
  id: string;
  name: string;
  value: number;
  assignments: MacroAssignment[];
}

export interface ModulationRoute {
  id: string;
  enabled: boolean;
  source: ModulationSource;
  shape: LfoShape;
  target: string;
  amount: number;
  polarity: ModulationPolarity;
  smoothing: number;
  min: number;
  max: number;
}

export interface LaboratoryScene {
  version: 1;
  params: VisualParameters;
  advanced: AdvancedValues;
  response: MusicalResponseSettings;
  macros: MacroControl[];
  modulationRoutes: ModulationRoute[];
}

export interface LaboratoryState {
  version: 1;
  sceneA: LaboratoryScene;
  sceneB: LaboratoryScene;
  editScene: "A" | "B";
  morph: number;
  currentAdvanced: AdvancedValues;
  response: MusicalResponseSettings;
  macros: MacroControl[];
  modulationRoutes: ModulationRoute[];
  customPalettes: ColorPalette[];
  mutationSeed: number;
  mutationIndex: number;
  mutationStrength: MutationStrength;
  overlayEnabled: boolean;
}

export interface LaboratoryRenderState {
  enabled: boolean;
  sceneA: LaboratoryScene;
  sceneB: LaboratoryScene;
  morph: number;
  macros: MacroControl[];
  modulationRoutes: ModulationRoute[];
  customPalettes: ColorPalette[];
}

export interface VisualInstrument {
  version: 1;
  id: string;
  name: string;
  builtIn: boolean;
  favorite: boolean;
  modifiedAt: string;
  mood?: string;
  description?: string;
  preferredMidiProfileId?: string;
  state: LaboratoryState;
  randomizerLocks: RandomizerLocks;
}

export interface ResolvedLaboratoryFrame {
  primary: LaboratoryScene;
  secondary: LaboratoryScene | null;
  primaryOpacity: number;
  secondaryOpacity: number;
  dualRender: boolean;
  activeRoutes: number;
  morph: number;
}

export interface HistoryEntry<T> {
  id: number;
  label: string;
  state: T;
  timestamp: number;
  coalesceKey?: string;
}

export interface LaboratoryHistory<T> {
  entries: HistoryEntry<T>[];
  index: number;
  entryState: T;
}

export interface AdvancedControlDefinition {
  id: string;
  label: string;
  description: string;
  group: "Form" | "Motion" | "Light" | "Composition" | "Musical Response";
  defaultValue: number;
}

export type LaboratoryMidiTarget =
  MidiParameterTarget | `macro-${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`;

export type ExperienceAdvancedDefinitions = Record<
  VisualMode,
  AdvancedControlDefinition[]
>;
