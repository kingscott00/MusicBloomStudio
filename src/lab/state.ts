import type {
  ColorPalette,
  RandomizerLocks,
  VisualMode,
  VisualParameters,
} from "../types";
import { clamp, hashNoise } from "../utils/math";
import { palettes } from "../presets/palettes";
import {
  defaultAdvancedValues,
  defaultMacros,
  defaultResponse,
} from "./definitions";
import { validatePalette } from "./paletteLab";
import type {
  HistoryEntry,
  LaboratoryHistory,
  LaboratoryScene,
  LaboratoryState,
  MacroControl,
  ModulationRoute,
  MusicalResponseSettings,
  MutationStrength,
  VisualInstrument,
} from "./types";

const LAB_STORAGE_KEY = "music-bloom-laboratory-v1";
const INSTRUMENT_STORAGE_KEY = "music-bloom-visual-instruments-v1";
const HISTORY_LIMIT = 50;
const validModes: VisualMode[] = [
  "bloom",
  "orbit",
  "ribbons",
  "constellation",
  "jellyfish",
  "geometry",
  "nebula",
  "forest",
  "metal",
  "portal",
];

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export function sceneFromParameters(
  params: VisualParameters,
  state?: Pick<
    LaboratoryState,
    "currentAdvanced" | "response" | "macros" | "modulationRoutes"
  >,
): LaboratoryScene {
  return {
    version: 1,
    params: { ...params },
    advanced: { ...(state?.currentAdvanced ?? defaultAdvancedValues()) },
    response: { ...(state?.response ?? defaultResponse) },
    macros: clone(state?.macros ?? defaultMacros()),
    modulationRoutes: clone(state?.modulationRoutes ?? []),
  };
}

export function createLaboratoryState(
  params: VisualParameters,
): LaboratoryState {
  const scene = sceneFromParameters(params);
  return {
    version: 1,
    sceneA: clone(scene),
    sceneB: {
      ...clone(scene),
      params: {
        ...params,
        density: clamp(params.density + 14, 0, 100),
        speed: clamp(params.speed + 10, 0, 100),
        rotation: clamp(params.rotation + 16, 0, 100),
        glow: clamp(params.glow + 12, 0, 100),
        recipeSeed: params.recipeSeed + 1,
      },
    },
    editScene: "A",
    morph: 0,
    currentAdvanced: { ...scene.advanced },
    response: { ...scene.response },
    macros: clone(scene.macros),
    modulationRoutes: [],
    customPalettes: [],
    mutationSeed: params.recipeSeed,
    mutationIndex: 0,
    mutationStrength: "subtle",
    surpriseSeed: params.recipeSeed,
    surpriseScope: "current-scene",
    overlayEnabled: true,
  };
}

export function captureScene(
  state: LaboratoryState,
  slot: "A" | "B",
  params: VisualParameters,
): LaboratoryState {
  const scene = sceneFromParameters(params, state);
  return {
    ...state,
    [slot === "A" ? "sceneA" : "sceneB"]: scene,
    editScene: slot,
  };
}

export function loadScene(
  state: LaboratoryState,
  slot: "A" | "B",
): { state: LaboratoryState; params: VisualParameters } {
  const scene = clone(slot === "A" ? state.sceneA : state.sceneB);
  return {
    params: scene.params,
    state: {
      ...state,
      editScene: slot,
      currentAdvanced: scene.advanced,
      response: scene.response,
      macros: scene.macros,
      modulationRoutes: scene.modulationRoutes,
    },
  };
}

export function swapScenes(state: LaboratoryState): LaboratoryState {
  return {
    ...state,
    sceneA: clone(state.sceneB),
    sceneB: clone(state.sceneA),
    morph: 100 - state.morph,
    editScene: state.editScene === "A" ? "B" : "A",
  };
}

export function copyScene(
  state: LaboratoryState,
  from: "A" | "B",
): LaboratoryState {
  const source = from === "A" ? state.sceneA : state.sceneB;
  return {
    ...state,
    [from === "A" ? "sceneB" : "sceneA"]: clone(source),
  };
}

