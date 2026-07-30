import type { RandomizerLocks, VisualMode, VisualParameters } from "../types";
import { experiences } from "../visuals/experiences";

interface Range {
  min: number;
  max: number;
}

interface ExperienceRecipe {
  palettes: string[];
  density: Range;
  speed: Range;
  rotation: Range;
  symmetry: Range;
  trails: Range;
  glow: Range;
  bloom: Range;
  responsiveness: Range;
  background: Range;
  idle: Range;
  driftChance: number;
}

const recipe = (
  palettes: string[],
  values: Omit<ExperienceRecipe, "palettes">,
): ExperienceRecipe => ({ palettes, ...values });

const recipes: Record<VisualMode, ExperienceRecipe> = {
  bloom: recipe(["moonlight", "aurora", "violet", "forest", "gold"], {
    density: { min: 48, max: 80 },
    speed: { min: 18, max: 56 },
    rotation: { min: 18, max: 64 },
    symmetry: { min: 5, max: 11 },
    trails: { min: 66, max: 90 },
    glow: { min: 58, max: 88 },
    bloom: { min: 62, max: 92 },
    responsiveness: { min: 62, max: 88 },
    background: { min: 5, max: 18 },
    idle: { min: 22, max: 46 },
    driftChance: 0.82,
  }),
  orbit: recipe(["moonlight", "violet", "gold", "embers", "neon"], {
    density: { min: 44, max: 76 },
    speed: { min: 24, max: 68 },
    rotation: { min: 42, max: 82 },
    symmetry: { min: 4, max: 9 },
    trails: { min: 62, max: 88 },
    glow: { min: 54, max: 84 },
    bloom: { min: 46, max: 74 },
    responsiveness: { min: 60, max: 88 },
    background: { min: 4, max: 16 },
    idle: { min: 18, max: 42 },
    driftChance: 0.78,
  }),
  ribbons: recipe(["ocean", "aurora", "sunset", "silver", "violet"], {
    density: { min: 42, max: 72 },
    speed: { min: 18, max: 52 },
    rotation: { min: 10, max: 54 },
    symmetry: { min: 4, max: 9 },
    trails: { min: 72, max: 86 },
    glow: { min: 42, max: 70 },
    bloom: { min: 36, max: 62 },
    responsiveness: { min: 58, max: 86 },
    background: { min: 4, max: 15 },
    idle: { min: 20, max: 44 },
    driftChance: 0.9,
  }),
  constellation: recipe(["moonlight", "silver", "violet", "gold", "neon"], {
    density: { min: 42, max: 68 },
    speed: { min: 14, max: 44 },
    rotation: { min: 12, max: 52 },
    symmetry: { min: 4, max: 9 },
    trails: { min: 54, max: 78 },
    glow: { min: 56, max: 88 },
    bloom: { min: 42, max: 72 },
    responsiveness: { min: 56, max: 84 },
    background: { min: 4, max: 14 },
    idle: { min: 26, max: 52 },
    driftChance: 0.74,
  }),
  jellyfish: recipe(["ocean", "violet", "aurora", "moonlight"], {
    density: { min: 38, max: 68 },
    speed: { min: 12, max: 38 },
    rotation: { min: 8, max: 38 },
    symmetry: { min: 4, max: 8 },
    trails: { min: 82, max: 96 },
    glow: { min: 66, max: 92 },
    bloom: { min: 72, max: 96 },
    responsiveness: { min: 54, max: 82 },
    background: { min: 5, max: 18 },
    idle: { min: 32, max: 58 },
    driftChance: 0.94,
  }),
  geometry: recipe(["gold", "moonlight", "silver", "violet", "aurora"], {
    density: { min: 42, max: 72 },
    speed: { min: 12, max: 42 },
    rotation: { min: 16, max: 58 },
    symmetry: { min: 6, max: 12 },
    trails: { min: 54, max: 78 },
    glow: { min: 48, max: 78 },
    bloom: { min: 48, max: 76 },
    responsiveness: { min: 64, max: 90 },
    background: { min: 2, max: 12 },
    idle: { min: 16, max: 38 },
    driftChance: 0.58,
  }),
  nebula: recipe(["violet", "sunset", "aurora", "ocean", "embers"], {
    density: { min: 48, max: 72 },
    speed: { min: 14, max: 44 },
    rotation: { min: 18, max: 62 },
    symmetry: { min: 4, max: 8 },
    trails: { min: 76, max: 94 },
    glow: { min: 60, max: 86 },
    bloom: { min: 66, max: 90 },
    responsiveness: { min: 62, max: 88 },
    background: { min: 5, max: 16 },
    idle: { min: 28, max: 54 },
    driftChance: 0.92,
  }),
  forest: recipe(["forest", "gold", "aurora", "moonlight", "embers"], {
    density: { min: 38, max: 66 },
    speed: { min: 10, max: 36 },
    rotation: { min: 8, max: 34 },
    symmetry: { min: 4, max: 8 },
    trails: { min: 58, max: 84 },
    glow: { min: 42, max: 76 },
    bloom: { min: 54, max: 86 },
    responsiveness: { min: 54, max: 82 },
    background: { min: 4, max: 16 },
    idle: { min: 26, max: 50 },
    driftChance: 0.72,
  }),
  metal: recipe(["silver", "moonlight", "neon", "violet", "embers"], {
    density: { min: 34, max: 62 },
    speed: { min: 22, max: 62 },
    rotation: { min: 18, max: 66 },
    symmetry: { min: 4, max: 8 },
    trails: { min: 58, max: 84 },
    glow: { min: 38, max: 68 },
    bloom: { min: 50, max: 82 },
    responsiveness: { min: 68, max: 94 },
    background: { min: 2, max: 12 },
    idle: { min: 14, max: 38 },
    driftChance: 0.76,
  }),
  portal: recipe(["violet", "moonlight", "neon", "gold", "embers"], {
    density: { min: 40, max: 68 },
    speed: { min: 20, max: 58 },
    rotation: { min: 34, max: 76 },
    symmetry: { min: 5, max: 10 },
    trails: { min: 62, max: 88 },
    glow: { min: 54, max: 84 },
    bloom: { min: 58, max: 88 },
    responsiveness: { min: 66, max: 92 },
    background: { min: 2, max: 14 },
    idle: { min: 18, max: 42 },
    driftChance: 0.82,
  }),
};

