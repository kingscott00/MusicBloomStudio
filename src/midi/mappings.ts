import type {
  MidiControlMessage,
  MidiMapping,
  MidiMappingProfile,
  MidiParameterTarget,
  MidiSmoothing,
  VisualParameters,
} from "../types";
import { clamp } from "../utils/math";

export const MIDI_MAPPING_STORAGE_KEY = "music-bloom-midi-mappings-v1";

export const parameterDefinitions: Record<
  MidiParameterTarget,
  { label: string; min: number; max: number }
> = {
  density: { label: "Visual density", min: 0, max: 100 },
  speed: { label: "Movement speed", min: 0, max: 100 },
  rotation: { label: "Rotation", min: 0, max: 100 },
  symmetry: { label: "Symmetry", min: 3, max: 14 },
  trails: { label: "Trail length", min: 0, max: 100 },
  glow: { label: "Glow", min: 0, max: 100 },
  bloom: { label: "Bloom strength", min: 0, max: 100 },
  responsiveness: { label: "Responsiveness", min: 0, max: 100 },
  background: { label: "Background light", min: 0, max: 100 },
  idle: { label: "Idle animation", min: 0, max: 100 },
  morph: { label: "Laboratory morph", min: 0, max: 100 },
  "macro-1": { label: "Macro 1", min: 0, max: 100 },
  "macro-2": { label: "Macro 2", min: 0, max: 100 },
  "macro-3": { label: "Macro 3", min: 0, max: 100 },
  "macro-4": { label: "Macro 4", min: 0, max: 100 },
  "macro-5": { label: "Macro 5", min: 0, max: 100 },
  "macro-6": { label: "Macro 6", min: 0, max: 100 },
  "macro-7": { label: "Macro 7", min: 0, max: 100 },
  "macro-8": { label: "Macro 8", min: 0, max: 100 },
};

export interface MappingRuntime {
  captured: boolean;
  lastInput: number | null;
  smoothedValue: number | null;
  momentaryBase: number | null;
}

export interface MappingResult {
  value: number | null;
  waitingForPickup: boolean;
}

export const createMappingRuntime = (): MappingRuntime => ({
  captured: false,
  lastInput: null,
  smoothedValue: null,
  momentaryBase: null,
});

export function messageMatchesMapping(
  mapping: MidiMapping,
  message: MidiControlMessage,
): boolean {
  return (
    mapping.deviceId === message.deviceId &&
    mapping.source === message.source &&
    mapping.channel === message.channel &&
    (mapping.source !== "cc" || mapping.controller === message.controller)
  );
}

export function mappingSignature(
  mapping: Pick<MidiMapping, "deviceId" | "source" | "channel" | "controller">,
): string {
  return [
    mapping.deviceId,
    mapping.source,
    mapping.channel,
    mapping.controller ?? "-",
  ].join(":");
}

export function findMappingConflicts(
  mappings: MidiMapping[],
  candidate: MidiMapping,
): MidiMapping[] {
  const signature = mappingSignature(candidate);
  return mappings.filter(
    (mapping) =>
      mapping.id !== candidate.id && mappingSignature(mapping) === signature,
  );
}

export function scaleMidiValue(
  value: number,
  mapping: Pick<
    MidiMapping,
    "inputMin" | "inputMax" | "outputMin" | "outputMax" | "invert"
  >,
): number {
  const inputSpan = Math.max(1, mapping.inputMax - mapping.inputMin);
  let normalized = clamp((value - mapping.inputMin) / inputSpan, 0, 1);
  if (mapping.invert) normalized = 1 - normalized;
  return (
    mapping.outputMin + normalized * (mapping.outputMax - mapping.outputMin)
  );
}

function smoothingFactor(smoothing: MidiSmoothing): number {
  return { none: 1, light: 0.58, medium: 0.32, heavy: 0.16 }[smoothing];
}