export function applyPaletteEdit(
  state: LaboratoryState,
  params: VisualParameters,
  palette: ColorPalette,
  sourcePaletteId: string,
): {
  state: LaboratoryState;
  params: VisualParameters;
  palette: ColorPalette;
} {
  const builtIn = palettes.some((item) => item.id === sourcePaletteId);
  const id = builtIn ? `custom-edit-${sourcePaletteId}` : sourcePaletteId;
  const saved: ColorPalette = {
    ...palette,
    id,
    name:
      builtIn && !palette.name.endsWith(" Edit")
        ? `${palette.name} Edit`
        : palette.name || "Custom palette",
    colors: [...palette.colors],
  };
  const customPalettes = [
    ...state.customPalettes.filter((item) => item.id !== id),
    saved,
  ];
  const nextParams = { ...params, paletteId: id };
  const sceneKey = state.editScene === "A" ? "sceneA" : "sceneB";
  return {
    palette: saved,
    params: nextParams,
    state: {
      ...state,
      customPalettes,
      [sceneKey]: {
        ...state[sceneKey],
        params: nextParams,
      },
    },
  };
}

export function createHistory<T>(state: T): LaboratoryHistory<T> {
  const entry: HistoryEntry<T> = {
    id: 0,
    label: "Entered Laboratory",
    state: clone(state),
    timestamp: Date.now(),
  };
  return { entries: [entry], index: 0, entryState: clone(state) };
}

export function pushHistory<T>(
  history: LaboratoryHistory<T>,
  state: T,
  label: string,
  coalesceKey?: string,
  now = Date.now(),
): LaboratoryHistory<T> {
  const entries = history.entries.slice(0, history.index + 1);
  const previous = entries.at(-1);
  const next: HistoryEntry<T> = {
    id: (previous?.id ?? 0) + 1,
    label,
    state: clone(state),
    timestamp: now,
    coalesceKey,
  };
  if (
    coalesceKey &&
    previous?.coalesceKey === coalesceKey &&
    now - previous.timestamp < 700
  )
    entries[entries.length - 1] = { ...next, id: previous.id };
  else entries.push(next);
  const bounded = entries.slice(-HISTORY_LIMIT);
  return { ...history, entries: bounded, index: bounded.length - 1 };
}

export function undoHistory<T>(history: LaboratoryHistory<T>): {
  history: LaboratoryHistory<T>;
  state: T;
} {
  const index = Math.max(0, history.index - 1);
  return {
    history: { ...history, index },
    state: clone(history.entries[index].state),
  };
}

export function redoHistory<T>(history: LaboratoryHistory<T>): {
  history: LaboratoryHistory<T>;
  state: T;
} {
  const index = Math.min(history.entries.length - 1, history.index + 1);
  return {
    history: { ...history, index },
    state: clone(history.entries[index].state),
  };
}

function seeded(seed: number, index: number): number {
  return hashNoise(seed * 0.0001 + index * 17.31);
}

