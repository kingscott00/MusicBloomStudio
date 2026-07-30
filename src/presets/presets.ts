import type { Preset, VisualParameters } from "../types";

export const defaultParams: VisualParameters = {
  mode: "bloom",
  paletteId: "moonlight",
  density: 62,
  speed: 42,
  rotation: 36,
  symmetry: 8,
  trails: 72,
  glow: 68,
  bloom: 70,
  responsiveness: 72,
  background: 12,
  autoMotion: true,
  idle: 34,
  reducedMotion: false,
  quality: "auto",
  recipeSeed: 28471,
};

const preset = (
  id: string,
  name: string,
  changes: Partial<VisualParameters>,
): Preset => ({
  id,
  name,
  builtIn: true,
  params: { ...defaultParams, ...changes },
});

export const builtInPresets: Preset[] = [
  preset("moonlit-bloom", "Moonlit Bloom", {
    mode: "bloom",
    paletteId: "moonlight",
    symmetry: 9,
    speed: 34,
    glow: 76,
    trails: 76,
  }),
  preset("aurora-garden", "Aurora Garden", {
    mode: "bloom",
    paletteId: "aurora",
    density: 72,
    rotation: 52,
    bloom: 84,
    symmetry: 7,
  }),
  preset("deep-ocean", "Deep Ocean", {
    mode: "ribbons",
    paletteId: "ocean",
    speed: 28,
    trails: 86,
    glow: 56,
    autoMotion: true,
  }),
  preset("cosmic-choir", "Cosmic Choir", {
    mode: "orbit",
    paletteId: "violet",
    density: 74,
    rotation: 62,
    glow: 83,
    symmetry: 6,
  }),
  preset("ember-spiral", "Ember Spiral", {
    mode: "orbit",
    paletteId: "embers",
    speed: 60,
    rotation: 76,
    trails: 82,
    glow: 78,
  }),
  preset("glass-cathedral", "Glass Cathedral", {
    mode: "ribbons",
    paletteId: "silver",
    symmetry: 12,
    speed: 23,
    trails: 90,
    glow: 48,
    bloom: 48,
  }),
  preset("midnight-constellation", "Midnight Constellation", {
    mode: "constellation",
    paletteId: "moonlight",
    density: 56,
    speed: 20,
    glow: 72,
    trails: 64,
  }),
  preset("dreaming-jellyfish", "Dreaming Jellyfish", {
    mode: "jellyfish",
    paletteId: "violet",
    speed: 18,
    trails: 92,
    glow: 88,
    bloom: 92,
    symmetry: 5,
  }),
  preset("abyssal-lanterns", "Abyssal Lanterns", {
    mode: "jellyfish",
    paletteId: "ocean",
    density: 54,
    speed: 15,
    trails: 94,
    glow: 86,
    bloom: 88,
    background: 8,
    recipeSeed: 73104,
  }),
  preset("temple-resonance", "Temple Resonance", {
    mode: "geometry",
    paletteId: "gold",
    density: 58,
    speed: 19,
    rotation: 29,
    symmetry: 10,
    trails: 65,
    glow: 66,
    background: 5,
    recipeSeed: 41027,
  }),
  preset("aurora-shrine", "Aurora Shrine", {
    mode: "geometry",
    paletteId: "aurora",
    density: 68,
    speed: 27,
    rotation: 46,
    symmetry: 8,
    glow: 73,
    bloom: 68,
    recipeSeed: 88216,
  }),
  preset("velvet-cosmos", "Velvet Cosmos", {
    mode: "nebula",
    paletteId: "violet",
    density: 72,
    speed: 24,
    trails: 91,
    glow: 84,
    bloom: 87,
    background: 13,
    recipeSeed: 15903,
  }),
  preset("solar-bloom", "Solar Bloom", {
    mode: "nebula",
    paletteId: "sunset",
    density: 66,
    speed: 32,
    rotation: 42,
    trails: 86,
    glow: 88,
    bloom: 91,
    background: 16,
    recipeSeed: 55261,
  }),
  preset("moss-cathedral", "Moss Cathedral", {
    mode: "forest",
    paletteId: "forest",
    density: 58,
    speed: 16,
    trails: 76,
    glow: 62,
    bloom: 78,
    background: 9,
    recipeSeed: 62419,
  }),
  preset("spores-at-midnight", "Spores at Midnight", {
    mode: "forest",
    paletteId: "moonlight",
    density: 48,
    speed: 22,
    trails: 82,
    glow: 76,
    bloom: 72,
    background: 5,
    recipeSeed: 90372,
  }),
  preset("chrome-tide", "Chrome Tide", {
    mode: "metal",
    paletteId: "silver",
    density: 52,
    speed: 46,
    rotation: 38,
    trails: 72,
    glow: 52,
    bloom: 68,
    responsiveness: 88,
    recipeSeed: 30744,
  }),
  preset("event-horizon", "Event Horizon", {
    mode: "portal",
    paletteId: "violet",
    density: 60,
    speed: 38,
    rotation: 66,
    symmetry: 7,
    trails: 82,
    glow: 78,
    bloom: 84,
    recipeSeed: 77138,
  }),
  preset("resonant-gate", "Resonant Gate", {
    mode: "portal",
    paletteId: "gold",
    density: 55,
    speed: 29,
    rotation: 54,
    symmetry: 9,
    trails: 74,
    glow: 70,
    bloom: 76,
    recipeSeed: 24580,
  }),
];

const STORAGE_KEY = "music-bloom-custom-presets-v1";

export function loadCustomPresets(): Preset[] {
  try {
    const stored = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? "[]",
    ) as unknown;
    if (!Array.isArray(stored)) return [];
    return stored.filter(isPreset).map((item) => ({
      ...item,
      builtIn: false,
      params: { ...defaultParams, ...item.params },
    }));
  } catch {
    return [];
  }
}

export function saveCustomPresets(presets: Preset[]): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(presets.filter((item) => !item.builtIn)),
  );
}

function isPreset(value: unknown): value is Preset {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<Preset>;
  return (
    typeof item.id === "string" &&
    typeof item.name === "string" &&
    !!item.params &&
    typeof item.params === "object"
  );
}