export function applyContinuousMapping(
  mapping: MidiMapping,
  message: MidiControlMessage,
  currentValue: number,
  runtime: MappingRuntime,
): MappingResult {
  const inputValue = clamp(message.value, 0, 127);
  const target = scaleMidiValue(inputValue, mapping);

  if (mapping.source === "pitchbend" && mapping.pitchMode === "momentary") {
    runtime.momentaryBase ??= currentValue;
    const center = 63.5;
    const bipolar = (inputValue - center) / center;
    const span = mapping.outputMax - mapping.outputMin;
    const value = clamp(
      runtime.momentaryBase + bipolar * span * 0.5,
      mapping.outputMin,
      mapping.outputMax,
    );
    runtime.smoothedValue =
      runtime.smoothedValue === null
        ? value
        : runtime.smoothedValue +
          (value - runtime.smoothedValue) * smoothingFactor(mapping.smoothing);
    runtime.lastInput = inputValue;
    return { value: runtime.smoothedValue, waitingForPickup: false };
  }

  if (mapping.takeover === "pickup" && !runtime.captured) {
    const outputSpan = Math.max(1, mapping.outputMax - mapping.outputMin);
    const targetDistance = Math.abs(target - currentValue) / outputSpan;
    const previousTarget =
      runtime.lastInput === null
        ? null
        : scaleMidiValue(runtime.lastInput, mapping);
    const crossed =
      previousTarget !== null &&
      (previousTarget - currentValue) * (target - currentValue) <= 0;
    runtime.lastInput = inputValue;
    if (targetDistance > 0.045 && !crossed)
      return { value: null, waitingForPickup: true };
    runtime.captured = true;
  }

  const previous = runtime.smoothedValue ?? currentValue;
  runtime.smoothedValue =
    previous + (target - previous) * smoothingFactor(mapping.smoothing);
  runtime.lastInput = inputValue;
  return { value: runtime.smoothedValue, waitingForPickup: false };
}

export function resetMappingPickup(runtime: MappingRuntime): void {
  runtime.captured = false;
  runtime.lastInput = null;
  runtime.smoothedValue = null;
  runtime.momentaryBase = null;
}

export function shouldTriggerMidiAction(
  previousValue: number,
  nextValue: number,
): boolean {
  return previousValue < 64 && nextValue >= 64;
}

export function mappingValueForDisplay(
  params: VisualParameters,
  target: MidiParameterTarget,
  laboratoryValues: Partial<Record<MidiParameterTarget, number>> = {},
): number {
  if (target in laboratoryValues) return laboratoryValues[target] ?? 0;
  const value = params[target as keyof VisualParameters];
  return typeof value === "number" ? value : 0;
}

export function loadMappingProfiles(): MidiMappingProfile[] {
  try {
    return validateProfiles(
      JSON.parse(localStorage.getItem(MIDI_MAPPING_STORAGE_KEY) ?? "[]"),
    );
  } catch {
    return [];
  }
}

export function saveMappingProfiles(profiles: MidiMappingProfile[]): void {
  localStorage.setItem(MIDI_MAPPING_STORAGE_KEY, JSON.stringify(profiles));
}

export function exportMappingProfiles(profiles: MidiMappingProfile[]): string {
  return JSON.stringify(
    { version: 1, application: "Music Bloom Studio", profiles },
    null,
    2,
  );
}

export function importMappingProfiles(json: string): MidiMappingProfile[] {
  const parsed = JSON.parse(json) as unknown;
  if (!parsed || typeof parsed !== "object")
    throw new Error("This is not a Music Bloom mapping file.");
  const profiles = (parsed as { profiles?: unknown }).profiles;
  const validated = validateProfiles(profiles);
  if (!validated.length)
    throw new Error("No valid mapping profiles were found.");
  return validated;
}

function validateProfiles(value: unknown): MidiMappingProfile[] {
  if (!Array.isArray(value)) return [];
  const profiles: MidiMappingProfile[] = [];
  for (const profile of value) {
    if (!profile || typeof profile !== "object") continue;
    const item = profile as Partial<MidiMappingProfile>;
    if (
      typeof item.id === "string" &&
      typeof item.name === "string" &&
      typeof item.deviceId === "string" &&
      typeof item.deviceName === "string" &&
      Array.isArray(item.mappings)
    )
      profiles.push({
        id: item.id,
        name: item.name,
        deviceId: item.deviceId,
        deviceName: item.deviceName,
        mappings: item.mappings.filter(isMidiMapping),
      });
  }
  return profiles;
}

function isMidiMapping(value: unknown): value is MidiMapping {
  if (!value || typeof value !== "object") return false;
  const mapping = value as Partial<MidiMapping>;
  const numeric = [
    mapping.channel,
    mapping.inputMin,
    mapping.inputMax,
    mapping.outputMin,
    mapping.outputMax,
  ];
  return (
    typeof mapping.id === "string" &&
    typeof mapping.deviceId === "string" &&
    typeof mapping.deviceName === "string" &&
    (mapping.targetType === "parameter" || mapping.targetType === "action") &&
    typeof mapping.target === "string" &&
    ["cc", "pitchbend", "pressure"].includes(mapping.source ?? "") &&
    (mapping.controller === null || typeof mapping.controller === "number") &&
    numeric.every(
      (item) => typeof item === "number" && Number.isFinite(item),
    ) &&
    typeof mapping.invert === "boolean" &&
    ["none", "light", "medium", "heavy"].includes(mapping.smoothing ?? "") &&
    ["pickup", "jump"].includes(mapping.takeover ?? "") &&
    ["permanent", "momentary"].includes(mapping.pitchMode ?? "")
  );
}