export function mutateLaboratory(
  state: LaboratoryState,
  params: VisualParameters,
  locks: RandomizerLocks,
  strength: MutationStrength,
  mutationIndex = state.mutationIndex + 1,
): { state: LaboratoryState; params: VisualParameters } {
  const amplitude = { subtle: 7, moderate: 18, wild: 34 }[strength];
  const seed = state.mutationSeed + mutationIndex * 1009;
  const vary = (value: number, index: number, min = 0, max = 100) =>
    clamp(
      Math.round(value + (seeded(seed, index) * 2 - 1) * amplitude),
      min,
      max,
    );
  const modes = validModes;
  const nextParams: VisualParameters = {
    ...params,
    density: locks.density ? params.density : vary(params.density, 1),
    speed: locks.motion ? params.speed : vary(params.speed, 2),
    rotation: locks.motion ? params.rotation : vary(params.rotation, 3),
    symmetry: locks.symmetry
      ? params.symmetry
      : vary(params.symmetry, 4, 3, 14),
    trails: locks.trails ? params.trails : vary(params.trails, 5),
    glow: locks.glow ? params.glow : vary(params.glow, 6),
    bloom: locks.glow ? params.bloom : vary(params.bloom, 7),
    background: vary(params.background, 8),
    idle: vary(params.idle, 9),
    recipeSeed: seed,
  };
  if (strength !== "subtle" && !locks.palette) {
    const paletteChoices = [
      ...palettes.map((palette) => palette.id),
      ...state.customPalettes.map((palette) => palette.id),
    ];
    if (seeded(seed, 12) > (strength === "wild" ? 0.28 : 0.62))
      nextParams.paletteId =
        paletteChoices[Math.floor(seeded(seed, 13) * paletteChoices.length)] ??
        params.paletteId;
  }
  if (strength === "wild" && !locks.experience && seeded(seed, 10) > 0.58)
    nextParams.mode = modes[Math.floor(seeded(seed, 11) * modes.length)];

  const advanced = { ...state.currentAdvanced };
  Object.keys(advanced).forEach((key, index) => {
    advanced[key] = vary(advanced[key], 20 + index);
  });
  const macros = state.macros.map((macro, index) => ({
    ...macro,
    value: strength === "subtle" ? macro.value : vary(macro.value, 200 + index),
  }));
  return {
    params: nextParams,
    state: {
      ...state,
      currentAdvanced: advanced,
      macros,
      mutationIndex,
      mutationStrength: strength,
    },
  };
}

function isVisualParameters(value: unknown): value is VisualParameters {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<VisualParameters>;
  const inRange = (key: keyof VisualParameters, min: number, max: number) => {
    const current = item[key];
    return (
      typeof current === "number" &&
      Number.isFinite(current) &&
      current >= min &&
      current <= max
    );
  };
  return (
    validModes.includes(item.mode as VisualMode) &&
    typeof item.paletteId === "string" &&
    item.paletteId.length <= 100 &&
    inRange("density", 0, 100) &&
    inRange("speed", 0, 100) &&
    inRange("rotation", 0, 100) &&
    inRange("symmetry", 3, 14) &&
    inRange("trails", 0, 100) &&
    inRange("glow", 0, 100) &&
    inRange("bloom", 0, 100) &&
    inRange("responsiveness", 0, 100) &&
    inRange("background", 0, 100) &&
    inRange("idle", 0, 100) &&
    inRange("recipeSeed", 0, 999_999_999) &&
    typeof item.autoMotion === "boolean" &&
    typeof item.reducedMotion === "boolean" &&
    ["auto", "high", "balanced", "low"].includes(item.quality ?? "")
  );
}

function validateMacros(value: unknown): MacroControl[] | null {
  if (!Array.isArray(value) || value.length !== 8) return null;
  if (
    !value.every(
      (macro) =>
        macro &&
        typeof macro === "object" &&
        typeof macro.id === "string" &&
        macro.id.length <= 100 &&
        typeof macro.name === "string" &&
        macro.name.length <= 100 &&
        typeof macro.value === "number" &&
        Number.isFinite(macro.value) &&
        macro.value >= 0 &&
        macro.value <= 100 &&
        Array.isArray(macro.assignments) &&
        macro.assignments.length <= 24 &&
        macro.assignments.every((assignment: unknown) => {
          if (!assignment || typeof assignment !== "object") return false;
          const item = assignment as Record<string, unknown>;
          return (
            typeof item.id === "string" &&
            typeof item.target === "string" &&
            typeof item.min === "number" &&
            typeof item.max === "number" &&
            Number.isFinite(item.min) &&
            Number.isFinite(item.max) &&
            item.min >= 0 &&
            item.max <= 100 &&
            item.min <= item.max &&
            typeof item.invert === "boolean" &&
            ["linear", "ease-in", "ease-out", "s-curve"].includes(
              String(item.curve),
            ) &&
            typeof item.weight === "number" &&
            item.weight >= 0 &&
            item.weight <= 100
          );
        }),
    )
  )
    return null;
  return clone(value as MacroControl[]);
}

