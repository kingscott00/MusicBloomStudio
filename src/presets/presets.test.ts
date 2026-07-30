import { beforeEach, describe, expect, it } from "vitest";
import {
  builtInPresets,
  defaultParams,
  loadCustomPresets,
  saveCustomPresets,
} from "./presets";
import type { Preset } from "../types";

describe("custom preset persistence", () => {
  beforeEach(() => localStorage.clear());

  it("round-trips custom presets and excludes built-ins", () => {
    const custom: Preset = {
      id: "custom-one",
      name: "My Atmosphere",
      builtIn: false,
      params: defaultParams,
    };
    const builtIn: Preset = {
      id: "built-in",
      name: "Protected",
      builtIn: true,
      params: defaultParams,
    };
    saveCustomPresets([builtIn, custom]);
    expect(loadCustomPresets()).toEqual([custom]);
  });

  it("survives invalid stored JSON", () => {
    localStorage.setItem("music-bloom-custom-presets-v1", "not json");
    expect(loadCustomPresets()).toEqual([]);
  });

  it("includes curated presets for every expanded visual world", () => {
    const modes = new Set(builtInPresets.map((preset) => preset.params.mode));
    expect(modes).toEqual(
      new Set([
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
      ]),
    );
    expect(new Set(builtInPresets.map((preset) => preset.id)).size).toBe(
      builtInPresets.length,
    );
  });
});
