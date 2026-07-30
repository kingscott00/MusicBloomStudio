import { describe, expect, it } from "vitest";
import { experiences } from "../visuals/experiences";
import { defaultParams } from "./presets";
import { createRandomizedParameters } from "./randomizer";

describe("curated visual randomizer", () => {
  it("recreates the same recipe from the same seed", () => {
    const first = createRandomizedParameters(defaultParams, 481516);
    const second = createRandomizedParameters(defaultParams, 481516);

    expect(first).toEqual(second);
    expect(first.recipeSeed).toBe(481516);
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
});