function validateRoutes(value: unknown): ModulationRoute[] | null {
  if (!Array.isArray(value) || value.length > 16) return null;
  return value.every(
    (route) =>
      route &&
      typeof route === "object" &&
      typeof route.id === "string" &&
      [
        "lfo-slow",
        "lfo-medium",
        "lfo-fast",
        "random-drift",
        "velocity",
        "register",
        "held-count",
        "rhythm",
        "tension",
        "attack",
        "held",
        "release",
        "sustain",
      ].includes(route.source) &&
      ["sine", "triangle", "saw", "square", "smooth-random"].includes(
        route.shape,
      ) &&
      typeof route.target === "string" &&
      typeof route.enabled === "boolean" &&
      typeof route.amount === "number" &&
      Number.isFinite(route.amount) &&
      route.amount >= -100 &&
      route.amount <= 100 &&
      ["unipolar", "bipolar"].includes(route.polarity) &&
      typeof route.smoothing === "number" &&
      route.smoothing >= 0 &&
      route.smoothing <= 100 &&
      typeof route.min === "number" &&
      typeof route.max === "number" &&
      route.min >= 0 &&
      route.max <= 100 &&
      route.min <= route.max,
  )
    ? clone(value as ModulationRoute[])
    : null;
}

function validateScene(value: unknown): LaboratoryScene | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<LaboratoryScene>;
  const macros = validateMacros(item.macros);
  const routes = validateRoutes(item.modulationRoutes);
  const advancedValid =
    item.advanced &&
    typeof item.advanced === "object" &&
    Object.keys(item.advanced).length <= 100 &&
    Object.values(item.advanced).every(
      (entry) =>
        typeof entry === "number" &&
        Number.isFinite(entry) &&
        entry >= 0 &&
        entry <= 100,
    );
  const responseValid =
    item.response &&
    typeof item.response === "object" &&
    ["velocity", "register", "rhythm", "tension", "attack", "release"].every(
      (key) => {
        const entry = (item.response as unknown as Record<string, unknown>)[
          key
        ];
        return (
          typeof entry === "number" &&
          Number.isFinite(entry) &&
          entry >= 0 &&
          entry <= 100
        );
      },
    );
  if (
    !isVisualParameters(item.params) ||
    !advancedValid ||
    !responseValid ||
    !macros ||
    !routes
  )
    return null;
  return {
    version: 1,
    params: item.params,
    advanced: clone(item.advanced as Record<string, number>),
    response: clone(item.response as MusicalResponseSettings),
    macros,
    modulationRoutes: routes,
  };
}

