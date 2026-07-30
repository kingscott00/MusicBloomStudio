import type { ChordQuality, VisualNoteVoice } from "../types";
import { clamp } from "../utils/math";

export interface HarmonyProfile {
  openness: number;
  inward: number;
  float: number;
  warp: number;
  crystalline: number;
  layerBonus: number;
  curvature: number;
  instability: number;
  stretch: number;
  directionalPull: number;
  halo: number;
  fluidity: number;
  closure: number;
}

const profiles: Partial<Record<ChordQuality, HarmonyProfile>> = {
  major: profile(
    1.18,
    0.04,
    0.08,
    0.03,
    0.06,
    0,
    0.2,
    0.04,
    1,
    0.04,
    0.16,
    0.86,
  ),
  minor: profile(
    0.63,
    0.88,
    0.14,
    0.13,
    0.05,
    0,
    0.88,
    0.14,
    0.82,
    0.05,
    0.5,
    0.72,
  ),
  diminished: profile(
    0.45,
    0.42,
    0.04,
    1.18,
    0.46,
    0,
    0.32,
    1,
    0.72,
    0.72,
    0.14,
    0.28,
  ),
  augmented: profile(
    1.12,
    0.1,
    0.18,
    0.48,
    1.2,
    0,
    0.12,
    0.5,
    1.42,
    0.3,
    0.28,
    0.48,
  ),
  sus2: profile(
    0.92,
    0.1,
    1.16,
    0.17,
    0.12,
    0,
    0.64,
    0.14,
    1.02,
    0.1,
    0.5,
    0.22,
  ),
  sus4: profile(
    0.86,
    0.14,
    1.05,
    0.21,
    0.14,
    0,
    0.72,
    0.18,
    0.98,
    0.12,
    0.46,
    0.18,
  ),
  major7: profile(
    1.14,
    0.07,
    0.38,
    0.1,
    0.38,
    1,
    0.28,
    0.1,
    1.08,
    0.14,
    1,
    0.68,
  ),
  dominant7: profile(
    0.92,
    0.17,
    0.16,
    0.42,
    0.3,
    1,
    0.38,
    0.46,
    1.02,
    1,
    0.36,
    0.4,
  ),
  minor7: profile(
    0.7,
    0.72,
    0.38,
    0.15,
    0.17,
    1,
    1,
    0.15,
    0.88,
    0.18,
    0.48,
    0.58,
  ),
  minorMajor7: profile(
    0.68,
    0.74,
    0.2,
    0.55,
    0.5,
    1,
    0.78,
    0.58,
    0.95,
    0.58,
    0.72,
    0.42,
  ),
  major6: profile(
    1.04,
    0.07,
    0.2,
    0.07,
    0.18,
    1,
    0.3,
    0.07,
    1.02,
    0.1,
    0.5,
    0.78,
  ),
  minor6: profile(
    0.7,
    0.72,
    0.18,
    0.18,
    0.14,
    1,
    0.82,
    0.18,
    0.86,
    0.2,
    0.38,
    0.62,
  ),
  add9: profile(
    1.06,
    0.05,
    0.54,
    0.09,
    0.28,
    1,
    0.5,
    0.08,
    1.12,
    0.12,
    0.7,
    0.56,
  ),
  major9: profile(
    1.16,
    0.03,
    0.58,
    0.12,
    0.45,
    2,
    0.34,
    0.12,
    1.22,
    0.16,
    1.15,
    0.5,
  ),
  minor9: profile(
    0.74,
    0.68,
    0.54,
    0.2,
    0.32,
    2,
    0.92,
    0.2,
    1.04,
    0.22,
    0.78,
    0.42,
  ),
  power: profile(1, 0.07, 0.06, 0.05, 0.04, 0, 0.08, 0.04, 1, 0.1, 0.08, 0.9),
  collection: profile(
    0.76,
    0.28,
    0.3,
    0.52,
    0.2,
    0,
    0.46,
    0.52,
    0.96,
    0.42,
    0.25,
    0.34,
  ),
  none: profile(
    0.86,
    0.18,
    0.38,
    0.06,
    0.05,
    0,
    0.46,
    0.06,
    1,
    0.06,
    0.18,
    0.55,
  ),
};

function profile(
  openness: number,
  inward: number,
  float: number,
  warp: number,
  crystalline: number,
  layerBonus: number,
  curvature: number,
  instability: number,
  stretch: number,
  directionalPull: number,
  halo: number,
  fluidity: number,
  closure = 0.55,
): HarmonyProfile {
  return {
    openness,
    inward,
    float,
    warp,
    crystalline,
    layerBonus,
    curvature,
    instability,
    stretch,
    directionalPull,
    halo,
    fluidity,
    closure,
  };
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

export function voiceComposition(voices: VisualNoteVoice[]): {
  pitch: number;
  register: number;
  energy: number;
  count: number;
} {
  let weight = 0;
  let pitch = 0;
  let register = 0;
  let count = 0;
  for (const voice of voices) {
    if (voice.phase === "release" && voice.release <= 0.08) continue;
    weight += voice.energy;
    pitch += pitchPosition(voice.note) * voice.energy;
    register += registerPosition(voice.note) * voice.energy;
    count += 1;
  }
  if (!count) return { pitch: 0, register: 0.5, energy: 0, count: 0 };
  return {
    pitch: pitch / Math.max(0.001, weight),
    register: register / Math.max(0.001, weight),
    energy: clamp(weight / Math.sqrt(count), 0, 1.6),
    count,
  };
}