export const defaultRandomizerLocks: RandomizerLocks = {
  experience: false,
  palette: false,
  density: false,
  motion: false,
  trails: false,
  glow: false,
  symmetry: false,
};

const LOCKS_STORAGE_KEY = "music-bloom-randomizer-locks-v1";

export function loadRandomizerLocks(): RandomizerLocks {
  try {
    return {
      ...defaultRandomizerLocks,
      ...(JSON.parse(
        localStorage.getItem(LOCKS_STORAGE_KEY) ?? "{}",
      ) as Partial<RandomizerLocks>),
    };
  } catch {
    return defaultRandomizerLocks;
  }
}

export function saveRandomizerLocks(locks: RandomizerLocks): void {
  localStorage.setItem(LOCKS_STORAGE_KEY, JSON.stringify(locks));
}

export function randomSeed(): number {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0] % 1_000_000_000;
}

export function createRandomizedParameters(
  current: VisualParameters,
  seed: number,
  locksOrWithinCurrent: RandomizerLocks | boolean = defaultRandomizerLocks,
  customPaletteIds: string[] = [],
): VisualParameters {
  const random = mulberry32(seed);
  const locks =
    typeof locksOrWithinCurrent === "boolean"
      ? {
          ...defaultRandomizerLocks,
          experience: locksOrWithinCurrent,
        }
      : { ...defaultRandomizerLocks, ...locksOrWithinCurrent };
  const available = experiences.map((experience) => experience.id);
  const mode = locks.experience
    ? current.mode
    : available[Math.floor(random() * available.length)];
  const constraints = recipes[mode];
  const choose = (range: Range) =>
    Math.round(range.min + random() * (range.max - range.min));
  const paletteIndex = Math.min(
    constraints.palettes.length - 1,
    Math.floor(Math.pow(random(), 1.18) * constraints.palettes.length),
  );
  const selectedPalette =
    customPaletteIds.length && random() > 0.72
      ? customPaletteIds[Math.floor(random() * customPaletteIds.length)]
      : constraints.palettes[paletteIndex];

  return {
    ...current,
    mode,
    paletteId: locks.palette ? current.paletteId : selectedPalette,
    density: locks.density ? current.density : choose(constraints.density),
    speed: locks.motion ? current.speed : choose(constraints.speed),
    rotation: locks.motion ? current.rotation : choose(constraints.rotation),
    symmetry: locks.symmetry ? current.symmetry : choose(constraints.symmetry),
    trails: locks.trails ? current.trails : choose(constraints.trails),
    glow: locks.glow ? current.glow : choose(constraints.glow),
    bloom: locks.glow ? current.bloom : choose(constraints.bloom),
    responsiveness: choose(constraints.responsiveness),
    background: choose(constraints.background),
    idle: locks.motion ? current.idle : choose(constraints.idle),
    autoMotion: locks.motion
      ? current.autoMotion
      : random() < constraints.driftChance,
    recipeSeed: seed,
  };
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}