export function migrateLaboratoryState(
  value: unknown,
  fallbackParams: VisualParameters,
): LaboratoryState {
  if (!value || typeof value !== "object")
    return createLaboratoryState(fallbackParams);
  const item = value as Partial<LaboratoryState>;
  const sceneA = validateScene(item.sceneA);
  const sceneB = validateScene(item.sceneB);
  const macros = validateMacros(item.macros);
  const routes = validateRoutes(item.modulationRoutes);
  if (!sceneA || !sceneB || !macros || !routes)
    return createLaboratoryState(fallbackParams);
  const editScene = item.editScene === "B" ? "B" : "A";
  const activeScene = editScene === "B" ? sceneB : sceneA;
  const mutationStrength: MutationStrength =
    item.mutationStrength === "moderate" ||
    item.mutationStrength === "wild" ||
    item.mutationStrength === "subtle"
      ? item.mutationStrength
      : "subtle";
  return {
    ...createLaboratoryState(fallbackParams),
    ...item,
    version: 1,
    sceneA,
    sceneB,
    macros,
    modulationRoutes: routes,
    editScene,
    morph: clamp(typeof item.morph === "number" ? item.morph : 0, 0, 100),
    currentAdvanced: clone(activeScene.advanced),
    response: clone(activeScene.response),
    mutationSeed:
      typeof item.mutationSeed === "number" &&
      Number.isFinite(item.mutationSeed)
        ? clamp(Math.round(item.mutationSeed), 0, 999_999_999)
        : fallbackParams.recipeSeed,
    mutationIndex:
      typeof item.mutationIndex === "number" &&
      Number.isFinite(item.mutationIndex)
        ? clamp(Math.round(item.mutationIndex), 0, 999_999)
        : 0,
    mutationStrength,
    surpriseSeed:
      typeof item.surpriseSeed === "number" &&
      Number.isFinite(item.surpriseSeed)
        ? clamp(Math.round(item.surpriseSeed), 0, 999_999_999)
        : fallbackParams.recipeSeed,
    surpriseScope:
      item.surpriseScope === "full-instrument"
        ? "full-instrument"
        : "current-scene",
    overlayEnabled:
      typeof item.overlayEnabled === "boolean" ? item.overlayEnabled : true,
    customPalettes: Array.isArray(item.customPalettes)
      ? item.customPalettes
          .map(validatePalette)
          .filter((palette): palette is ColorPalette => !!palette)
      : [],
  };
}

export function loadLaboratoryState(params: VisualParameters): LaboratoryState {
  try {
    return migrateLaboratoryState(
      JSON.parse(localStorage.getItem(LAB_STORAGE_KEY) ?? "null"),
      params,
    );
  } catch {
    return createLaboratoryState(params);
  }
}

export function saveLaboratoryState(state: LaboratoryState): void {
  localStorage.setItem(LAB_STORAGE_KEY, JSON.stringify(state));
}

export function serializeInstrument(instrument: VisualInstrument): string {
  return JSON.stringify(
    {
      application: "Music Bloom Studio",
      kind: "Visual Instrument",
      version: 1,
      instrument,
    },
    null,
    2,
  );
}

export function validateInstrument(value: unknown): VisualInstrument {
  if (!value || typeof value !== "object")
    throw new Error("This is not a Visual Instrument file.");
  const envelope = value as { instrument?: unknown; version?: unknown };
  if (envelope.version !== undefined && envelope.version !== 1)
    throw new Error("This Visual Instrument version is not supported.");
  const raw = envelope.instrument ?? value;
  if (!raw || typeof raw !== "object")
    throw new Error("The Visual Instrument payload is missing.");
  const item = raw as Partial<VisualInstrument>;
  if (item.version !== undefined && item.version !== 1)
    throw new Error("This Visual Instrument version is not supported.");
  if (
    typeof item.id !== "string" ||
    typeof item.name !== "string" ||
    !item.state ||
    typeof item.state !== "object" ||
    !item.randomizerLocks ||
    typeof item.randomizerLocks !== "object"
  )
    throw new Error("The Visual Instrument is malformed or incomplete.");
  const rawState = item.state as LaboratoryState;
  const sceneA = validateScene(rawState.sceneA);
  const sceneB = validateScene(rawState.sceneB);
  const macros = validateMacros(rawState.macros);
  const routes = validateRoutes(rawState.modulationRoutes);
  if (!sceneA || !sceneB || !macros || !routes)
    throw new Error("The Visual Instrument contains an invalid scene.");
  const lockKeys: Array<keyof RandomizerLocks> = [
    "experience",
    "palette",
    "density",
    "motion",
    "trails",
    "glow",
    "symmetry",
  ];
  if (
    !lockKeys.every((key) => typeof item.randomizerLocks?.[key] === "boolean")
  )
    throw new Error("The Visual Instrument contains invalid randomizer locks.");
  const state = migrateLaboratoryState(item.state, sceneA.params);
  return {
    version: 1,
    id: item.id.slice(0, 100),
    name: item.name.slice(0, 100),
    builtIn: false,
    favorite: Boolean(item.favorite),
    modifiedAt:
      typeof item.modifiedAt === "string"
        ? item.modifiedAt
        : new Date().toISOString(),
    mood: typeof item.mood === "string" ? item.mood.slice(0, 40) : undefined,
    description:
      typeof item.description === "string"
        ? item.description.slice(0, 500)
        : undefined,
    preferredMidiProfileId:
      typeof item.preferredMidiProfileId === "string"
        ? item.preferredMidiProfileId.slice(0, 100)
        : undefined,
    state,
    randomizerLocks: clone(item.randomizerLocks),
  };
}

