import { beforeEach, describe, expect, it } from "vitest";
import { experiences } from "../visuals/experiences";
import { defaultParams } from "./presets";
import {
  createRandomizedParameters,
  defaultRandomizerLocks,
  loadRandomizerLocks,
  saveRandomizerLocks,
} from "./randomizer";

describe("curated visual randomizer", () => {
  beforeEach(() => localStorage.clear());
  it("recreates the same recipe from the same seed", () => {
    const first = createRandomizedParameters(defaultParams, 481516);
    const second = createRandomizedParameters(defaultParams, 481516);

    expect(first).toEqual(second);
    expect(first.recipeSeed).toBe(481516);
  });

  it("can include locally created palettes without changing legacy recipes", () => {
    const legacy = createRandomizedParameters(defaultParams, 481516);
    expect(
      createRandomizedParameters(defaultParams, 481516, undefined, []),
    ).toEqual(legacy);
    const discovered = new Set(
      Array.from({ length: 80 }, (_, index) =>
        createRandomizedParameters(
          defaultParams,
          index + 1,
          defaultRandomizerLocks,
          ["custom-starlight"],
        ),
      ).map((params) => params.paletteId),
    );
    expect(discovered.has("custom-starlight")).toBe(true);
  });

  it("keeps comfort and rendering preferences while constraining visual values", () => {
    const current = {
      ...defaultParams,
      reducedMotion: true,
      quality: "low" as const,
    };

    for (let seed = 1; seed <= 250; seed += 1) {
      const result = createRandomizedParameters(current, seed);
      expect(result.reducedMotion).toBe(true);
      expect(result.quality).toBe("low");
      expect(result.density).toBeGreaterThanOrEqual(34);
      expect(result.density).toBeLessThanOrEqual(80);
      expect(result.speed).toBeGreaterThanOrEqual(10);
      expect(result.speed).toBeLessThanOrEqual(68);
      expect(result.glow).toBeGreaterThanOrEqual(38);
      expect(result.glow).toBeLessThanOrEqual(92);
      expect(result.background).toBeLessThanOrEqual(20);
    }
  });

  it("can randomize within the current experience", () => {
    const result = createRandomizedParameters(
      { ...defaultParams, mode: "forest" },
      90125,
      true,
    );

    expect(result.mode).toBe("forest");
  });

  it("makes every experience discoverable across a seed series", () => {
    const discovered = new Set(
      Array.from(
        { length: 500 },
        (_, index) => createRandomizedParameters(defaultParams, index + 1).mode,
      ),
    );

    expect(discovered).toEqual(
      new Set(experiences.map((experience) => experience.id)),
    );
  });

  it("preserves locked properties while randomizing unlocked ones", () => {
    const current = {
      ...defaultParams,
      mode: "metal" as const,
      paletteId: "embers",
      density: 17,
      speed: 23,
      rotation: 31,
      idle: 11,
      autoMotion: false,
      trails: 44,
      glow: 51,
      symmetry: 13,
    };
    const result = createRandomizedParameters(current, 4567, {
      experience: true,
      palette: true,
      density: true,
      motion: true,
      trails: true,
      glow: true,
      symmetry: true,
    });
    expect(result).toMatchObject({
      mode: "metal",
      paletteId: "embers",
      density: 17,
      speed: 23,
      rotation: 31,
      idle: 11,
      autoMotion: false,
      trails: 44,
      glow: 51,
      symmetry: 13,
    });
  });

  it("replays deterministic recipes with the same locks", () => {
    const locks = {
      ...defaultRandomizerLocks,
      experience: true,
      trails: true,
    };
    const current = { ...defaultParams, mode: "portal" as const, trails: 91 };
    expect(createRandomizedParameters(current, 919191, locks)).toEqual(
      createRandomizedParameters(current, 919191, locks),
    );
  });

  it("persists randomizer locks locally", () => {
    const locks = { ...defaultRandomizerLocks, palette: true, motion: true };
    saveRandomizerLocks(locks);
    expect(loadRandomizerLocks()).toEqual(locks);
  });
});
