import {
  advancedDefinitions,
  defaultMacros,
  defaultResponse,
} from "./definitions";
import { createRandomizedParameters } from "../presets/randomizer";
import type { RandomizerLocks, VisualMode, VisualParameters } from "../types";
import type {
  AdvancedControlDefinition,
  LaboratoryScene,
  LaboratoryState,
  MacroControl,
  ModulationRoute,
  SurpriseScope,
} from "./types";

export const SAFE_SURPRISE_PAIRS: ReadonlyArray<
  readonly [VisualMode, VisualMode]
> = [
  ["forest", "portal"],
  ["jellyfish", "metal"],
  ["bloom", "nebula"],
  ["geometry", "constellation"],
  ["orbit", "orbit"],
  ["ribbons", "ribbons"],
  ["bloom", "bloom"],
  ["constellation", "constellation"],
];

const CURATED_PAIR_PALETTES: Record<string, readonly [string, string]> = {
  "forest:portal": ["forest", "violet"],
  "jellyfish:metal": ["ocean", "silver"],
  "bloom:nebula": ["aurora", "violet"],
  "geometry:constellation": ["gold", "moonlight"],
};

interface SurpriseResult {
  state: LaboratoryState;
  params: VisualParameters;
}

function seededRandom(seed: number): () => number {
  let current = seed >>> 0;
  return () => {
    current += 0x6d2b79f5;
    let value = current;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

const choose = <T>(items: readonly T[], random: () => number): T =>
  items[Math.min(items.length - 1, Math.floor(random() * items.length))];

function lockForAdvanced(
  definition: AdvancedControlDefinition,
  locks: RandomizerLocks,
): boolean {
  if (definition.group === "Motion") return locks.motion;
  if (definition.group === "Light") return locks.glow;
  if (definition.group === "Composition")
    return locks.density || locks.symmetry;
  if (definition.group === "Form") return locks.density;
  return false;
}

function randomizedAdvanced(
  mode: VisualMode,
  current: Record<string, number>,
  locks: RandomizerLocks,
  random: () => number,
  dramatic = false,
): Record<string, number> {
  const next = { ...current };
  advancedDefinitions[mode].forEach((definition, index) => {
    if (lockForAdvanced(definition, locks)) return;
    const low = dramatic && index % 2 === 0 ? 62 : 28;
    const high = dramatic && index % 2 === 0 ? 94 : 82;
    next[definition.id] = Math.round(low + random() * (high - low));
  });
  return next;
}

function randomizedResponse(random: () => number) {
  const value = () => Math.round(48 + random() * 42);
  return {
    velocity: value(),
    register: value(),
    rhythm: value(),
    tension: value(),
    attack: value(),
    release: value(),
  };
}

function scene(
  params: VisualParameters,
  advanced: Record<string, number>,
  response: typeof defaultResponse,
  macros: MacroControl[],
  routes: ModulationRoute[],
): LaboratoryScene {
  return {
    version: 1,
    params,
    advanced,
    response,
    macros,
    modulationRoutes: routes,
  };
}

function namedMacros(random: () => number): MacroControl[] {
  const names = [
    "Radiance",
    "Breath",
    "Depth",
    "Gravity",
    "Tension",
    "Drift",
    "Flourish",
    "Dissolve",
  ];
  return defaultMacros().map((macro, index) => ({
    ...macro,
    name: names[index],
    value: Math.round(38 + random() * 36),
    assignments:
      index < 4
        ? [
            {
              id: `surprise-macro-${index + 1}`,
              target: [
                "shared.glow",
                "shared.speed",
                "shared.bloom",
                "shared.rotation",
              ][index],
              min: index === 1 ? 12 : 28,
              max: index === 1 ? 74 : 94,
              invert: false,
              curve: index === 0 ? "ease-out" : "s-curve",
              weight: 100,
            },
          ]
        : [],
  }));
}

function tastefulRoutes(seed: number, random: () => number): ModulationRoute[] {
  const routes: ModulationRoute[] = [
    {
      id: `surprise-${seed}-breath`,
      enabled: true,
      source: "lfo-slow",
      shape: "sine",
      target: "shared.bloom",
      amount: Math.round(10 + random() * 12),
      polarity: "bipolar",
      smoothing: 76,
      min: 20,
      max: 94,
    },
    {
      id: `surprise-${seed}-attack`,
      enabled: true,
      source: "attack",
      shape: "sine",
      target: "shared.glow",
      amount: Math.round(14 + random() * 18),
      polarity: "unipolar",
      smoothing: 42,
      min: 24,
      max: 100,
    },
  ];
  if (random() > 0.42)
    routes.push({
      id: `surprise-${seed}-tension`,
      enabled: true,
      source: "tension",
      shape: "smooth-random",
      target: "shared.rotation",
      amount: Math.round(8 + random() * 16),
      polarity: "bipolar",
      smoothing: 66,
      min: 8,
      max: 88,
    });
  return routes;
}

function forceMode(
  params: VisualParameters,
  mode: VisualMode,
  seed: number,
  locks: RandomizerLocks,
  paletteIds: string[],
): VisualParameters {
  const randomized = createRandomizedParameters(
    { ...params, mode },
    seed,
    { ...locks, experience: true },
    paletteIds,
  );
  return { ...randomized, mode: locks.experience ? params.mode : mode };
}

export function surpriseCurrentScene(
  state: LaboratoryState,
  params: VisualParameters,
  locks: RandomizerLocks,
  seed: number,
  paletteIds: string[] = [],
): SurpriseResult {
  const random = seededRandom(seed);
  const nextParams = createRandomizedParameters(
    params,
    seed,
    locks,
    paletteIds,
  );
  const advanced = randomizedAdvanced(
    nextParams.mode,
    state.currentAdvanced,
    locks,
    random,
    true,
  );
  const response = randomizedResponse(random);
  const key = state.editScene === "A" ? "sceneA" : "sceneB";
  const nextScene = scene(
    nextParams,
    advanced,
    response,
    state.macros,
    state.modulationRoutes,
  );
  return {
    params: nextParams,
    state: {
      ...state,
      [key]: nextScene,
      currentAdvanced: advanced,
      response,
      surpriseSeed: seed,
      surpriseScope: "current-scene",
    },
  };
}

export function surpriseFullInstrument(
  state: LaboratoryState,
  params: VisualParameters,
  locks: RandomizerLocks,
  seed: number,
  paletteIds: string[] = [],
): SurpriseResult {
  const random = seededRandom(seed);
  const baseA = state.editScene === "A" ? params : state.sceneA.params;
  const baseB = state.editScene === "B" ? params : state.sceneB.params;
  const pair = locks.experience
    ? ([baseA.mode, baseB.mode] as const)
    : choose(SAFE_SURPRISE_PAIRS, random);
  const macros = namedMacros(random);
  const routes = tastefulRoutes(seed, random);
  let paramsA = forceMode(baseA, pair[0], seed + 101, locks, paletteIds);
  let paramsB = forceMode(baseB, pair[1], seed + 211, locks, paletteIds);
  const curatedPalettes = CURATED_PAIR_PALETTES[`${pair[0]}:${pair[1]}`];
  if (!locks.palette && curatedPalettes) {
    paramsA = { ...paramsA, paletteId: curatedPalettes[0] };
    paramsB = { ...paramsB, paletteId: curatedPalettes[1] };
  }
  const advancedA = randomizedAdvanced(
    paramsA.mode,
    state.sceneA.advanced,
    locks,
    random,
  );
  const advancedB = randomizedAdvanced(
    paramsB.mode,
    state.sceneB.advanced,
    locks,
    random,
    pair[0] === pair[1],
  );
  const responseA = randomizedResponse(random);
  const responseB = randomizedResponse(random);
  const sceneA = scene(paramsA, advancedA, responseA, macros, routes);
  const sceneB = scene(paramsB, advancedB, responseB, macros, routes);
  const editScene = state.editScene;
  const active = editScene === "A" ? sceneA : sceneB;
  return {
    params: active.params,
    state: {
      ...state,
      sceneA,
      sceneB,
      morph: Math.round(22 + random() * 48),
      currentAdvanced: active.advanced,
      response: active.response,
      macros,
      modulationRoutes: routes,
      surpriseSeed: seed,
      surpriseScope: "full-instrument",
    },
  };
}

export function createSurprise(
  scope: SurpriseScope,
  state: LaboratoryState,
  params: VisualParameters,
  locks: RandomizerLocks,
  seed: number,
  paletteIds: string[] = [],
): SurpriseResult {
  return scope === "full-instrument"
    ? surpriseFullInstrument(state, params, locks, seed, paletteIds)
    : surpriseCurrentScene(state, params, locks, seed, paletteIds);
}