export function importInstrument(json: string): VisualInstrument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("The selected file is not valid JSON.");
  }
  return validateInstrument(parsed);
}

export function loadCustomInstruments(): VisualInstrument[] {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(INSTRUMENT_STORAGE_KEY) ?? "[]",
    ) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((value) => {
      try {
        return [validateInstrument(value)];
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
}

export function saveCustomInstruments(instruments: VisualInstrument[]): void {
  localStorage.setItem(
    INSTRUMENT_STORAGE_KEY,
    JSON.stringify(instruments.filter((instrument) => !instrument.builtIn)),
  );
}

function exampleInstrument(
  id: string,
  name: string,
  params: VisualParameters,
  modeB: VisualMode,
  mood: string,
  route?: ModulationRoute,
): VisualInstrument {
  const state = createLaboratoryState(params);
  state.sceneB.params.mode = modeB;
  state.sceneB.params.density = clamp(params.density + 18, 0, 100);
  state.sceneB.params.glow = clamp(params.glow + 10, 0, 100);
  state.morph = modeB === params.mode ? 35 : 18;
  if (route) {
    state.modulationRoutes = [route];
    state.sceneA.modulationRoutes = [route];
    state.sceneB.modulationRoutes = [route];
  }
  state.macros[2].assignments = [
    {
      id: `${id}-radiance`,
      target: "shared.glow",
      min: 38,
      max: 94,
      invert: false,
      curve: "ease-out",
      weight: 100,
    },
  ];
  return {
    version: 1,
    id,
    name,
    builtIn: true,
    favorite: false,
    modifiedAt: "2026-07-30T00:00:00.000Z",
    mood,
    description: "A curated Visual Laboratory instrument.",
    state,
    randomizerLocks: {
      experience: false,
      palette: false,
      density: false,
      motion: false,
      trails: false,
      glow: false,
      symmetry: false,
    },
  };
}

export function createExampleInstruments(
  params: VisualParameters,
): VisualInstrument[] {
  const base = { ...params };
  return [
    exampleInstrument(
      "instrument-breathing-cathedral",
      "Breathing Cathedral",
      { ...base, mode: "geometry", paletteId: "gold" },
      "geometry",
      "meditative",
      {
        id: "cathedral-breath",
        enabled: true,
        source: "lfo-slow",
        shape: "sine",
        target: "shared.bloom",
        amount: 18,
        polarity: "bipolar",
        smoothing: 70,
        min: 30,
        max: 95,
      },
    ),
    exampleInstrument(
      "instrument-forest-portal",
      "Forest Through the Portal",
      { ...base, mode: "forest", paletteId: "forest" },
      "portal",
      "mysterious",
    ),
    exampleInstrument(
      "instrument-chrome-medusae",
      "Chrome Medusae",
      { ...base, mode: "metal", paletteId: "silver" },
      "jellyfish",
      "luminous",
    ),
    exampleInstrument(
      "instrument-star-garden",
      "Harmonic Star Garden",
      { ...base, mode: "constellation", paletteId: "aurora" },
      "bloom",
      "celestial",
      {
        id: "garden-tension",
        enabled: true,
        source: "tension",
        shape: "sine",
        target: "shared.rotation",
        amount: 22,
        polarity: "unipolar",
        smoothing: 45,
        min: 0,
        max: 100,
      },
    ),
  ];
}
