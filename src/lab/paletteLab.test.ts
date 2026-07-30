import { beforeEach, describe, expect, it } from "vitest";
import {
  loadCustomPalettes,
  saveCustomPalettes,
  transformPalette,
  validatePalette,
} from "./paletteLab";

const palette = {
  id: "custom-night",
  name: "Custom Night",
  colors: ["#336699", "#ffcc88"],
  background: "#05070c",
};

describe("custom palette serialization", () => {
  beforeEach(() => localStorage.clear());

  it("round-trips valid custom palettes through local storage", () => {
    saveCustomPalettes([palette]);
    expect(loadCustomPalettes()).toEqual([palette]);
  });

  it("rejects invalid color stops and unsafe palette sizes", () => {
    expect(validatePalette({ ...palette, colors: ["red"] })).toBeNull();
    expect(
      validatePalette({
        ...palette,
        colors: Array.from({ length: 9 }, () => "#ffffff"),
      }),
    ).toBeNull();
  });

  it("applies deterministic rotation, saturation, brightness, and temperature", () => {
    const first = transformPalette(palette, 30, 120, 90, 20);
    const second = transformPalette(palette, 30, 120, 90, 20);
    expect(first).toEqual(second);
    expect(first.colors).not.toEqual(palette.colors);
    expect(first.background).toMatch(/^#[0-9a-f]{6}$/);
  });
});
