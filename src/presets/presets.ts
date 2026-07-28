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
    mode: "bloom",
    paletteId: "violet",
    speed: 18,
    trails: 92,
    glow: 88,
    bloom: 92,
    symmetry: 5,
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
