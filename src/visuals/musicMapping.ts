import type { ChordQuality } from "../types";
import { clamp } from "../utils/math";

export interface HarmonyProfile {
  openness: number;
  inward: number;
  float: number;
  warp: number;
  crystalline: number;
  layerBonus: number;
}

const profiles: Partial<Record<ChordQuality, HarmonyProfile>> = {
  major: profile(1, 0.05, 0.12, 0.04, 0.08, 0),
  minor: profile(0.66, 0.78, 0.16, 0.12, 0.05, 0),
  diminished: profile(0.48, 0.46, 0.08, 1, 0.42, 0),
  augmented: profile(1.14, 0.12, 0.24, 0.58, 1, 0),
  sus2: profile(0.88, 0.12, 1, 0.18, 0.12, 0),
  sus4: profile(0.84, 0.16, 0.92, 0.22, 0.14, 0),
  major7: profile(1.08, 0.08, 0.34, 0.12, 0.34, 1),
  dominant7: profile(0.94, 0.18, 0.2, 0.38, 0.28, 1),
  minor7: profile(0.72, 0.68, 0.34, 0.16, 0.18, 1),
  minorMajor7: profile(0.7, 0.72, 0.22, 0.52, 0.46, 1),
  major6: profile(1.02, 0.08, 0.22, 0.08, 0.18, 1),
  minor6: profile(0.72, 0.7, 0.2, 0.18, 0.14, 1),
  add9: profile(1.04, 0.06, 0.48, 0.1, 0.26, 1),
  major9: profile(1.12, 0.04, 0.52, 0.14, 0.42, 2),
  minor9: profile(0.76, 0.65, 0.5, 0.2, 0.3, 2),
  power: profile(0.98, 0.08, 0.08, 0.06, 0.04, 0),
  collection: profile(0.78, 0.28, 0.3, 0.5, 0.2, 0),
  none: profile(0.86, 0.18, 0.38, 0.06, 0.05, 0),
};

function profile(
  openness: number,
  inward: number,
  float: number,
  warp: number,
  crystalline: number,
  layerBonus: number,
): HarmonyProfile {
  return { openness, inward, float, warp, crystalline, layerBonus };
}

export function harmonyProfile(quality: ChordQuality): HarmonyProfile {
  return profiles[quality] ?? profiles.none!;
}

export function registerPosition(note: number): number {
  return clamp((note - 24) / 84, 0, 1);
}

export function pitchPosition(note: number): number {
  const angle = ((note % 12) / 12) * Math.PI * 2 - Math.PI / 2;
  return Math.sin(angle);
}

export function velocityCurve(velocity: number): number {
  return 0.18 + Math.pow(clamp(velocity / 127, 0, 1), 0.72) * 0.82;
}
