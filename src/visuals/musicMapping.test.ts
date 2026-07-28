import { describe, expect, it } from "vitest";
import {
  harmonyProfile,
  registerPosition,
  velocityCurve,
  voiceComposition,
} from "./musicMapping";
import { detectChord } from "../music/chords";
import { calculateVisualVoices } from "../music/envelopes";
import type { NoteLifecycle } from "../types";

describe("music-to-visual mapping", () => {
  it("gives chord families meaningfully different physical profiles", () => {
    expect(harmonyProfile("major").openness).toBeGreaterThan(
      harmonyProfile("minor").openness,
    );
    expect(harmonyProfile("minor").inward).toBeGreaterThan(
      harmonyProfile("major").inward,
    );
    expect(harmonyProfile("sus4").float).toBeGreaterThan(
      harmonyProfile("major").float,
    );
    expect(harmonyProfile("diminished").warp).toBeGreaterThan(
      harmonyProfile("minor").warp,
    );
    expect(harmonyProfile("major9").layerBonus).toBe(2);
  });

  it("maps register and velocity monotonically", () => {
    expect(registerPosition(36)).toBeLessThan(registerPosition(84));
    expect(velocityCurve(20)).toBeLessThan(velocityCurve(120));
    expect(velocityCurve(1)).toBeGreaterThan(0);
  });

  it("gives B major, minor, and diminished distinct geometry", () => {
    const major = harmonyProfile(detectChord([59, 63, 66]).quality);
    const minor = harmonyProfile(detectChord([59, 62, 66]).quality);
    const diminished = harmonyProfile(detectChord([59, 62, 65]).quality);

    expect(major.openness).toBeGreaterThan(minor.openness);
    expect(minor.curvature).toBeGreaterThan(major.curvature);
    expect(diminished.instability).toBeGreaterThan(minor.instability);
    expect(diminished.stretch).not.toBe(minor.stretch);
  });

  it("separates dominant and major seventh extension behavior", () => {
    const dominant = harmonyProfile(detectChord([59, 63, 66, 69]).quality);
    const majorSeventh = harmonyProfile(detectChord([59, 63, 66, 70]).quality);

    expect(dominant.directionalPull).toBeGreaterThan(
      majorSeventh.directionalPull,
    );
    expect(majorSeventh.halo).toBeGreaterThan(dominant.halo);
  });

  it("builds composition from every sounding chord voice", () => {
    const lifecycles: NoteLifecycle[] = [59, 63, 66].map((note) => ({
      id: String(note),
      note,
      velocity: 96,
      startedAt: 0,
      releasedAt: null,
      physicallyHeld: true,
      sustained: false,
      releasedFromSustain: false,
    }));
    const voices = calculateVisualVoices(lifecycles, 500);
    const composition = voiceComposition(voices);

    expect(voices.map((voice) => voice.note)).toEqual([59, 63, 66]);
    expect(composition.count).toBe(3);
  });
});
